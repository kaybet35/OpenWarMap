renderReportTable = function() {
  const rows = state.maps.map(name => ({
    name,
    displayName: prettyMapName(name),
    report: state.reports.get(name) || {}
  }));

  rows.sort(compareReportRows);

  els.reportTableBody.innerHTML = rows.map(item => `
    <tr class="report-region-row" data-map-name="${item.name}" tabindex="0">
      <td>
        <span class="report-region-name">
          <img class="region-thumb report-thumb" src="${regionThumbnailUrl(item.name)}" alt="" width="40" height="30">
          <span>${item.displayName}</span>
        </span>
      </td>
      <td>${item.report.dayOfWar ?? "—"}</td>
      <td>${formatNumber(item.report.totalEnlistments || 0)}</td>
      <td class="warden-text">${formatNumber(item.report.wardenCasualties || 0)}</td>
      <td class="colonial-text">${formatNumber(item.report.colonialCasualties || 0)}</td>
      <td>${formatNumber(totalCasualties(item.report))}</td>
    </tr>
  `).join("");

  updateReportTotals();
  updateReportSortHeaders();
};

drawDetailVoronoi = function(ctx, labels, mapItems, mapX, mapY, mapWidth, mapHeight) {
  const showSubregions = document.getElementById("showSubregions")?.checked !== false;
  const showFrontline = document.getElementById("showFrontline")?.checked === true;
  const sites = labels
    .filter(label =>
      label.mapMarkerType === "Major" &&
      Number.isFinite(label.x) &&
      Number.isFinite(label.y)
    )
    .map(label => ({
      x: mapX + label.x * mapWidth,
      y: mapY + label.y * mapHeight
    }));

  if (sites.length < 2) {
    return;
  }

  const hexPolygon = DETAIL_HEX_POINTS.map(point => ({
    x: mapX + point.x * mapWidth,
    y: mapY + point.y * mapHeight
  }));
  const bases = mapItems
    .filter(item =>
      WORLD_BASE_ICON_TYPES.has(item.iconType) &&
      DETAIL_OWNER_COLORS[item.teamId] &&
      Number.isFinite(item.x) &&
      Number.isFinite(item.y)
    )
    .map(item => ({
      x: mapX + item.x * mapWidth,
      y: mapY + item.y * mapHeight,
      teamId: item.teamId
    }));
  const segments = new Map();

  for (let i = 0; i < sites.length; i++) {
    let cell = hexPolygon.map(point => ({ ...point }));

    for (let j = 0; j < sites.length && cell.length; j++) {
      if (i === j) {
        continue;
      }
      cell = clipPolygonToVoronoiHalfPlane(cell, sites[i], sites[j]);
    }

    if (cell.length < 3) {
      continue;
    }

    const owner = getVoronoiCellOwner(cell, sites[i], bases);
    if (showSubregions) {
      fillDetailVoronoiCell(ctx, cell, owner);
    }
    collectDetailVoronoiSegments(cell, segments, owner);
  }

  if (showSubregions) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = DETAIL_VORONOI_BORDER_WIDTH;
    ctx.strokeStyle = DETAIL_VORONOI_BORDER_COLOR;
    ctx.beginPath();

    for (const segment of segments.values()) {
      if (segment.count < 2) {
        continue;
      }
      ctx.moveTo(segment.a.x, segment.a.y);
      ctx.lineTo(segment.b.x, segment.b.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  if (showFrontline) {
    drawDetailFrontlines(ctx, segments);
  }
};

function setupReportRegionLinks() {
  if (!els.reportTableBody) {
    return;
  }

  const openRow = row => {
    if (row?.dataset.mapName) {
      openRegion(row.dataset.mapName);
    }
  };

  els.reportTableBody.addEventListener("click", event => {
    openRow(event.target.closest("tr[data-map-name]"));
  });

  els.reportTableBody.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const row = event.target.closest("tr[data-map-name]");
    if (row) {
      event.preventDefault();
      openRow(row);
    }
  });
}

function setupDetailLayerControls() {
  const subregions = document.getElementById("showSubregions");
  const frontline = document.getElementById("showFrontline");

  if (subregions) {
    subregions.checked = true;
    subregions.addEventListener("change", drawRegion);
  }

  if (frontline) {
    frontline.checked = false;
    frontline.addEventListener("change", drawRegion);
  }
}

function applyMapLayerDefaults() {
  if (window.WORLD_OVERVIEW_LAYERS) {
    window.WORLD_OVERVIEW_LAYERS.regionNames = false;
  }

  const regionNames = document.querySelector('[data-world-layer="regionNames"]');
  if (regionNames) {
    regionNames.checked = false;
  }

  const locations = document.getElementById("showLabels");
  if (locations) {
    locations.checked = false;
  }

  drawWorld();
  drawRegion();
}

const interactionStyle = document.createElement("style");
interactionStyle.textContent = `
  .report-region-row {
    cursor: pointer;
  }

  .report-region-row:focus-visible {
    outline: 1px solid #65798c;
    outline-offset: -1px;
  }
`;
document.head.appendChild(interactionStyle);

document.addEventListener("DOMContentLoaded", () => {
  setupReportRegionLinks();
  setupDetailLayerControls();
  applyMapLayerDefaults();
});
