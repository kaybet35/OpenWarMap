const WORLD_BORDER_COLOR = "rgba(140, 125, 107, 0.349)";
const WORLD_BORDER_WIDTH = 1;
const WORLD_FRONTLINE_COLOR = "rgba(220, 62, 62, 0.95)";
const WORLD_FRONTLINE_WIDTH = 1.4;
const VORONOI_BASE_ICON_TYPES = new Set([45, 46, 47, 56, 57, 58]);
const VORONOI_OWNER_COLORS = {
  WARDENS: "rgba(111, 155, 208, 0.2)",
  COLONIALS: "rgba(115, 157, 111, 0.2)"
};

window.WORLD_OVERVIEW_LAYERS = {
  regionNames: false,
  victoryBases: true,
  otherBases: true,
  casualtyHeatmap: false,
  territoryOwnership: true,
  frontline: true,
  ...(window.WORLD_OVERVIEW_LAYERS || {})
};

const baseRefreshOverviewDataForVoronoi = refreshOverviewData;
refreshOverviewData = async function() {
  await baseRefreshOverviewDataForVoronoi();
  await loadWorldStaticData();
  drawWorld();
};

const baseDrawWorldForOverlay = drawWorld;
drawWorld = function() {
  baseDrawWorldForOverlay();
  drawWorldHexOverlay();
};

async function loadWorldStaticData() {
  const missingMaps = state.maps.filter(mapName =>
    !state.static.has(mapName)
  );

  if (!missingMaps.length) {
    return;
  }

  const entries = await mapWithConcurrency(missingMaps, 6, async mapName => {
    try {
      return [
        mapName,
        await apiFetch(`/worldconquest/maps/${encodeURIComponent(mapName)}/static`)
      ];
    } catch {
      return [mapName, null];
    }
  });

  for (const [mapName, data] of entries) {
    if (data) {
      state.static.set(mapName, data);
    }
  }
}

function drawWorldHexOverlay() {
  if (!state.worldImage || !els.worldCanvas) {
    return;
  }

  const canvas = els.worldCanvas;
  const rect = canvas.getBoundingClientRect();
  const ctx = canvas.getContext("2d");
  const scale = Math.min(rect.width / WORLD_COORD_WIDTH, rect.height / WORLD_COORD_HEIGHT);
  const width = WORLD_COORD_WIDTH * scale;
  const height = WORLD_COORD_HEIGHT * scale;
  const offsetX = (rect.width - width) / 2;
  const offsetY = (rect.height - height) / 2;

  if (window.WORLD_OVERVIEW_LAYERS.casualtyHeatmap) {
    drawWorldCasualtyHeatmap(ctx, scale, offsetX, offsetY);
  }

  const frontlineSegments = drawWorldVoronoi(ctx, scale, offsetX, offsetY);

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = WORLD_BORDER_WIDTH;
  ctx.strokeStyle = WORLD_BORDER_COLOR;

  for (const entry of WORLD_HEX_LAYOUT) {
    drawWorldPolygon(ctx, entry.points, scale, offsetX, offsetY);
  }

  ctx.restore();

  if (window.WORLD_OVERVIEW_LAYERS.frontline) {
    drawWorldFrontlines(ctx, frontlineSegments, scale, offsetX, offsetY);
  }

  if (window.WORLD_OVERVIEW_LAYERS.regionNames) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "400 11.5px Jost, sans-serif";
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "rgb(192, 181, 149)";
    ctx.fillStyle = "rgb(71, 87, 85)";

    for (const entry of WORLD_HEX_LAYOUT) {
      const center = polygonCenter(entry.points);
      const x = offsetX + center.x * scale;
      const y = offsetY + center.y * scale;
      ctx.strokeText(entry.name, x, y);
      ctx.fillText(entry.name, x, y);
    }

    ctx.restore();
  }

  drawWorldVictoryBases(ctx, scale, offsetX, offsetY);
}

