/**
 * Created by drw on 10/6/16.
 * Note: this is still experimental. It might blow your foot off.
 *
 * Roto y sin uso (ver docs/BUGS.md): Physical es una clase y Physical.apply(this) lanza TypeError, así
 * que construir un Mortar falla. Además el segundo `Mortar.prototype = {...}` pisa al primero. Se mantiene
 * con su forma original (función + prototype) para no cambiar ese comportamiento.
 */
import Physical = require("../physics/physical.js");
import type WeaponProperties = require("../properties/weapon.properties.js");
import type Slot = require("../slot");

interface Mortar extends Physical {
  properties: WeaponProperties;
  slot: Slot;
  step(): void;
  move(): void;
  onComplete(): void;
}

function Mortar(this: Mortar, properties: WeaponProperties, x: number, y: number, vx: number, vy: number, slot: Slot) {
  Physical.apply(this);
  this.properties = properties;
  this.X = x;
  this.Y = y;
  this.Vx = vx;
  this.Vy = vy;
  console.log("boundradius " + this.boundRadius);
  console.log(this.windR);
  console.log("Launched mortar with X: " + this.X + " Y: " + this.Y + " Vx: " + this.Vx + " Vy: " + this.Vy);
  this.slot = slot;
}

(Mortar as { prototype: object }).prototype = new Physical();

(Mortar as { prototype: object }).prototype = {
  step(this: Mortar) {
    const averageHit = this.slot.getCollisionAverage(this, this.boundPoints);

    this.Vx += -this.Vx * this.dt * this.windR;
    this.Vy = this.Vy + (this.gravity + (0 - this.Vy) * this.windR) * this.dt;

    if (averageHit.nP != 0) {
      console.log("projectile hit something!");
      this.move();
      this.onComplete();
      return;
    } else {
      console.log("projectile did not hit! X: " + this.X + " Y: " + this.Y + " Vx: " + this.Vx + " Vy: " + this.Vy +
        " WindR " + this.windR + " gravity " + this.gravity + " dt " + this.dt);
    }
  },

  move(this: Mortar) {
    const dY = this.Vy * this.dt;
    const dX = this.Vx * this.dt;
    this.X += dX;
    this.Y += dY;

    if (this.X < -10000 || this.Y < -10000) this.onComplete();

    if (this.Y > 1700) {
      this.onComplete();
    }
  },

  onComplete(this: Mortar) {
    this.complete = true;
    console.log("Mortar exploded at " + this.X + " " + this.Y);
    this.slot.field.explode(this.X, this.Y, this.properties.Rdirt); //this should be expanded
  },
};

export = Mortar;
