/** Config del juego (Config.dat). Solo los campos que usa el servidor. */
export type GameConfig = {
  gameTimes: number[]; // duraciones de partida permitidas, en minutos
  turnTimes: number[]; // duraciones de turno permitidas, en segundos
  maxPlayers: number[]; // jugadores por partida permitidos
  maxSlots: number; // máximo de partidas iguales (mismo mapa y opciones)
  petMainColors: string[]; // colores de mascota permitidos, en hex sin "0x"
  petDetailColors: string[];
  gameHeight: number;
};
