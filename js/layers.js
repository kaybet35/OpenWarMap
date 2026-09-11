/* Menus are reconciled only when their available icon types change. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  let worldMenu, detailMenu, worldList, detailList;
  const signatures = new WeakMap();
  app.worldHiddenBases = new Set();
  const category = type => app.config.resourceTypes.has(type) ? 'resources' : 'structures';
  function enabled(type, detail, worldTypes) {
    if (detail) return !app.hiddenIcons.has(type) &&
      (category(type) === 'resources' ? app.ui.showResources.checked : app.ui.showStructures.checked);
    return worldTypes.has(type);
  }
  function setEnabled(type, checked, detail) {
    if (detail) {
      if (checked) app.hiddenIcons.delete(type); else app.hiddenIcons.add(type);
      if (checked) (category(type) === 'resources' ? app.ui.showResources : app.ui.showStructures).checked = true;
    } else {
      if (checked) { app.worldIcons.add(type); app.worldHiddenBases.delete(type); }
      else { app.worldIcons.delete(type); app.worldHiddenBases.add(type); }
    }
  }
  function sync(list, detail) {
    const worldTypes = new Set();
    if (!detail) for (const region of app.regions.values()) for (const item of region.items) {
      const type = item.iconType;
      const visible = (item.flags & 1) || app.config.baseTypes.has(type)
        ? !app.worldHiddenBases.has(type) && ((item.flags & 1) ? app.layers.victoryBases : app.layers.otherBases)
        : app.worldIcons.has(type);
      if (visible) worldTypes.add(type);
    }
    for (const group of list.querySelectorAll('[data-icon-group]')) {
      const inputs = [...group.querySelectorAll('input[data-icon-type]')];
      for (const input of inputs) input.checked = enabled(Number(input.value), detail, worldTypes);
      const master = group.querySelector('input[data-icon-category]');
      const count = inputs.filter(input => input.checked).length;
      master.checked = inputs.length > 0 && count === inputs.length;
      master.indeterminate = count > 0 && count < inputs.length;
      master.disabled = !inputs.length;
    }
  }
  function fill(list, types, detail) {
    const sorted = [...types].sort((a,b) => app.config.iconName(a).localeCompare(app.config.iconName(b)));
    const key = sorted.join(",") + (detail ? ":"+app.selected : "");
    if (signatures.get(list) === key) { sync(list, detail); return; }
    signatures.set(list,key);
    const fragment = document.createDocumentFragment();
    const groups = new Map();
    for (const [key, name] of [['structures', 'Structures'], ['resources', 'Resources']]) {
      const group = document.createElement('div'); group.dataset.iconGroup = key;
      const heading = document.createElement('label'); heading.className = 'icon-group-heading';
      const master = document.createElement('input'); master.type = 'checkbox'; master.dataset.iconCategory = key;
      const text = document.createElement('strong'); text.textContent = name;
      heading.append(master, text); group.append(heading); fragment.append(group); groups.set(key, group);
    }
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
      label.append(input,preview,text); groups.get(category(type)).append(label);
    }
    if (!sorted.length) {
      const empty = document.createElement("span"); empty.className = "world-icon-layer-empty";
      empty.textContent = "No map icons available."; fragment.append(empty);
    }
    list.replaceChildren(fragment);
    sync(list, detail);
  }
  app.updateMenus = () => {
    if (worldMenu?.open) {
      const types = new Set();
      for (const region of app.regions.values()) for (const item of region.items) {
        types.add(item.iconType);
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
        const input = event.target.closest('input[data-icon-type], input[data-icon-category]');
        if (!input) return;
        const list = isDetail ? detailList : worldList;
        const types = input.dataset.iconCategory
          ? [...input.closest('[data-icon-group]').querySelectorAll('input[data-icon-type]')].map(child => Number(child.value))
          : [Number(input.value)];
        // Enabling structures also opens the existing base visibility gates.
        if (!isDetail && input.checked && types.some(type => category(type) === 'structures')) {
          app.layers.victoryBases = true; app.layers.otherBases = true;
          for (const key of ['victoryBases', 'otherBases']) {
            document.querySelector(`[data-world-layer="${key}"]`).checked = true;
          }
        }
        for (const type of types) setEnabled(type, input.checked, isDetail);
        sync(list, isDetail);
        app.render.request(isDetail ? "detail" : "world");
      });
    }
  };
})();
