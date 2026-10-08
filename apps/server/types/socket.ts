/**
 * Conexión de un jugador, sea TCP o WebSocket (ver wol/transport.ts). Es lo único que el resto del
 * servidor usa del socket.
 */
export interface GameSocket {
  id: string; // uuid
  name: string; // ip:puerto
  remoteAddress?: string;
  readyState: string; // TCP: "open", "closed"... (nunca vacío, así que el chequeo !readyState no bloquea)
  write(data: string): unknown;
}
