// Tipos compartidos por varios archivos del servidor (solo tipos, no generan código)
import type { Socket } from "net";
import type { Player } from "@wildones/protocol";

/** Socket TCP de un jugador. wol.js le agrega `name` (ip:puerto) e `id` (uuid). */
export type GameSocket = Socket & { name: string; id: string };

/** Documento de la colección `users` en Mongo (ver user-schema.example.json). */
export type UserDoc = Omit<Player, "command" | "online"> & { lkey?: string; gkey?: string };
