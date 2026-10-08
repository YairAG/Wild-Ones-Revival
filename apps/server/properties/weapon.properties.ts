// Armas: se rellena con WeaponsGrid.dat
class WeaponProperties {
  size = 10;
  description = "Weapon";
  dispersion = 0.15;
  bounce = 0.5;
  hp = 100;
  currency = "gold";
  timeAfter: number | null = 4000; // ms hasta el fin de turno tras disparar (null = 4 s)
  R1 = 60;
  R2 = 100;
  instructions = "No Instructions";
  alt = "";
  projectiles = 1;
  baseType = "null";
  par1 = 1;
  offense = "";
  tip = "";
  purchaseAmount: number | string = 1;
  type = "null";
  petWeapon = false;
  par3 = 1;
  interval = 10;
  defense = "";
  featuredEndDate = "";
  par2 = 1;
  windR = 0.0001;
  Vmax = 1.5;
  clip = 1;
  _price: number | string = 0;
  gravity = 0.0005;
  Rdirt = 60;
  dropTime = 1000;
  timeout = -1;
  Vinit = 0;
  deploy = "gun";
  instant = false;
  sticky = false;
  expireDate = "";
  damage = 100;
  live = 1;
  impulse = 0.001;
  childType = "null";
  initAmmo = 5;
  children = 0;

  set price(value: number | string) {
    this._price = value;
  }

  get price(): number | string {
    return this._price;
  }
}

export = WeaponProperties;
