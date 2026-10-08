// El "gerente" del servidor: carga los datos del juego, abre el puerto TCP, guarda las conexiones y las
// partidas, y cada 100 ms avanza todas las partidas (update).
import net = require("net");
import UUID = require("node-uuid");
import Database = require("../database.js");
import PacketHandler = require("../handler");
import Slot = require("../slot");
import Client = require("../client/client.abstract.js");
import * as assets from "./assets";
import * as matchmaking from "./matchmaking";
import type LobbyClient = require("../client/client.lobby.js");
import type LadderClient = require("../client/client.ladder.js");
import type GameClient = require("../client/client.game.js");
import type AccessoriesProperties = require("../properties/accessories.properties.js");
import type WeaponProperties = require("../properties/weapon.properties.js");
import type MapProperties = require("../properties/map.properties.js");
import type PetFoodProperties = require("../properties/pet.food.properties.js");
import type ChassisProperties = require("../properties/chassis.properties.js");
import type { Player } from "@wildones/protocol";
import type { GameConfig, GameSocket } from "../types";

const gameport = process.env.PORT || 8000;

const DEBUG = true;

type AnyClient = Client | LobbyClient | LadderClient | GameClient;

class WOL {
  declare lobbyClients: Record<string, LobbyClient>;
  declare ladderClients: Record<string, LadderClient>;
  declare slots: Record<string, Slot>;
  declare db: Database;
  declare packetHandler: PacketHandler;
  declare assetsURL: string;
  declare assetsCacheVersion: string;
  declare assetsList: string[];
  declare assetsObj: Record<string, unknown>;
  declare config: GameConfig;
  declare accessoriesObj: Record<string, AccessoriesProperties>;
  declare crateObj: unknown;
  declare levelsObj: unknown;
  declare weaponsObj: Record<string, WeaponProperties>;
  declare mapsObj: Record<string, MapProperties>;
  declare petFoodsObj: Record<string, PetFoodProperties>;
  declare petsObj: Record<string, ChassisProperties>;
  declare itemLevel: Record<string, number>;
  declare DEFAULT_TIME_AFTER_WEAPON: number;
  declare procTimer: void;

  constructor() {
    //initialize containers
    this.lobbyClients = {};
    this.ladderClients = {};
    this.slots = {};

    // setup database
    this.db = new Database();
    this.db.connect();

    // setup packet Handler
    this.packetHandler = new PacketHandler(this);

    //assets
    this.assetsURL = process.env.ASSETS_URL || "http://localhost/assets/json/";
    this.assetsCacheVersion = "debug_0002";
    this.assetsList = ["Config", "Accessories", "Crate", "Gifts", "Levels", "Maps", "Other", "PetFoods", "Pets", "WeaponsGrid"];
    this.assetsObj = {};

    this.config = {} as GameConfig;
    this.accessoriesObj = {};
    this.crateObj = {};
    this.levelsObj = {};
    this.weaponsObj = {};
    this.mapsObj = {};
    this.petFoodsObj = {};
    this.petsObj = {};

    this.itemLevel = {};

    //initialize timers

    this.DEFAULT_TIME_AFTER_WEAPON = 400;
  }

  // Llama a func cada `wait` ms (o `times` veces). Si func lanza, deja de repetir
  interval(func: () => void, wait: number, times?: number): void {
    const interv = (function (w, t) {
      return function () {
        if (typeof t === "undefined" || t-- > 0) {
          setTimeout(interv, w);
          try {
            func.call(null);
          } catch {
            t = 0;
          }
        }
      };
    })(wait, times);

    setTimeout(interv, wait);
  }

  start(): void {
    this.loadAssets(0);
    this.procTimer = this.interval(this.update.bind(this), 100);
  }

  // Assets
  loadAssets(pos: number): void {
    assets.loadAssets(this, pos);
  }

  // Client handling
  run(): void {
    console.log(">> Accepting clients on " + gameport);

    net
      .createServer((rawSocket) => {
        const socket = rawSocket as GameSocket;
        socket.name = socket.remoteAddress + ":" + socket.remotePort;
        socket.id = UUID();
        console.log("generated socket id: " + socket.id);
        // Empieza como Client genérico; al llegar el POST, handler.js lo cambia por el de su tipo
        let obj: AnyClient = new Client(socket, this.db, this);
        if (DEBUG) console.log(">> CLIENT " + socket.name + " " + obj.id);
        //### scope handler ###
        (obj as Client).eventTrigger.on("newScope", function () {
          if (DEBUG) console.log(">>> New object was assigned");
          obj = (obj as Client).newObject as AnyClient;
        });
        //### data handler ###
        socket.on("data", (data) => {
          try {
            this.packetHandler.handle(obj, data);
          } catch (e) {
            if (DEBUG) console.log("!! Data error: " + e);
          }
        });
        //### error handler ###
        socket.on("error", function (e) {
          if (DEBUG) console.log("!! Sock error: " + e);
        });

        //### disconnection handler ###
        socket.on("close", () => {
          this.removeClientObj(obj);
        });

        socket.on("end", () => {
          this.removeClientObj(obj);
        });
      })
      .listen(gameport as number, "0.0.0.0"); // PORT del .env llega como texto, como en el original
  }

  //### Timers ###

  // Cada 100 ms: avanza todas las partidas
  update(): void {
    for (const key in this.slots) {
      this.slots[key].update();
    }
  }

  //### Game related ###

  validateMapDetails<D extends matchmaking.MapDetails>(client: LobbyClient, data: D): D {
    return matchmaking.validateMapDetails(this, client, data);
  }

  findSimilarSlot(map: Slot): string | undefined {
    return matchmaking.findSimilarSlot(this, map);
  }

  findSlot(_client: LobbyClient, mapDetails: matchmaking.MapDetails, customName: string | null): string | 0 | undefined {
    return matchmaking.findSlot(this, mapDetails, customName);
  }

  createSlot(gameId: string, mapName: string, playerCount: number, gameDuration: number, turnDuration: number): void {
    this.slots[gameId] = new Slot(this, gameId, mapName, playerCount, gameDuration, turnDuration);
  }

  getJoinCommand(gameId: string) {
    return this.slots[gameId].getString("join");
  }

  getGame(gameId: string): Slot {
    return this.slots[gameId];
  }

  // Un GameClient cambió los datos del jugador: actualiza la copia de su conexión de lobby
  updateLobbyPlayer(newPlayer: Player): void {
    for (const key in this.lobbyClients) {
      const lc = this.lobbyClients[key];
      if (lc.player.id == newPlayer.id) {
        lc.player = newPlayer;
        break;
      }
    }
  }

  getLobbyLoad(): number {
    return Object.keys(this.lobbyClients).length;
  }

  //### add / remove client ###

  addClient(obj: AnyClient): void {
    console.log("adding client UUID: " + obj.sock.id);
    if (obj.connectionType == "lobby") this.lobbyClients[obj.sock.id] = obj as LobbyClient;
    else if (obj.connectionType == "ladder") this.ladderClients[obj.sock.id] = obj as LadderClient;
  }

  removeClientObj(obj: AnyClient): void {
    console.log(">> disconnectClient was called");

    if (obj.connectionType == "lobby") delete this.lobbyClients[obj.sock.id];
    else if (obj.connectionType == "ladder") delete this.ladderClients[obj.sock.id];
    else if (obj.connectionType == "game") {
      const game = obj as GameClient;
      if (game.gameId && this.slots[game.gameId]) {
        this.slots[game.gameId].removeClient(game);
      }
    } else {
      console.log("!! Object with undefined connectionType disconnected");
    }
  }
}

export = WOL;
