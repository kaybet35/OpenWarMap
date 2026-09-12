/* OpenWarMap state, request scheduling, and view lifecycle. */
"use strict";
window.OpenWarMap = (() => {
  const app = {
    config: {}, ui: {}, regions: new Map(), maps: [], war: null,
    selected: null, generation: 0, selection: 0, controller: new AbortController(),
    layers: { simplifiedMode: true, regionNames: true, majorLocations: false, minorLocations: false, victoryBases: true, otherBases: true,
      casualtyHeatmap: false, territoryOwnership: true, frontline: false },
    worldIcons: new Set(), hiddenIcons: new Set(), revision: 0
  };
  const endpoints = {
    "1": "https://war-service-live.foxholeservices.com/api",
    "2": "https://war-service-live-2.foxholeservices.com/api",
    "3": "https://war-service-live-3.foxholeservices.com/api",
    dev: "https://war-service-dev.foxholeservices.com/api"
  };
  let shard = "1", active = 0, overview = null, detail = null;
  let overviewTimer, detailTimer;
  const queue = [], responses = new Map(), pending = new Map();
  const abortError = () => new DOMException("Request cancelled", "AbortError");
  const current = generation => generation === app.generation && !app.controller.signal.aborted;
  app.isCurrent = current;

  // A single network budget covers overview, detail and manual refreshes.
  function pump() {
    while (active < 6 && queue.length) {
      const task = queue.shift();
      if (!current(task.generation)) { task.reject(abortError()); continue; }
      active++;
      task.run().then(task.resolve, task.reject).finally(() => { active--; pump(); });
    }
  }
  function request(path, ttl = 10000) {
    const key = shard + path;
    const cached = responses.get(key);
    if (cached && Date.now() - cached.time < ttl) return Promise.resolve(cached.data);
    if (pending.has(key)) {
      // Opening a region promotes its existing queued work instead of duplicating it.
      const index = app.selected ? queue.findIndex(task => task.key === key) : -1;
      if (index > 0) queue.unshift(queue.splice(index, 1)[0]);
      return pending.get(key);
    }
    const generation = app.generation, base = endpoints[shard], signal = app.controller.signal;
    const promise = new Promise((resolve, reject) => {
      queue.push({ key, generation, resolve, reject, run: async () => {
        const controller = new AbortController();
        const cancel = () => controller.abort();
        signal.addEventListener("abort", cancel, { once: true });
        const timeout = setTimeout(cancel, 15000);
        try {
          const response = await fetch(base + path, { signal: controller.signal, cache: "no-cache" });
          if (!response.ok) throw new Error("WarAPI HTTP " + response.status);
          const data = await response.json();
          if (!current(generation)) throw abortError();
          responses.set(key, { data, time: Date.now() });
          return data;
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener("abort", cancel);
        }
      } });
      pump();
    });
    pending.set(key, promise);
    promise.finally(() => { if (pending.get(key) === promise) pending.delete(key); }).catch(() => {});
    return promise;
  }
  app.request = request;
  app.region = name => {
    if (!app.regions.has(name)) app.regions.set(name, {
      name, static: null, dynamic: null, report: null, items: [], labels: [], bases: [],
      geometry: null, geometryKey: "", ownerKey: "", updated: 0
    });
    return app.regions.get(name);
  };
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  app.validPoint = validPoint;
  function indexRegion(region) {
    const items = new Map();
    // Public dynamic ownership takes precedence over matching static markers.
    for (const item of [...(region.dynamic?.mapItems || []), ...(region.static?.mapItems || [])]) {
      if (!validPoint(item) || !Number.isInteger(item.iconType) || item.iconType === 0) continue;
      const key = item.iconType + ":" + item.x.toFixed(5) + ":" + item.y.toFixed(5);
      if (!items.has(key)) items.set(key, item);
    }
    region.items = [...items.values()];
    region.labels = (region.static?.mapTextItems || []).filter(validPoint);
    region.bases = (region.dynamic?.mapItems || []).filter(item =>
      validPoint(item) && app.config.baseTypes.has(item.iconType));
  }
  app.indexRegion = indexRegion;

  async function loadRegion(name, generation) {
    const region = app.region(name), encoded = encodeURIComponent(name);
    const jobs = [
      ["dynamic", "/worldconquest/maps/" + encoded + "/dynamic/public"],
      ["report", "/worldconquest/warReport/" + encoded]
    ];
    if (!region.static) jobs.push(["static", "/worldconquest/maps/" + encoded + "/static"]);
    const results = await Promise.allSettled(jobs.map(async ([kind, path]) => {
      const data = await request(path, kind === "static" ? Infinity : 10000);
      if (!data || typeof data !== "object" || Array.isArray(data) ||
          (kind !== "report" && (!Array.isArray(data.mapItems) ||
          (kind === "static" && !Array.isArray(data.mapTextItems))))) {
        responses.delete(shard + path);
        throw new Error("Invalid " + kind + " data");
      }
      if (current(generation)) region[kind] = data;
    }));
    if (!current(generation)) return false;
    indexRegion(region);
    const complete = results.every(result => result.status === "fulfilled");
    if (complete) region.updated = Date.now();
    return complete;
  }

  function scheduleOverview(delay = 60000) {
    clearTimeout(overviewTimer);
    if (!document.hidden) overviewTimer = setTimeout(() => app.refresh(), delay);
  }
  function scheduleDetail(delay = 15000) {
    clearTimeout(detailTimer);
    if (app.selected && !document.hidden) detailTimer = setTimeout(() => app.refreshDetail(), delay);
  }
  app.refresh = () => {
    if (overview) return overview;
    const generation = app.generation;
    clearTimeout(overviewTimer);
    app.status("loading", "Refreshing…");
    const run = (async () => {
      try {
        const [war, maps] = await Promise.all([
          request("/worldconquest/war"), request("/worldconquest/maps")
        ]);
        if (!current(generation)) return;
        if (!war || typeof war !== "object" || Array.isArray(war) || !Array.isArray(maps)) {
          responses.delete(shard + "/worldconquest/war");
          responses.delete(shard + "/worldconquest/maps");
          throw new Error("Invalid WarAPI data");
        }
        if (app.war && (app.war.warId !== war.warId || app.war.warNumber !== war.warNumber)) {
          // A new war invalidates in-flight detail requests as well as static data.
          app.switchShard(shard);
          return;
        }
        app.war = war;
        app.maps = maps.filter(name => typeof name === "string" && !/^HomeRegion[CW]$/i.test(name));
        const available = new Set(app.maps);
        for (const name of app.regions.keys()) if (!available.has(name)) app.regions.delete(name);
        if (app.selected && !available.has(app.selected)) app.closeRegion();
        app.updateSummary();
        const results = await Promise.all(app.maps.map(name => loadRegion(name, generation)));
        if (!current(generation)) return;
        app.revision++;
        app.updateSummary();
        app.updateMenus();
        app.updateDetail();
        app.render.request();
        const failed = results.filter(ok => !ok).length;
        app.status(failed ? "error" : "online", failed ? "Partial data · " + failed + " regions" : "Live");
        app.text("lastRefresh", (failed ? "Checked " : "Updated ") + new Date().toLocaleTimeString());
      } catch (error) {
        if (current(generation)) app.status("error", "API error · retrying");
      }
    })();
    overview = run;
    run.finally(() => {
      if (overview === run) overview = null;
      if (current(generation)) scheduleOverview();
    });
    return run;
  };
  app.refreshDetail = () => {
    if (!app.selected) return Promise.resolve();
    // Share refresh callbacks only within the same visit; request() still shares transports.
    if (detail?.name === app.selected && detail.selection === app.selection &&
        detail.generation === app.generation) return detail.promise;
    const name = app.selected, generation = app.generation, selection = app.selection;
    clearTimeout(detailTimer);
    const promise = (async () => {
      const complete = await loadRegion(name, generation);
      if (!current(generation) || selection !== app.selection) return;
      app.revision++;
      app.updateSummary();
      app.updateMenus();
      app.updateDetail(complete ? null : "Partial data · retrying");
      app.render.request();
    })();
    const record = { name, selection, generation, promise };
    detail = record;
    promise.finally(() => {
      if (detail === record) detail = null;
      if (current(generation) && selection === app.selection) scheduleDetail();
    });
    return promise;
  };
  app.openRegion = name => {
    if (!app.maps.includes(name)) return;
    const source = document.activeElement;
    app.closeRegion();
    app.returnFocus = source;
    app.selected = name;
    app.camera?.reset("detail", false);
    app.assets.releaseWorld?.();
    const selection = app.selection;
    app.ui.worldPanel.hidden = true;
    app.ui.detailPanel.hidden = false;
    app.ui.detailPanel.classList.remove("hidden");
    app.syncView?.();
    app.text("detailTitle", app.layout.byName.get(name)?.name || name.replace(/Hex$/, ""));
    app.ui.detailCanvas.setAttribute?.("aria-label", "Map of " + app.ui.detailTitle.textContent);
    (app.ui.detailTitle.getClientRects?.().length === 0 ? app.ui.closeDetail : app.ui.detailTitle).focus?.({ preventScroll: true });
    app.text("detailLoading", "Loading local map…");
    app.ui.detailLoading.style.display = "block";
    app.updateDetail();
    app.updateMenus();
    app.render.request();
    app.assets.detail(name).then(image => {
      if (selection !== app.selection) { image?.close?.(); return; }
      app.detailImage = image;
      app.ui.detailLoading.style.display = image ? "none" : "block";
      if (!image) app.text("detailLoading", "Local map unavailable");
      app.render.request("detail");
    });
    app.refreshDetail();
  };
  app.closeRegion = () => {
    app.camera?.cancel();
    const restoreFocus = app.selected && app.ui.detailPanel.contains?.(document.activeElement);
    clearTimeout(detailTimer);
    app.selection++;
    app.selected = null;
    app.detailImage?.close?.();
    app.detailImage = null;
    app.ui.detailPanel.hidden = true;
    app.ui.detailPanel.classList.add("hidden");
    app.ui.worldPanel.hidden = false;
    app.syncView?.();
    if (restoreFocus) (app.returnFocus?.isConnected ? app.returnFocus : app.ui.regionSelect).focus?.();
    app.ui.mapTooltip.classList.add("hidden");
    app.render?.releaseDetail();
    app.render?.request("world");
  };
  app.switchShard = value => {
    if (!endpoints[value]) return;
    app.controller.abort();
    app.generation++;
    app.controller = new AbortController();
    shard = value;
    clearTimeout(overviewTimer);
    app.closeRegion();
    overview = null;
    detail = null;
    responses.clear();
    pending.clear();
    app.regions.clear();
    app.maps = [];
    app.war = null;
    app.revision++;
    app.updateSummary();
    app.updateMenus();
    app.render.request();
    app.refresh();
  };
  app.visibilityChanged = () => {
    clearTimeout(overviewTimer);
    clearTimeout(detailTimer);
    if (!document.hidden) {
      app.render.request();
      app.refresh();
      if (app.selected) app.refreshDetail();
    }
  };
  return app;
})();
