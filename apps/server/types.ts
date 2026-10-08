// Tipos compartidos por varios archivos del servidor (solo tipos, no generan código)
import type { Socket } from "net";

/** Socket TCP de un jugador. wol.js le agrega `name` (ip:puerto) e `id` (uuid). */
export type GameSocket = Socket & { name: string; id: string };
