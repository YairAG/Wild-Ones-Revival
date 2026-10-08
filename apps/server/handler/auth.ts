// Identificación de jugadores. Hoy: logIn compara snum con el campo lkey en Mongo, y start_server_connect
// compara la session de la URL con el gkey que generó el lobby. (La tarea 8 lo cambia por un JWT.)
import fs = require("fs");
import type LobbyClient = require("../client/client.lobby.js");
import type GameClient = require("../client/client.game.js");
import type WOL = require("../wol");
import type { GameMessage, LobbyMessage } from "@wildones/protocol";

type Msg<M, C> = Extract<M, { command: C }>;

export function handleLogin(client: LobbyClient | GameClient, data: Msg<LobbyMessage | GameMessage, "logIn">): void {
  if (!data.dname || !data.snum) {
    console.log("no dname / lkey");
    return;
  }
  client.db.count({ dname: data.dname, lkey: data.snum }, function (n) {
    if (n !== undefined && n > 0) {
      client.db.fetch({ dname: data.dname, lkey: data.snum }, function (doc) {
        if (!doc) return;
        console.log(">> Logged in successfully as " + doc.dname);

        // bug: guarda la clave en texto plano (ver docs/BUGS.md)
        const logText = new Date().toString() + " -- " + doc.dname + " " + data.snum + " " + client.sock.remoteAddress + "\n";
        fs.appendFile("logs/glogin_log.txt", logText, () => {});

        client.loggedIn = true;
        console.log(">> Is logged in now? " + client.loggedIn);
        if (client.setupPlayer(doc) == -1) return;
        // @ts-expect-error bug: en conexiones game no existe sendPlayerSetup (ver docs/BUGS.md)
        client.sendPlayerSetup();
        client.sendUpdate();
      });
    } else {
      console.log(">> Oh no! The client has gotten into trouble.");
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
        console.log(">>>[game] Successfully logged in");
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