function drawWorldCasualtyHeatmap(ctx, scale, offsetX, offsetY) {
  let maxCasualties = 0;

  for (const entry of WORLD_HEX_LAYOUT) {
    const report = state.reports.get(entry.mapName) || {};
    maxCasualties = Math.max(maxCasualties, totalCasualties(report));
  }

  if (!maxCasualties) {
    return;
  }

  ctx.save();

  for (const entry of WORLD_HEX_LAYOUT) {
    const report = state.reports.get(entry.mapName) || {};
    const casualties = totalCasualties(report);
    if (!casualties) {
      continue;
    }

    const ratio = Math.min(1, casualties / maxCasualties);
    const intensity = Math.sqrt(ratio);
    const alpha = 0.08 + intensity * 0.42;

    ctx.beginPath();
    ctx.moveTo(
      offsetX + entry.points[0] * scale,
      offsetY + entry.points[1] * scale
    );
    for (let i = 2; i < entry.points.length; i += 2) {
      ctx.lineTo(
        offsetX + entry.points[i] * scale,
        offsetY + entry.points[i + 1] * scale
      );
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(220, 42, 42, ${alpha.toFixed(3)})`;
    ctx.fill();
  }

  ctx.restore();
}

function drawWorldPolygon(ctx, points, scale, offsetX, offsetY) {
  ctx.beginPath();
  ctx.moveTo(offsetX + points[0] * scale, offsetY + points[1] * scale);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(offsetX + points[i] * scale, offsetY + points[i + 1] * scale);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawWorldVoronoi(ctx, scale, offsetX, offsetY) {
  const segments = new Map();
  const cells = [];

  for (const entry of WORLD_HEX_LAYOUT) {
    const mapName = entry.mapName;
    const sites = getMajorMarkerSites(entry, mapName);
    if (sites.length < 2) {
      continue;
    }

    const hexPolygon = pointsToPolygon(entry.points);
    const ownedBases = getOwnedVoronoiBases(entry, mapName);

    for (let i = 0; i < sites.length; i++) {
      let cell = hexPolygon.map(point => ({ ...point }));

      for (let j = 0; j < sites.length && cell.length; j++) {
        if (i === j) {
          continue;
        }
        cell = clipPolygonToVoronoiHalfPlane(cell, sites[i], sites[j]);
      }

      if (!cell.length) {
        continue;
      }

      const owner = getVoronoiCellOwner(cell, sites[i], ownedBases);
      if (window.WORLD_OVERVIEW_LAYERS.territoryOwnership) {
        fillVoronoiCell(ctx, cell, owner, scale, offsetX, offsetY);
      }

      cells.push({
        polygon: cell,
        owner,
        mapName
      });
      collectVoronoiSegments(cell, segments, owner, mapName);
    }
  }

  if (window.WORLD_OVERVIEW_LAYERS.territoryOwnership) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = WORLD_BORDER_WIDTH;
    ctx.strokeStyle = WORLD_BORDER_COLOR;
    ctx.beginPath();

    for (const segment of segments.values()) {
      if (segment.count < 2) {
        continue;
      }

      ctx.moveTo(
        offsetX + segment.a.x * scale,
        offsetY + segment.a.y * scale
      );
      ctx.lineTo(
        offsetX + segment.b.x * scale,
        offsetY + segment.b.y * scale
      );
    }

    ctx.stroke();
    ctx.restore();
  }

  return buildWorldFrontlineSegments(segments, cells);
}

function getMajorMarkerSites(entry, mapName) {
  const staticData = state.static.get(mapName);
  const labels = staticData?.mapTextItems || [];
  const bounds = getWorldHexBounds(entry);
  const sites = [];
  const seen = new Set();

  for (const label of labels) {
    if (label.mapMarkerType !== "Major") {
      continue;
    }
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) {
      continue;
    }

    const x = bounds.minX + label.x * bounds.width;
    const y = bounds.minY + label.y * bounds.height;
    const key = `${x.toFixed(5)}:${y.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sites.push({ x, y });
  }

  return sites;
}

function getOwnedVoronoiBases(entry, mapName) {
  const dynamicData = state.dynamic.get(mapName);
  const bounds = getWorldHexBounds(entry);
  const bases = [];

  for (const item of dynamicData?.mapItems || []) {
    if (!VORONOI_BASE_ICON_TYPES.has(item.iconType)) {
      continue;
    }
    if (!VORONOI_OWNER_COLORS[item.teamId]) {
      continue;
    }
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) {
      continue;
    }

    bases.push({
      x: bounds.minX + item.x * bounds.width,
      y: bounds.minY + item.y * bounds.height,
      teamId: item.teamId,
      iconType: item.iconType
    });
  }

  return bases;
}

function getWorldHexBounds(entry) {
  if (entry.bounds) {
    return {
      minX: entry.bounds.x,
      minY: entry.bounds.y,
      width: entry.bounds.width,
      height: entry.bounds.height
    };
  }

  const xs = entry.points.filter((_, index) => index % 2 === 0);
  const ys = entry.points.filter((_, index) => index % 2 === 1);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function getVoronoiCellOwner(cell, site, bases) {
  const candidates = bases.filter(base => pointInPolygonObject(base, cell));
  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) =>
    squaredDistance(a, site) - squaredDistance(b, site)
  );

  return candidates[0].teamId;
}

