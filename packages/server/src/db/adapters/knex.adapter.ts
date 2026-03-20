import Knex, { type Knex as KnexType } from "knex";
import { config } from "../../config/index";
import { logger } from "../../utils/logger";
import type { IDBAdapter, QueryOptions, PaginatedResult } from "./IDBAdapter";

// ============================================================================
// KNEX ADAPTER — supports MySQL and PostgreSQL
// ============================================================================

export class KnexAdapter implements IDBAdapter {
  private knex: KnexType;
  private _connected = false;

  constructor(knexInstance?: KnexType) {
    if (knexInstance) {
      this.knex = knexInstance;
      return;
    }

    const client = config.db.provider === "pg" ? "pg" : "mysql2";
    const pgPort = 5432;
    const port = config.db.provider === "pg" ? pgPort : config.db.port;

    this.knex = Knex({
      client,
      connection: {
        host: config.db.host,
        port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.name,
        ...(client === "mysql2" ? { timezone: "+00:00", charset: "utf8mb4" } : {}),
      },
      pool: { min: config.db.poolMin, max: config.db.poolMax },
      acquireConnectionTimeout: 10000,
    });
  }

  getKnex(): KnexType {
    return this.knex;
  }

  async connect(): Promise<void> {
    try {
      await this.knex.raw("SELECT 1");
      this._connected = true;
      logger.info(`[DB] Connected to ${config.db.provider} at ${config.db.host}:${config.db.port}/${config.db.name}`);
    } catch (err) {
      logger.error("[DB] Connection failed", { err });
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.knex.destroy();
    this._connected = false;
    logger.info("[DB] Disconnected");
  }

  isConnected(): boolean {
    return this._connected;
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  async findById<T>(table: string, id: string, orgId?: string): Promise<T | null> {
    const q = this.knex(table).where({ id }).first();
    if (orgId) q.where({ org_id: orgId });
    const row = await q;
    return row ? this.toCamel(row) as T : null;
  }

  async findOne<T>(table: string, where: Record<string, unknown>): Promise<T | null> {
    const row = await this.knex(table).where(where).first();
    return row ? this.toCamel(row) as T : null;
  }

  async findMany<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
    const q = this.knex(table);
    if (options.where) q.where(options.where);
    if (options.columns) q.select(options.columns);
    if (options.orderBy) {
      options.orderBy.forEach(({ column, direction }) => q.orderBy(column, direction));
    }
    if (options.limit) q.limit(options.limit);
    if (options.offset) q.offset(options.offset);
    const rows = await q;
    return rows.map((r: Record<string, unknown>) => this.toCamel(r)) as T[];
  }

  async findPaginated<T>(
    table: string,
    options: QueryOptions & { page: number; limit: number }
  ): Promise<PaginatedResult<T>> {
    const { page, limit, where, orderBy, columns } = options;
    const offset = (page - 1) * limit;

    const countQ = this.knex(table).count("* as count");
    if (where) countQ.where(where);
    const countResult = await countQ.first();
    const total = parseInt(String((countResult as Record<string, unknown>)?.count ?? 0));

    const q = this.knex(table);
    if (where) q.where(where);
    if (columns) q.select(columns);
    if (orderBy) orderBy.forEach(({ column, direction }) => q.orderBy(column, direction));
    q.limit(limit).offset(offset);

    const rows = await q;
    return {
      data: rows.map((r: Record<string, unknown>) => this.toCamel(r)) as T[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create<T>(table: string, data: Record<string, unknown>): Promise<T> {
    const snake = this.toSnake(data);
    const [id] = await this.knex(table).insert(snake);
    const row = await this.knex(table).where({ id: data.id ?? id }).first();
    return this.toCamel(row) as T;
  }

  async update<T>(table: string, id: string, data: Record<string, unknown>, orgId?: string): Promise<T> {
    const snake = this.toSnake(data);
    const q = this.knex(table).where({ id }).update(snake);
    if (orgId) q.where({ org_id: orgId });
    await q;
    const row = await this.knex(table).where({ id }).first();
    return this.toCamel(row) as T;
  }

  async delete(table: string, id: string, orgId?: string): Promise<boolean> {
    const q = this.knex(table).where({ id }).delete();
    if (orgId) q.where({ org_id: orgId });
    const affected = await q;
    return affected > 0;
  }

  async softDelete(table: string, id: string, orgId?: string): Promise<boolean> {
    const q = this.knex(table).where({ id }).update({ is_active: false, deleted_at: new Date() });
    if (orgId) q.where({ org_id: orgId });
    const affected = await q;
    return affected > 0;
  }

  async createMany<T>(table: string, rows: Record<string, unknown>[]): Promise<T[]> {
    const snakeRows = rows.map((r) => this.toSnake(r));
    await this.knex(table).insert(snakeRows);
    return snakeRows.map((r) => this.toCamel(r)) as T[];
  }

  async updateMany(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<number> {
    return this.knex(table).where(where).update(this.toSnake(data));
  }

  async deleteMany(table: string, where: Record<string, unknown>): Promise<number> {
    return this.knex(table).where(where).delete();
  }

  async raw<T>(query: string, bindings: unknown[] = []): Promise<T> {
    const result = await this.knex.raw(query, bindings);
    return (config.db.provider === "pg" ? result.rows : result[0]) as T;
  }

  async transaction<T>(fn: (trx: IDBAdapter) => Promise<T>): Promise<T> {
    return this.knex.transaction(async (trxKnex) => {
      const trxAdapter = new KnexAdapter(trxKnex);
      trxAdapter._connected = true;
      return fn(trxAdapter);
    });
  }

  async count(table: string, where?: Record<string, unknown>): Promise<number> {
    const q = this.knex(table).count("* as count");
    if (where) q.where(where);
    const result = await q.first();
    return parseInt(String((result as Record<string, unknown>)?.count ?? 0));
  }

  async exists(table: string, where: Record<string, unknown>): Promise<boolean> {
    const count = await this.count(table, where);
    return count > 0;
  }

  async increment(table: string, id: string, column: string, amount = 1): Promise<number> {
    await this.knex(table).where({ id }).increment(column, amount);
    const row = await this.knex(table).where({ id }).select(column).first();
    return (row as Record<string, number>)[column];
  }

  async migrate(): Promise<void> {
    const path = await import("path");
    const dir = path.resolve(__dirname, "../migrations");
    await this.knex.migrate.latest({ directory: dir });
    logger.info("[DB] Migrations complete");
  }

  async seed(): Promise<void> {
    const path = await import("path");
    const dir = path.resolve(__dirname, "../seeds");
    await this.knex.seed.run({ directory: dir });
    logger.info("[DB] Seeds complete");
  }

  // --------------------------------------------------------------------------
  // Case conversion helpers
  // --------------------------------------------------------------------------

  private toSnake(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value;
    }
    return result;
  }

  private toCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
    }
    return result;
  }
}
