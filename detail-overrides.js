const DETAIL_TINTED_ICON_IMAGES = new Map();
const DETAIL_HIDDEN_ICON_TYPES = new Set();
const DETAIL_ICON_COLORS = {
  WARDENS: "#245682",
  COLONIALS: "#516C4B"
};
const DETAIL_ICON_PAINT_THRESHOLD = 130;
const DETAIL_MAP_WIDTH = 1024;
const DETAIL_MAP_HEIGHT = 888;

openRegion = async function(mapName) {
  state.selectedMap = mapName;

  els.detailPanel.classList.remove("hidden");
  els.detailTitle.textContent = prettyMapName(mapName);
  els.detailSubtitle.textContent = mapName;
  els.detailLoading.style.display = "block";
  els.detailLoading.textContent = "Loading local map and live data…";

  updateDetailStats(state.reports.get(mapName) || {});

  try {
    const tasks = [];

    if (!state.static.has(mapName)) {
      tasks.push(
        apiFetch(`/worldconquest/maps/${encodeURIComponent(mapName)}/static`)
          .then(data => state.static.set(mapName, data))
      );
    }

    tasks.push(
      apiFetch(`/worldconquest/maps/${encodeURIComponent(mapName)}/dynamic/public`)
        .then(data => state.dynamic.set(mapName, data))
    );

    tasks.push(
      apiFetch(`/worldconquest/warReport/${encodeURIComponent(mapName)}`)
        .then(data => {
          state.reports.set(mapName, data);
          updateDetailStats(data);
        })
    );

    tasks.push(
      loadLocalRegionImage(mapName)
        .then(image => {
          state.regionImage = image;
        })
    );

    await Promise.all(tasks);
    await preloadVisibleIcons(mapName);
    refreshDetailIconLayerMenu(mapName);

    els.detailLoading.style.display = "none";
    drawRegion();

    clearInterval(state.regionTimer);
    state.regionTimer = setInterval(refreshSelectedRegion, 15000);
  } catch (error) {
    console.error(error);
    els.detailLoading.textContent = `Could not load ${prettyMapName(mapName)}: ${error.message}`;
  }
};

async function loadLocalRegionImage(mapName) {
  const image = new Image();
  image.src = worldTileImageUrl(mapName);
  await image.decode();
  return image;
}

