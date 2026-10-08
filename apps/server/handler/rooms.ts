// Lobby: buscar partida (quick_play) y salas con nombre. Responden "join" con el id de la partida y la
// session que el cliente usará para abrir la conexión game.
import type LobbyClient = require("../client/client.lobby.js");
import type WOL = require("../wol");
import type { LobbyMessage } from "@wildones/protocol";

const DEBUG = true;

type Msg<C> = Extract<LobbyMessage, { command: C }>;

export function handleQuickPlay(client: LobbyClient, packet: Msg<"quick_play">, wol: WOL): void {
  const mapDetails = wol.validateMapDetails(client, packet);
  if (DEBUG) console.log(">> Validated map details");
  const gameId = wol.findSlot(client, mapDetails, null);

  if (DEBUG) console.log(">> Found slot");
  if (gameId == 0) {
    //The map details provided seem to be invalid
    return;
  }

  //send join game only after at least two players are in the slot
  client.gameId = gameId;
  client.sendJoinGame();
}

/*TO DO: move game_name_return to a function */
export function handleGameNameCheck(client: LobbyClient, data: Msg<"game_name_check">, wol: WOL): void {
  if (/^[a-zA-Z0-9- ]*$/.test(data.name) == false) {
    return;
  }

  const cmd = {
    command: "game_name_return",
    name: data.name,
    // bug: no convierte espacios en guiones como create_game (ver docs/BUGS.md)
    value: wol.getGame(data.name) ? 0 : 1,
  };

  client.sendPacket(cmd);
}

export function handleCreateGame(client: LobbyClient, data: Msg<"create_game">, wol: WOL): void {
  if (/^[a-zA-Z0-9- ]*$/.test(data.gameName) == false) {
    return;
  }

  data.gameName = data.gameName.split(" ").join("-");

  if (wol.getGame(data.gameName)) {
    client.sendPacket({
      command: "game_name_return",
      name: data.gameName,
      value: 0,
    });
    return;
  }

  const mapDetails = wol.validateMapDetails(client, data);
  const gameId = wol.findSlot(client, mapDetails, data.gameName);

  if (gameId == 0) {
    //game is running!
    return;
  }

  client.gameId = gameId;
  client.sendJoinGame();
}

export function handleJoinGame(client: LobbyClient, data: Msg<"join_game">, wol: WOL): void {
  if (/^[a-zA-Z0-9- ]*$/.test(data.gameName) == false) {
    return;
  }

  data.gameName = data.gameName.split(" ").join("-");
  const gameRef = wol.getGame(data.gameName);
  if (gameRef) {
    if (!gameRef.isRunning()) {
      // @ts-expect-error bug: mete en la partida a la conexión de lobby (ver docs/BUGS.md)
      gameRef.addClient(client);
      client.gameId = data.gameName;
      client.sendJoinGame();
    }
  }
}
