/* Menus are reconciled only when their available icon types change. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  let worldMenu, detailMenu, worldList, detailList;
  const signatures = new WeakMap();
  function fill(list, types, detail) {
    const sorted = [...types].sort((a,b) => app.config.iconName(a).localeCompare(app.config.iconName(b)));
    const key = sorted.join(",") + (detail ? ":"+app.selected : "");
    if (signatures.get(list) === key) return;
    signatures.set(list,key);
    const fragment = document.createDocumentFragment();
    for (const type of sorted) {
      const label = document.createElement("label"), input = document.createElement("input");
      input.type = "checkbox"; input.value = String(type);
      input.checked = detail ? !app.hiddenIcons.has(type) : app.worldIcons.has(type);
      input.dataset.iconType = String(type);
      const preview = document.createElement("span");
      preview.className = "world-icon-layer-preview";
      const fallback = document.createElement("span");
      fallback.className = "world-icon-layer-enum"; fallback.textContent = String(type);
      preview.append(fallback);
      const file = app.config.icons[type]?.[1];
      if (file) {
        const image = document.createElement("img");
        image.width = 18; image.height = 18; image.alt = ""; image.loading = "lazy";
        image.onload = () => { fallback.hidden = true; };
        image.onerror = () => { image.remove(); fallback.hidden = false; };
        image.src = "icons/"+file;
        preview.prepend(image);
      }
      const text = document.createElement("span"); text.textContent = app.config.iconName(type);
      label.append(input,preview,text); fragment.append(label);
    }
    if (!sorted.length) {
      const empty = document.createElement("span"); empty.className = "world-icon-layer-empty";
      empty.textContent = "No map icons available."; fragment.append(empty);
    }
    list.replaceChildren(fragment);
  }
  app.updateMenus = () => {
    if (worldMenu?.open) {
      const types = new Set();
      for (const region of app.regions.values()) for (const item of region.items) {
        if (!(item.flags & 1) && !app.config.baseTypes.has(item.iconType)) types.add(item.iconType);
      }
      fill(worldList,types,false);
    }
    if (detailMenu?.open) {
      fill(detailList,new Set((app.regions.get(app.selected)?.items || []).map(item => item.iconType)),true);
    }
  };
  app.setupMenus = () => {
    worldMenu = document.getElementById("worldIconLayerMenu");
    worldList = document.getElementById("worldIconLayerList");
    detailMenu = document.getElementById("detailIconLayerMenu");
    detailList = document.getElementById("detailIconLayerList");
    for (const [menu,isDetail] of [[worldMenu,false],[detailMenu,true]]) {
      menu.addEventListener("toggle", app.updateMenus);
      menu.addEventListener("change", event => {
        const input = event.target.closest("input[data-icon-type]");
        if (!input) return;
        const set = isDetail ? app.hiddenIcons : app.worldIcons;
        if (isDetail ? !input.checked : input.checked) set.add(Number(input.value));
        else set.delete(Number(input.value));
        app.render.request(isDetail ? "detail" : "world");
      });
    }
  };
})();