function fillVoronoiCell(ctx, cell, owner, scale, offsetX, offsetY) {
  const fillStyle = VORONOI_OWNER_COLORS[owner];
  if (!fillStyle || cell.length < 3) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    offsetX + cell[0].x * scale,
    offsetY + cell[0].y * scale
  );

  for (let i = 1; i < cell.length; i++) {
    ctx.lineTo(
      offsetX + cell[i].x * scale,
      offsetY + cell[i].y * scale
    );
  }

  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function squaredDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pointInPolygonObject(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      (point.x < (b.x - a.x) * (point.y - a.y) /
        ((b.y - a.y) || Number.EPSILON) + a.x);
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointsToPolygon(points) {
  const polygon = [];
  for (let i = 0; i < points.length; i += 2) {
    polygon.push({ x: points[i], y: points[i + 1] });
  }
  return polygon;
}

function clipPolygonToVoronoiHalfPlane(polygon, site, otherSite) {
  if (!polygon.length) {
    return polygon;
  }

  const nx = 2 * (otherSite.x - site.x);
  const ny = 2 * (otherSite.y - site.y);
  const c = otherSite.x * otherSite.x + otherSite.y * otherSite.y -
    site.x * site.x - site.y * site.y;
  const result = [];
  const epsilon = 1e-7;

  for (let i = 0; i < polygon.length; i++) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    const startDistance = nx * start.x + ny * start.y - c;
    const endDistance = nx * end.x + ny * end.y - c;
    const startInside = startDistance <= epsilon;
    const endInside = endDistance <= epsilon;

    if (startInside && endInside) {
      result.push({ ...end });
      continue;
    }

    if (startInside !== endInside) {
      const denominator = startDistance - endDistance;
      const t = Math.abs(denominator) < epsilon ? 0 : startDistance / denominator;
      result.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      });
    }

    if (!startInside && endInside) {
      result.push({ ...end });
    }
  }

  return result;
}

function collectVoronoiSegments(cell, segments, owner, mapName) {
  if (cell.length < 2) {
    return;
  }

  for (let i = 0; i < cell.length; i++) {
    const a = cell[i];
    const b = cell[(i + 1) % cell.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-5) {
      continue;
    }

    const key = voronoiSegmentKey(a, b);
    const existing = segments.get(key);
    if (existing) {
      existing.count++;
      if (owner) {
        existing.owners.add(owner);
      }
      existing.mapNames.add(mapName);
    } else {
      segments.set(key, {
        a: { ...a },
        b: { ...b },
        count: 1,
        owners: new Set(owner ? [owner] : []),
        mapNames: new Set([mapName]),
        owner,
        mapName
      });
    }
  }
}

function buildWorldFrontlineSegments(segments, cells) {
  const frontlines = new Map();

  for (const segment of segments.values()) {
    if (segment.count >= 2) {
      if (segment.owners.has("WARDENS") && segment.owners.has("COLONIALS")) {
        addFrontlineSegment(frontlines, segment.a, segment.b);
      }
      continue;
    }

    if (!isFactionOwner(segment.owner)) {
      continue;
    }

    const length = Math.hypot(
      segment.b.x - segment.a.x,
      segment.b.y - segment.a.y
    );
    const steps = Math.max(1, Math.ceil(length / 32));

    for (let i = 0; i < steps; i++) {
      const t1 = i / steps;
      const t2 = (i + 1) / steps;
      const a = interpolatePoint(segment.a, segment.b, t1);
      const b = interpolatePoint(segment.a, segment.b, t2);
      const midpoint = interpolatePoint(a, b, 0.5);

      if (hasOpposingTerritoryNear(
        midpoint,
        segment.owner,
        segment.mapName,
        cells
      )) {
        addFrontlineSegment(frontlines, a, b);
      }
    }
  }

  return [...frontlines.values()];
}

function hasOpposingTerritoryNear(point, owner, mapName, cells) {
  for (const cell of cells) {
    if (cell.mapName === mapName || !isFactionOwner(cell.owner) || cell.owner === owner) {
      continue;
    }
    if (pointInPolygonObject(point, cell.polygon)) {
      return true;
    }
    if (distancePointToPolygon(point, cell.polygon) <= 4.5) {
      return true;
    }
  }

  return false;
}

function distancePointToPolygon(point, polygon) {
  let minimum = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    minimum = Math.min(minimum, distancePointToSegment(point, a, b));
  }

  return minimum;
}

function distancePointToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
  ));
  const x = a.x + t * dx;
  const y = a.y + t * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function interpolatePoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  };
}

function isFactionOwner(owner) {
  return owner === "WARDENS" || owner === "COLONIALS";
}

function addFrontlineSegment(frontlines, a, b) {
  const key = voronoiSegmentKey(a, b);
  if (!frontlines.has(key)) {
    frontlines.set(key, {
      a: { ...a },
      b: { ...b }
    });
  }
}

function drawWorldFrontlines(ctx, segments, scale, offsetX, offsetY) {
  if (!segments.length) {
    return;
  }

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = WORLD_FRONTLINE_WIDTH;
  ctx.strokeStyle = WORLD_FRONTLINE_COLOR;
  ctx.beginPath();

  for (const segment of segments) {
    ctx.moveTo(
      offsetX + segment.a.x * scale,
      offsetY + segment.a.y * scale
    );
    ctx.lineTo(
      offsetX + segment.b.x * scale,
      offsetY + segment.b.y * scale
    );
  }

  ctx.stroke();
  ctx.restore();
}

function voronoiSegmentKey(a, b) {
  const first = `${a.x.toFixed(4)},${a.y.toFixed(4)}`;
  const second = `${b.x.toFixed(4)},${b.y.toFixed(4)}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function polygonCenter(points) {
  let x = 0;
  let y = 0;
  const count = points.length / 2;

  for (let i = 0; i < points.length; i += 2) {
    x += points[i];
    y += points[i + 1];
  }

  return { x: x / count, y: y / count };
}
