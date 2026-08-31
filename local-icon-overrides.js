const LOCAL_ICON_FILES = {
  5: ["Static Base T1", "MapIconStaticBase1.png", "structure"],
  6: ["Static Base T2", "MapIconStaticBase2.png", "structure"],
  7: ["Static Base T3", "MapIconStaticBase3.png", "structure"],
  8: ["Forward Base", "MapIconForwardBase1.png", "structure"],
  11: ["Hospital", "MapIconHospital.png", "structure"],
  12: ["Vehicle Factory", "MapIconVehicle.png", "structure"],
  13: ["Armory", "MapIconArmory.png", "structure"],
  15: ["Workshop", "MapIconWorkshop.png", "structure"],
  17: ["Refinery", "MapIconManufacturing.png", "structure"],
  18: ["Shipyard", "Shipyard.png", "structure"],
  19: ["Engineering Center", "MapIconTechCenter.png", "structure"],
  20: ["Salvage Field", "SalvageMapIcon.png", "resource"],
  21: ["Component Field", "MapIconComponents.png", "resource"],
  22: ["Fuel Field", "MapIconFuel.png", "resource"],
  23: ["Sulfur Field", "MapIconSulfur.png", "resource"],
  27: ["Keep", "MapIconsKeep.png", "structure"],
  28: ["Observation Tower", "MapIconObservationTower.png", "structure"],
  29: ["Fort", "MapIconFort.png", "structure"],
  32: ["Sulfur Mine", "MapIconSulfurMine.png", "resource"],
  33: ["Storage Facility", "MapIconStorageFacility.png", "structure"],
  34: ["Factory", "MapIconFactory.png", "structure"],
  35: ["Garrison Station", "MapIconsFortGarrisonStation.png", "structure"],
  37: ["Rocket Site", "MapIconRocketSite.png", "structure"],
  38: ["Salvage Mine", "MapIconScrapMine.png", "resource"],
  39: ["Construction Yard", "MapIconConstructionYard.png", "structure"],
  40: ["Component Mine", "MapIconComponentMine.png", "resource"],
  45: ["Relic Base", "MapIconRelicBase.png", "structure"],
  46: ["Relic Base", "MapIconRelicBase.png", "structure"],
  47: ["Relic Base", "MapIconRelicBase.png", "structure"],
  51: ["Mass Production Factory", "MapIconMassProductionFactory.png", "structure"],
  52: ["Seaport", "MapIconSeaport.png", "structure"],
  53: ["Coastal Gun", "MapIconCoastalGun.png", "structure"],
  54: ["Soul Factory", "MapIconSoulFactory.png", "structure"],
  56: ["Town Base T1", "MapIconTownBaseTier1.png", "structure"],
  57: ["Town Base T2", "MapIconTownBaseTier2.png", "structure"],
  58: ["Town Base T3", "MapIconTownBaseTier3.png", "structure"],
  59: ["Storm Cannon", "MapIconStormcannon.png", "structure"],
  60: ["Intel Center", "MapIconIntelcenter.png", "structure"],
  61: ["Coal Field", "MapIconCoal.png", "resource"],
  62: ["Oil Field", "MapIconFuel.png", "resource"],
  70: ["Rocket Target", "MapIconRocketTarget.png", "structure"],
  71: ["Rocket Ground Zero", "MapIconRocketGroundZero.png", "structure"],
  72: ["Rocket Site With Rocket", "MapIconRocketSiteWithRocket.png", "structure"],
  75: ["Facility Mine Oil Rig", "MapIconFacilityMineOilRig.png", "resource"],
  83: ["Weather Station", "MapIconWeatherStation.png", "structure"],
  84: ["Mortar House", "MapIconMortarHouse.png", "structure"],
  88: ["Aircraft Depot", "MapIconAircraftDepot.png", "structure"],
  89: ["Aircraft Factory", "MapIconAircraftFactory.png", "structure"],
  91: ["Aircraft Runway T1", "MapIconAircraftRunwayT1.png", "structure"],
  92: ["Aircraft Runway T2", "MapIconAircraftRunwayT2.png", "structure"],
  97: ["Anti Air Gun", "MapIconAAGunAI.png", "structure"]
};

for (const [iconType, data] of Object.entries(LOCAL_ICON_FILES)) {
  ICONS[iconType] = data;
}

preloadVisibleIcons = async function(mapName) {
  const staticData = state.static.get(mapName) || {};
  const dynamicData = state.dynamic.get(mapName) || {};
  const types = new Set([
    ...(staticData.mapItems || []).map(item => item.iconType),
    ...(dynamicData.mapItems || []).map(item => item.iconType)
  ]);

  await Promise.all([...types].map(async type => {
    if (state.iconImages.has(type)) {
      return;
    }

    const entry = LOCAL_ICON_FILES[type];
    if (!entry) {
      state.iconImages.set(type, null);
      return;
    }

    try {
      const image = new Image();
      image.src = `icons/${entry[1]}`;
      await image.decode();
      state.iconImages.set(type, image);
    } catch (error) {
      console.warn(`Could not load local map icon ${type}: ${entry[1]}`, error);
      state.iconImages.set(type, null);
    }
  }));
};
