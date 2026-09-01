const SHARDS = {
  "1": "https://war-service-live.foxholeservices.com/api",
  "2": "https://war-service-live-2.foxholeservices.com/api",
  "3": "https://war-service-live-3.foxholeservices.com/api",
  "dev": "https://war-service-dev.foxholeservices.com/api"
};

const FLAGS = {
  VICTORY_BASE: 0x01,
  BUILD_SITE: 0x04,
  SCORCHED: 0x10,
  TOWN_CLAIMED: 0x20
};

const ICONS = {};

const state = {
  shard: "1",
  maps: [],
  war: null,
  reports: new Map(),
  dynamic: new Map(),
  static: new Map(),
  selectedMap: null,
  worldImage: null,
  regionImage: null,
  iconImages: new Map(),
  markerHitboxes: [],
  regionTimer: null
};

const els = {};

let openRegion;
let drawWorld;
let drawRegion;
let drawMapItem;
let drawMapLabels;
let preloadVisibleIcons;
let loadWorldImage;

document.addEventListener("DOMContentLoaded", init);

function init() {
  [
    "shardSelect", "refreshButton", "connectionStatus", "warNumber", "warPhase",
    "warDuration", "wardenVp", "colonialVp", "wardenCasualties", "colonialCasualties",
    "lastRefresh", "worldCanvas", "worldLoading", "detailPanel", "closeDetail",
    "detailTitle", "detailSubtitle", "detailTotalCas", "detailWardenCas",
    "detailColonialCas", "detailEnlistments", "detailUpdated", "detailCanvas",
    "detailLoading", "showLabels", "showResources", "showStructures", "showNeutral",
    "mapTooltip"
  ].forEach(id => els[id] = document.getElementById(id));

  els.shardSelect.addEventListener("change", async () => {
    state.shard = els.shardSelect.value;
    resetState();
    await refreshAll();
  });

  els.refreshButton.addEventListener("click", refreshAll);
  els.closeDetail.addEventListener("click", closeRegion);

  [els.showLabels, els.showResources, els.showStructures, els.showNeutral]
    .forEach(input => input.addEventListener("change", drawRegion));

  window.addEventListener("resize", () => {
    drawWorld();
    drawRegion();
  });

  els.detailCanvas.addEventListener("mousemove", handleMapPointer);
  els.detailCanvas.addEventListener("mouseleave", () => els.mapTooltip.classList.add("hidden"));

  loadWorldImage();
  refreshAll();
  window.setInterval(refreshOverviewData, 60000);
}

function apiBase() {
  return SHARDS[state.shard];
}