drawRegion = function() {
  if (!state.selectedMap || !state.regionImage || !els.detailCanvas) {
    return;
  }

  const staticData = state.static.get(state.selectedMap) || {};
  const dynamicData = state.dynamic.get(state.selectedMap) || {};
  const canvas = els.detailCanvas;
  const renderScale = Math.max(1, window.devicePixelRatio || 1);

  canvas.width = Math.round(DETAIL_MAP_WIDTH * renderScale);
  canvas.height = Math.round(DETAIL_MAP_HEIGHT * renderScale);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const image = state.regionImage;
  const mapX = 0;
  const mapY = 0;
  const mapWidth = DETAIL_MAP_WIDTH;
  const mapHeight = DETAIL_MAP_HEIGHT;

  ctx.drawImage(image, mapX, mapY, mapWidth, mapHeight);
  drawDetailVoronoi(
    ctx,
    staticData.mapTextItems || [],
    dynamicData.mapItems || [],
    mapX,
    mapY,
    mapWidth,
    mapHeight
  );

  if (els.showLabels.checked) {
    drawMapLabels(ctx, staticData.mapTextItems || [], mapX, mapY, mapWidth, mapHeight);
  }

  state.markerHitboxes = [];
  const merged = [
    ...(staticData.mapItems || []),
    ...(dynamicData.mapItems || [])
  ];
  const seen = new Set();

  for (const item of merged) {
    const key = `${item.iconType}:${item.x.toFixed(5)}:${item.y.toFixed(5)}:${item.teamId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (DETAIL_HIDDEN_ICON_TYPES.has(item.iconType)) {
      continue;
    }

    const category = ICONS[item.iconType]?.[2] || "structure";
    if (category === "resource" && !els.showResources.checked) {
      continue;
    }
    if (category !== "resource" && !els.showStructures.checked) {
      continue;
    }

    drawMapItem(ctx, item, mapX, mapY, mapWidth, mapHeight);
  }
};

drawMapItem = function(ctx, item, mapX, mapY, mapWidth, mapHeight) {
  const x = mapX + item.x * mapWidth;
  const y = mapY + item.y * mapHeight;
  const image = getPaintedDetailIcon(item.iconType, item.teamId);
  const isVictory = (item.flags & FLAGS.VICTORY_BASE) !== 0;
  const size = isVictory ? 26 : 20;

  ctx.save();
  ctx.translate(x, y);

  if (image) {
    ctx.globalAlpha = item.teamId === "NONE" ? 0.76 : 1;
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    ctx.globalAlpha = 1;
    ctx.font = "600 11px Jost, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeText(String(item.iconType), 0, 0);
    ctx.fillStyle = teamColor(item.teamId);
    ctx.fillText(String(item.iconType), 0, 0);
  }

  ctx.restore();

  const rect = els.detailCanvas.getBoundingClientRect();
  const screenScaleX = rect.width / DETAIL_MAP_WIDTH;
  const screenScaleY = rect.height / DETAIL_MAP_HEIGHT;

  state.markerHitboxes.push({
    x: x * screenScaleX,
    y: y * screenScaleY,
    r: size * 0.72 * Math.max(screenScaleX, screenScaleY),
    item,
    name: ICONS[item.iconType]?.[0] || `Icon ${item.iconType}`
  });
};

function getPaintedDetailIcon(iconType, teamId) {
  const image = state.iconImages.get(iconType);
  const color = DETAIL_ICON_COLORS[teamId];
  if (!image || !color) {
    return image;
  }

  const key = `${iconType}:${teamId}`;
  if (DETAIL_TINTED_ICON_IMAGES.has(key)) {
    return DETAIL_TINTED_ICON_IMAGES.get(key);
  }

  const width = image.width || image.naturalWidth || 1;
  const height = image.height || image.naturalHeight || 1;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);

  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(image, 0, 0, width, height);

  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(image, 0, 0, width, height);

  ctx.globalCompositeOperation = "source-over";
  DETAIL_TINTED_ICON_IMAGES.set(key, canvas);
  return canvas;
}

function getAvailableDetailIconTypes(mapName) {
  const staticData = state.static.get(mapName) || {};
  const dynamicData = state.dynamic.get(mapName) || {};
  const types = new Set();

  for (const item of [
    ...(dynamicData.mapItems || []),
    ...(staticData.mapItems || [])
  ]) {
    if (Number.isFinite(item.iconType)) {
      types.add(item.iconType);
    }
  }

  return [...types].sort((a, b) =>
    detailIconDisplayName(a).localeCompare(detailIconDisplayName(b))
  );
}

function detailIconDisplayName(iconType) {
  const name = ICONS[iconType]?.[0] || `Icon ${iconType}`;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d+)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function detailIconLayerPreview(iconType) {
  const entry = LOCAL_ICON_FILES[iconType];
  if (!entry) {
    return `
      <span class="world-icon-layer-preview">
        <span class="world-icon-layer-enum">${iconType}</span>
      </span>
    `;
  }

  return `
    <span class="world-icon-layer-preview">
      <img
        data-detail-icon-preview
        src="icons/${entry[1]}"
        alt=""
        width="18"
        height="18"
      >
      <span class="world-icon-layer-enum" hidden>${iconType}</span>
    </span>
  `;
}

function refreshDetailIconLayerMenu(mapName = state.selectedMap) {
  const list = document.getElementById("detailIconLayerList");
  if (!list || !mapName) {
    return;
  }

  const availableTypes = getAvailableDetailIconTypes(mapName);
  if (!availableTypes.length) {
    list.innerHTML = '<span class="world-icon-layer-empty">No map icons available.</span>';
    return;
  }

  list.innerHTML = availableTypes.map(iconType => `
    <label>
      <input
        type="checkbox"
        data-detail-icon-type="${iconType}"
        ${DETAIL_HIDDEN_ICON_TYPES.has(iconType) ? "" : "checked"}
      >
      ${detailIconLayerPreview(iconType)}
      <span>${detailIconDisplayName(iconType)}</span>
    </label>
  `).join("");

  list.querySelectorAll("img[data-detail-icon-preview]").forEach(image => {
    const showFallback = () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    };

    if (image.complete && !image.naturalWidth) {
      showFallback();
    } else {
      image.addEventListener("error", showFallback, { once: true });
    }
  });
}

function setupDetailIconLayerMenu() {
  const toolbar = document.querySelector(".detail-toolbar");
  if (!toolbar || document.getElementById("detailIconLayerMenu")) {
    return;
  }

  const menu = document.createElement("details");
  menu.id = "detailIconLayerMenu";
  menu.className = "world-icon-layer-menu detail-icon-layer-menu";
  menu.innerHTML = `
    <summary>Map Icons</summary>
    <div id="detailIconLayerList" class="world-icon-layer-list">
      <span class="world-icon-layer-empty">Open a region to load map icons.</span>
    </div>
  `;

  if (els.detailUpdated) {
    toolbar.insertBefore(menu, els.detailUpdated);
  } else {
    toolbar.appendChild(menu);
  }

  menu.addEventListener("change", event => {
    const input = event.target.closest("input[data-detail-icon-type]");
    if (!input) {
      return;
    }

    const iconType = Number(input.dataset.detailIconType);
    if (input.checked) {
      DETAIL_HIDDEN_ICON_TYPES.delete(iconType);
    } else {
      DETAIL_HIDDEN_ICON_TYPES.add(iconType);
    }

    drawRegion();
  });
}

const baseRefreshSelectedRegionForDetailIconLayers = refreshSelectedRegion;
refreshSelectedRegion = async function() {
  await baseRefreshSelectedRegionForDetailIconLayers();
  if (state.selectedMap) {
    refreshDetailIconLayerMenu(state.selectedMap);
  }
};

document.addEventListener("DOMContentLoaded", setupDetailIconLayerMenu);
