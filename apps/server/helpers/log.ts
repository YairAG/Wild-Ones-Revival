// Logger del servidor. Cada línea es un JSON con nivel, hora, mensaje y datos.
// Nivel con LOG_LEVEL (debug, info, warn, error); por defecto info. `pnpm dev` lo muestra legible.
import pino from "pino";

// redact: si algún objeto logueado trae la clave (snum), se reemplaza por [Redacted]
const log = pino({ level: process.env.LOG_LEVEL || "info", redact: ["snum", "*.snum"] });

export = log;
