// Mascotas ("chassis"): se rellena con Pets.dat
class ChassisProperties {
  size = 40.0;
  bounce = 0.2;
  hp = 900.0;
  currency = "gold";
  falldmg = 200.0;
  petPower = "";
  bottomsXY = [0, 0, 0, 1, 1];
  offense = "";
  jump = 0.25;
  color2: number | string = 0;
  alt = "Body";
  color1: number | string = 0;
  type = "unknown";
  tip = "Body";
  topsXY = [0, 0, 0, 1, 1];
  defense = "";
  speed = 0.004;
  _price: number | string = 1234321;
  gravity = 5.0e-4;
  scale = 1.0;
  headsXY = [0, 0, 0, 1, 1];
  miscXY = [0, 0, 0, 1, 1];
  impulse = 1.0;
  description = "Body";

  set price(value: number | string) {
    this._price = value;
  }

  get price(): number | string {
    return this._price;
  }
}

export = ChassisProperties;
