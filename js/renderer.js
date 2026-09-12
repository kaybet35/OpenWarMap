/* One invalidation-driven renderer, with a viewport-sized terrain cache. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  let frame = 0, worldDirty = true, detailDirty = true, terrainKey = "";
  const terrain = document.createElement("canvas");
  const metrics = { worldFrames: 0, detailFrames: 0, terrainBuilds: 0 };
  function request(view) {
    if (view !== "detail") worldDirty = true;
    if (view !== "world") detailDirty = true;
    if (!frame && !document.hidden) frame = requestAnimationFrame(flush);
  }
  function flush() {
    frame = 0;
    if (document.hidden) return;
    if (app.selected) {
      if (detailDirty) { detailDirty = false; app.drawDetail(); metrics.detailFrames++; }
    } else if (worldDirty) { worldDirty = false; drawWorld(); metrics.worldFrames++; }
  }
  function size(canvas, width, height) {
    // Cap both density and total pixels. DPR 3/4 phones do not need 4x map buffers.
    const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4000000 / Math.max(1,width*height)));
    const w = Math.max(1, Math.round(width * ratio)), h = Math.max(1, Math.round(height * ratio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(w / width, 0, 0, h / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return ctx;
  }
  function polygon(ctx, points, project) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = project(points[i]);
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
  }
  function lines(ctx, edges, project, color, width) {
    ctx.beginPath();
    for (const edge of edges) {
      const a = project(edge.a), b = project(edge.b);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function territories(ctx, geometry, project, fill, frontline, borderWidth = 1) {
    if (fill) {
      for (const cell of geometry.cells) {
        const color = app.config.ownerColors[cell.owner];
        if (!color) continue;
        polygon(ctx, cell.polygon, project);
        ctx.fillStyle = color;
        ctx.fill();
      }
      lines(ctx, geometry.edges.filter(edge => edge.cells.length > 1), project, "rgba(140,125,107,0.349)", borderWidth);
    }
    if (frontline) lines(ctx, geometry.edges.filter(app.geometry.opposing), project, "rgba(220,62,62,0.95)", 0.7*borderWidth);
  }
  function marker(ctx, item, x, y, size) {
    const image = app.assets.icon(item.iconType, item.teamId);
    if (image) {
      ctx.globalAlpha = item.teamId === "NONE" ? 0.76 : 1;
      ctx.drawImage(image, x-size/2, y-size/2, size, size);
      ctx.globalAlpha = 1;
    } else {
      ctx.font = "600 " + (size*0.5) + "px system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = size*2/9; ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(String(item.iconType), x, y);
      ctx.fillStyle = app.config.colors[item.teamId] || app.config.colors.NONE;
      ctx.fillText(String(item.iconType), x, y);
    }
  }
  function drawWorld() {
    const canvas = app.ui.worldCanvas, rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ctx = size(canvas, rect.width, rect.height);
    const view = app.camera.view('world', rect.width, rect.height);
    const { scale, offsetX, offsetY } = view;
    const symbolScale = scale * app.layout.width / 1280;
    const project = p => ({ x: offsetX+p.x*scale, y: offsetY+p.y*scale });
    app.worldView = view;
    const visible = app.layout.tiles.filter(tile => {
      const p = project(tile.bounds), margin = 30 * symbolScale;
      return p.x <= rect.width + margin && p.y <= rect.height + margin &&
        p.x + tile.bounds.width*scale >= -margin && p.y + tile.bounds.height*scale >= -margin;
    });
    app.assets.prepareWorld?.(visible, 1028 * scale * canvas.width / rect.width);
    const key = [canvas.width, canvas.height, rect.width, rect.height, scale, offsetX, offsetY, app.assets.revision].join(':');
    if (key !== terrainKey) {
      terrain.width = canvas.width; terrain.height = canvas.height;
      const tc = terrain.getContext("2d");
      tc.setTransform(canvas.width/rect.width, 0, 0, canvas.height/rect.height, 0, 0);
      for (const tile of visible) {
        const image = app.assets.terrain?.(tile.mapName) || app.assets.tiles.get(tile.mapName);
        if (!image) continue;
        tc.save();
        polygon(tc, tile.polygon, project);
        tc.clip();
        const p = project(tile.bounds);
        tc.drawImage(image, p.x, p.y, tile.bounds.width*scale, tile.bounds.height*scale);
        tc.restore();
      }
      terrainKey = key;
      metrics.terrainBuilds++;
    }
    ctx.drawImage(terrain, 0, 0, rect.width, rect.height);
    let maxCasualties = 0;
    if (app.layers.casualtyHeatmap) for (const region of app.regions.values()) maxCasualties = Math.max(maxCasualties, app.casualties(region.report));
    const entries = [];
    if (app.layers.territoryOwnership || app.layers.frontline) for (const tile of app.layout.tiles) {
      const region = app.regions.get(tile.mapName);
      if (region) entries.push({ tile, region, geometry: app.geometry.get(region, tile) });
    }
    for (const tile of visible) {
      const region = app.regions.get(tile.mapName);
      if (maxCasualties && region) {
        const count = app.casualties(region.report);
        if (count) {
          polygon(ctx, tile.polygon, project);
          ctx.fillStyle = "rgba(220,42,42," + (0.08+Math.sqrt(count/maxCasualties)*0.42) + ")";
          ctx.fill();
        }
      }
      if (region && (app.layers.territoryOwnership || app.layers.frontline)) {
        const geometry = app.geometry.get(region, tile);
        territories(ctx, geometry, project, app.layers.territoryOwnership, false, symbolScale);
      }
      polygon(ctx, tile.polygon, project);
      ctx.strokeStyle = "rgba(140,125,107,0.349)"; ctx.lineWidth = symbolScale; ctx.stroke();
    }
    if (app.layers.frontline) lines(ctx, app.geometry.worldFrontlines(entries), project, "rgba(220,62,62,0.95)", 1.4*symbolScale);
    for (const tile of visible) {
      const region = app.regions.get(tile.mapName);
      if (!region) continue;
      for (const item of region.items) {
        const victory = !!(item.flags & 1), base = app.config.baseTypes.has(item.iconType);
        const p = project({ x: tile.bounds.x+item.x*tile.bounds.width, y: tile.bounds.y+item.y*tile.bounds.height });
        if (victory || base) {
          if (!(victory ? app.layers.victoryBases : app.layers.otherBases)) continue;
          if (!app.layers.simplifiedMode) {
            marker(ctx,item,p.x,p.y,(victory ? 12 : 9)*symbolScale);
            continue;
          }
          ctx.beginPath(); ctx.arc(p.x,p.y,(victory?4.5:2.5)*symbolScale,0,Math.PI*2);
          ctx.fillStyle = app.config.colors[item.teamId] || app.config.colors.NONE; ctx.fill();
          ctx.strokeStyle = item.flags & 16 ? "#d7ae58" : "rgba(8,10,13,0.9)";
          ctx.lineWidth = (victory?1.5:0.9)*symbolScale; ctx.stroke();
        } else if (app.worldIcons.has(item.iconType)) marker(ctx,item,p.x,p.y,9*symbolScale);
      }
    }
    // Location text uses the same cached WarAPI labels as the regional view.
    // Draw above all icons, with region names retaining the highest priority.
    if (app.layers.majorLocations || app.layers.minorLocations) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineWidth = 0.1*symbolScale;
      ctx.strokeStyle = "rgb(192,181,149)"; ctx.fillStyle = "rgb(71,87,85)";
      for (const tile of visible) {
        const region = app.regions.get(tile.mapName);
        for (const label of region?.labels || []) {
          const major = label.mapMarkerType === "Major";
          if (major ? !app.layers.majorLocations : label.mapMarkerType !== "Minor" || !app.layers.minorLocations) continue;
          const p = project({ x: tile.bounds.x + label.x*tile.bounds.width,
            y: tile.bounds.y + label.y*tile.bounds.height });
          ctx.font = "400 " + ((major ? 2.25 : 1.5)*symbolScale) + "px Jost, system-ui, sans-serif";
          ctx.strokeText(label.text,p.x,p.y); ctx.fillText(label.text,p.x,p.y);
        }
      }
    }
    // Labels are the final pass, above markers from every region.
    for (const tile of visible) {
      if (app.layers.regionNames) {
        const p = project(tile);
        ctx.font = "400 " + (12.5*symbolScale) + "px Jost, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 0.5*symbolScale; ctx.strokeStyle = "rgb(192,181,149)"; ctx.fillStyle = "rgb(71,87,85)";
        ctx.strokeText(tile.name,p.x,p.y); ctx.fillText(tile.name,p.x,p.y);
      }
    }
  }
  app.render = { request, size, polygon, lines, territories, marker, metrics,
    releaseDetail() {
      app.ui.detailCanvas.width = 1; app.ui.detailCanvas.height = 1;
      app.detailHits = [];
    }
  };
})();
