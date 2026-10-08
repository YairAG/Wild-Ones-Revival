// Terreno de la partida. Debía cargar la máscara del mapa para detectar colisiones, pero la carga está
// comentada en el original: bitmapData siempre es undefined y solo se usa como registro de explosiones.
import Utils = require("./helpers/utils.js");
import type Slot = require("./slot.js");
import type CollisionAverage = require("./physics/collision.js");

type Bitmap = { getPixelColor(x: number, y: number): number };

class Field {
  declare flag: string;
  declare slot: Slot;
  declare bitmapUrl: string;
  declare bitmapData: Bitmap | undefined;
  declare explosionRecord: string[][];
  declare width: number;
  declare height: number;

  constructor(slot: Slot) {
    this.flag = "kt";
    this.slot = slot;
    this.bitmapUrl = "http://beta.wildones.pw/images/r1_kitchen-A/kt_mask.png";
    this.bitmapData = undefined;
    this.explosionRecord = [];
    this.width = 2800;
    this.height = 1400;
    // Aquí el original cargaba bitmapUrl con Jimp (comentado)
  }

  checkFieldCollisionPoint(x: number, y: number): boolean | undefined {
    try {
      if (x < 0 || y < 0) return false;
      return Boolean(this.getFieldPointColor(x, y) & 0xff000000);
    } catch (e) {
      console.log(e);
    }
  }

  getFieldPointColor(x: number, y: number): number {
    try {
      return this.bitmapData.getPixelColor(x, y);
    } catch {
      return 0;
    }
  }

  checkCollisionPointSet(x: number, y: number, pointSet: { X: number; Y: number }[], avg: CollisionAverage): CollisionAverage {
    if (this.bitmapData) {
      for (let i = 0; i < pointSet.length; i++) {
        const p = pointSet[i];
        if (p.X + x < 0 || p.Y + y < 0) continue;
        const pix = this.getFieldPointColor(p.X + x, p.Y + y);
        if (pix & 4278190080) {
          avg.sumX += p.X;
          avg.sumY += p.Y;
          avg.nP++;
          avg.nGround++;
        }
      }
    } else {
      console.log("!!! bitmapData is null");
    }

    return avg;
  }

  explode(x: number, y: number, r: number): void {
    if (r <= 1) return;
    this.explosionRecord.push([Utils.intToString(x), Utils.intToString(y), Utils.intToString(r)]); //convert these to string
  }
}

export = Field;
