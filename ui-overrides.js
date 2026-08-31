const reportSortState = {
  key: "casualties",
  direction: "desc"
};

refreshAll = async function() {
  setStatus("loading", "Refreshing…");

  try {
    const [war, maps] = await Promise.all([
      apiFetch("/worldconquest/war"),
      apiFetch("/worldconquest/maps")
    ]);

    state.war = war;
    state.maps = maps.filter(name => !/^HomeRegion[CW]$/i.test(name));
    await refreshOverviewData();
    setStatus("online", "Live");
  } catch (error) {
    console.error(error);
    setStatus("error", "API error");
  }
};

const baseUpdateSummaryForWorldStats = updateSummary;
updateSummary = function() {
  baseUpdateSummaryForWorldStats();

  const war = state.war || {};
  let wardenVp = 0;
  let colonialVp = 0;
  let scorched = 0;
  let wardenCasualties = 0;
  let colonialCasualties = 0;

  for (const data of state.dynamic.values()) {
    for (const item of data.mapItems || []) {
      if ((item.flags & FLAGS.VICTORY_BASE) === 0) {
        continue;
      }
      if (item.teamId === "WARDENS") {
        wardenVp++;
      } else if (item.teamId === "COLONIALS") {
        colonialVp++;
      }
      if ((item.flags & FLAGS.SCORCHED) !== 0) {
        scorched++;
      }
    }
  }

  for (const report of state.reports.values()) {
    wardenCasualties += report.wardenCasualties || 0;
    colonialCasualties += report.colonialCasualties || 0;
  }

  const required = Math.max(0, (war.requiredVictoryTowns || 0) - scorched);
  const totalCasualtiesValue = wardenCasualties + colonialCasualties;
  const wardenVpPercent = required ? wardenVp / required * 100 : 0;
  const colonialVpPercent = required ? colonialVp / required * 100 : 0;
  const wardenCasualtyPercent = totalCasualtiesValue
    ? wardenCasualties / totalCasualtiesValue * 100
    : 0;
  const colonialCasualtyPercent = totalCasualtiesValue
    ? colonialCasualties / totalCasualtiesValue * 100
    : 0;

  const startTime = Number(war.conquestStartTime || 0);
  const endTime = Number(war.conquestEndTime || Date.now());
  const elapsedHours = startTime && endTime > startTime
    ? (endTime - startTime) / 3600000
    : 0;
  const hourlyCasualties = elapsedHours
    ? totalCasualtiesValue / elapsedHours
    : 0;

  els.wardenVp.textContent = `${wardenVp} / ${required || "—"} (${formatPercent(wardenVpPercent)})`;
  els.colonialVp.textContent = `${colonialVp} / ${required || "—"} (${formatPercent(colonialVpPercent)})`;
  els.wardenCasualties.textContent = `${formatNumber(wardenCasualties)} (${formatPercent(wardenCasualtyPercent)})`;
  els.colonialCasualties.textContent = `${formatNumber(colonialCasualties)} (${formatPercent(colonialCasualtyPercent)})`;

  const total = document.getElementById("totalCasualtiesSummary");
  if (total) {
    total.textContent = `${formatNumber(totalCasualtiesValue)} (${elapsedHours ? `${formatNumber(Math.round(hourlyCasualties))}/hr` : "—/hr"})`;
  }
};

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

