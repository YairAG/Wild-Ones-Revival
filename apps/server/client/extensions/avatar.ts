// Personaje de un jugador en partida. Lo que se usa hoy: posición (X, Y), dirección, apuntado,
// si ya disparó (alreadyShot), si está bloqueado (locked) y si murió (dead).
// La física (step, move, colisiones) está copiada del cliente Flash pero desactivada y con bugs.
import Physical = require("../../physics/physical.js");
import Point = require("../../helpers/point.js");
import type CollisionAverage = require("../../physics/collision.js");
import type ChassisProperties = require("../../properties/chassis.properties.js");
import type WeaponProperties = require("../../properties/weapon.properties.js");
import type GameClient = require("../client.game.js");

type PointXY = { X: number; Y: number };

// bug: avatar usa Utils sin importarlo (ver docs/BUGS.md). Esta línea es solo para el tipado:
// en ejecución Utils sigue sin existir y export() lanza ReferenceError, igual que antes.
declare const Utils: typeof import("../../helpers/utils.js");

class Avatar extends Physical {
  declare parent: GameClient;
  declare maxFireTick: number;
  declare maxWalkSpeed: number;
  declare gunFirePower: number;
  declare gunX: number;
  declare gunY: number;
  declare climbBoundPoints: PointXY[];
  declare chassis: string;
  declare jump: number;
  declare averageHit: CollisionAverage | null;
  declare isHitBig: boolean;
  declare underwater: boolean;
  declare gunLength: number;
  declare waitingForJumpTick: number;
  declare reticleLength: number;
  declare groundPoints: PointXY[];
  declare isWalkingRight: boolean;
  declare accumulateDamage: object;
  declare _climbing: boolean;
  declare _grappling: boolean;
  declare startFireTick: number;
  declare moveGrappling: number;
  declare waitingForJump: boolean;
  declare superJumpTick: number;
  declare lastHealth: number;
  declare isClient: boolean;
  declare isWalkingLeft: boolean;
  declare holdRight: boolean;
  declare shotX: number;
  declare shotY: number;
  declare minAngle: number;
  declare digging: boolean;
  declare wasLastFacingRight: boolean;
  declare gooTick: number;
  declare maxAngle: number;
  declare angle: number;
  declare isFacingRight: boolean;
  declare walkAcceleration: number;
  declare jumpDirection: string;
  declare maxFPDistance: number;
  declare fpDistance: number;
  declare dead: boolean;
  // Asignados desde fuera (handler.js / slot.js) o nunca asignados (física desactivada)
  declare alreadyShot: boolean;
  declare locked: boolean;
  declare gA: number;
  declare tt: number;
  declare player: unknown;
  declare color: unknown;
  declare ownedPet: unknown;
  declare currentTurn: unknown;
  declare startFireTrick: unknown;
  declare isFacingLeft: boolean;
  declare properties: ChassisProperties;
  declare drowningProperties: WeaponProperties;
  declare climbProperties: WeaponProperties;

  constructor(parent: GameClient) {
    super();
    this.parent = parent;
    this.maxFireTick = 200;
    this.maxWalkSpeed = 0.004;
    this.gunFirePower = 0;
    this.gunX = 0;
    this.gunY = 0;
    this.climbBoundPoints = [];
    this.chassis = "";
    this.jump = 0.2;
    this.averageHit = null;
    this.isHitBig = false;
    this.underwater = false;
    this.gunLength = 45;
    this.waitingForJumpTick = 0;
    this.reticleLength = 105;
    this.groundPoints = [];
    this.isWalkingRight = false;
    this.accumulateDamage = {};
    this._climbing = false;
    this._grappling = false;
    this.startFireTick = 0;
    this.moveGrappling = 0;
    this.waitingForJump = false;
    this.superJumpTick = -10000;
    this.lastHealth = -1;
    this.isClient = false;
    this.isWalkingLeft = false;
    this.holdRight = false;
    this.shotX = 0;
    this.shotY = 0;
    this.minAngle = 0;
    this.digging = false;
    this.wasLastFacingRight = false;
    this.gooTick = 0;
    this.maxAngle = 1.5707963267949;
    this.angle = 0;
    this.isFacingRight = false;
    this.walkAcceleration = 0.01;
    this.jumpDirection = "up";
    this.maxFPDistance = 450;
    this.fpDistance = 0;

    this.dead = false;
  }

