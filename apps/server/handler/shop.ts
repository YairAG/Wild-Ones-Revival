// Lobby: tienda (armas, accesorios, mascotas), ruleta y equipamiento. Los precios salen de los .dat
import type LobbyClient = require("../client/client.lobby.js");
import type WOL = require("../wol.js");
import type { LobbyMessage } from "@wildones/protocol";

const DEBUG = true;

type Msg<C> = Extract<LobbyMessage, { command: C }>;

export function handleNewPlayerFlag(client: LobbyClient): void {
  client.player.nw = -1;
  client.updatePlayerData();
}

export function handlePetModification(client: LobbyClient, data: Msg<"modify_pet">): void {
  console.log("[" + client.connectionType + "] handlePetModification");
  if (!client.player) console.log("no player data!");
  if (!client.player.ownedPets[data.petid]) {
    console.log("*** Pet id is not valid");
    return;
  }

  client.player.ownedPets[data.petid].color1 = data.color1;
  client.player.ownedPets[data.petid].color2 = data.color2;
  client.player.ownedPets[data.petid].name = data.name;
  client.updatePlayerData();
}

export function handleChanceWheel(client: LobbyClient): void {
  if (client.connectionType == "lobby") {
    client.sendPacket({
      command: "chance_wheel_return",
      value: client.getReward(),
    });
  }
}

export function handleChangePet(client: LobbyClient, data: Msg<"change_pet">): void {
  if (!client.ownsPet(data.name)) return;

  client.player.currentPet = data.name;
  client.sendUpdate();
  client.updatePlayerData();
}

export function handleBuyAccessory(client: LobbyClient, data: Msg<"buy_accessory">, wol: WOL): void {
  if (client.connectionType != "lobby") return;

  const type = data.type;

  if (!wol.accessoriesObj[type]) {
    console.log("type of accessory not found!");
    return;
  }

  if (wol.accessoriesObj[type].currency == "treats") {
    if (client.chargeTreats(wol.accessoriesObj[type].price as number)) {
      client.player.userAccessories.push(type);
      client.sendUpdate();
      client.updatePlayerData();
    } else {
      if (DEBUG) console.log(">> not enough treats");
    }
  } else {
    if (client.chargeGold(wol.accessoriesObj[type].price as number)) {
      client.player.userAccessories.push(type);
      client.sendUpdate();
      client.updatePlayerData();
    } else {
      if (DEBUG) console.log(">> not enough gold");
    }
  }
}

export function handleAccLoad(client: LobbyClient, data: Msg<"set_acc_load">, wol: WOL): void {
  if (client.connectionType != "lobby") return;

  let valid = data.load.every(function (val) {
    return client.player.userAccessories.indexOf(val) >= 0;
  });

  // bug: cuenta por .type (único por accesorio) en vez de .category (ver docs/BUGS.md)
  const occurrences: Record<string, number> = {};
  for (const key in data.load) {
    const item = data.load[key];
    occurrences[wol.accessoriesObj[item].type] =
      occurrences[wol.accessoriesObj[item].type] != null ? occurrences[wol.accessoriesObj[item].type] + 1 : 1;
    if (occurrences[wol.accessoriesObj[item].type] > 1) {
      valid = false;
      break;
    }
  }

  if (valid) {
    client.player.ownedPets[client.player.currentPet].accessories = data.load;
    client.sendUpdate();
    client.updatePlayerData();
  } else {
    console.log("Client " + client.player.dname + " is feeling 1337 today!");
    //log event
  }
}

