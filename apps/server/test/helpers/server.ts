// Arranca un entorno completo para los tests: Mongo temporal, assets inventados y el servidor real
// (como proceso aparte). Cada archivo de test arranca el suyo.
import { spawn } from "child_process";
import { once } from "events";
import path = require("path");
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, type Document } from "mongodb";
import serveAssets = require("../../scripts/serve-assets");
import { WebSocket } from "ws";
import jwt = require("jsonwebtoken");
import net = require("net");
import { TestClient, sleep, type Transport } from "./client";

/** Los tests corren una vez por cada transporte */
const TRANSPORTS: Transport[] = ["tcp", "ws"];

const ROOT = path.join(__dirname, "../..");
const MONGO_VERSION = process.env.MONGO_VERSION || "9.0.2";
const JWT_SECRET = "secreto-de-los-tests";

/** Documento de jugador de prueba (se identifica con un JWT con sub = id, ver token()) */
function user(id: number, dname: string, extra: object = {}) {
  return {
    id, dname,
    nw: -1, level: 0, xp: 0, gold: 1000, treats: 200, status: "playing", wins: 0, losses: 0, gamecount: 0,
    currentPet: "1",
    ownedPets: { 1: { id: 1, name: "Rex", type: "dog", accessories: [] } },
    userWeaponsOwned: {}, userWeaponsEquipped: ["walk", "mortar"],
    userAccessories: [], allowedMaps: [],
    ...extra,
  };
}

async function startTestServer(users: Document[], transport: Transport) {
  // Puertos aleatorios: evitan choques con procesos viejos
  const tcpPort = 18000 + Math.floor(Math.random() * 1000);
  const wsPort = tcpPort + 1000;
  const port = transport === "tcp" ? tcpPort : wsPort;
  const mongod = await MongoMemoryServer.create({ binary: { version: MONGO_VERSION } });
  const mongoUrl = mongod.getUri().replace(/\/?$/, "/emu");
  const mongoClient = await MongoClient.connect(mongoUrl);
  const db = mongoClient.db();
  await db.collection("users").insertMany(users);

  const assetServer = serveAssets(path.join(__dirname, "../fixtures/assets"), 0);
  await once(assetServer, "listening");

  // --import tsx: permite que el servidor tenga archivos .ts sin compilar
  const server = spawn(process.execPath, ["--import", "tsx", "app.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      TCP_ENABLED: "true",
      TCP_PORT: String(tcpPort),
      WS_PORT: String(wsPort),
      MONGO_URL: mongoUrl,
      LOG_LEVEL: "debug",
      JWT_SECRET,
      ASSETS_URL: `http://127.0.0.1:${(assetServer.address() as import("net").AddressInfo).port}/`,
    },
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));

  // Listo cuando abrió los dos transportes
  for (let i = 0; log.split('"msg":"Aceptando clientes"').length < 3; i++) {
    if (i > 300) throw new Error("El servidor no arrancó en 15 s:\n" + log);
    await sleep(50);
  }

  const clients: TestClient[] = [];
  return {
    port,
    transport,
    db,
    log: () => log,
    // Líneas de log (JSON de pino) ya parseadas; ignora lo que no sea JSON
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logs: (): Record<string, any>[] =>
      log.split("\n").flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      }),

    async connect(urlPath: string) {
      const c = new TestClient(port, urlPath, transport);
      await c.connect();
      clients.push(c);
      return c;
    },

    // Abre una conexión sin el POST inicial, envía `text` y devuelve la primera respuesta (texto crudo)
    raw(text: string): Promise<string> {
      return new Promise((resolve, reject) => {
        if (transport === "tcp") {
          const socket = net.connect(port, "127.0.0.1", () => socket.write(text));
          socket.on("data", (d) => (socket.destroy(), resolve(d.toString())));
          socket.on("error", reject);
        } else {
          const ws = new WebSocket(`ws://127.0.0.1:${port}`);
          ws.on("open", () => ws.send(text));
          ws.on("message", (d) => (ws.terminate(), resolve(d.toString())));
          ws.on("error", reject);
        }
      });
    },

    // JWT como el que emitiría el backend de cuentas. options permite firmar mal, expirarlo, etc.
    token(id: number, options: jwt.SignOptions = {}, secret = JWT_SECRET): string {
      return jwt.sign({}, secret, { subject: String(id), expiresIn: "1h", ...options });
    },

    // Abre lobby y hace login; devuelve el cliente ya sin los mensajes del login
    async login(dname: string) {
      const c = await this.connect("/ballistic/lobby?session=x");
      const id = users.find((u) => u.dname === dname)!.id;
      c.send({ command: "logIn", token: this.token(id) });
      await c.next("player");
      return c;
    },

    // Espera a que una condición sobre Mongo se cumpla (el servidor guarda sin esperar respuesta)
    async waitForUser(dname: string, check: (doc: Document) => boolean) {
      for (let i = 0; i < 50; i++) {
        const doc = await db.collection("users").findOne({ dname });
        if (doc && check(doc)) return doc;
        await sleep(20);
      }
      throw new Error("Mongo no se actualizó para " + dname);
    },

    async stop() {
      clients.forEach((c) => c.close());
      server.kill();
      assetServer.close();
      await mongoClient.close();
      await mongod.stop();
      if (process.env.SERVER_LOG) console.log(log);
    },
  };
}

type TestEnv = Awaited<ReturnType<typeof startTestServer>>;

export { startTestServer, user, sleep, TRANSPORTS };
export type { TestEnv };