  initialize(): void {
    this.type = "avatar";
    // El resto (cargar stats de la mascota, puntos de colisión) está comentado en el original
  }

  setBoundPoints(): void {
    const halfBound = this.boundRadius * 0.5;
    const semiCircleTop = this.getSemicirclePoints(0, 0 - halfBound, 0 - Math.PI, halfBound);
    const line1 = this.getLinearPoints(halfBound, 0 - halfBound, Math.PI * 0.5, this.boundRadius);
    const semiCircleBottom = this.getSemicirclePoints(0, halfBound, 0, halfBound);
    const line2 = this.getLinearPoints(0 - halfBound, halfBound, (0 - Math.PI) * 0.5, this.boundRadius);
    this.boundPoints = semiCircleTop.concat(semiCircleBottom).concat(line1).concat(line2);
    this.nChecks = this.boundPoints.length;
  }

  export(): Record<string, unknown> {
    const object: Record<string, unknown> = {};
    object["X"] = Utils.intToString(this.X);
    object["Y"] = Utils.intToString(this.Y);
    object["A"] = Utils.intToString(this.A);
    object["Vx"] = Utils.intToString(this.Vx);
    object["Vy"] = Utils.intToString(this.Vy);
    object["Va"] = Utils.intToString(this.Va);
    object["hp"] = Utils.intToString(this.hp);
    object["tt"] = Utils.intToString(this.tt);
    object["complete"] = this.complete;
    object["player"] = this.player;
    object["color"] = this.color;
    object["ownedPet"] = this.ownedPet;
    object["currentTurn"] = this.currentTurn;
    object["startFireTrick"] = this.startFireTrick;
    object["gunFirePower"] = Utils.intToString(this.gunFirePower);
    object["isFacingRight"] = this.isFacingRight;
    object["isFacingLeft"] = this.isFacingLeft;
    object["isWalkingLeft"] = this.isWalkingLeft;
    object["isWalkingRight"] = this.isWalkingRight;
    object["waitingForJump"] = this.waitingForJump;
    object["jumpDirection"] = this.jumpDirection;
    object["waitingForJumpTick"] = this.waitingForJumpTick;
    object["underwater"] = this.underwater;
    object["climbing"] = this.climbing;
    object["digging"] = this.digging;
    object["superJumpTick"] = this.superJumpTick;
    object["gooTick"] = this.gooTick;
    object["moveGrappling"] = this.moveGrappling;
    return object;
  }

