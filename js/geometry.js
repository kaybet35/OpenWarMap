/* Geometry is built only when major locations change; ownership is cached separately. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  function contains(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) &&
          point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function clip(polygon, site, other) {
    const nx = 2 * (other.x - site.x), ny = 2 * (other.y - site.y);
    const c = other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2;
    const output = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const da = nx * a.x + ny * a.y - c, db = nx * b.x + ny * b.y - c;
      const ina = da <= 1e-7, inb = db <= 1e-7;
      if (ina !== inb) {
        const t = da / (da - db);
        output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
      if (inb) output.push(b);
    }
    return output;
  }
  function bounds(points) {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const p of points) {
      left = Math.min(left, p.x); right = Math.max(right, p.x);
      top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
    }
    return { left, top, right, bottom };
  }
  const nearBounds = (p, b, margin = 0) => p.x >= b.left - margin && p.x <= b.right + margin &&
    p.y >= b.top - margin && p.y <= b.bottom + margin;
  const edgeKey = (a, b) => {
    const first = a.x.toFixed(3) + "," + a.y.toFixed(3);
    const second = b.x.toFixed(3) + "," + b.y.toFixed(3);
    return first < second ? first + "|" + second : second + "|" + first;
  };
  function geometry(region, tile) {
    const labels = region.labels.filter(label => label.mapMarkerType === "Major");
    const key = labels.map(p => p.x + "," + p.y).join(";");
    if (!region.geometry || key !== region.geometryKey) {
      const seen = new Set(), sites = [];
      for (const label of labels) {
        const siteKey = label.x.toFixed(6) + "," + label.y.toFixed(6);
        if (seen.has(siteKey)) continue;
        seen.add(siteKey);
        sites.push({ x: tile.bounds.x + label.x * tile.bounds.width,
          y: tile.bounds.y + label.y * tile.bounds.height });
      }
      const cells = [], edges = new Map();
      if (sites.length >= 2) for (let i = 0; i < sites.length; i++) {
        let polygon = tile.polygon;
        for (let j = 0; j < sites.length && polygon.length; j++) {
          if (i !== j) polygon = clip(polygon, sites[i], sites[j]);
        }
        if (polygon.length < 3) continue;
        const cell = { site: sites[i], polygon, bounds: bounds(polygon), owner: null };
        cells.push(cell);
        for (let k = 0; k < polygon.length; k++) {
          const a = polygon[k], b = polygon[(k + 1) % polygon.length];
          if (distance2(a, b) < 1e-10) continue;
          const id = edgeKey(a, b);
          if (!edges.has(id)) edges.set(id, { a, b, cells: [] });
          edges.get(id).cells.push(cell);
        }
      }
      region.geometry = { cells, edges: [...edges.values()] };
      region.geometryKey = key;
      region.ownerKey = null;
    }
    const ownerKey = region.bases.map(base => base.x + "," + base.y + "," + base.teamId).join(";");
    if (ownerKey !== region.ownerKey) {
      const bases = region.bases.filter(base => app.config.ownerColors[base.teamId]).map(base => ({
        x: tile.bounds.x + base.x * tile.bounds.width,
        y: tile.bounds.y + base.y * tile.bounds.height, team: base.teamId
      }));
      for (const cell of region.geometry.cells) {
        cell.owner = null;
        let nearest = Infinity;
        for (const base of bases) {
          const distance = distance2(base, cell.site);
          if (distance < nearest && nearBounds(base, cell.bounds) && contains(base, cell.polygon)) {
            nearest = distance;
            cell.owner = base.team;
          }
        }
      }
      region.ownerKey = ownerKey;
    }
    return region.geometry;
  }
  function segmentDistance2(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/length)) : 0;
    return (p.x - a.x - t*dx) ** 2 + (p.y - a.y - t*dy) ** 2;
  }
  function nearCell(p, cell) {
    if (!nearBounds(p, cell.bounds, 4.5)) return false;
    if (contains(p, cell.polygon)) return true;
    return cell.polygon.some((a, i, polygon) =>
      segmentDistance2(p, a, polygon[(i+1) % polygon.length]) <= 4.5 ** 2);
  }
  const opposing = edge => edge.cells.some(cell => cell.owner === "WARDENS") &&
    edge.cells.some(cell => cell.owner === "COLONIALS");
  let cachedKey = "", cachedFront = [];
  function worldFrontlines(entries) {
    const key = entries.map(({ tile, region }) =>
      tile.mapName + ":" + region.geometryKey + ":" + region.ownerKey).join("|");
    if (key === cachedKey) return cachedFront;
    const output = new Map();
    const add = (a, b) => output.set(edgeKey(a,b), { a, b });
    for (const entry of entries) {
      // Only adjacent tiles can contribute a cross-region frontline.
      const neighbors = entries.filter(other => other !== entry &&
        Math.abs(other.tile.x - entry.tile.x) <= 1030 &&
        Math.abs(other.tile.y - entry.tile.y) <= 894);
      for (const edge of entry.geometry.edges) {
        if (edge.cells.length > 1) {
          if (opposing(edge)) add(edge.a, edge.b);
          continue;
        }
        const owner = edge.cells[0].owner;
        if (!owner) continue;
        const candidates = neighbors.flatMap(other => other.geometry.cells.filter(cell => cell.owner && cell.owner !== owner));
        if (!candidates.length) continue;
        const steps = Math.max(1, Math.ceil(Math.sqrt(distance2(edge.a, edge.b)) / 32));
        const point = t => ({ x: edge.a.x + (edge.b.x-edge.a.x)*t, y: edge.a.y+(edge.b.y-edge.a.y)*t });
        for (let i = 0; i < steps; i++) {
          const middle = point((i + 0.5) / steps);
          if (candidates.some(cell => nearCell(middle, cell))) add(point(i/steps), point((i+1)/steps));
        }
      }
    }
    cachedKey = key;
    cachedFront = [...output.values()];
    return cachedFront;
  }
  app.geometry = { contains, clip, get: geometry, worldFrontlines, opposing };
})();
