/* DOM updates and number formatting are shared by world and detail summaries. */
"use strict";
(() => {
  const app = window.OpenWarMap, formatter = new Intl.NumberFormat();
  app.number = value => formatter.format(Number(value || 0));
  app.percent = (value,total) => (total ? value/total*100 : 0).toFixed(1)+"%";
  app.casualties = report => (report?.wardenCasualties || 0)+(report?.colonialCasualties || 0);
  app.text = (id,value) => {
    const element = app.ui[id];
    if (element && element.textContent !== String(value)) element.textContent = String(value);
  };
  app.status = (type,text) => {
    app.ui.connectionStatus.className = "status-pill is-"+type;
    app.text("connectionStatus",text);
  };
  app.hourly = count => {
    const war = app.war, start = Number(war?.conquestStartTime || 0);
    const hours = start ? Math.max(0,(Number(war.conquestEndTime || Date.now())-start)/3600000) : 0;
    return hours ? app.number(Math.round(count/hours))+"/hr" : "—/hr";
  };
  app.updateSummary = () => {
    const war = app.war;
    if (!war) {
      for (const id of ["warNumber","warDuration","wardenVp","colonialVp","wardenCasualties",
        "colonialCasualties","totalCasualtiesSummary"]) app.text(id,"—");
      app.text("warPhase","Loading"); app.text("lastRefresh","Updated —");
      app.ranks = new Map();
      return;
    }
    let warden=0,colonial=0,wardenVp=0,colonialVp=0,scorched=0;
    const reports = [];
    for (const region of app.regions.values()) {
      warden += region.report?.wardenCasualties || 0;
      colonial += region.report?.colonialCasualties || 0;
      if (region.report) reports.push(region);
      for (const item of region.dynamic?.mapItems || []) if (item.flags & 1) {
        if (item.teamId === "WARDENS") wardenVp++;
        if (item.teamId === "COLONIALS") colonialVp++;
        if (item.flags & 16) scorched++;
      }
    }
    const total=warden+colonial, required=Math.max(0,(war.requiredVictoryTowns || 0)-scorched);
    app.text("warNumber", war.warNumber ? "#"+war.warNumber : "—");
    app.text("wardenVp",wardenVp+" / "+(required || "—")+" ("+app.percent(wardenVp,required)+")");
    app.text("colonialVp",colonialVp+" / "+(required || "—")+" ("+app.percent(colonialVp,required)+")");
    app.text("wardenCasualties",app.number(warden)+" ("+app.percent(warden,total)+")");
    app.text("colonialCasualties",app.number(colonial)+" ("+app.percent(colonial,total)+")");
    app.text("totalCasualtiesSummary",app.number(total)+" ("+app.hourly(total)+")");
    app.text("warPhase",war.conquestEndTime ? "Ended "+new Date(war.conquestEndTime).toLocaleString() :
      war.resistanceStartTime ? "Resistance" : "World Conquest");
    const elapsed = Math.max(0,Number(war.conquestEndTime || Date.now())-Number(war.conquestStartTime || Date.now()));
    app.text("warDuration",war.conquestStartTime ?
      Math.floor(elapsed/86400000)+"d "+Math.floor(elapsed%86400000/3600000)+"h elapsed" : "Awaiting conquest");
    app.ranks = new Map(reports.map(region => [region.name,{total:reports.length}]));
    reports.sort((a,b) => app.casualties(b.report)-app.casualties(a.report))
      .forEach((region,index) => { app.ranks.get(region.name).casualties=index+1; });
    reports.sort((a,b) => (b.report.totalEnlistments || 0)-(a.report.totalEnlistments || 0))
      .forEach((region,index) => { app.ranks.get(region.name).enlistments=index+1; });
  };
  // Preserve existing embedded CSS verbatim: this rewrite changes JavaScript behavior only.
  const style = document.createElement("style");
  style.textContent = `
    .map-layer-controls {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 6;
      display: flex;
      min-height: 0;
      flex-direction: column;
      align-items: stretch;
      gap: 7px;
      box-sizing: border-box;
      padding: 9px 11px;
      border: 1px solid rgba(60, 72, 84, 0.9);
      border-radius: 6px;
      background: rgba(12, 16, 20, 0.9);
      color: #b6c0ca;
      font-size: 12px;
      backdrop-filter: blur(6px);
    }

    .map-layer-controls label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
    }

    .map-layer-controls input {
      margin: 0;
    }

    .map-layer-controls > .muted {
      margin-top: 2px;
      padding-top: 6px;
      border-top: 1px solid rgba(60, 72, 84, 0.72);
      font-size: 10px;
      white-space: nowrap;
    }

    .world-war-stats {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 5;
      display: flex;
      width: max-content;
      max-width: calc(100% - 24px);
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      padding: 9px 11px;
      border: 1px solid rgba(60, 72, 84, 0.72);
      border-radius: 6px;
      background: rgba(12, 16, 20, 0.78);
      backdrop-filter: blur(5px);
      pointer-events: none;
    }

    .world-war-stats > span {
      display: grid;
      gap: 2px;
      min-width: 0;
      text-align: right;
    }

    .world-war-stats small {
      color: var(--muted);
      font-size: 9px;
      line-height: 1;
      text-transform: uppercase;
    }

    .world-war-stats strong {
      color: inherit;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.1;
      white-space: nowrap;
    }

    .world-war-stats > span:last-child {
      color: var(--text);
    }

    @media (max-width: 900px) {
      .world-war-stats {
        position: static;
        top: auto;
        right: auto;
        bottom: auto;
        width: 100%;
        max-width: none;
      }
    }


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
  document.head.appendChild(style);
})();