  step(): void {
    if (this.walking && this.digging && this.parent.getGame().tick % 8 == 0) {
      this.gA = -this.trueGunAngle;
      // @ts-expect-error bug: X, Y y gA sin this. (ver docs/BUGS.md)
      this.parent.getGame().field.explode(X + Math.cos(gA) * 10, Y - Math.sin(gA) * 10, this.boundRadius + 1);
    } else this.A = 0;

    this.totalTime += this.dt;
    this.Vy = this.Vy + this.gravity * this.dt;

    let averageHitG: CollisionAverage | null = null;

    if (this.climbing) {
      averageHitG = this.monkeyClimb();
      const aveBounceXG = averageHitG.sumX;
      const aveBounceYG = averageHitG.sumY;

      this.Vx = this.Vx + 0.001 * aveBounceXG;
      this.Vy = this.Vy + 0.001 * aveBounceYG;
    }

    if (this.isWalkingLeft) {
      if (this.grappling) {
        this.Vx = this.Vx - 0.002;
      }
      this.Va = this.maxWalkSpeed;
    } else if (this.isWalkingRight) {
      if (this.grappling) {
        this.Vx = this.Vx + 0.002;
      }
      this.Va = -this.maxWalkSpeed;
    } else {
      this.Va = 0;
    }

    if (this.climbing) {
      this.averageHit = this.parent.getGame().getCollisionAverage(this, this.climbBoundPoints, false, true, true, true);
    } else {
      this.averageHit = this.parent.getGame().getCollisionAverage(this, this.boundPoints, false, true, true, true);
    }

    const nBounce = this.averageHit.nP;

    const aveBounceX = this.averageHit.sumX;
    let aveBounceY = this.averageHit.sumY;
    const originalBounceY = aveBounceY;

    if (!this.climbing) {
      let nAveBounceY: number;
      if (aveBounceY > this.boundRadius * 0.5) {
        nAveBounceY = aveBounceY - this.boundRadius * 0.5;
      } else if (aveBounceY < (0 - this.boundRadius) * 0.5) {
        nAveBounceY = aveBounceY + this.boundRadius * 0.5;
      } else {
        nAveBounceY = 0;
      }

      aveBounceY = nAveBounceY;
    }

    if (nBounce != 0) {
      if (this.isHitBig) {
        //animation is played on the client side
        this.isHitBig = false;
      }

      const r2 = aveBounceX * aveBounceX + aveBounceY * aveBounceY;
      const r = Math.sqrt(r2);

      if (r2 != 0 && nBounce < this.nChecks / 2) {
        const Vnormal = (aveBounceX * this.Vx + aveBounceY * this.Vy) / r;

        if (Vnormal > 0.4) {
          if (aveBounceY > 0) {
            // bug: resta un número a la partida en vez de a su tick (ver docs/BUGS.md)
            if (this.parent.getGame() - this.superJumpTick < 800) {
              //apply dust
            } else {
              const hits = this.checkAvatarFallHit();
              //take damage of other characters
              if (hits.length > 0) {
                // vacío en el original
              } else {
                //to be done
              }
            }
          } else {
            this.hp = this.hp - (Math.abs(Vnormal) - 0.4) * this.properties.falldmg;
          }
        }

        if (this.waitingForJump && (originalBounceY > 2 || this.climbing)) {
          if (this.parent.getGame().tick - this.waitingForJumpTick < 50) {
            if (this.climbing) {
              if (averageHitG && averageHitG.nP > 0) {
                //fix averageHitG
                // @ts-expect-error bug: A sin this. (ver docs/BUGS.md)
                const jumpAngle = A - Math.PI * 0.5;
                this.Vx = this.jump * Math.cos(jumpAngle);
                this.Vy = this.jump * Math.sin(jumpAngle);
              }
            } else {
              this.Vy = 0 - this.jump;
            }
          } else {
            this.waitingForJump = false;
          }
        } else {
          const _local21 = (aveBounceX * this.Vy - aveBounceY * this.Vx) / r;

          if (
            !this.walking &&
            this.averageHit.nWall < this.averageHit.nP &&
            ((aveBounceY > this.boundRadius * 0.25 && Math.abs(_local21) < 0.05 && Math.abs(Vnormal) < 0.05) ||
              this.climbing)
          ) {
            this.Vx = 0;
            this.Vy = 0;
            return;
          }

          const _local22 = (Vnormal * aveBounceX) / r;
          const _local23 = (Vnormal * aveBounceY) / r;
          const _local24 = this.Vx - _local22;
          const _local25 = this.Vy - _local23;
          let _local26 = 0;
          if (this.climbing) {
            if (averageHitG.nP > 0) {
              // @ts-expect-error bug: Va sin this. (ver docs/BUGS.md)
              _local26 = _local21 + r * Va * this.climbProperties.Vmax;
            }
          } else if (originalBounceY > 10) {
            _local26 = _local21 + r * this.Va;
          }
          if (Vnormal > 0) {
            this.Vx =
              this.bounce * (0 - _local22) +
              (_local24 / _local21) * _local26 * 0.5 -
              (0.5 * this.gravity * this.dt * aveBounceX) / r;
            this.Vy = this.bounce * (0 - _local23) + (_local25 / _local21) * _local26 * 0.5;
          }
        }
      } else if (nBounce < this.nChecks) {
        const vel = new Point(0 - aveBounceX, 0 - originalBounceY);
        vel.normalize(0.1);
        this.Vx = vel.x;
        this.Vy = vel.y;
      } else {
        if (this.parent.isCurrentPlayer() && this.parent.getGame().tick % this.drowningProperties.interval == 0) {
          this.hp = this.hp - this.drowningProperties.damage;
        }
        if (this.isWalkingRight) {
          this.Vx = 0.04;
          this.Vy = -0.04;
        } else if (this.isWalkingLeft) {
          this.Vx = -0.04;
          this.Vy = -0.04;
        } else {
          this.Vx = 0;
          this.Vy = 0;
        }
      }
    } else if (this.underwater) {
      if (this.isWalkingLeft) {
        this.Vx = -0.1;
      }
      if (this.isWalkingRight) {
        this.Vx = 0.1;
      }
      if (this.parent.getGame().tick % 40 == 0 && this.parent.getGame().tick - this.waitingForJumpTick < 50) {
        this.Vy = -0.25;
        this.waitingForJump = false;
      }
    } else if (!this.climbing && !this.grappling) {
      if (this.isWalkingLeft && this.Vx > -0.07) {
        this.Vx = this.Vx - 0.002;
      }
      if (this.isWalkingRight && this.Vx < 0.07) {
        this.Vx = this.Vx + 0.002;
      }
    }
  }

