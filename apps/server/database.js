"use strict";

var MongoClient = require('mongodb').MongoClient;

var url = process.env.MONGO_URL || 'mongodb://localhost:27017/emu';

var database;

class Database{
    connect(){
        // Si no conecta, la promesa rechazada sin catch tumba el proceso (como el assert de antes)
        MongoClient.connect(url).then(function(client) {
          console.log("Connected correctly to server.");
          database = client.db();
        });
    }

    update(condition, data) {
       database.collection('users').updateOne(condition, { $set: data }).catch(function() {});
    }

    count(condition, callback){
        database.collection('users').countDocuments(condition).then(callback, function() { callback(); });
    }

    fetch(condition, callback){
        database.collection('users').findOne(condition).then(callback, function() { callback(null); });
    }
}


module.exports = Database;

/* Thanks for contribution */
