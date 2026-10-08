import type { Player } from "wildones-protocol";

/** Documento de la colección `users` en Mongo (ver user-schema.example.json). */
export type UserDoc = Omit<Player, "command" | "online"> & {
  gkey?: string | null; // pase de un solo uso para entrar a la partida (ver handler/auth.ts)
  presence?: Presence;
};

/**
 * Dónde está el jugador, para nuestras pantallas (p. ej. amigos): en una partida, solo en el lobby o
 * desconectado. Aparte de `status`, que es la marca de "listo" de la sala que usa el cliente original.
 */
export type Presence = "playing" | "lobby" | "offline";
