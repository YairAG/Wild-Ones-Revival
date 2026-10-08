import type { Player } from "wildones-protocol";

/** Documento de la colección `users` en Mongo (ver user-schema.example.json). */
export type UserDoc = Omit<Player, "command" | "online"> & { gkey?: string | null }; // gkey: pase de un solo uso para entrar a la partida (ver handler/auth.ts)
