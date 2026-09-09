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
    app.updateRegionSelect();
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

  const regionName = name => app.layout.byName.get(name)?.name || name.replace(/Hex$/, "");
  let regionOptionsKey = "";
  app.syncView = () => {
    app.ui.regionSelect.value = app.selected || "";
    document.title = (app.selected ? regionName(app.selected) : "Foxhole war tracker") + " — OpenWarMap";
  };
  app.updateRegionSelect = () => {
    const key = app.maps.join(",");
    if (key !== regionOptionsKey || !app.ui.regionSelect.options?.length) {
      regionOptionsKey = key;
      const fragment = document.createDocumentFragment();
      const overview = document.createElement("option");
      overview.value = "";
      overview.textContent = "World overview";
      fragment.append(overview);
      for (const name of [...app.maps].sort((a,b) => regionName(a).localeCompare(regionName(b)))) {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = regionName(name);
        fragment.append(option);
      }
      app.ui.regionSelect.replaceChildren(fragment);
    }
    app.ui.regionSelect.disabled = !app.maps.length;
    app.syncView();
  };
})();
