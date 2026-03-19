import { KnexAdapter } from "./knex.adapter";
import { MongoAdapter } from "./mongo.adapter";
import { config } from "../../config/index";
import { logger } from "../../utils/logger";
import type { IDBAdapter } from "./IDBAdapter";

// Singleton — one DB connection for the whole server process
let _db: IDBAdapter | null = null;

export function createDBAdapter(): IDBAdapter {
  switch (config.db.provider) {
    case "mysql":
    case "pg":
      return new KnexAdapter();
    case "mongodb":
      return new MongoAdapter();
    default:
      throw new Error(`Unsupported DB_PROVIDER: ${config.db.provider}`);
  }
}

export async function getDB(): Promise<IDBAdapter> {
  if (!_db) {
    _db = createDBAdapter();
    await _db.connect();
  }
  return _db;
}

export async function closeDB(): Promise<void> {
  if (_db) {
    await _db.disconnect();
    _db = null;
  }
}

export type { IDBAdapter };
