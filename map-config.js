const MAP_ICON_ENUM = {
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

const RESOURCE_ICON_TYPES = new Set([
  20, 21, 22, 23, 31, 32, 38, 40, 41, 61, 62, 75
]);

for (const [idText, enumName] of Object.entries(MAP_ICON_ENUM)) {
  const id = Number(idText);
  if (id === 0 || ICONS[id]) {
    continue;
  }

  ICONS[id] = [enumName, null, RESOURCE_ICON_TYPES.has(id) ? "resource" : "structure"];
}

drawMapLabels = function(ctx, labels, mapX, mapY, mapWidth, mapHeight) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const label of labels) {
    const x = mapX + label.x * mapWidth;
    const y = mapY + label.y * mapHeight;
    const major = label.mapMarkerType === "Major";
    const fontSize = major ? 13 : 10;

    ctx.font = `${major ? 600 : 500} ${fontSize}px Jost, sans-serif`;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgb(192, 181, 149)";
    ctx.strokeText(label.text, x, y);
    ctx.fillStyle = "rgb(71, 87, 85)";
    ctx.fillText(label.text, x, y);
  }

  ctx.restore();
};
