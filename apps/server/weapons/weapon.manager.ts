/**
 * Created by drw on 10/6/16.
 * Fabrica proyectiles según el nombre del arma. Sin uso real: slot.addProjectile lo llama con otra firma
 * (sin `name`) y nadie llama a addProjectile (ver docs/BUGS.md).
 */
import Mortar = require("./mortar.js");
import type WeaponProperties = require("../properties/weapon.properties.js");
import type Slot = require("../slot");

type MortarConstructor = new (...args: Parameters<typeof Mortar>) => Mortar;

class Weapon {
  declare slot: Slot;

  constructor(slot: Slot) {
    this.slot = slot;
  }

  makeWeapon(name: string, properties: WeaponProperties, x: number, y: number, vx: number, vy: number) {
    switch (name) {
      case "mortar":
      case "nuke":
      case "meganuke":
      case "gonuke":
      case "babynuke":
        // Mortar es una función-constructor (ver mortar.ts); TypeScript necesita que se lo indiquen
        return new (Mortar as unknown as MortarConstructor)(properties, x, y, vx, vy, this.slot);
    }
  }
}

export = Weapon;
