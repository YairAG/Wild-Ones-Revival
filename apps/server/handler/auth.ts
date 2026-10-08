// Identificación de jugadores:
// - logIn (lobby): verifica el JWT que emite el backend de cuentas; sub = id del usuario en Mongo.
// - start_server_connect (partida): compara la session de la URL con el gkey que generó el lobby en "join".
// Este servidor nunca recibe ni guarda contraseñas.
import jwt = require("jsonwebtoken");
import type LobbyClient = require("../client/client.lobby.js");
import type GameClient = require("../client/client.game.js");
import type WOL = require("../wol");
import type { GameMessage, LobbyMessage } from "@wildones/protocol";
import log = require("../helpers/log.js");

type Msg<M, C> = Extract<M, { command: C }>;

// Verifica el JWT de tu backend de cuentas (HS256 con JWT_SECRET). Devuelve el id del usuario (sub) o null
function verifyToken(token: string): number | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    log.error("Falta JWT_SECRET: no se puede verificar ningún login");
    return null;
  }
  try {
    // algorithms: solo HS256 (rechaza tokens sin firma o con otro algoritmo)
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    const id = Number(typeof payload === "object" ? payload.sub : undefined);
    return Number.isInteger(id) ? id : null;
  } catch (e) {
    log.warn({ reason: (e as Error).message }, "Token inválido");
    return null;
  }
}

export function handleLogin(client: LobbyClient | GameClient, data: Msg<LobbyMessage | GameMessage, "logIn">): void {
  const id = verifyToken(data.token);
  if (id === null) return; // como antes con una clave mala: no se responde nada

  client.db.fetch({ id }, function (doc) {
    if (!doc) {
      log.warn({ id }, "Login fallido: el usuario no existe");
      return;
    }
    log.info({ id, dname: doc.dname, ip: client.sock.remoteAddress }, "Login correcto");

    client.loggedIn = true;
    if (client.setupPlayer(doc) == -1) return;
    // @ts-expect-error bug: en conexiones game no existe sendPlayerSetup (ver docs/BUGS.md)
    client.sendPlayerSetup();
    client.sendUpdate();
  });
}

export function handleStartServerConnect(client: GameClient, data: Msg<GameMessage, "start_server_connect">, wol: WOL): void {
  //what happens if it connects after the game restarted?
  //what happens if i connect after the slot is full!?
  if (!client) return;
  client.db.count({ dname: data.userId, gkey: client.gameSession }, function (n) {
    if (n !== undefined && n > 0) {
      client.db.fetch({ dname: data.userId, gkey: client.gameSession }, function (doc) {
        if (!doc) return;
        log.info({ dname: doc.dname }, "Entró por la conexión game");
        if (!client.getGame()) return;
        if (client.setupPlayer(doc) == -1 || !client.player.id) return;

        if (client.getGame().isFull()) {
          client.gameId = wol.findSimilarSlot(client.getGame());
        }

        client.getGame().addClient(client);
        client.sendGamePlayers();
        client.sendToGame(client.player);
        client.updateGame();
        client.getGame().stopGameStart();
      });
    }
  });
}
