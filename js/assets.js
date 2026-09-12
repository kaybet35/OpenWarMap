/* Bounded asset decoding. Overview keeps small bitmaps, detail keeps one full tile. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  const tiles = new Map(), icons = new Map(), painted = new Map();
  const waiting = [];
  let active = 0, tileRevision = 0, redrawTimer;
  function enqueue(run) {
    return new Promise(resolve => {
      waiting.push({ run, resolve });
      pump();
    });
  }
  function pump() {
    while (active < 3 && waiting.length) {
      const job = waiting.shift();
      active++;
      job.run().catch(() => null).then(job.resolve).finally(() => { active--; pump(); });
    }
  }
  const url = name => "img/Map" +
    name.replace(/Hex$/i, "").replace(/^DeadLands$/i, "Deadlands") + "Hex.png";
  async function decode(src, width) {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    await image.decode();
    if (!width || image.naturalWidth <= width) return image;
    const height = Math.max(1, Math.round(image.naturalHeight * width / image.naturalWidth));
    if (typeof createImageBitmap === "function") {
      try { return await createImageBitmap(image, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" }); }
      catch { /* Older engines use a small canvas instead. */ }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(image, 0, 0, width, height);
    return canvas;
  }
  function loadIcon(type) {
    if (!icons.has(type)) {
      const file = app.config.icons[type]?.[1];
      const record = { image: null };
      icons.set(type, record);
      record.promise = file ? enqueue(() => decode("icons/" + file, 64)).then(image => {
        record.image = image;
        app.render.request();
        return image;
      }) : Promise.resolve(null);
    }
    return icons.get(type);
  }
  function icon(type, team) {
    const source = loadIcon(type).image;
    if (!source || (team !== "WARDENS" && team !== "COLONIALS")) return source;
    const key = type + ":" + team;
    if (painted.has(key)) return painted.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = team === "WARDENS" ? "#245682" : "#516C4B";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(source, 0, 0);
    painted.set(key, canvas);
    return canvas;
  }
  // Only visible overview regions receive sharper images. A 32 MiB budget
  // includes both the displayed bitmaps and their replacements while decoding.
  const sharper = new Map(), pendingSharp = new Set(), failedSharp = new Map();
  let wanted = new Map(), sharpTimer, wantedKey = '';
  const sharpBudget = 32 * 1024 * 1024;
  function trimSharp() {
    for (const [name, record] of sharper) {
      if (!wanted.has(name) || record.width > wanted.get(name)) {
        record.image.close?.(); sharper.delete(name); tileRevision++;
      }
    }
  }
  function requestSharp() {
    trimSharp();
    for (const [name, width] of wanted) {
      if ((sharper.get(name)?.width || 256) >= width || pendingSharp.has(name) ||
          Date.now() - (failedSharp.get(name) || 0) < 30000) continue;
      pendingSharp.add(name);
      enqueue(async () => {
        if (wanted.get(name) !== width) return null;
        return decode(url(name), width);
      }).then(image => {
        pendingSharp.delete(name);
        if (image && wanted.get(name) === width) {
          sharper.get(name)?.image.close?.();
          sharper.set(name, {image, width}); tileRevision++;
        } else {
          image?.close?.();
          if (wanted.get(name) === width) failedSharp.set(name, Date.now());
        }
        app.render.request('world');
        // A gesture may have changed the requested level during this decode.
        if (wanted.get(name) && wanted.get(name) !== width) scheduleSharp();
      });
    }
  }
  function scheduleSharp() {
    clearTimeout(sharpTimer);
    sharpTimer = setTimeout(requestSharp, 120);
  }
  function prepareWorld(visible, pixels) {
    const perTile = Math.sqrt(sharpBudget / (2 * Math.max(1, visible.length) * 4 * 888 / 1024));
    const desired = pixels > 512 ? 1024 : pixels > 256 ? 512 : 256;
    const budgetWidth = perTile >= 1024 ? 1024 : perTile >= 512 ? 512 : 256;
    const width = Math.min(desired, budgetWidth);
    const next = new Map(width > 256 ? visible.map(tile => [tile.mapName, width]) : []);
    const key = [...next].map(([name,w]) => name + ':' + w).join('|');
    if (key === wantedKey) return;
    wantedKey = key; wanted = next;
    trimSharp(); scheduleSharp();
  }
  app.assets = {
    tiles, icon, url, prepareWorld,
    terrain: name => sharper.get(name)?.image || tiles.get(name),
    releaseWorld() { wanted = new Map(); wantedKey = ''; clearTimeout(sharpTimer); trimSharp(); },
    get revision() { return tileRevision; },
    // Detail decode is not held behind the overview queue.
    detail: name => decode(url(name), 2048).catch(() => null),
    async start() {
      let loaded = 0;
      await Promise.all(app.layout.tiles.map(tile => enqueue(() => decode(url(tile.mapName), 256)).then(image => {
        if (image) { tiles.set(tile.mapName, image); loaded++; tileRevision++; }
        if (!redrawTimer) redrawTimer = setTimeout(() => {
          redrawTimer = null;
          app.render.request("world");
        }, 100);
        app.text("worldLoading", "Loading world tiles… " + loaded + "/" + app.layout.tiles.length);
      })));
      app.ui.worldLoading.style.display = loaded === app.layout.tiles.length ? "none" : "block";
      if (loaded !== app.layout.tiles.length) app.text("worldLoading", "Some local map tiles are unavailable");
      app.render.request("world");
    }
  };
})();