async function apiFetch(path) {
  const response = await fetch(`${apiBase()}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function refreshAll() {
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
}

async function refreshOverviewData() {
  if (!state.maps.length) {
    return;
  }

  try {
    state.war = await apiFetch("/worldconquest/war");

    const reportEntries = await mapWithConcurrency(state.maps, 6, async mapName => {
      try {
        return [mapName, await apiFetch(`/worldconquest/warReport/${encodeURIComponent(mapName)}`)];
      } catch {
        return [mapName, null];
      }
    });

    reportEntries.forEach(([name, report]) => {
      if (report) {
        state.reports.set(name, report);
      }
    });

    const dynamicEntries = await mapWithConcurrency(state.maps, 6, async mapName => {
      try {
        return [mapName, await apiFetch(`/worldconquest/maps/${encodeURIComponent(mapName)}/dynamic/public`)];
      } catch {
        return [mapName, null];
      }
    });

    dynamicEntries.forEach(([name, data]) => {
      if (data) {
        state.dynamic.set(name, data);
      }
    });

    updateSummary();
    els.lastRefresh.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    setStatus("online", "Live");
  } catch (error) {
    console.error(error);
    setStatus("error", "Partial/API error");
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const result = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) {
        break;
      }
      result[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return result;
}

function updateSummary() {
  const war = state.war || {};
  let wardenVp = 0;
  let colonialVp = 0;
  let scorched = 0;
  let wardenCas = 0;
  let colonialCas = 0;

  for (const data of state.dynamic.values()) {
    for (const item of data.mapItems || []) {
      if ((item.flags & FLAGS.VICTORY_BASE) !== 0) {
        if (item.teamId === "WARDENS") wardenVp++;
        if (item.teamId === "COLONIALS") colonialVp++;
        if ((item.flags & FLAGS.SCORCHED) !== 0) scorched++;
      }
    }
  }

  for (const report of state.reports.values()) {
    wardenCas += report.wardenCasualties || 0;
    colonialCas += report.colonialCasualties || 0;
  }

  const required = Math.max(0, (war.requiredVictoryTowns || 0) - scorched);
  const requiredDisplay = required || "—";

  els.warNumber.textContent = war.warNumber ? `#${war.warNumber}` : "—";
  els.wardenVp.textContent = `${wardenVp} / ${requiredDisplay}`;
  els.colonialVp.textContent = `${colonialVp} / ${requiredDisplay}`;
  els.wardenCasualties.textContent = `${formatNumber(wardenCas)} casualties`;
  els.colonialCasualties.textContent = `${formatNumber(colonialCas)} casualties`;

  if (war.conquestEndTime) {
    els.warPhase.textContent = `Ended ${new Date(war.conquestEndTime).toLocaleString()}`;
  } else if (war.resistanceStartTime) {
    els.warPhase.textContent = "Resistance";
  } else {
    els.warPhase.textContent = "World Conquest";
  }

  if (war.conquestStartTime) {
    const elapsed = Date.now() - war.conquestStartTime;
    const days = Math.floor(elapsed / 86400000);
    const hours = Math.floor((elapsed % 86400000) / 3600000);
    els.warDuration.textContent = `${days}d ${hours}h elapsed`;
  } else {
    els.warDuration.textContent = "Awaiting conquest";
  }
}

function closeRegion() {
  state.selectedMap = null;
  state.regionImage = null;
  state.markerHitboxes = [];
  clearInterval(state.regionTimer);
  state.regionTimer = null;

  if (els.detailPanel) {
    els.detailPanel.classList.add("hidden");
  }
}

async function refreshSelectedRegion() {
  if (!state.selectedMap) {
    return;
  }

  const mapName = state.selectedMap;

  try {
    const [dynamic, report] = await Promise.all([
      apiFetch(`/worldconquest/maps/${encodeURIComponent(mapName)}/dynamic/public`),
      apiFetch(`/worldconquest/warReport/${encodeURIComponent(mapName)}`)
    ]);

    state.dynamic.set(mapName, dynamic);
    state.reports.set(mapName, report);
    updateDetailStats(report);
    await preloadVisibleIcons(mapName);
    drawRegion();
    els.detailUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    console.warn("Selected region refresh failed", error);
  }
}

function updateDetailStats(report) {
  const warden = report.wardenCasualties || 0;
  const colonial = report.colonialCasualties || 0;
  const total = warden + colonial;
  const wardenPercent = total ? warden / total * 100 : 0;
  const colonialPercent = total ? colonial / total * 100 : 0;
  const war = state.war || {};
  const startTime = Number(war.conquestStartTime || 0);
  const endTime = Number(war.conquestEndTime || Date.now());
  const elapsedHours = startTime && endTime > startTime
    ? (endTime - startTime) / 3600000
    : 0;
  const hourlyCasualties = elapsedHours ? total / elapsedHours : 0;

  els.detailWardenCas.textContent = `${formatNumber(warden)} (${wardenPercent.toFixed(1)}%)`;
  els.detailColonialCas.textContent = `${formatNumber(colonial)} (${colonialPercent.toFixed(1)}%)`;
  els.detailTotalCas.textContent = `${formatNumber(total)} (${elapsedHours ? `${formatNumber(Math.round(hourlyCasualties))}/hr` : "—/hr"})`;
  els.detailEnlistments.textContent = formatNumber(report.totalEnlistments || 0);
}

function handleMapPointer(event) {
  if (!state.markerHitboxes.length) {
    els.mapTooltip.classList.add("hidden");
    return;
  }

  const canvasRect = els.detailCanvas.getBoundingClientRect();
  const viewportRect = els.detailCanvas.parentElement.getBoundingClientRect();
  const x = event.clientX - canvasRect.left;
  const y = event.clientY - canvasRect.top;

  const hit = [...state.markerHitboxes]
    .reverse()
    .find(marker => Math.hypot(x - marker.x, y - marker.y) <= marker.r);

  if (!hit) {
    els.mapTooltip.classList.add("hidden");
    return;
  }

  const flags = [];
  if ((hit.item.flags & FLAGS.VICTORY_BASE) !== 0) flags.push("Victory Base");
  if ((hit.item.flags & FLAGS.BUILD_SITE) !== 0) flags.push("Build Site");
  if ((hit.item.flags & FLAGS.SCORCHED) !== 0) flags.push("Scorched");
  if ((hit.item.flags & FLAGS.TOWN_CLAIMED) !== 0) flags.push("Town Claimed");

  els.mapTooltip.innerHTML = `
    <strong>${hit.name}</strong><br>
    <span style="color:${teamColor(hit.item.teamId)}">${prettyTeam(hit.item.teamId)}</span>
    ${flags.length ? `<br><span class="muted">${flags.join(" · ")}</span>` : ""}
  `;

  els.mapTooltip.classList.remove("hidden");
  els.mapTooltip.style.left = `${event.clientX - viewportRect.left + 14}px`;
  els.mapTooltip.style.top = `${event.clientY - viewportRect.top + 14}px`;
}

function prettyMapName(mapName) {
  const aliases = {
    DeadLandsHex: "Deadlands",
    MooringCountyHex: "The Moors",
    LinnMercyHex: "The Linn of Mercy",
    OarbreakerHex: "Oarbreaker Isles",
    FishermansRowHex: "Fisherman's Row",
    CallahansPassageHex: "Callahan's Passage",
    CallumsCapeHex: "Callum's Cape",
    KingsCageHex: "King's Cage",
    AllodsBightHex: "Allod's Bight",
    LochMorHex: "Loch Mór"
  };

  if (aliases[mapName]) {
    return aliases[mapName];
  }

  return mapName
    .replace(/Hex$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
}

function teamColor(team) {
  if (team === "WARDENS") return "#6f9bd0";
  if (team === "COLONIALS") return "#739d6f";
  return "#aaa99f";
}

function prettyTeam(team) {
  if (team === "WARDENS") return "Wardens";
  if (team === "COLONIALS") return "Colonials";
  return "Neutral";
}

function totalCasualties(report) {
  return (report.wardenCasualties || 0) + (report.colonialCasualties || 0);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function setStatus(type, text) {
  els.connectionStatus.className = `status-pill is-${type}`;
  els.connectionStatus.textContent = text;
}

function resetState() {
  state.maps = [];
  state.war = null;
  state.reports.clear();
  state.dynamic.clear();
  state.static.clear();
  closeRegion();
}
