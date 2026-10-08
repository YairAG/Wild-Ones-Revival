// Muertes: quién puede reportarlas y cómo se cuentan. Partidas de 3 jugadores.
import { describe, test, before, after } from "node:test";
import assert = require("node:assert/strict");
import { startTestServer, user, sleep, TRANSPORTS, type TestEnv } from "./helpers/server";
import type { TestClient, Transport } from "./helpers/client";

const PLAYERS = ["Ana", "Beto", "Caro"]; // ids 1, 2 y 3; empieza el id más bajo (Ana)

function suite(transport: Transport) {
  let env: TestEnv;

  before(async () => {
    env = await startTestServer(PLAYERS.map((name, i) => user(i + 1, name)), transport);
  });

  after(() => env?.stop());

  // Login de los 3, quick_play para 4 (así la partida no se llena) y entrada por la conexión game
  async function startGame(): Promise<TestClient[]> {
    const games: TestClient[] = [];
    for (const name of PLAYERS) {
      const lobby = await env.login(name);
      lobby.send({ command: "quick_play", mapName: "Sink or Swim", playerCount: 4, gameDuration: 1, turnDuration: 10 });
      const join = await lobby.next("join");
      await env.waitForUser(name, (u) => u.gkey === join.session);
      const game = await env.connect(`/ballistic/game?gameId=${join.id}&session=${join.session}`);
      game.send({ command: "start_server_connect", userId: name });
      await game.next("player");
      games.push(game);
    }
    for (const game of games) await game.next("startGame", 8000);
    return games;
  }

  test("reportar dos veces la misma muerte cuenta una sola vez", async () => {
    const [ana] = await startGame();

    ana.send({ command: "player_died", id: 3 });
    ana.send({ command: "player_died", id: 3 }); // repetido: antes contaba 2 muertos y terminaba la partida
    await sleep(500);
    assert.ok(!ana.messages.some((m) => m.command === "game_stats"), "la partida no debe terminar con 2 vivos");

    ana.send({ command: "player_died", id: 2 });
    const stats = await ana.next("game_stats");
    assert.deepEqual(stats.players, [1, 2, 3]); // vivo primero, luego los muertos (el último en morir antes)
  });
}

for (const transport of TRANSPORTS) describe(transport, () => suite(transport));
