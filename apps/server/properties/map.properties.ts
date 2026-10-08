// Mapas: se rellena con Maps.dat. positions/minePos/cratePos: [x1, y1, x2, y2] por punto
class MapProperties {
  mines = 3;
  minePos: number[][] = [[100, 1000, 1500, 1000]];
  wind = 0.0;
  name = "No Name";
  waterAlpha = 0.5;
  midHeight = -1.0;
  crates = 3;
  cratePos: number[][] = [[100, 1000, 1500, 1000]];
  waterColor = 21845;
  currency = "gold";
  backScale = 1.0;
  height = 1200.0;
  background = "No Background";
  players = 6;
  updated = false;
  backColor = 37324;
  foreground = "No Foreground";
  width = 1600.0;
  _price: number | string = 6;
  midground = "No Midground";
  thumb = "";
  preview = "";
  waterHighlight = 16777215;
  midWidth = -1.0;
  disaster = "flood";
  ambientLoop = "";
  max = 6;
  positions: number[][] = [[100, 1000, 1500, 1000]];
  mask = "No Mask";
  ambientRandom: unknown[] = [];

  set price(value: number | string) {
    this._price = value;
  }

  get price(): number | string {
    return this._price;
  }
}

export = MapProperties;
