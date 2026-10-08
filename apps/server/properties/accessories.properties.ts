class AccessoriesProperties {
  type = "unknown";
  rep_currency = "treats";
  sell_value = 0;
  durability = -1;
  _price: number | string = 100;
  currency = "gold";
  _rep_cost: number | string = 0;
  pos = {};
  sell_currency = "treats";
  stats = {};
  alt = "unknown";
  featuredEndDate = "";
  expireDate = "";
  tip = "default accessory";
  startDate = "";
  z = -1;
  category = "";

  set price(value: number | string) {
    this._price = value;
  }

  get price(): number | string {
    return this._price;
  }

  set rep_cost(value: number | string) {
    this._rep_cost = value;
  }

  get rep_cost(): number | string {
    return this._rep_cost;
  }
}

export = AccessoriesProperties;
