const WORLD_COORD_WIDTH = 10242;
const WORLD_COORD_HEIGHT = 6218;
const WORLD_TILE_CENTER_X = 512;
const WORLD_TILE_CENTER_Y = 444;
const WORLD_TILE_STEP_X = 768;
const WORLD_TILE_STEP_Y = 444;
const WORLD_TILE_HALF_WIDTH = 514;
const WORLD_TILE_SHOULDER_X = 256;
const WORLD_TILE_HALF_HEIGHT = 446;

const WORLD_HEX_LAYOUT = [
  ["Olavi's Wake", "OlavisWakeHex", 0, 4],
  ["Pari Peak", "PariPeakHex", 1, 3],
  ["Palantine Berm", "PalantineBermHex", 1, 5],
  ["The Oarbreaker Isles", "OarbreakerHex", 1, 7],
  ["Kuura Strand", "KuuraStrandHex", 2, 2],
  ["The Gutter", "GutterHex", 2, 4],
  ["Fisherman's Row", "FishermansRowHex", 2, 6],
  ["Stema Landing", "StemaLandingHex", 2, 8],
  ["Nevish Line", "NevishLineHex", 3, 3],
  ["Farranac Coast", "FarranacCoastHex", 3, 5],
  ["Westgate", "WestgateHex", 3, 7],
  ["Origin", "OriginHex", 3, 9],
  ["Callum's Cape", "CallumsCapeHex", 4, 2],
  ["Stonecradle", "StonecradleHex", 4, 4],
  ["King's Cage", "KingsCageHex", 4, 6],
  ["Sableport", "SableportHex", 4, 8],
  ["Ash Fields", "AshFieldsHex", 4, 10],
  ["Speaking Woods", "SpeakingWoodsHex", 5, 1],
  ["The Moors", "MooringCountyHex", 5, 3],
  ["The Linn of Mercy", "LinnMercyHex", 5, 5],
  ["Loch Mór", "LochMorHex", 5, 7],
  ["The Heartlands", "HeartlandsHex", 5, 9],
  ["Red River", "RedRiverHex", 5, 11],
  ["Basin Sionnach", "BasinSionnachHex", 6, 0],
  ["Reaching Trail", "ReachingTrailHex", 6, 2],
  ["Callahan's Passage", "CallahansPassageHex", 6, 4],
  ["Deadlands", "DeadLandsHex", 6, 6],
  ["Umbral Wildwood", "UmbralWildwoodHex", 6, 8],
  ["Great March", "GreatMarchHex", 6, 10],
  ["Kalokai", "KalokaiHex", 6, 12],
  ["Howl County", "HowlCountyHex", 7, 1],
  ["Viper Pit", "ViperPitHex", 7, 3],
  ["Marban Hollow", "MarbanHollow", 7, 5],
  ["The Drowned Vale", "DrownedValeHex", 7, 7],
  ["Shackled Chasm", "ShackledChasmHex", 7, 9],
  ["Acrithia", "AcrithiaHex", 7, 11],
  ["Clanshead Valley", "ClansheadValleyHex", 8, 2],
  ["Weathered Expanse", "WeatheredExpanseHex", 8, 4],
  ["The Clahstra", "ClahstraHex", 8, 6],
  ["Allod's Bight", "AllodsBightHex", 8, 8],
  ["Terminus", "TerminusHex", 8, 10],
  ["Morgen's Crossing", "MorgensCrossingHex", 9, 3],
  ["Stlican Shelf", "StlicanShelfHex", 9, 5],
  ["Endless Shore", "EndlessShoreHex", 9, 7],
  ["Reaver's Pass", "ReaversPassHex", 9, 9],
  ["Godcrofts", "GodcroftsHex", 10, 4],
  ["Tempest Island", "TempestIslandHex", 10, 6],
  ["Wresta", "WrestaHex", 10, 8],
  ["Ónyx", "OnyxHex", 10, 10],
  ["Lykos Isle", "LykosIsleHex", 11, 5],
  ["The Fingers", "TheFingersHex", 11, 7],
  ["Tyrant Foothills", "TyrantFoothillsHex", 11, 9],
  ["Piper's Enclave", "PipersEnclaveHex", 12, 8]
].map(([name, mapName, tileX, tileY]) => createWorldTile(name, mapName, tileX, tileY));

