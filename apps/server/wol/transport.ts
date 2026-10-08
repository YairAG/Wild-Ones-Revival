// Transportes: TCP crudo y WebSocket. Los dos entregan los datos al servidor igual: el mismo
// "POST /ballistic/<tipo>?..." inicial y después mensajes de 6 dígitos + JSON (ver docs/PROTOCOL.md).
// En WebSocket, cada mensaje recibido se trata como un trozo de datos del socket TCP.
import net = require("net");
import { randomUUID } from "crypto";
import { WebSocketServer, WebSocket } from "ws";
import log = require("../helpers/log.js");
import type { GameSocket } from "../types";

/** Lo que el servidor hace con cada conexión, venga del transporte que venga */
export type Connection = { data(chunk: Buffer | string): void; close(): void };
type Accept = (socket: GameSocket) => Connection;

export function listenTcp(port: number, accept: Accept): void {
  net
    .createServer((raw) => {
      const socket = Object.assign(raw, { name: raw.remoteAddress + ":" + raw.remotePort, id: randomUUID() });
      const conn = accept(socket);
      raw.on("data", (data) => conn.data(data));
      raw.on("error", (e) => log.warn({ err: e }, "Error de socket"));
      raw.on("close", () => conn.close());
      raw.on("end", () => conn.close());
    })
    .listen(port, "0.0.0.0");
  log.info({ transport: "tcp", port }, "Aceptando clientes");
}

export function listenWs(port: number, accept: Accept): void {
  const wss = new WebSocketServer({ port, host: "0.0.0.0" });
  wss.on("connection", (ws, req) => {
    let binary = false; // se responde en el mismo formato en que habla el cliente (Ruffle usa binario)
    const socket: GameSocket = {
      id: randomUUID(),
      name: req.socket.remoteAddress + ":" + req.socket.remotePort,
      remoteAddress: req.socket.remoteAddress,
      get readyState() {
        return ws.readyState === WebSocket.OPEN ? "open" : "closed";
      },
      write: (str) => ws.send(binary ? Buffer.from(str) : str),
    };
    const conn = accept(socket);
    ws.on("message", (data, isBinary) => {
      binary = isBinary;
      conn.data(data as Buffer);
    });
    ws.on("error", (e) => log.warn({ err: e }, "Error de socket"));
    ws.on("close", () => conn.close());
  });
  log.info({ transport: "ws", port }, "Aceptando clientes");
}