  setPosition(x: number, y: number): void {
    this.X = x;
    this.Y = y;
  }

  move(): void {
    const dX = this.Vx * this.dt;
    const dY = this.Vy * this.dt;

    this.X += dX;
    this.Y += dY;

    if (this.parent.getGame().currentPlayer == this.parent.player.id && this.parent.getGame().tick % 50 == 0)
      console.log("[" + this.parent.getGame().tick + "] " + "X is " + this.X + " Y is " + this.Y);

    if (dX != 0 && dY != 0) {
      if (this.parent.getGame().tick % 1 == 0) {
        const cmd = {
          command: "p",
          i: [this.parent.player.id, parseInt(String(this.X)), parseInt(String(this.Y))],
        };

        this.parent.getGame().sendPacketE(cmd, this.parent);
      }
    }

    if (this.Y > this.parent.WOL.config["gameHeight"] + 10) this.hp = 0;
    //implement water
  }

  stopWalking(): void {
    this.isWalkingLeft = false;
    this.isWalkingRight = false;
  }

  // @ts-expect-error bug: sin implementar, devuelve undefined y step() falla al escalar (ver docs/BUGS.md)
  monkeyClimb(): CollisionAverage {
    //to implement
  }

  checkAvatarFallHit(): Avatar[] {
    const clients = this.parent.getGame().getClients();
    const result: Avatar[] = [];

    for (const key in clients) {
      const checkObj = clients[key].avatar;
      const dY = this.Y - checkObj.Y;
      if (!(checkObj.complete || checkObj === this || dY > 0)) {
        const RR1 = checkObj.boundRadius + this.boundRadius + 2;
        const RR2 = RR1 * RR1;
        const dX = this.X - checkObj.X;
        if (dX * dX + dY * dY < RR2) {
          result.push(checkObj);
        }
      }
    }

    return result;
  }

  //getters - setters
  get firePower(): number {
    if (this.fpDistance == 0) return 0;
    let result = this.fpDistance / this.maxFPDistance;
    if (result > 1) result = 1;
    if (result < 0.01) result = 0.01;

    this.shotX = this.X;
    this.shotY = this.Y;

    return result;
  }

  get walking(): boolean {
    return this.isWalkingLeft || this.isWalkingRight;
  }

  getGunPoint(len: number): PointXY {
    const A1 = this.isFacingRight ? this.A : Math.PI + this.A;
    const result = { X: this.gunX * Math.cos(A1), Y: this.gunX * Math.sin(A1) };
    if (len == 0) return result;
    return { X: result.X + this.getGunTipPoint(len).X, Y: result.Y + this.getGunTipPoint(len).Y };
  }

  getGunTipPoint(len: number): PointXY {
    const A2 = this.trueGunAngle;
    return { X: len * Math.cos(A2), Y: len * Math.sin(A2) };
  }

  get trueGunAngle(): number {
    if (this.isFacingRight) return -this.angle + this.A;
    else return Math.PI + this.angle + this.A;
  }

  set trueGunAngle(value: number) {
    let theta = this.A - value;

    if (theta < -Math.PI) {
      theta = theta + Math.PI * 2;
    }
    if (theta > Math.PI) {
      theta = theta - Math.PI * 2;
    }
    this.isFacingRight = theta < Math.PI * 0.5 && theta > -Math.PI * 0.5;
    if (!this.isFacingRight) {
      theta = value - Math.PI - this.A;
      if (theta < -Math.PI) {
        theta = theta + Math.PI * 2;
      }
      if (theta > Math.PI) {
        theta = theta - Math.PI * 2;
      }
    }

    this.angle = theta;
  }

  get climbing(): boolean {
    return this._climbing;
  }

  set climbing(value: boolean) {
    // @ts-expect-error bug: _climing (typo), nunca cambia _climbing (ver docs/BUGS.md)
    this._climing = value;
  }

  get grappling(): boolean {
    return this._grappling;
  }

  set grappling(value: boolean) {
    this._grappling = value;
  }
}

export = Avatar;
