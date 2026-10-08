// Identificación de jugadores. Hoy: logIn compara snum con el campo lkey en Mongo, y start_server_connect
// compara la session de la URL con el gkey que generó el lobby. (La tarea 8 lo cambia por un JWT.)
import type LobbyClient = require("../client/client.lobby.js");
import type GameClient = require("../client/client.game.js");
import type WOL = require("../wol");
import type { GameMessage, LobbyMessage } from "@wildones/protocol";
import log = require("../helpers/log.js");

type Msg<M, C> = Extract<M, { command: C }>;

export function handleLogin(client: LobbyClient | GameClient, data: Msg<LobbyMessage | GameMessage, "logIn">): void {
  if (!data.dname || !data.snum) {
    log.warn("Login sin dname o snum");
    return;
  }
  client.db.count({ dname: data.dname, lkey: data.snum }, function (n) {
    if (n !== undefined && n > 0) {
      client.db.fetch({ dname: data.dname, lkey: data.snum }, function (doc) {
        if (!doc) return;
        log.info({ dname: doc.dname }, "Login correcto");

        // bug: registra la clave en texto plano (ver docs/BUGS.md)
        log.info({ dname: doc.dname, snum: data.snum, ip: client.sock.remoteAddress }, "Registro de login");

        client.loggedIn = true;
        log.debug({ loggedIn: client.loggedIn }, "Estado de login");
        if (client.setupPlayer(doc) == -1) return;
        // @ts-expect-error bug: en conexiones game no existe sendPlayerSetup (ver docs/BUGS.md)
        client.sendPlayerSetup();
        client.sendUpdate();
      });
    } else {
      log.warn({ dname: data.dname }, "Login fallido");
    }
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
