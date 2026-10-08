// Tests de caracterización: fijan cómo se comporta el servidor HOY (bugs incluidos), para detectar
// cualquier cambio durante la migración. Arrancan el servidor real como proceso aparte, con un Mongo
// temporal y datos de juego inventados (test/fixtures/assets).
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("child_process");
const { once } = require("events");
const net = require("net");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { MongoClient } = require("mongodb");
const serveAssets = require("../scripts/serve-assets.js");
const { TestClient, sleep } = require("./client.js");

const ROOT = path.join(__dirname, "..");
const PORT = 18000;
const MONGO_VERSION = process.env.MONGO_VERSION || "9.0.2";

let mongod, mongoClient, db, assetServer, server, serverLog = "";
const clients = [];

function user(id, dname) {
  return {
    id, dname, lkey: "clave-" + dname,
    nw: -1, level: 0, xp: 0, gold: 1000, treats: 200, status: "playing",
    currentPet: "1",
    ownedPets: { 1: { id: 1, name: "Rex", type: "dog", accessories: [] } },
    userWeaponsOwned: {}, userWeaponsEquipped: ["walk", "mortar"],
    userAccessories: [], allowedMaps: [],
  };
}

async function connect(urlPath) {
  const c = new TestClient(PORT, urlPath);
  await c.connect();
  clients.push(c);
  return c;
}

// Espera a que una condición sobre Mongo se cumpla (el servidor guarda sin esperar respuesta)
async function waitForUser(dname, check) {
  for (let i = 0; i < 50; i++) {
    const doc = await db.collection("users").findOne({ dname });
    if (check(doc)) return doc;
    await sleep(20);
  }
  throw new Error("Mongo no se actualizó para " + dname);
}

before(async () => {
  mongod = await MongoMemoryServer.create({ binary: { version: MONGO_VERSION } });
  const mongoUrl = mongod.getUri().replace(/\/?$/, "/emu");
  mongoClient = await MongoClient.connect(mongoUrl);
  db = mongoClient.db();
  await db.collection("users").insertMany([user(1, "Ana"), user(2, "Beto")]);

  assetServer = serveAssets(path.join(__dirname, "fixtures/assets"), 0);
  await once(assetServer, "listening");

  server = spawn(process.execPath, ["app.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      MONGO_URL: mongoUrl,
      ASSETS_URL: `http://127.0.0.1:${assetServer.address().port}/`,
    },
  });
  server.stdout.on("data", (d) => (serverLog += d));
  server.stderr.on("data", (d) => (serverLog += d));

  for (let i = 0; !serverLog.includes("Accepting clients"); i++) {
    if (i > 100) throw new Error("El servidor no arrancó:\n" + serverLog);
    await sleep(50);
  }
});

after(async () => {
  clients.forEach((c) => c.close());
  server?.kill();
  assetServer?.close();
  await mongoClient?.close();
  await mongod?.stop();
  if (process.env.SERVER_LOG) console.log(serverLog);
});

test("responde a la petición de política de Flash", async () => {
  const socket = net.connect(PORT, "127.0.0.1");
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
    assert.equal(setPlayer.online, 3); // conexiones lobby abiertas (incluye la del test anterior)
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
