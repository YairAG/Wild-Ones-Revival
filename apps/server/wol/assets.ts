// Datos del juego (.dat): se descargan uno por uno desde ASSETS_URL al arrancar y se rellenan las
// plantillas de properties/. Cuando están todos, se abre el servidor TCP.
import AccessoriesProperties = require("../properties/accessories.properties.js");
import WeaponProperties = require("../properties/weapon.properties.js");
import MapProperties = require("../properties/map.properties.js");
import PetFoodProperties = require("../properties/pet.food.properties.js");
import ChassisProperties = require("../properties/chassis.properties.js");
import type WOL = require("./index.js");
import type { GameConfig } from "../types";

const DEBUG = true;

type Item = Record<string, unknown>;

// Descarga el asset número `pos` de la lista y, al terminar, el siguiente
export function loadAssets(wol: WOL, pos: number): void {
  const item = wol.assetsList[pos];
  // Si la descarga falla, body queda undefined y JSON.parse lanza: el proceso se cae (como con request)
  fetch(wol.assetsURL + item + ".dat?cachev=" + wol.assetsCacheVersion)
    .then(
      (res) => res.text(),
      () => undefined,
    )
    .then(function (body) {
      wol.assetsObj[item] = JSON.parse(body as string);
      console.log("Loaded asset: " + item);

      if (wol.assetsList.length - 1 > pos) loadAssets(wol, pos + 1);
      else onAssetsLoaded(wol);
    });
}

function onAssetsLoaded(wol: WOL): void {
  if (DEBUG) console.log("All assets loaded. Processing..");
  wol.config = wol.assetsObj["Config"] as GameConfig;
  wol.accessoriesObj = byKey(wol.assetsObj["Accessories"], AccessoriesProperties, "type");
  wol.crateObj = wol.assetsObj["Crate"];
  processLevels(wol);
  wol.mapsObj = byKey(wol.assetsObj["Maps"], MapProperties, "name");
  wol.petFoodsObj = byKey(wol.assetsObj["PetFoods"], PetFoodProperties, "type");
  wol.petsObj = byKey(wol.assetsObj["Pets"], ChassisProperties, "type");
  wol.weaponsObj = byKey(wol.assetsObj["WeaponsGrid"], WeaponProperties, "type");
  if (DEBUG) console.log("Done processing. \n");
  wol.run();
}

// Crea una plantilla por elemento, le copia los campos del .dat y las indexa por `key` (type o name)
function byKey<T extends object>(
  items: unknown,
  Template: new () => T,
  key: string,
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items as Item[]) {
    const obj = Object.assign(new Template(), item);
    result[(obj as Item)[key] as string] = obj;
  }
  return result;
}

// Nivel en el que se desbloquea cada mapa, mascota y arma (el servidor lo calcula pero no lo usa)
function processLevels(wol: WOL): void {
  wol.levelsObj = wol.assetsObj["Levels"];

  let _level = 1;
  for (const i in wol.levelsObj as Item[]) {
    const level = (wol.levelsObj as Record<string, Record<string, string[]>>)[i];
    for (const itemIndex in level.map) {
      wol.itemLevel[level.map[itemIndex]] = _level;
      if (DEBUG) console.log("item " + level.map[itemIndex] + " has level " + _level);
    }
    for (const itemIndex in level.chassis) {
      wol.itemLevel[level.chassis[itemIndex]] = _level;
      if (DEBUG) console.log("item " + level.chassis[itemIndex] + " has level " + _level);
    }
    for (const itemIndex in level.weapon) {
      wol.itemLevel[level.weapon[itemIndex]] = _level;
      if (DEBUG) console.log("item " + level.weapon[itemIndex] + " has level " + _level);
    }
    _level++;
  }
}
