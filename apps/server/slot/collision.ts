// Colisiones de la física del servidor (desactivada: solo la llamaría avatar.step / mortar.step)
import CollisionAverage = require("../physics/collision.js");
import type Physical = require("../physics/physical.js");
import type Slot = require("./index.js");

type PointXY = { X: number; Y: number };

/** Promedio de los puntos de `pointSet` (relativos a obj) que chocan con objetos, paredes o terreno */
export function collisionAverage(
  slot: Slot,
  obj: Physical,
  pointSet: PointXY[],
  checkNonAvatar?: boolean,
  checkAvatar?: boolean,
  checkField?: boolean,
  checkWalls?: boolean,
): CollisionAverage {
  let avg = new CollisionAverage();
  for (let j = 0; j < pointSet.length; j++) {
    const fieldX = obj.X + pointSet[j].X;
    const fieldY = obj.Y + pointSet[j].Y;

    for (let i = 0; i < slot.physicsObjects.length; i++) {
      const other = slot.physicsObjects[i];
      if (other.type == "avatar" && !checkAvatar) continue;
      if ((other.type == "crate" || other.type == "mine") && !checkNonAvatar) continue;
      if (!other.complete && other != obj) {
        if (other.checkCollision(fieldX, fieldY)) {
          avg.sumX += pointSet[j].X;
          avg.sumY += pointSet[j].Y;
          avg.nP++;
        }
      }
    }
  }

  if (checkWalls) {
    for (let j = 0; j < pointSet.length; j++) {
      const fieldX = obj.X + pointSet[j].X;

      if (fieldX < 0 || fieldX > slot.field.width) {
        avg.sumX += pointSet[j].X;
        avg.sumY += pointSet[j].Y;
        avg.nP++;
        avg.nWall++;
      }
    }
  }

  if (checkField) {
    avg = slot.field.checkCollisionPointSet(obj.X, obj.Y, pointSet, avg);
  }

  if (avg.nP != 0) {
    avg.sumX = avg.sumX / avg.nP;
    avg.sumY = avg.sumY / avg.nP;
  }

  return avg;
}
