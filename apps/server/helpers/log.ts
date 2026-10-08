// Logger del servidor. Cada línea es un JSON con nivel, hora, mensaje y datos.
// Nivel con LOG_LEVEL (debug, info, warn, error); por defecto info. `pnpm dev` lo muestra legible.
import pino from "pino";

const log = pino({ level: process.env.LOG_LEVEL || "info" });

export = log;