function createWorldTile(name, mapName, tileX, tileY) {
  const centerX = WORLD_TILE_CENTER_X + tileX * WORLD_TILE_STEP_X;
  const centerY = WORLD_TILE_CENTER_Y + tileY * WORLD_TILE_STEP_Y;
  const points = [
    centerX - WORLD_TILE_HALF_WIDTH, centerY,
    centerX - WORLD_TILE_SHOULDER_X, centerY - WORLD_TILE_HALF_HEIGHT,
    centerX + WORLD_TILE_SHOULDER_X, centerY - WORLD_TILE_HALF_HEIGHT,
    centerX + WORLD_TILE_HALF_WIDTH, centerY,
    centerX + WORLD_TILE_SHOULDER_X, centerY + WORLD_TILE_HALF_HEIGHT,
    centerX - WORLD_TILE_SHOULDER_X, centerY + WORLD_TILE_HALF_HEIGHT
  ];

  return {
    name,
    mapName,
    tileX,
    tileY,
    centerX,
    centerY,
    points,
    bounds: {
      x: centerX - WORLD_TILE_HALF_WIDTH,
      y: centerY - WORLD_TILE_HALF_HEIGHT,
      width: WORLD_TILE_HALF_WIDTH * 2,
      height: WORLD_TILE_HALF_HEIGHT * 2
    }
  };
}

function resolveWorldMapName(displayName) {
  return WORLD_HEX_LAYOUT.find(entry => entry.name === displayName)?.mapName || null;
}

function normalizeWorldName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pointInWorldPolygon(x, y, points) {
  let inside = false;

  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    const xi = points[i];
    const yi = points[i + 1];
    const xj = points[j];
    const yj = points[j + 1];
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

function findWorldHexAt(x, y) {
  return (state.worldHexHitboxes || []).find(hit =>
    pointInWorldPolygon(x, y, hit.screenPoints)
  ) || null;
}

document.addEventListener("DOMContentLoaded", () => {
  const viewport = els.worldCanvas?.parentElement;
  if (!viewport) {
    return;
  }

  const tooltip = document.createElement("div");
  tooltip.className = "map-tooltip hidden";
  viewport.appendChild(tooltip);
  els.worldCanvas.style.cursor = "pointer";

  els.worldCanvas.addEventListener("mousemove", event => {
    const rect = els.worldCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = findWorldHexAt(x, y);

    if (!hit) {
      tooltip.classList.add("hidden");
      return;
    }

    const report = hit.mapName ? state.reports.get(hit.mapName) : null;
    tooltip.innerHTML = `<strong>${hit.name}</strong>${report ? `<br><span class="warden-text">W ${formatNumber(report.wardenCasualties || 0)}</span> · <span class="colonial-text">C ${formatNumber(report.colonialCasualties || 0)}</span>` : ""}`;
    tooltip.classList.remove("hidden");
    tooltip.style.left = `${Math.min(x + 14, rect.width - 220)}px`;
    tooltip.style.top = `${Math.min(y + 14, rect.height - 70)}px`;
  });

  els.worldCanvas.addEventListener("mouseleave", () => tooltip.classList.add("hidden"));

  els.worldCanvas.addEventListener("click", event => {
    const rect = els.worldCanvas.getBoundingClientRect();
    const hit = findWorldHexAt(event.clientX - rect.left, event.clientY - rect.top);
    if (hit?.mapName && state.maps.includes(hit.mapName)) {
      openRegion(hit.mapName);
    }
  });
});