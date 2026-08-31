const WORLD_SELECTED_ICON_TYPES = new Set();
const WORLD_ICON_SIZE = 9;

const baseRefreshOverviewDataForIconLayers = refreshOverviewData;
refreshOverviewData = async function() {
  await baseRefreshOverviewDataForIconLayers();
  refreshWorldIconLayerMenu();
  await preloadSelectedWorldIcons();
  drawWorld();
};

const baseDrawWorldForIconLayers = drawWorld;
drawWorld = function() {
  baseDrawWorldForIconLayers();
  drawSelectedWorldIcons();
};

function isExistingWorldBaseLayerItem(item) {
  return (item.flags & FLAGS.VICTORY_BASE) !== 0 ||
    WORLD_BASE_ICON_TYPES.has(item.iconType);
}

function getWorldIconLayerItems(mapName) {
  const staticData = state.static.get(mapName) || {};
  const dynamicData = state.dynamic.get(mapName) || {};
  const merged = [
    ...(dynamicData.mapItems || []),
    ...(staticData.mapItems || [])
  ];
  const seen = new Set();
  const items = [];

  for (const item of merged) {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) {
      continue;
    }

    const key = `${item.iconType}:${item.x.toFixed(5)}:${item.y.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    if (isExistingWorldBaseLayerItem(item)) {
      continue;
    }

    items.push(item);
  }

  return items;
}

function getAvailableWorldIconTypes() {
  const types = new Set();

  for (const mapName of state.maps) {
    for (const item of getWorldIconLayerItems(mapName)) {
      types.add(item.iconType);
    }
  }

  return [...types].sort((a, b) =>
    worldIconDisplayName(a).localeCompare(worldIconDisplayName(b))
  );
}

function worldIconDisplayName(iconType) {
  const name = ICONS[iconType]?.[0] || `Icon ${iconType}`;
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d+)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function worldIconLayerPreview(iconType) {
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
        data-world-icon-preview
        src="icons/${entry[1]}"
        alt=""
        width="18"
        height="18"
      >
      <span class="world-icon-layer-enum" hidden>${iconType}</span>
    </span>
  `;
}

function refreshWorldIconLayerMenu() {
  const list = document.getElementById("worldIconLayerList");
  if (!list) {
    return;
  }

  const availableTypes = getAvailableWorldIconTypes();
  const availableSet = new Set(availableTypes);

  for (const iconType of [...WORLD_SELECTED_ICON_TYPES]) {
    if (!availableSet.has(iconType)) {
      WORLD_SELECTED_ICON_TYPES.delete(iconType);
    }
  }

  if (!availableTypes.length) {
    list.innerHTML = '<span class="world-icon-layer-empty">No additional map icons available.</span>';
    return;
  }

  list.innerHTML = availableTypes.map(iconType => `
    <label>
      <input
        type="checkbox"
        data-world-icon-type="${iconType}"
        ${WORLD_SELECTED_ICON_TYPES.has(iconType) ? "checked" : ""}
      >
      ${worldIconLayerPreview(iconType)}
      <span>${worldIconDisplayName(iconType)}</span>
    </label>
  `).join("");

  list.querySelectorAll("img[data-world-icon-preview]").forEach(image => {
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

async function preloadSelectedWorldIcons() {
  await Promise.all([...WORLD_SELECTED_ICON_TYPES].map(loadWorldIconType));
}

async function loadWorldIconType(iconType) {
  if (state.iconImages.has(iconType)) {
    return;
  }

  const entry = LOCAL_ICON_FILES[iconType];
  if (!entry) {
    state.iconImages.set(iconType, null);
    return;
  }

  try {
    const image = new Image();
    image.src = `icons/${entry[1]}`;
    await image.decode();
    state.iconImages.set(iconType, image);
  } catch (error) {
    console.warn(`Could not load local world map icon ${iconType}: ${entry[1]}`, error);
    state.iconImages.set(iconType, null);
  }
}

function drawSelectedWorldIcons() {
  if (!WORLD_SELECTED_ICON_TYPES.size || !els.worldCanvas) {
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

  for (const entry of WORLD_HEX_LAYOUT) {
    if (!state.maps.includes(entry.mapName)) {
      continue;
    }

    for (const item of getWorldIconLayerItems(entry.mapName)) {
      if (!WORLD_SELECTED_ICON_TYPES.has(item.iconType)) {
        continue;
      }

      const x = offsetX + (entry.bounds.x + item.x * entry.bounds.width) * scale;
      const y = offsetY + (entry.bounds.y + item.y * entry.bounds.height) * scale;
      drawWorldLayerIcon(ctx, item, x, y);
    }
  }
}

function drawWorldLayerIcon(ctx, item, x, y) {
  const image = typeof getPaintedDetailIcon === "function"
    ? getPaintedDetailIcon(item.iconType, item.teamId)
    : state.iconImages.get(item.iconType);

  ctx.save();
  ctx.translate(x, y);

  if (image) {
    ctx.globalAlpha = item.teamId === "NONE" ? 0.82 : 1;
    ctx.drawImage(
      image,
      -WORLD_ICON_SIZE / 2,
      -WORLD_ICON_SIZE / 2,
      WORLD_ICON_SIZE,
      WORLD_ICON_SIZE
    );
  } else {
    ctx.font = "600 4.5px Jost, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.strokeText(String(item.iconType), 0, 0);
    ctx.fillStyle = teamColor(item.teamId);
    ctx.fillText(String(item.iconType), 0, 0);
  }

  ctx.restore();
}

function setupWorldIconLayerMenu() {
  const list = document.getElementById("worldIconLayerList");
  if (!list) {
    return;
  }

  list.addEventListener("change", async event => {
    const input = event.target.closest("input[data-world-icon-type]");
    if (!input) {
      return;
    }

    const iconType = Number(input.dataset.worldIconType);
    if (input.checked) {
      WORLD_SELECTED_ICON_TYPES.add(iconType);
      await loadWorldIconType(iconType);
    } else {
      WORLD_SELECTED_ICON_TYPES.delete(iconType);
    }

    drawWorld();
  });

  refreshWorldIconLayerMenu();
}

const worldIconLayerStyle = document.createElement("style");
worldIconLayerStyle.textContent = `
  .world-icon-layer-menu {
    margin-top: 2px;
    padding-top: 7px;
    border-top: 1px solid rgba(60, 72, 84, 0.72);
  }

  .world-icon-layer-menu summary {
    cursor: pointer;
    color: #c4cdd6;
    font-weight: 600;
    user-select: none;
  }

  .world-icon-layer-list {
    display: grid;
    max-height: 260px;
    gap: 6px;
    margin-top: 8px;
    padding-right: 4px;
    overflow-y: auto;
  }

  .world-icon-layer-list label {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .world-icon-layer-preview {
    display: grid;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    place-items: center;
  }

  .world-icon-layer-preview img {
    display: block;
    width: 18px;
    height: 18px;
    object-fit: contain;
  }

  .world-icon-layer-enum {
    color: #aeb8c2;
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
  }

  .world-icon-layer-empty {
    color: var(--muted);
    font-size: 11px;
  }
`;
document.head.appendChild(worldIconLayerStyle);

document.addEventListener("DOMContentLoaded", setupWorldIconLayerMenu);
