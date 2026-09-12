/* Single entry point and frame-coalesced pointer interactions. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  function setupCollapsibleControls() {
    const session = document.querySelector('.session-controls');
    const toggles = document.querySelectorAll('.mobile-panel-toggle');
    const updatePosition = () => document.getElementById('main').style.setProperty('--mobile-tools-top', (session.offsetTop + session.offsetHeight + 8) + 'px');
    for (const toggle of toggles) {
      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(expanded));
        if (!expanded) {
          for (const menu of document.getElementById(toggle.getAttribute('aria-controls')).querySelectorAll('details[open]')) menu.open = false;
        }
        updatePosition();
      });
    }
    document.querySelector('.skip-link').addEventListener('click', () => {
      session.querySelector('.mobile-panel-toggle').setAttribute('aria-expanded', 'true');
      updatePosition();
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(updatePosition).observe(session);
    else window.addEventListener('resize', updatePosition, {passive:true});
    updatePosition();
  }
  function setupPointers() {
    const worldTooltip = document.createElement("div");
    worldTooltip.className = "map-tooltip hidden";
    app.ui.worldCanvas.parentElement.appendChild(worldTooltip);
    app.ui.worldCanvas.style.cursor = "grab";
    let pointerFrame = 0, latest = null, contentKey = "";
    function hide() {
      latest = null;
      worldTooltip.classList.add("hidden");
      app.ui.mapTooltip.classList.add("hidden");
      contentKey = "";
    }
    function worldHit(event) {
      const view = app.worldView;
      if (!view) return null;
      const rect = app.ui.worldCanvas.getBoundingClientRect();
      const point = { x:(event.clientX-rect.left-view.offsetX)/view.scale,
        y:(event.clientY-rect.top-view.offsetY)/view.scale };
      return app.layout.tiles.find(tile => Math.abs(point.x-tile.x)<=514 &&
        Math.abs(point.y-tile.y)<=446 && app.geometry.contains(point,tile.polygon));
    }
    function show(event,detail) {
      const canvas = detail ? app.ui.detailCanvas : app.ui.worldCanvas;
      const tooltip = detail ? app.ui.mapTooltip : worldTooltip;
      let title, rows, key;
      if (detail) {
        const rect = canvas.getBoundingClientRect(), x=event.clientX-rect.left, y=event.clientY-rect.top;
        let hit;
        const hits = app.detailHits || [];
        for (let i=hits.length-1;i>=0;i--) {
          const candidate=hits[i];
          if ((x-candidate.x)**2+(y-candidate.y)**2 <= candidate.r**2) { hit=candidate; break; }
        }
        if (!hit) { hide(); return; }
        const item=hit.item;
        title=app.config.iconName(item.iconType);
        rows=[item.teamId==="WARDENS" ? "Wardens" : item.teamId==="COLONIALS" ? "Colonials" : "Neutral"];
        const flags=[[1,"Victory Base"],[4,"Build Site"],[16,"Scorched"],[32,"Town Claimed"]];
        const names=flags.filter(([mask]) => item.flags&mask).map(([,name]) => name);
        if (names.length) rows.push(names.join(" · "));
        key="detail:"+item.iconType+":"+item.x+":"+item.y+":"+app.revision;
      } else {
        const tile=worldHit(event);
        if (!tile) { hide(); return; }
        title=tile.name; rows=[];
        const report=app.regions.get(tile.mapName)?.report;
        if (report) {
          const w=report.wardenCasualties || 0,c=report.colonialCasualties || 0,t=w+c,rank=app.ranks?.get(tile.mapName);
          rows=["Warden Casualties: "+app.number(w)+" ("+app.percent(w,t)+")",
            "Colonial Casualties: "+app.number(c)+" ("+app.percent(c,t)+")",
            "Total Casualties: "+app.number(t)+(rank ? " (#"+rank.casualties+" / "+rank.total+")" : ""),
            "Enlistments: "+app.number(report.totalEnlistments)+(rank ? " (#"+rank.enlistments+" / "+rank.total+")" : "")];
        }
        key="world:"+tile.mapName+":"+app.revision;
      }
      if (key!==contentKey) {
        const heading=document.createElement("strong"); heading.textContent=title;
        const nodes=[heading];
        for (const row of rows) {
          const span=document.createElement("span"); span.textContent=row;
          if (row.startsWith("Warden")) span.className="warden-text";
          if (row.startsWith("Colonial")) span.className="colonial-text";
          nodes.push(document.createElement("br"),span);
        }
        tooltip.replaceChildren(...nodes); contentKey=key;
      }
      tooltip.classList.remove("hidden");
      const rect=canvas.parentElement.getBoundingClientRect();
      tooltip.style.left=Math.max(0,Math.min(event.clientX-rect.left+14,rect.width-tooltip.offsetWidth-8))+"px";
      tooltip.style.top=Math.max(0,Math.min(event.clientY-rect.top+14,rect.height-tooltip.offsetHeight-8))+"px";
    }
    for (const [canvas,detail] of [[app.ui.worldCanvas,false],[app.ui.detailCanvas,true]]) {
      canvas.addEventListener("pointermove",event => {
        if (event.pointerType==="touch" || app.camera.interacting(canvas)) return;
        latest={ event,detail };
        if (!pointerFrame) pointerFrame=requestAnimationFrame(() => {
          pointerFrame=0;
          if (latest) show(latest.event,latest.detail);
        });
      }, { passive:true });
      canvas.addEventListener("mapgesture",hide);
      canvas.addEventListener("pointerleave",hide,{passive:true});
      canvas.addEventListener("pointercancel",hide,{passive:true});
      canvas.addEventListener("click",event => {
        if (detail) show(event,true);
        else {
          const tile=worldHit(event);
          if (tile && app.maps.includes(tile.mapName)) { hide(); app.openRegion(tile.mapName); }
        }
      });
    }
    document.addEventListener("scroll",hide,{capture:true,passive:true});
    app.ui.closeDetail.addEventListener("click",hide);
    app.ui.regionSelect.addEventListener("change",hide);
    app.ui.shardSelect.addEventListener("change",hide);
  }
  function init() {
    document.querySelectorAll("[id]").forEach(element => { app.ui[element.id]=element; });
    app.setupMenus();
    app.ui.shardSelect.addEventListener("change",() => app.switchShard(app.ui.shardSelect.value));
    app.ui.refreshButton.addEventListener("click",() => app.refresh());
    app.ui.closeDetail.addEventListener("click",app.closeRegion);
    const menus = [...document.querySelectorAll("[data-layer-menu]")];
    for (const menu of menus) menu.addEventListener("toggle", () => {
      if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
    });
    document.addEventListener("click", event => {
      for (const menu of menus) if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
    document.addEventListener("keydown", event => {
      if (event.key !== "Escape") return;
      const menu = menus.find(menu => menu.open);
      if (menu) {
        menu.open = false;
        menu.querySelector("summary").focus();
      } else if (app.selected) app.closeRegion();
    });
    app.ui.regionSelect.addEventListener("change", () => {
      if (app.ui.regionSelect.value) app.openRegion(app.ui.regionSelect.value);
      else app.closeRegion();
    });
    for (const input of document.querySelectorAll("[data-world-layer]")) {
      const key=input.dataset.worldLayer;
      input.checked=app.layers[key]===true;
      input.addEventListener("change",() => { app.layers[key]=input.checked; app.render.request("world"); });
    }
    for (const id of ["showLabels","showSubregions","showFrontline"]) {
      app.ui[id].addEventListener("change",() => app.render.request("detail"));
    }
    setupCollapsibleControls();
    app.camera.setup();
    setupPointers();
    const resize=() => app.render.request();
    if (typeof ResizeObserver==="function") {
      const observer=new ResizeObserver(resize);
      observer.observe(app.ui.worldCanvas.parentElement);
      observer.observe(app.ui.detailCanvas.parentElement);
    } else window.addEventListener("resize",resize,{passive:true});
    document.addEventListener("visibilitychange",app.visibilityChanged);
    window.addEventListener("online",app.visibilityChanged);
    window.addEventListener("pageshow",event => { if (event.persisted) app.visibilityChanged(); });
    document.fonts?.ready.then(resize).catch(() => {});
    app.updateSummary();
    app.assets.start();
    app.render.request();
    app.refresh();
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
