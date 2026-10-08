// Acceso a MongoDB, colección `users`. Las operaciones no esperan respuesta: avisan por callback.
import { MongoClient, type Db, type Filter } from "mongodb";
import type { UserDoc } from "./types";
import log = require("./helpers/log.js");

const url = process.env.MONGO_URL || "mongodb://localhost:27017/emu";

let database: Db;

class Database {
  connect(): void {
    // Si no conecta, la promesa rechazada sin catch tumba el proceso (como el assert de antes)
    MongoClient.connect(url).then(function (client) {
      log.info("Conectado a MongoDB");
      database = client.db();
    });
  }

  update(condition: Filter<UserDoc>, data: Partial<UserDoc>): void {
    database.collection<UserDoc>("users").updateOne(condition, { $set: data }).catch(function () {});
  }

  count(condition: Filter<UserDoc>, callback: (n?: number) => void): void {
    database.collection<UserDoc>("users").countDocuments(condition).then(callback, function () {
      callback();
    });
  }

  fetch(condition: Filter<UserDoc>, callback: (doc: UserDoc | null) => void): void {
    database.collection<UserDoc>("users").findOne(condition).then(callback, function () {
      callback(null);
    });
  }
}

export = Database;
