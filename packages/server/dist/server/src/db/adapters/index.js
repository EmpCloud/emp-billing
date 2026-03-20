"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDBAdapter = createDBAdapter;
exports.getDB = getDB;
exports.closeDB = closeDB;
const knex_adapter_1 = require("./knex.adapter");
const mongo_adapter_1 = require("./mongo.adapter");
const index_1 = require("../../config/index");
// Singleton — one DB connection for the whole server process
let _db = null;
function createDBAdapter() {
    switch (index_1.config.db.provider) {
        case "mysql":
        case "pg":
            return new knex_adapter_1.KnexAdapter();
        case "mongodb":
            return new mongo_adapter_1.MongoAdapter();
        default:
            throw new Error(`Unsupported DB_PROVIDER: ${index_1.config.db.provider}`);
    }
}
async function getDB() {
    if (!_db) {
        _db = createDBAdapter();
        await _db.connect();
    }
    return _db;
}
async function closeDB() {
    if (_db) {
        await _db.disconnect();
        _db = null;
    }
}
//# sourceMappingURL=index.js.map