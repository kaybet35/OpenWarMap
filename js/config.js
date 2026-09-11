/* WarAPI enums and local asset metadata; kept independent of rendering. */
"use strict";
(() => {
  const app = window.OpenWarMap;
  app.config.icons = {
  5:  ["Static Base Tier 1", "MapIconStaticBase1.png", "structure"],                   // StaticBase1
  6:  ["Static Base Tier 2", "MapIconStaticBase2.png", "structure"],                   // StaticBase2
  7:  ["Static Base Tier 3", "MapIconStaticBase3.png", "structure"],                   // StaticBase3
  8:  ["Forward Base", "MapIconForwardBase1.png", "structure"],                        // ForwardBase1
  11: ["Hospital", "MapIconHospital.png", "structure"],                                // Hospital
  12: ["Garage", "MapIconVehicle.png", "structure"],                                   // VehicleFactory
  13: ["Armory", "MapIconArmory.png", "structure"],                                    // Armory
  15: ["Workshop", "MapIconWorkshop.png", "structure"],                                // Workshop
  17: ["Refinery", "MapIconManufacturing.png", "structure"],                           // Refinery
  18: ["Shipyard", "Shipyard.png", "structure"],                                       // Shipyard
  19: ["Engineering Center", "MapIconTechCenter.png", "structure"],                    // TechCenter
  20: ["Salvage Field", "SalvageMapIcon.png", "resource"],                             // SalvageField
  21: ["Component Field", "MapIconComponents.png", "resource"],                        // ComponentField
  22: ["Fuel Field", "MapIconFuel.png", "resource"],                                   // FuelField
  23: ["Sulfur Field", "MapIconSulfur.png", "resource"],                               // SulfurField
  27: ["Keep", "MapIconsKeep.png", "structure"],                                       // SpecialBase
  28: ["Observation Tower", "MapIconObservationTower.png", "structure"],               // ObservationTower
  29: ["Fort", "MapIconFort.png", "structure"],                                        // Fort
  32: ["Sulfur Mine", "MapIconSulfurMine.png", "resource"],                            // SulfurMine
  33: ["Storage Depot", "MapIconStorageFacility.png", "structure"],                    // StorageFacility
  34: ["Factory", "MapIconFactory.png", "structure"],                                  // Factory
  35: ["Safehouse", "MapIconSafehouse.png", "structure"],                              // GarrisonStation
  37: ["Rocket Platform", "MapIconRocketSite.png", "structure"],                       // RocketSite
  38: ["Salvage Mine", "MapIconScrapMine.png", "resource"],                            // SalvageMine
  39: ["Construction Yard", "MapIconConstructionYard.png", "structure"],               // ConstructionYard
  40: ["Component Mine", "MapIconComponentMine.png", "resource"],                      // ComponentMine
  45: ["Relic Base", "MapIconRelicBase.png", "structure"],                             // RelicBase1
  46: ["Relic Base", "MapIconRelicBase.png", "structure"],                             // RelicBase2
  47: ["Relic Base", "MapIconRelicBase.png", "structure"],                             // RelicBase3
  51: ["Mass Production Factory", "MapIconMassProductionFactory.png", "structure"],    // MassProductionFactory
  52: ["Seaport", "MapIconSeaport.png", "structure"],                                  // Seaport
  53: ["Coastal Gun", "MapIconCoastalGun.png", "structure"],                           // CoastalGun
  54: ["Font of Balor", "MapIconSoulFactory.png", "structure"],                        // SoulFactory
  56: ["Town Base Tier 1", "MapIconTownBaseTier1.png", "structure"],                   // TownBase1
  57: ["Town Base Tier 2", "MapIconTownBaseTier2.png", "structure"],                   // TownBase2
  58: ["Town Base Tier 3", "MapIconTownBaseTier3.png", "structure"],                   // TownBase3
  59: ["Storm Cannon", "MapIconStormcannon.png", "structure"],                         // LRArtillery
  60: ["Intelligence Center", "MapIconIntelcenter.png", "structure"],                  // IntelCenter
  61: ["Coal Field", "MapIconCoal.png", "resource"],                                   // CoalField
  62: ["Oil Field", "MapIconFuel.png", "resource"],                                    // OilField
  70: ["Rocket Target", "MapIconRocketTarget.png", "structure"],                       // RocketTarget
  71: ["Rocket Ground Zero", "MapIconRocketGroundZero.png", "structure"],              // RocketGroundZero
  72: ["Rocket Platform With Rocket", "MapIconRocketSiteWithRocket.png", "structure"], // RocketSiteWithRocket
  75: ["Offshore Platform", "MapIconFacilityMineOilRig.png", "resource"],              // FacilityMineOilRig
  83: ["Weather Station", "MapIconWeatherStation.png", "structure"],                   // WeatherStation
  84: ["Emplacement House", "MapIconMortarHouse.png", "structure"],                    // MortarHouse
  88: ["Aircraft Depot", "MapIconAircraftDepot.png", "structure"],                     // AircraftDepot
  89: ["Aircraft Hangar", "MapIconAircraftFactory.png", "structure"],                  // AircraftFactory
  91: ["Aircraft Runway Tier 1", "MapIconAircraftRunwayT1.png", "structure"],          // AircraftRunwayT1
  92: ["Aircraft Runway Tier 2", "MapIconAircraftRunwayT2.png", "structure"],          // AircraftRunwayT2
  97: ["Anti-Air Gun", "MapIconAAGunAI.png", "structure"]                              // AntiAirGun
};
  app.config.enums = {
  0: "None",
  1: "HomeTown",
  2: "TownHall",
  3: "Outpost",
  4: "PortBase",
  5: "StaticBase1",
  6: "StaticBase2",
  7: "StaticBase3",
  8: "ForwardBase1",
  9: "ForwardBase2",
  10: "ForwardBase3",
  11: "Hospital",
  12: "VehicleFactory",
  13: "Armory",
  14: "SupplyStation",
  15: "Workshop",
  16: "ManufacturingPlant",
  17: "Refinery",
  18: "Shipyard",
  19: "TechCenter",
  20: "SalvageField",
  21: "ComponentField",
  22: "FuelField",
  23: "SulfurField",
  24: "WorldMapTent",
  25: "TravelTent",
  26: "TrainingArea",
  27: "SpecialBase",
  28: "ObservationTower",
  29: "Fort",
  30: "TroopShip",
  31: "ScrapMine",
  32: "SulfurMine",
  33: "StorageFacility",
  34: "Factory",
  35: "GarrisonStation",
  36: "AmmoFactory",
  37: "RocketSite",
  38: "SalvageMine",
  39: "ConstructionYard",
  40: "ComponentMine",
  41: "OilWell",
  42: "OperationStorageFacility",
  43: "FrontierBase",
  44: "CursedFort",
  45: "RelicBase1",
  46: "RelicBase2",
  47: "RelicBase3",
  48: "FortBase1",
  49: "FortBase2",
  50: "FortBase3",
  51: "MassProductionFactory",
  52: "Seaport",
  53: "CoastalGun",
  54: "SoulFactory",
  55: "BorderBase",
  56: "TownBase1",
  57: "TownBase2",
  58: "TownBase3",
  59: "LRArtillery",
  60: "IntelCenter",
  61: "CoalField",
  62: "OilField",
  63: "ResourceTransfer1",
  64: "ResourceTransfer2",
  65: "ResourceTransfer3",
  66: "MaintenanceTunnel",
  67: "FacilityVehicleFactory1",
  68: "FacilityVehicleFactory2",
  69: "FacilityModCenter",
  70: "RocketTarget",
  71: "RocketGroundZero",
  72: "RocketSiteWithRocket",
  73: "LargeShipBaseShip",
  74: "LargeShipStorageShip",
  75: "FacilityMineOilRig",
  76: "FacilityVehicleFactory3",
  77: "MapPostPublic",
  78: "MapPostSquad",
  79: "MapPostRegiment",
  80: "MapPostIntelligence",
  81: "MapPostFacility",
  82: "MapPostLogistics",
  83: "WeatherStation",
  84: "MortarHouse",
  85: "ResourceTransfer4",
  86: "FacilitySmallArmsFactory",
  87: "FortGarrisonStation",
  88: "AircraftDepot",
  89: "AircraftFactory",
  90: "FortAircraftRadar",
  91: "AircraftRunwayT1",
  92: "AircraftRunwayT2",
  93: "IntelGround",
  94: "IntelAir",
  95: "LargeShipAircraftC",
  96: "LargeShipBattleshipAircraftW",
  97: "AntiAirGun",
  98: "IntelArea"
};
  app.config.resourceTypes = new Set([20,21,22,23,31,32,38,40,41,61,62,75]);
  app.config.baseTypes = new Set([45,46,47,56,57,58]);
  app.config.colors = { WARDENS: "#6f9bd0", COLONIALS: "#739d6f", NONE: "#aaa99f" };
  app.config.ownerColors = { WARDENS: "rgba(111,155,208,0.2)", COLONIALS: "rgba(115,157,111,0.2)" };
  app.config.iconName = type => (app.config.icons[type]?.[0] || app.config.enums[type] || "Icon " + type).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Za-z])(\d+)/g, "$1 $2");
})();