export function handleBuyPet(client: LobbyClient, data: Msg<"buy_pet">, wol: WOL): void {
  if (client.connectionType != "lobby") return;
  if (!data.name) return;

  if (
    wol.config.petDetailColors.indexOf(data.color2.toString(16)) < 0 ||
    wol.config.petMainColors.indexOf(data.color1.toString(16)) < 0
  ) {
    if (DEBUG) console.log(">>> Color hack!");
    return;
  }

  if (!wol.petsObj[data.type]) {
    if (DEBUG) console.log(">>> pet does not exist in crumbs " + data.type);
    return;
  }

  if (wol.petsObj[data.type].currency == "treats") {
    if (!client.chargeTreats(parseInt(String(wol.petsObj[data.type].price)))) {
      if (DEBUG) console.log(">> not enough treats for pet!");
      return;
    }
  } else {
    if (!client.chargeGold(parseInt(String(wol.petsObj[data.type].price)))) {
      if (DEBUG) console.log(">> not enough gold for pet!");
      return;
    }
  }

  if (DEBUG) console.log(">> surpassed checkers adopting pet!");

  const petInfo = {
    id: Object.keys(client.player.ownedPets).length + 1,
    gender: "M",
    name: data.name,
    color1: data.color1,
    color2: data.color2,
    kills: 0,
    deaths: 0,
    type: data.type,
    pers: "physicist",
    accessories: [],
  };

  client.player.ownedPets[petInfo["id"]] = petInfo;
  client.sendUpdate();
  client.updatePlayerData();
}

export function handleDeletePet(client: LobbyClient, data: Msg<"delete_pet">): void {
  if (client.connectionType != "lobby") return;
  if (!data.petId) return;

  const len = Object.keys(client.player.ownedPets).length + 1;

  if (len <= 2) return;

  // Corre las mascotas siguientes una posición hacia abajo y borra la última
  for (let i = parseInt(String(data.petId)); i < len - 1; i++) {
    if (client.player.ownedPets[i] && client.player.ownedPets[i + 1]) {
      client.player.ownedPets[i] = client.player.ownedPets[i + 1];
      client.player.ownedPets[i].id = i;
    }
  }

  delete client.player.ownedPets[len - 1];
  client.player.currentPet = 1;
  client.sendUpdate();
  client.updatePlayerData();
}

export function handleBuyAmmo(client: LobbyClient, data: Msg<"buy_ammo">, wol: WOL): void {
  if (client.connectionType != "lobby") return;

  const type = data.ammoType;
  const count = data.ammoCount;

  if (!wol.weaponsObj[type]) {
    if (DEBUG) console.log(">> no wep of type " + type);
    return;
  }

  if (!count) return;

  //also check for level

  // Cantidad que se suma: purchaseAmount × count (o count si el arma no tiene purchaseAmount)
  const weapon = wol.weaponsObj[type];
  const amount = weapon.purchaseAmount ? parseInt(String(weapon.purchaseAmount)) * data.ammoCount : data.ammoCount;
  const paid =
    weapon.currency == "treats"
      ? client.chargeTreats((weapon.price as number) * data.ammoCount)
      : client.chargeGold((weapon.price as number) * data.ammoCount);

  if (paid) {
    if (client.player.userWeaponsOwned[type]) client.player.userWeaponsOwned[type] += amount;
    else client.player.userWeaponsOwned[type] = amount;

    client.sendUpdate();
    client.updatePlayerData();
  } else if (DEBUG) {
    console.log(weapon.currency == "treats" ? ">> could not afford treat wep " + type : ">> could not afford wep gold" + type);
  }
}

export function handleSetWeaponsEquipped(client: LobbyClient, data: Msg<"set_weapons_equipped">): void {
  let validSet = true;
  for (let i = 0; i < data.value.length; i++) {
    // Armas gratis: no hace falta tenerlas
    if (
      data.value[i] == "mortar" || data.value[i] == "superjump" || data.value[i] == "empty" || data.value[i] == "punch" ||
      data.value[i] == "walk" || data.value[i] == "bone" || data.value[i] == "dig" || data.value[i] == "climb" ||
      data.value[i] == ""
    ) {
      continue;
    }

    if (!client.player.userWeaponsOwned[data.value[i]]) {
      console.log(">> invalid_set: " + data.value[i]);
      // @ts-expect-error bug: falta this., lanza ReferenceError (ver docs/BUGS.md)
      invalidItemLog.write("Supposedly invalid item: " + data.value[i]);
      validSet = false;
      break;
    }
  }

  if (!validSet) return;

  client.player.userWeaponsEquipped = data.value;
  client.sendUpdate();
  client.updatePlayerData();
}
