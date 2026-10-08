// Tests de caracterización: fijan cómo se comporta el servidor HOY (bugs incluidos), para detectar
// cualquier cambio durante la migración. Ver docs/TESTS.md.
import { test, before, after } from "node:test";
import assert = require("node:assert/strict");
import { once } from "events";
import net = require("net");
import { startTestServer, user, sleep } from "./helpers/server";

let env;
const connect = (urlPath) => env.connect(urlPath);
const waitForUser = (dname, check) => env.waitForUser(dname, check);

before(async () => {
  env = await startTestServer([user(1, "Ana"), user(2, "Beto")]);
});

after(() => env?.stop());

test("responde a la petición de política de Flash", async () => {
  const socket = net.connect(env.port, "127.0.0.1");
  socket.write("<policy-file-request/>");
  const [data] = await once(socket, "data");
  socket.destroy();
  assert.equal(
    data.toString(),
    '<cross-domain-policy><allow-access-from domain="*" to-ports="*" /></cross-domain-policy>\0',
  );
});

test("ladder solo responde ping", async () => {
  const ladder = await connect("/ballistic/ladder?session=x");
  ladder.send({ command: "ping" });
  await ladder.next("ping_ack");
  assert.ok(ladder.sawHeader, "la primera respuesta lleva la pseudo-cabecera");
});

test("login con clave incorrecta no responde nada", async () => {
  const lobby = await connect("/ballistic/lobby?session=x");
  lobby.send({ command: "logIn", dname: "Ana", snum: "mala" });
  await assert.rejects(lobby.next("setPlayer", 500));
});

test("mensajes inválidos se descartan y se loguean; el servidor sigue respondiendo", async () => {
  const lobby = await connect("/ballistic/lobby?session=x");
  lobby.send({ command: "buy_ammo", ammoType: 5 }); // ammoType debe ser texto y falta ammoCount
  lobby.send({ command: "comando_inventado" });
  lobby.send({ command: "ping" });
  await lobby.next("ping_ack");
  assert.equal(lobby.messages.length, 0);
  assert.ok(env.log().includes('Mensaje inválido descartado: {"command":"buy_ammo","ammoType":5}'));
  assert.ok(env.log().includes('Mensaje inválido descartado: {"command":"comando_inventado"}'));
});

