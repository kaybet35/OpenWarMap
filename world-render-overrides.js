const WORLD_TILE_IMAGES = new Map();
const WORLD_TILE_IMAGE_OVERRIDES = {
  MarbanHollow: "MapMarbanHollowHex.png"
};
const WORLD_BASE_ICON_TYPES = new Set([45, 46, 47, 56, 57, 58]);
const DETAIL_HEX_POINTS = [
  { x: 0, y: 0.5 },
  { x: 0.249027, y: 0 },
  { x: 0.750973, y: 0 },
  { x: 1, y: 0.5 },
  { x: 0.750973, y: 1 },
  { x: 0.249027, y: 1 }
];
const DETAIL_VORONOI_BORDER_COLOR = "rgba(140, 125, 107, 0.349)";
const DETAIL_VORONOI_BORDER_WIDTH = 2;
const DETAIL_FRONTLINE_COLOR = "rgba(220, 62, 62, 0.95)";
const DETAIL_FRONTLINE_WIDTH = 1.4;
const DETAIL_OWNER_COLORS = {
  WARDENS: "rgba(111, 155, 208, 0.2)",
  COLONIALS: "rgba(115, 157, 111, 0.2)"
};

const originalRefreshOverviewDataForWorld = refreshOverviewData;
refreshOverviewData = async function() {
  await originalRefreshOverviewDataForWorld();
  drawWorld();
};

async function loadWorldTiles() {
  els.worldLoading.style.display = "block";
  els.worldLoading.textContent = "Loading world map tiles…";

  const entries = await Promise.all(WORLD_HEX_LAYOUT.map(async entry => {
    const image = new Image();
    image.src = worldTileImageUrl(entry.mapName);

    try {
      await image.decode();
      return [entry.mapName, image];
    } catch (error) {
      console.warn(`Could not load world tile ${entry.mapName}`, error);
      return [entry.mapName, null];
    }
  }));

  WORLD_TILE_IMAGES.clear();
  for (const [mapName, image] of entries) {
    if (image) {
      WORLD_TILE_IMAGES.set(mapName, image);
    }
  }

  state.worldImage = WORLD_TILE_IMAGES.size ? { tileBased: true } : null;

  if (WORLD_TILE_IMAGES.size) {
    els.worldLoading.style.display = "none";
  } else {
    els.worldLoading.textContent = "Could not load local world map tiles.";
  }

  drawWorld();
}

loadWorldImage = loadWorldTiles;

function worldTileImageUrl(mapName) {
  if (WORLD_TILE_IMAGE_OVERRIDES[mapName]) {
    return `img/${WORLD_TILE_IMAGE_OVERRIDES[mapName]}`;
  }

  let base = mapName.replace(/Hex$/i, "");
  if (/^DeadLands$/i.test(base)) {
    base = "Deadlands";
  }
  return `img/Map${base}Hex.png`;
}

drawWorld = function() {
  if (!els.worldCanvas) {
    return;
  }

  const canvas = els.worldCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const worldScale = Math.min(
    rect.width / WORLD_COORD_WIDTH,
    rect.height / WORLD_COORD_HEIGHT
  );
  const sampleImage = WORLD_TILE_IMAGES.values().next().value;
  const tileScreenWidth = WORLD_TILE_HALF_WIDTH * 2 * worldScale;
  const sourceScale = sampleImage && tileScreenWidth > 0
    ? sampleImage.naturalWidth / tileScreenWidth
    : 1;
  const backingScale = Math.max(1, Math.min(
    4,
    Math.max(2, dpr * 1.5),
    sourceScale
  ));

  canvas.width = Math.max(1, Math.round(rect.width * backingScale));
  canvas.height = Math.max(1, Math.round(rect.height * backingScale));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(backingScale, 0, 0, backingScale, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const width = WORLD_COORD_WIDTH * worldScale;
  const height = WORLD_COORD_HEIGHT * worldScale;
  const offsetX = (rect.width - width) / 2;
  const offsetY = (rect.height - height) / 2;

  for (const entry of WORLD_HEX_LAYOUT) {
    const image = WORLD_TILE_IMAGES.get(entry.mapName);
    if (!image) {
      continue;
    }
    drawWorldTile(ctx, image, entry, worldScale, offsetX, offsetY);
  }

  state.worldHexHitboxes = WORLD_HEX_LAYOUT.map(entry => ({
    ...entry,
    screenPoints: entry.points.map((value, index) =>
      index % 2 === 0
        ? offsetX + value * worldScale
        : offsetY + value * worldScale
    )
  }));
};

function drawWorldTile(ctx, image, entry, worldScale, offsetX, offsetY) {
  const points = entry.points;
  const bounds = entry.bounds;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(
    offsetX + points[0] * worldScale,
    offsetY + points[1] * worldScale
  );

  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(
      offsetX + points[i] * worldScale,
      offsetY + points[i + 1] * worldScale
    );
  }

  ctx.closePath();
  ctx.clip();
  ctx.drawImage(
    image,
    offsetX + bounds.x * worldScale,
    offsetY + bounds.y * worldScale,
    bounds.width * worldScale,
    bounds.height * worldScale
  );
  ctx.restore();
}