renderReportTable = function() {
  const rows = state.maps.map(name => ({
    name,
    displayName: prettyMapName(name),
    report: state.reports.get(name) || {}
  }));

  rows.sort(compareReportRows);

  els.reportTableBody.innerHTML = rows.map(item => `
    <tr>
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

function compareReportRows(a, b) {
  const direction = reportSortState.direction === "asc" ? 1 : -1;
  let result = 0;

  switch (reportSortState.key) {
    case "region":
      result = a.displayName.localeCompare(b.displayName);
      break;
    case "day":
      result = (a.report.dayOfWar || 0) - (b.report.dayOfWar || 0);
      break;
    case "enlistments":
      result = (a.report.totalEnlistments || 0) - (b.report.totalEnlistments || 0);
      break;
    case "warden":
      result = (a.report.wardenCasualties || 0) - (b.report.wardenCasualties || 0);
      break;
    case "colonial":
      result = (a.report.colonialCasualties || 0) - (b.report.colonialCasualties || 0);
      break;
    default:
      result = totalCasualties(a.report) - totalCasualties(b.report);
      break;
  }

  return result * direction;
}

function updateReportTotals() {
  const totalsRow = document.getElementById("reportTableTotals");
  if (!totalsRow) {
    return;
  }

  let maxDay = 0;
  let totalEnlistments = 0;
  let totalWardenCasualties = 0;
  let totalColonialCasualties = 0;

  for (const mapName of state.maps) {
    const report = state.reports.get(mapName) || {};
    maxDay = Math.max(maxDay, report.dayOfWar || 0);
    totalEnlistments += report.totalEnlistments || 0;
    totalWardenCasualties += report.wardenCasualties || 0;
    totalColonialCasualties += report.colonialCasualties || 0;
  }

  totalsRow.innerHTML = `
    <th>Total (${state.maps.length} regions)</th>
    <th>${maxDay || "—"}</th>
    <th>${formatNumber(totalEnlistments)}</th>
    <th class="warden-text">${formatNumber(totalWardenCasualties)}</th>
    <th class="colonial-text">${formatNumber(totalColonialCasualties)}</th>
    <th>${formatNumber(totalWardenCasualties + totalColonialCasualties)}</th>
  `;
}

function setupReportSorting() {
  const headers = document.querySelectorAll(".table-panel thead th");
  const keys = ["region", "day", "enlistments", "warden", "colonial", "casualties"];

  headers.forEach((header, index) => {
    header.dataset.sortKey = keys[index];
    header.classList.add("sortable-header");
    header.tabIndex = 0;
    header.setAttribute("role", "button");

    const activate = () => {
      const key = header.dataset.sortKey;
      if (reportSortState.key === key) {
        reportSortState.direction = reportSortState.direction === "asc" ? "desc" : "asc";
      } else {
        reportSortState.key = key;
        reportSortState.direction = key === "region" ? "asc" : "desc";
      }
      renderReportTable();
    };

    header.addEventListener("click", activate);
    header.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });

  updateReportSortHeaders();
}

function updateReportSortHeaders() {
  document.querySelectorAll(".table-panel thead th").forEach(header => {
    header.classList.toggle("is-sorted", header.dataset.sortKey === reportSortState.key);
    header.dataset.sortDirection = header.dataset.sortKey === reportSortState.key
      ? reportSortState.direction
      : "";
  });
}

function regionThumbnailUrl(mapName) {
  return worldTileImageUrl(mapName);
}

function setupReportCollapse() {
  const button = document.getElementById("reportTableToggle");
  const tableWrap = document.getElementById("reportTableWrap");
  if (!button || !tableWrap) {
    return;
  }

  const setExpanded = expanded => {
    tableWrap.hidden = !expanded;
    button.setAttribute("aria-expanded", String(expanded));
    button.textContent = expanded ? "Hide table" : "Show table";
  };

  setExpanded(false);
  button.addEventListener("click", () => {
    setExpanded(button.getAttribute("aria-expanded") !== "true");
  });
}

function setupWorldLayerControls() {
  const controls = document.getElementById("worldLayerControls");
  if (!controls) {
    return;
  }

  controls.querySelectorAll("input[data-world-layer]").forEach(input => {
    const key = input.dataset.worldLayer;
    input.checked = key === "casualtyHeatmap"
      ? window.WORLD_OVERVIEW_LAYERS[key] === true
      : window.WORLD_OVERVIEW_LAYERS[key] !== false;

    input.addEventListener("change", () => {
      window.WORLD_OVERVIEW_LAYERS[key] = input.checked;
      drawWorld();
    });
  });

  const style = document.createElement("style");
  style.textContent = `
    .topbar-war-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      color: var(--muted);
    }

    .topbar-war-info > span {
      display: grid;
      gap: 1px;
      text-align: center;
    }

    .topbar-war-info small,
    .world-war-stats small {
      color: var(--muted);
      font-size: 9px;
      line-height: 1;
      text-transform: uppercase;
    }

    .topbar-war-info strong {
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      line-height: 1.15;
    }

    .topbar-war-duration {
      min-width: 92px;
    }

    .map-layer-controls {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 6;
      display: flex;
      min-height: 0;
      flex-direction: column;
      align-items: stretch;
      gap: 7px;
      box-sizing: border-box;
      padding: 9px 11px;
      border: 1px solid rgba(60, 72, 84, 0.9);
      border-radius: 6px;
      background: rgba(12, 16, 20, 0.9);
      color: #b6c0ca;
      font-size: 12px;
      backdrop-filter: blur(6px);
    }

    .map-layer-controls label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
    }

    .map-layer-controls input {
      margin: 0;
    }

    .detail-toolbar .muted {
      margin-top: 2px;
      padding-top: 6px;
      border-top: 1px solid rgba(60, 72, 84, 0.72);
      font-size: 10px;
      white-space: nowrap;
    }

    .world-war-stats {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 5;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      padding: 9px 11px;
      border: 1px solid rgba(60, 72, 84, 0.72);
      border-radius: 6px;
      background: rgba(12, 16, 20, 0.78);
      backdrop-filter: blur(5px);
      pointer-events: none;
    }

    .world-war-stats > span {
      display: grid;
      gap: 2px;
      min-width: 190px;
      text-align: right;
    }

    .world-war-stats strong {
      color: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.1;
      white-space: nowrap;
    }

    .world-war-stats > span:last-child {
      color: var(--text);
    }

    @media (max-width: 900px) {
      .topbar-war-info {
        order: 3;
        width: 100%;
      }

      .world-war-stats {
        top: auto;
        right: 12px;
        bottom: 12px;
      }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", () => {
  setupReportSorting();
  setupReportCollapse();
  setupWorldLayerControls();
});

if (document.fonts?.load) {
  Promise.all([
    document.fonts.load("400 12px Jost"),
    document.fonts.load("500 12px Jost"),
    document.fonts.load("600 12px Jost"),
    document.fonts.load("700 12px Jost")
  ]).then(() => {
    drawWorld();
    drawRegion();
  }).catch(() => {});
}
