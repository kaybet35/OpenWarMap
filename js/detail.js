/* Detail drawing uses screen coordinates and a single layout read per frame. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  app.drawDetail = () => {
    if (!app.selected) return;
    const canvas = app.ui.detailCanvas;
    const rect = canvas.parentElement.getBoundingClientRect();
    const scale = Math.min(rect.width / 1024, rect.height / 888);
    if (!(scale > 0)) return;
    const width = 1024 * scale, height = 888 * scale;
    // Explicit CSS dimensions decouple intrinsic backing size from flex layout.
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    const ctx = app.render.size(canvas, width, height);
    app.detailHits = [];
    if (app.detailImage) ctx.drawImage(app.detailImage, 0, 0, width, height);
    const region = app.regions.get(app.selected);
    if (!region) return;
    const tile = app.layout.byName.get(app.selected);
    if (tile && (app.ui.showSubregions.checked || app.ui.showFrontline.checked)) {
      const project = p => ({ x: (p.x-tile.bounds.x)/tile.bounds.width*width,
        y: (p.y-tile.bounds.y)/tile.bounds.height*height });
      app.render.territories(ctx, app.geometry.get(region,tile), project,
        app.ui.showSubregions.checked, app.ui.showFrontline.checked, 2*scale);
    }
    if (app.ui.showLabels.checked) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.strokeStyle = "rgb(192,181,149)"; ctx.fillStyle = "rgb(71,87,85)"; ctx.lineWidth = 0.5;
      for (const label of region.labels) {
        ctx.font = "400 " + ((label.mapMarkerType === "Major" ? 18.5 : 12.5)*scale) + "px system-ui, sans-serif";
        ctx.strokeText(label.text, label.x*width, label.y*height);
        ctx.fillText(label.text, label.x*width, label.y*height);
      }
    }
    for (const item of region.items) {
      if (app.hiddenIcons.has(item.iconType)) continue;
      const resource = app.config.resourceTypes.has(item.iconType);
      if (!(resource ? app.ui.showResources.checked : app.ui.showStructures.checked)) continue;
      if (item.teamId === "NONE" && !app.ui.showNeutral.checked) continue;
      const x = item.x*width, y = item.y*height, size = (item.flags & 1 ? 26 : 20)*scale;
      app.render.marker(ctx,item,x,y,size);
      app.detailHits.push({ x,y,r:Math.max(6,size*0.72),item });
    }
  };
  app.updateDetail = error => {
    if (!app.selected) return;
    const region = app.regions.get(app.selected), report = region?.report;
    const warden = report?.wardenCasualties || 0, colonial = report?.colonialCasualties || 0;
    const total = warden+colonial;
    app.text("detailWardenCas", report ? app.number(warden)+" ("+app.percent(warden,total)+")" : "—");
    app.text("detailColonialCas", report ? app.number(colonial)+" ("+app.percent(colonial,total)+")" : "—");
    app.text("detailTotalCas", report ? app.number(total)+" ("+app.hourly(total)+")" : "—");
    app.text("detailEnlistments", report ? app.number(report.totalEnlistments)+"": "—");
    app.text("detailUpdated", error || (region?.updated ? "Updated "+new Date(region.updated).toLocaleTimeString() : "Awaiting live data"));
  };
})();
