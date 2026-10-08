import type { Player } from "@wildones/protocol";

/** Documento de la colección `users` en Mongo (ver user-schema.example.json). */
export type UserDoc = Omit<Player, "command" | "online"> & { lkey?: string; gkey?: string };
