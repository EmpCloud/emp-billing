import { MongoClient, Db, Collection, ClientSession, Document, Filter } from "mongodb";
import { randomUUID } from "crypto";
import { config } from "../../config/index";
import { logger } from "../../utils/logger";
import type { IDBAdapter, QueryOptions, PaginatedResult } from "./IDBAdapter";

// ============================================================================
// MONGODB ADAPTER — native driver implementation
// ============================================================================

export class MongoAdapter implements IDBAdapter {
  private client: MongoClient;
  private db!: Db;
  private _connected = false;
  private session: ClientSession | null;

  constructor(opts?: { client: MongoClient; db: Db; session: ClientSession }) {
    if (opts) {
      this.client = opts.client;
      this.db = opts.db;
      this.session = opts.session;
      this._connected = true;
      return;
    }

    const uri =
      process.env.MONGO_URI ??
      `mongodb://${config.db.host}:${config.db.port}/${config.db.name}`;

    this.client = new MongoClient(uri, {
      minPoolSize: config.db.poolMin,
      maxPoolSize: config.db.poolMax,
    });
    this.session = null;
  }

  // --------------------------------------------------------------------------
  // Connection lifecycle
  // --------------------------------------------------------------------------

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.db = this.client.db(config.db.name);
      this._connected = true;
      logger.info(
        `[DB] Connected to MongoDB at ${config.db.host}:${config.db.port}/${config.db.name}`
      );
    } catch (err) {
      logger.error("[DB] MongoDB connection failed", { err });
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    this._connected = false;
    logger.info("[DB] MongoDB disconnected");
  }

  isConnected(): boolean {
    return this._connected;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private col(table: string): Collection {
    return this.db.collection(table);
  }

  /** Session options — only included when running inside a transaction. */
  private get sOpts(): { session: ClientSession } | Record<string, never> {
    return this.session ? { session: this.session } : {};
  }

  /**
   * Convert a snake_case filter/where object into a Mongo filter.
   * Handles special values: undefined keys are dropped.
   */
  private buildFilter(
    where: Record<string, unknown>,
    orgId?: string
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;
      if (key === "id") {
        filter._id = value;
      } else {
        filter[key] = value;
      }
    }

    if (orgId) {
      filter.org_id = orgId;
    }
    return filter;
  }

  /**
   * Build a Mongo sort object from the QueryOptions orderBy array.
   */
  private buildSort(
    orderBy?: { column: string; direction: "asc" | "desc" }[]
  ): Record<string, 1 | -1> | undefined {
    if (!orderBy || orderBy.length === 0) return undefined;
    const sort: Record<string, 1 | -1> = {};
    for (const { column, direction } of orderBy) {
      const key = column === "id" ? "_id" : column;
      sort[key] = direction === "asc" ? 1 : -1;
    }
    return sort;
  }

  /**
   * Build a Mongo projection from columns array.
   */
  private buildProjection(
    columns?: string[]
  ): Record<string, 1> | undefined {
    if (!columns || columns.length === 0) return undefined;
    const proj: Record<string, 1> = {};
    for (const col of columns) {
      const key = col === "id" ? "_id" : col;
      proj[key] = 1;
    }
    return proj;
  }

  /**
   * Convert Mongo document (_id) to service-friendly object (id).
   * Also converts _id → id transparently.
   */
  private docToRow(doc: Record<string, unknown>): Record<string, unknown> {
    if (!doc) return doc;
    const { _id, ...rest } = doc;
    return this.toCamel({ id: _id, ...rest });
  }

  /**
   * Convert service data (camelCase with id) to Mongo document (snake_case with _id).
   */
  private rowToDoc(data: Record<string, unknown>): Record<string, unknown> {
    const snake = this.toSnake(data);
    const { id, ...rest } = snake;
    const doc: Record<string, unknown> = { ...rest };
    if (id !== undefined) {
      doc._id = id;
    }
    return doc;
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  async findById<T>(
    table: string,
    id: string,
    orgId?: string
  ): Promise<T | null> {
    const filter: Record<string, unknown> = { _id: id };
    if (orgId) filter.org_id = orgId;

    const doc = await this.col(table).findOne(filter, this.sOpts);
    return doc ? (this.docToRow(doc as Record<string, unknown>) as T) : null;
  }

  async findOne<T>(
    table: string,
    where: Record<string, unknown>
  ): Promise<T | null> {
    const filter = this.buildFilter(where);
    const doc = await this.col(table).findOne(filter, this.sOpts);
    return doc ? (this.docToRow(doc as Record<string, unknown>) as T) : null;
  }

  async findMany<T>(
    table: string,
    options: QueryOptions = {}
  ): Promise<T[]> {
    const filter = options.where ? this.buildFilter(options.where) : {};
    const projection = this.buildProjection(options.columns);
    const sort = this.buildSort(options.orderBy);

    let cursor = this.col(table).find(filter, {
      ...this.sOpts,
      ...(projection ? { projection } : {}),
    });

    if (sort) cursor = cursor.sort(sort);
    if (options.offset) cursor = cursor.skip(options.offset);
    if (options.limit) cursor = cursor.limit(options.limit);

    const docs = await cursor.toArray();
    return docs.map(
      (d) => this.docToRow(d as Record<string, unknown>) as T
    );
  }

  async findPaginated<T>(
    table: string,
    options: QueryOptions & { page: number; limit: number }
  ): Promise<PaginatedResult<T>> {
    const { page, limit, where, orderBy, columns } = options;
    const offset = (page - 1) * limit;

    const filter = where ? this.buildFilter(where) : {};
    const total = await this.col(table).countDocuments(filter, this.sOpts);

    const projection = this.buildProjection(columns);
    const sort = this.buildSort(orderBy);

    let cursor = this.col(table).find(filter, {
      ...this.sOpts,
      ...(projection ? { projection } : {}),
    });

    if (sort) cursor = cursor.sort(sort);
    cursor = cursor.skip(offset).limit(limit);

    const docs = await cursor.toArray();
    return {
      data: docs.map(
        (d) => this.docToRow(d as Record<string, unknown>) as T
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create<T>(
    table: string,
    data: Record<string, unknown>
  ): Promise<T> {
    const doc = this.rowToDoc(data);
    // Generate a string UUID for _id if none provided
    if (doc._id === undefined) {
      doc._id = randomUUID();
    }

    await this.col(table).insertOne(doc, this.sOpts);

    // Re-read to return the full document
    const inserted = await this.col(table).findOne(
      { _id: doc._id } as Filter<Document>,
      this.sOpts
    );
    return this.docToRow(inserted as Record<string, unknown>) as T;
  }

  async update<T>(
    table: string,
    id: string,
    data: Record<string, unknown>,
    orgId?: string
  ): Promise<T> {
    const filter: Record<string, unknown> = { _id: id };
    if (orgId) filter.org_id = orgId;

    const doc = this.rowToDoc(data);
    // Never overwrite _id
    delete doc._id;

    await this.col(table).updateOne(filter, { $set: doc }, this.sOpts);

    const updated = await this.col(table).findOne(
      { _id: id } as unknown as Filter<Document>,
      this.sOpts
    );
    return this.docToRow(updated as Record<string, unknown>) as T;
  }

  async delete(
    table: string,
    id: string,
    orgId?: string
  ): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: id };
    if (orgId) filter.org_id = orgId;

    const result = await this.col(table).deleteOne(filter, this.sOpts);
    return result.deletedCount > 0;
  }

  async softDelete(
    table: string,
    id: string,
    orgId?: string
  ): Promise<boolean> {
    const filter: Record<string, unknown> = { _id: id };
    if (orgId) filter.org_id = orgId;

    const result = await this.col(table).updateOne(
      filter,
      { $set: { is_active: false, deleted_at: new Date() } },
      this.sOpts
    );
    return result.modifiedCount > 0;
  }

  // --------------------------------------------------------------------------
  // Batch
  // --------------------------------------------------------------------------

  async createMany<T>(
    table: string,
    rows: Record<string, unknown>[]
  ): Promise<T[]> {
    const docs = rows.map((r) => {
      const doc = this.rowToDoc(r);
      if (doc._id === undefined) {
        doc._id = randomUUID();
      }
      return doc;
    });

    await this.col(table).insertMany(docs, this.sOpts);

    return docs.map(
      (d) => this.docToRow(d as Record<string, unknown>) as T
    );
  }

  async updateMany(
    table: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>
  ): Promise<number> {
    const filter = this.buildFilter(where);
    const doc = this.rowToDoc(data);
    delete doc._id;

    const result = await this.col(table).updateMany(
      filter,
      { $set: doc },
      this.sOpts
    );
    return result.modifiedCount;
  }

  async deleteMany(
    table: string,
    where: Record<string, unknown>
  ): Promise<number> {
    const filter = this.buildFilter(where);
    const result = await this.col(table).deleteMany(filter, this.sOpts);
    return result.deletedCount;
  }

  // --------------------------------------------------------------------------
  // Raw query (escape hatch)
  // --------------------------------------------------------------------------

  async raw<T>(query: string, bindings: unknown[] = []): Promise<T> {
    // For MongoDB, raw() accepts a JSON command string.
    // Parse the query as a JSON command and run it with db.command().
    const command = JSON.parse(query) as Record<string, unknown>;

    // Merge bindings into the command if provided (as positional replacements
    // in values is not standard for Mongo — callers should embed values directly).
    const result = await this.db.command(command, this.sOpts);
    return result as T;
  }

  // --------------------------------------------------------------------------
  // Transactions (using MongoDB sessions)
  // --------------------------------------------------------------------------

  async transaction<T>(fn: (trx: IDBAdapter) => Promise<T>): Promise<T> {
    const session = this.client.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        const trxAdapter = new MongoAdapter({
          client: this.client,
          db: this.db,
          session,
        });
        result = await fn(trxAdapter);
      });
      return result as T;
    } finally {
      await session.endSession();
    }
  }

  // --------------------------------------------------------------------------
  // Count / Exists
  // --------------------------------------------------------------------------

  async count(
    table: string,
    where?: Record<string, unknown>
  ): Promise<number> {
    const filter = where ? this.buildFilter(where) : {};
    return this.col(table).countDocuments(filter, this.sOpts);
  }

  async exists(
    table: string,
    where: Record<string, unknown>
  ): Promise<boolean> {
    const filter = this.buildFilter(where);
    const doc = await this.col(table).findOne(filter, {
      ...this.sOpts,
      projection: { _id: 1 },
    });
    return doc !== null;
  }

  // --------------------------------------------------------------------------
  // Increment
  // --------------------------------------------------------------------------

  async increment(
    table: string,
    id: string,
    column: string,
    amount = 1
  ): Promise<number> {
    const result = await this.col(table).findOneAndUpdate(
      { _id: id } as unknown as Filter<Document>,
      { $inc: { [column]: amount } },
      { ...this.sOpts, returnDocument: "after" }
    );

    if (!result) {
      throw new Error(`increment: document ${id} not found in ${table}`);
    }

    return (result as Record<string, unknown>)[column] as number;
  }

  // --------------------------------------------------------------------------
  // Migrate / Seed (no-op for Mongo — schema-less)
  // --------------------------------------------------------------------------

  async migrate(): Promise<void> {
    // MongoDB is schema-less, but we create indexes for common access patterns.
    logger.info("[DB] MongoDB migrate — creating indexes");

    const indexDefs: Array<{
      collection: string;
      indexes: Array<{ key: Record<string, 1 | -1>; unique?: boolean }>;
    }> = [
      {
        collection: "organizations",
        indexes: [{ key: { slug: 1 }, unique: true }],
      },
      {
        collection: "users",
        indexes: [
          { key: { email: 1 }, unique: true },
          { key: { org_id: 1 } },
        ],
      },
      {
        collection: "clients",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, email: 1 } },
        ],
      },
      {
        collection: "invoices",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, client_id: 1 } },
          { key: { org_id: 1, status: 1 } },
          { key: { org_id: 1, invoice_number: 1 }, unique: true },
          { key: { due_date: 1 } },
        ],
      },
      {
        collection: "invoice_items",
        indexes: [{ key: { invoice_id: 1 } }],
      },
      {
        collection: "quotes",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, client_id: 1 } },
          { key: { org_id: 1, status: 1 } },
        ],
      },
      {
        collection: "quote_items",
        indexes: [{ key: { quote_id: 1 } }],
      },
      {
        collection: "payments",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, invoice_id: 1 } },
        ],
      },
      {
        collection: "payment_allocations",
        indexes: [
          { key: { payment_id: 1 } },
          { key: { invoice_id: 1 } },
        ],
      },
      {
        collection: "credit_notes",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, client_id: 1 } },
        ],
      },
      {
        collection: "expenses",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, category_id: 1 } },
        ],
      },
      {
        collection: "products",
        indexes: [
          { key: { org_id: 1 } },
          { key: { org_id: 1, sku: 1 } },
        ],
      },
      {
        collection: "recurring_profiles",
        indexes: [
          { key: { org_id: 1 } },
          { key: { next_run_at: 1, status: 1 } },
        ],
      },
      {
        collection: "audit_logs",
        indexes: [
          { key: { org_id: 1, created_at: -1 } },
          { key: { entity_type: 1, entity_id: 1 } },
        ],
      },
      {
        collection: "webhooks",
        indexes: [{ key: { org_id: 1 } }],
      },
      {
        collection: "settings",
        indexes: [{ key: { org_id: 1, key: 1 }, unique: true }],
      },
      {
        collection: "tax_rates",
        indexes: [{ key: { org_id: 1 } }],
      },
    ];

    for (const def of indexDefs) {
      for (const idx of def.indexes) {
        try {
          await this.db
            .collection(def.collection)
            .createIndex(idx.key, idx.unique ? { unique: true } : {});
        } catch {
          // Index may already exist with different options — log and continue
          logger.warn(
            `[DB] Could not create index on ${def.collection}: ${JSON.stringify(idx.key)}`
          );
        }
      }
    }

    logger.info("[DB] MongoDB indexes created");
  }

  async seed(): Promise<void> {
    // Seeding for MongoDB can be implemented by the seed scripts.
    // This is intentionally a no-op; use `npm run db:seed` with a Mongo-aware seed runner.
    logger.info("[DB] MongoDB seed — no-op (use seed scripts directly)");
  }

  // --------------------------------------------------------------------------
  // Case conversion helpers (same logic as KnexAdapter)
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
      result[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] =
        value;
    }
    return result;
  }
}
