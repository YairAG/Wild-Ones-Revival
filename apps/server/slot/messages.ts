// Arman los mensajes que el servidor envía sobre una partida (ver docs/PROTOCOL.md, sección 2)
import type Slot = require("./index.js");

export function statusCollection(slot: Slot): { guid: number; status: string }[] {
  const playerList: { guid: number; status: string }[] = [];
  for (const key in slot.clients) {
    const client = slot.clients[key];
    playerList.push({ guid: client.player.id, status: client.player.status });
  }
  return playerList;
}

export function playerList(slot: Slot) {
  const list = [];
  for (const key in slot.clients) {
    list.push(slot.clients[key].player);
  }
  return list;
}

export function playerIds(slot: Slot): string[] {
  const ids: string[] = [];
  for (const key in slot.clients) {
    ids.push(slot.clients[key].player.id.toString());
  }
  return ids;
}

export function playerPositions(slot: Slot): { id: number; x: number; y: number }[] {
  const positions: { id: number; x: number; y: number }[] = [];
  for (const key in slot.clients) {
    positions.push({
      id: slot.clients[key].player.id,
      x: slot.clients[key].avatar.X,
      y: slot.clients[key].avatar.Y,
    });
  }
  return positions;
}

export function playerPositionsAndVelocities(slot: Slot): number[][] {
  const collection: number[][] = [];
  for (const key in slot.clients) {
    const { player, avatar } = slot.clients[key];
    collection.push([player.id, avatar.X, avatar.Y, avatar.Vx, avatar.Vy]);
  }
  return collection;
}

/** Estado de la partida: mensajes "game" (dentro de la partida) y "join" (en lobby) */
export function gameState(slot: Slot, command: "game" | "join") {
  return {
    command: command,
    status: slot.status,
    playerCount: slot.getPlayerCount(),
    min: slot.min,
    id: slot.gameId,
    map: slot.mapName,
    players: statusCollection(slot),
    name: slot.mapName,
    skip: slot.skip,
    time: new Date().getTime(),
    gameDuration: slot.gameDuration,
    turnDuration: slot.turnDuration,
    cl: slot.cl,
    sumOfLevels: slot.sumOfLevels,
    session: slot.session,
  };
}

/** Registro de partida: mensajes "changeTurn" y "endGame" */
export function gameRecord(slot: Slot, cmd: "changeTurn" | "endGame") {
  return {
    randomSeed: slot.randomSeed,
    co: playerIds(slot),
    playerlist: playerList(slot),
    tick: 0,
    currentPlayer: slot.currentPlayer,
    command: cmd,
    why: "Because we can.",
  };
}