test("partida completa: login → quick_play → 2 jugadores → turno → game over", async (t) => {
  const lobbyA = await connect("/ballistic/lobby?session=x");
  const lobbyB = await connect("/ballistic/lobby?session=x");
  let gameA, gameB, joinA, joinB;

  await t.test("login en lobby devuelve setPlayer y luego player", async () => {
    lobbyA.send({ command: "logIn", dname: "Ana", snum: "clave-Ana" });
    const setPlayer = await lobbyA.next("setPlayer");
    assert.equal(setPlayer.dname, "Ana");
    assert.equal(setPlayer.id, 1);
    assert.equal(setPlayer.gold, 1000);
    assert.equal(setPlayer.online, 4); // conexiones lobby abiertas (incluye las de los tests anteriores)
    assert.equal((await lobbyA.next("player")).dname, "Ana");

    lobbyB.send({ command: "logIn", dname: "Beto", snum: "clave-Beto" });
    await lobbyB.next("setPlayer");
    await lobbyB.next("player");
  });

  await t.test("ping en lobby", async () => {
    lobbyA.send({ command: "ping" });
    await lobbyA.next("ping_ack");
  });

  await t.test("quick_play empareja a los dos en la misma partida", async () => {
    const details = { mapName: "Sink or Swim", playerCount: 2, gameDuration: 1, turnDuration: 10 };
    lobbyA.send({ command: "quick_play", ...details });
    joinA = await lobbyA.next("join");
    lobbyB.send({ command: "quick_play", ...details });
    joinB = await lobbyB.next("join");

    assert.equal(joinA.id, "Sink-or-Swim_2_60000_10000_0");
    assert.equal(joinB.id, joinA.id);
    assert.equal(joinA.map, "Sink or Swim");
    assert.equal(joinA.status, "idle");
    assert.equal(joinA.playerCount, 0); // todavía nadie entró por la conexión game
    assert.equal(joinA.turnDuration, 10000);
    assert.notEqual(joinA.session, joinB.session);

    // La session se guarda en Mongo como gkey (la usa start_server_connect)
    await waitForUser("Ana", (u) => u.gkey === joinA.session);
    await waitForUser("Beto", (u) => u.gkey === joinB.session);
  });

  await t.test("entran por la conexión game y arranca la partida", async () => {
    gameA = await connect(`/ballistic/game?gameId=${joinA.id}&session=${joinA.session}`);
    gameA.send({ command: "start_server_connect", userId: "Ana" });
    assert.equal((await gameA.next("player")).dname, "Ana");
    assert.equal((await gameA.next("game")).playerCount, 1);

    gameB = await connect(`/ballistic/game?gameId=${joinB.id}&session=${joinB.session}`);
    gameB.send({ command: "start_server_connect", userId: "Beto" });
    assert.equal((await gameB.next("player")).dname, "Ana"); // primero recibe a los que ya estaban
    assert.equal((await gameB.next("player")).dname, "Beto");
    assert.equal((await gameA.next("player")).dname, "Beto");

    // Con 2 jugadores: cuenta atrás de 5 s → game_join_confirmed → startGame
    await gameA.next("game_join_confirmed", 7000);
    const start = await gameA.next("startGame");
    await gameB.next("startGame");

    assert.deepEqual(start.co, ["1", "2"]);
    assert.equal(start.currentPlayer, 1); // empieza el id más bajo
    assert.equal(start.tick, 0);
    assert.ok(start.randomSeed >= 0 && start.randomSeed < 1000);
    assert.deepEqual(start.positions, [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 300, y: 100 },
    ]);
    assert.deepEqual(start.playerlist.map((p) => p.dname), ["Ana", "Beto"]);
  });

  await t.test("solo se reenvían las acciones del jugador en turno", async () => {
    gameB.send({ command: "move_left", d: [5, 5] }); // Beto no está en turno: se ignora
    gameA.send({ command: "move_left", d: [10, 20] });

    const move = await gameB.next("move_left");
    assert.deepEqual(move.d, [10, 20]);
    await sleep(200);
    assert.ok(!gameA.messages.some((m) => m.command === "move_left"));
  });

  await t.test("chat, set_aim, on_ready y synchronization", async () => {
    // chat: se reenvía tal cual a los demás, aunque no sea su turno
    gameB.send({ command: "chat", text: "hola", extra: 1 });
    assert.deepEqual(await gameA.next("chat"), { command: "chat", text: "hola", extra: 1 });

    // set_aim: solo del jugador en turno, reenviado a los demás
    gameA.send({ command: "set_aim", value: 1.2, power: 300 });
    assert.deepEqual(await gameB.next("set_aim"), { command: "set_aim", value: 1.2, power: 300 });

    // on_ready: marca al jugador como "ready" y manda "game" a todos
    gameB.send({ command: "on_ready" });
    const game = await gameA.next("game");
    assert.deepEqual(game.players.find((p) => p.guid === 2), { guid: 2, status: "ready" });

    // synchronization: el servidor lo transforma en set_synch y lo manda a todos (incluido quien lo envió)
    const hp500 = "407F400000000000"; // 500 codificado en hex (ver PROTOCOL.md, números codificados)
    gameA.send({
      command: "synchronization",
      timeLoop: { activeAvatar: 99, currentTick: 99, commandQueue: [1] },
      avatarList: [{ player: 2, hp: hp500, isWalkingLeft: "true" }],
    });
    for (const g of [gameA, gameB]) {
      const synch = await g.next("set_synch");
      assert.equal(synch.id, "oppenheimer");
      assert.equal(synch.gameRecord, null);
      assert.equal(synch.timeLoop.activeAvatar, 1);
      assert.deepEqual(synch.timeLoop.commandQueue, []);
      assert.deepEqual(synch.avatarList, [{ player: 2, hp: hp500, isWalkingLeft: "false", isWalkingRight: "false" }]);
    }
  });

  await t.test("disparar acorta el turno y pasa al siguiente jugador", async () => {
    gameA.send({ command: "projectile", d: [10, 20], ammo_type: "mortar", crate: "false" });

    const shot = await gameB.next("projectile");
    assert.equal(shot.ammo_type, "mortar");

    // Al que dispara le llegan 3 "player": tras sumar XP (+1..11), tras sumar oro (+1..6) y al final
    const afterXp = await gameA.next("player");
    assert.ok(afterXp.xp >= 1 && afterXp.xp <= 11, "xp " + afterXp.xp);
    assert.equal(afterXp.gold, 1000);
    const afterGold = await gameA.next("player");
    assert.ok(afterGold.gold >= 1001 && afterGold.gold <= 1006, "oro " + afterGold.gold);
    const final = await gameA.next("player");
    assert.equal(final.userWeaponsOwned.mortar, null); // bug: undefined - 1 = NaN → null en JSON

    await gameB.next("set_tick"); // va al jugador que empieza turno
    const turnA = await gameA.next("changeTurn");
    await gameB.next("changeTurn");
    assert.equal(turnA.currentPlayer, "2"); // tras el primer cambio el id pasa a ser string
    assert.equal(turnA.why, "Because we can.");
  });

  await t.test("cuando queda uno vivo termina la partida", async () => {
    gameA.send({ command: "player_died", id: 2 });

    for (const g of [gameA, gameB]) {
      const stats = await g.next("game_stats");
      assert.deepEqual(stats.players, [1, 2]); // vivo primero, luego los muertos
      assert.equal(stats.place, 0);
      await g.next("endGame");
    }
  });
});