function drawWorldVictoryBases(ctx, worldScale, offsetX, offsetY) {
  const layers = window.WORLD_OVERVIEW_LAYERS || {};

  for (const hex of state.worldHexHitboxes || []) {
    const dynamic = state.dynamic.get(hex.mapName);
    if (!dynamic?.mapItems?.length) {
      continue;
    }

    const bounds = hex.bounds;

    for (const item of dynamic.mapItems) {
      const isVictoryBase = (item.flags & FLAGS.VICTORY_BASE) !== 0;
      const isTownOrRelicBase = WORLD_BASE_ICON_TYPES.has(item.iconType);
      if (!isVictoryBase && !isTownOrRelicBase) {
        continue;
      }
      if (isVictoryBase && layers.victoryBases === false) {
        continue;
      }
      if (!isVictoryBase && layers.otherBases === false) {
        continue;
      }

      const worldX = bounds.x + item.x * bounds.width;
      const worldY = bounds.y + item.y * bounds.height;
      const x = offsetX + worldX * worldScale;
      const y = offsetY + worldY * worldScale;
      const radius = isVictoryBase ? 4.5 : 2.5;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = teamColor(item.teamId);
      ctx.fill();
      ctx.lineWidth = isVictoryBase ? 1.5 : 0.9;
      ctx.strokeStyle = (item.flags & FLAGS.SCORCHED) !== 0
        ? "#d7ae58"
        : "rgba(8, 10, 13, 0.9)";
      ctx.stroke();
    }
  }
}

drawRegion = function() {
  if (!state.selectedMap || !state.regionImage || !els.detailCanvas) {
    return;
  }

  const staticData = state.static.get(state.selectedMap) || {};
  const dynamicData = state.dynamic.get(state.selectedMap) || {};
  const canvas = els.detailCanvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const image = state.regionImage;
  const scale = Math.min(rect.width / image.width, rect.height / image.height);
  const mapWidth = image.width * scale;
  const mapHeight = image.height * scale;
  const mapX = (rect.width - mapWidth) / 2;
  const mapY = (rect.height - mapHeight) / 2;

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

    const category = ICONS[item.iconType]?.[2] || "structure";
    if (category === "resource" && !els.showResources.checked) {
      continue;
    }
    if (category !== "resource" && !els.showStructures.checked) {
      continue;
    }
    if (item.teamId === "NONE" && !els.showNeutral.checked) {
      continue;
    }

    drawMapItem(ctx, item, mapX, mapY, mapWidth, mapHeight);
  }

  if (els.showLabels.checked) {
    drawMapLabels(ctx, staticData.mapTextItems || [], mapX, mapY, mapWidth, mapHeight);
  }
};

function drawDetailVoronoi(ctx, labels, mapItems, mapX, mapY, mapWidth, mapHeight) {
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
    fillDetailVoronoiCell(ctx, cell, owner);
    collectDetailVoronoiSegments(cell, segments, owner);
  }

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

  if (document.getElementById("showFrontline")?.checked) {
    drawDetailFrontlines(ctx, segments);
  }
}

function fillDetailVoronoiCell(ctx, cell, owner) {
  const fillStyle = DETAIL_OWNER_COLORS[owner];
  if (!fillStyle) {
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cell[0].x, cell[0].y);
  for (let i = 1; i < cell.length; i++) {
    ctx.lineTo(cell[i].x, cell[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function collectDetailVoronoiSegments(cell, segments, owner) {
  for (let i = 0; i < cell.length; i++) {
    const a = cell[i];
    const b = cell[(i + 1) % cell.length];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-5) {
      continue;
    }

    const first = `${a.x.toFixed(3)},${a.y.toFixed(3)}`;
    const second = `${b.x.toFixed(3)},${b.y.toFixed(3)}`;
    const key = first < second ? `${first}|${second}` : `${second}|${first}`;
    const existing = segments.get(key);

    if (existing) {
      existing.count++;
      if (owner) {
        existing.owners.add(owner);
      }
    } else {
      segments.set(key, {
        a: { ...a },
        b: { ...b },
        count: 1,
        owners: new Set(owner ? [owner] : [])
      });
    }
  }
}

function drawDetailFrontlines(ctx, segments) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = DETAIL_FRONTLINE_WIDTH;
  ctx.strokeStyle = DETAIL_FRONTLINE_COLOR;
  ctx.beginPath();

  for (const segment of segments.values()) {
    if (
      segment.count < 2 ||
      !segment.owners.has("WARDENS") ||
      !segment.owners.has("COLONIALS")
    ) {
      continue;
    }

    ctx.moveTo(segment.a.x, segment.a.y);
    ctx.lineTo(segment.b.x, segment.b.y);
  }

  ctx.stroke();
  ctx.restore();
}

drawMapLabels = function(ctx, labels, mapX, mapY, mapWidth, mapHeight) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "rgb(192, 181, 149)";
  ctx.fillStyle = "rgb(71, 87, 85)";
  ctx.lineWidth = 0.5;

  for (const label of labels) {
    const x = mapX + label.x * mapWidth;
    const y = mapY + label.y * mapHeight;
    const major = label.mapMarkerType === "Major";
    const fontSize = major ? 18.5 : 12.5;

    ctx.font = `400 ${fontSize}px Jost, sans-serif`;
    ctx.strokeText(label.text, x, y);
    ctx.fillText(label.text, x, y);
  }

  ctx.restore();
};
