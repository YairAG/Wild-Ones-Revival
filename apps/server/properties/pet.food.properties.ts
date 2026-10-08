// Comida de mascota: se rellena con PetFoods.dat (el servidor no la usa más allá de cargarla)
class PetFoodProperties {
  bonusBoost: number | string = 10;
  price: number | string = 10.0;
  bonusTime: number | string = 1;
  coinBonus: number | string = 0;
  currency = "gold";
  prepTime: number | string = 300;
  alt = "none";
  bonusType = "damage";
  type = "none";
}

export = PetFoodProperties;
