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

    .map-layer-controls > .muted {
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
      width: max-content;
      max-width: calc(100% - 24px);
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
      min-width: 0;
      text-align: right;
    }

    .world-war-stats small {
      color: var(--muted);
      font-size: 9px;
      line-height: 1;
      text-transform: uppercase;
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
      .world-war-stats {
        position: static;
        top: auto;
        right: auto;
        bottom: auto;
        width: 100%;
        max-width: none;
      }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", setupWorldLayerControls);

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
