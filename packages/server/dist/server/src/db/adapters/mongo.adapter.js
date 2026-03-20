"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoAdapter = void 0;
const mongodb_1 = require("mongodb");
const crypto_1 = require("crypto");
const index_1 = require("../../config/index");
const logger_1 = require("../../utils/logger");
// ============================================================================
// MONGODB ADAPTER — native driver implementation
// ============================================================================
class MongoAdapter {
    client;
    db;
    _connected = false;
    session;
    constructor(opts) {
        if (opts) {
            this.client = opts.client;
            this.db = opts.db;
            this.session = opts.session;
            this._connected = true;
            return;
        }
        const uri = process.env.MONGO_URI ??
            `mongodb://${index_1.config.db.host}:${index_1.config.db.port}/${index_1.config.db.name}`;
        this.client = new mongodb_1.MongoClient(uri, {
            minPoolSize: index_1.config.db.poolMin,
            maxPoolSize: index_1.config.db.poolMax,
        });
        this.session = null;
    }
    // --------------------------------------------------------------------------
    // Connection lifecycle
    // --------------------------------------------------------------------------
    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(index_1.config.db.name);
            this._connected = true;
            logger_1.logger.info(`[DB] Connected to MongoDB at ${index_1.config.db.host}:${index_1.config.db.port}/${index_1.config.db.name}`);
        }
        catch (err) {
            logger_1.logger.error("[DB] MongoDB connection failed", { err });
            throw err;
        }
    }
    async disconnect() {
        await this.client.close();
        this._connected = false;
        logger_1.logger.info("[DB] MongoDB disconnected");
    }
    isConnected() {
        return this._connected;
    }
    // --------------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------------
    col(table) {
        return this.db.collection(table);
    }
    /** Session options — only included when running inside a transaction. */
    get sOpts() {
        return this.session ? { session: this.session } : {};
    }
    /**
     * Convert a snake_case filter/where object into a Mongo filter.
     * Handles special values: undefined keys are dropped.
     */
    buildFilter(where, orgId) {
        const filter = {};
        for (const [key, value] of Object.entries(where)) {
            if (value === undefined)
                continue;
            if (key === "id") {
                filter._id = value;
            }
            else {
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
    buildSort(orderBy) {
        if (!orderBy || orderBy.length === 0)
            return undefined;
        const sort = {};
        for (const { column, direction } of orderBy) {
            const key = column === "id" ? "_id" : column;
            sort[key] = direction === "asc" ? 1 : -1;
        }
        return sort;
    }
    /**
     * Build a Mongo projection from columns array.
     */
    buildProjection(columns) {
        if (!columns || columns.length === 0)
            return undefined;
        const proj = {};
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
    docToRow(doc) {
        if (!doc)
            return doc;
        const { _id, ...rest } = doc;
        return this.toCamel({ id: _id, ...rest });
    }
    /**
     * Convert service data (camelCase with id) to Mongo document (snake_case with _id).
     */
    rowToDoc(data) {
        const snake = this.toSnake(data);
        const { id, ...rest } = snake;
        const doc = { ...rest };
        if (id !== undefined) {
            doc._id = id;
        }
        return doc;
    }
    // --------------------------------------------------------------------------
    // CRUD
    // --------------------------------------------------------------------------
    async findById(table, id, orgId) {
        const filter = { _id: id };
        if (orgId)
            filter.org_id = orgId;
        const doc = await this.col(table).findOne(filter, this.sOpts);
        return doc ? this.docToRow(doc) : null;
    }
    async findOne(table, where) {
        const filter = this.buildFilter(where);
        const doc = await this.col(table).findOne(filter, this.sOpts);
        return doc ? this.docToRow(doc) : null;
    }
    async findMany(table, options = {}) {
        const filter = options.where ? this.buildFilter(options.where) : {};
        const projection = this.buildProjection(options.columns);
        const sort = this.buildSort(options.orderBy);
        let cursor = this.col(table).find(filter, {
            ...this.sOpts,
            ...(projection ? { projection } : {}),
        });
        if (sort)
            cursor = cursor.sort(sort);
        if (options.offset)
            cursor = cursor.skip(options.offset);
        if (options.limit)
            cursor = cursor.limit(options.limit);
        const docs = await cursor.toArray();
        return docs.map((d) => this.docToRow(d));
    }
    async findPaginated(table, options) {
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
        if (sort)
            cursor = cursor.sort(sort);
        cursor = cursor.skip(offset).limit(limit);
        const docs = await cursor.toArray();
        return {
            data: docs.map((d) => this.docToRow(d)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async create(table, data) {
        const doc = this.rowToDoc(data);
        // Generate a string UUID for _id if none provided
        if (doc._id === undefined) {
            doc._id = (0, crypto_1.randomUUID)();
        }
        await this.col(table).insertOne(doc, this.sOpts);
        // Re-read to return the full document
        const inserted = await this.col(table).findOne({ _id: doc._id }, this.sOpts);
        return this.docToRow(inserted);
    }
    async update(table, id, data, orgId) {
        const filter = { _id: id };
        if (orgId)
            filter.org_id = orgId;
        const doc = this.rowToDoc(data);
        // Never overwrite _id
        delete doc._id;
        await this.col(table).updateOne(filter, { $set: doc }, this.sOpts);
        const updated = await this.col(table).findOne({ _id: id }, this.sOpts);
        return this.docToRow(updated);
    }
    async delete(table, id, orgId) {
        const filter = { _id: id };
        if (orgId)
            filter.org_id = orgId;
        const result = await this.col(table).deleteOne(filter, this.sOpts);
        return result.deletedCount > 0;
    }
    async softDelete(table, id, orgId) {
        const filter = { _id: id };
        if (orgId)
            filter.org_id = orgId;
        const result = await this.col(table).updateOne(filter, { $set: { is_active: false, deleted_at: new Date() } }, this.sOpts);
        return result.modifiedCount > 0;
    }
    // --------------------------------------------------------------------------
    // Batch
    // --------------------------------------------------------------------------
    async createMany(table, rows) {
        const docs = rows.map((r) => {
            const doc = this.rowToDoc(r);
            if (doc._id === undefined) {
                doc._id = (0, crypto_1.randomUUID)();
            }
            return doc;
        });
        await this.col(table).insertMany(docs, this.sOpts);
        return docs.map((d) => this.docToRow(d));
    }
    async updateMany(table, where, data) {
        const filter = this.buildFilter(where);
        const doc = this.rowToDoc(data);
        delete doc._id;
        const result = await this.col(table).updateMany(filter, { $set: doc }, this.sOpts);
        return result.modifiedCount;
    }
    async deleteMany(table, where) {
        const filter = this.buildFilter(where);
        const result = await this.col(table).deleteMany(filter, this.sOpts);
        return result.deletedCount;
    }
    // --------------------------------------------------------------------------
    // Raw query (escape hatch)
    // --------------------------------------------------------------------------
    async raw(query, bindings = []) {
        // For MongoDB, raw() accepts a JSON command string.
        // Parse the query as a JSON command and run it with db.command().
        const command = JSON.parse(query);
        // Merge bindings into the command if provided (as positional replacements
        // in values is not standard for Mongo — callers should embed values directly).
        const result = await this.db.command(command, this.sOpts);
        return result;
    }
    // --------------------------------------------------------------------------
    // Transactions (using MongoDB sessions)
    // --------------------------------------------------------------------------
    async transaction(fn) {
        const session = this.client.startSession();
        try {
            let result;
            await session.withTransaction(async () => {
                const trxAdapter = new MongoAdapter({
                    client: this.client,
                    db: this.db,
                    session,
                });
                result = await fn(trxAdapter);
            });
            return result;
        }
        finally {
            await session.endSession();
        }
    }
    // --------------------------------------------------------------------------
    // Count / Exists
    // --------------------------------------------------------------------------
    async count(table, where) {
        const filter = where ? this.buildFilter(where) : {};
        return this.col(table).countDocuments(filter, this.sOpts);
    }
    async exists(table, where) {
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
    async increment(table, id, column, amount = 1) {
        const result = await this.col(table).findOneAndUpdate({ _id: id }, { $inc: { [column]: amount } }, { ...this.sOpts, returnDocument: "after" });
        if (!result) {
            throw new Error(`increment: document ${id} not found in ${table}`);
        }
        return result[column];
    }
    // --------------------------------------------------------------------------
    // Migrate / Seed (no-op for Mongo — schema-less)
    // --------------------------------------------------------------------------
    async migrate() {
        // MongoDB is schema-less, but we create indexes for common access patterns.
        logger_1.logger.info("[DB] MongoDB migrate — creating indexes");
        const indexDefs = [
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
                }
                catch {
                    // Index may already exist with different options — log and continue
                    logger_1.logger.warn(`[DB] Could not create index on ${def.collection}: ${JSON.stringify(idx.key)}`);
                }
            }
        }
        logger_1.logger.info("[DB] MongoDB indexes created");
    }
    async seed() {
        // Seeding for MongoDB can be implemented by the seed scripts.
        // This is intentionally a no-op; use `npm run db:seed` with a Mongo-aware seed runner.
        logger_1.logger.info("[DB] MongoDB seed — no-op (use seed scripts directly)");
    }
    // --------------------------------------------------------------------------
    // Case conversion helpers (same logic as KnexAdapter)
    // --------------------------------------------------------------------------
    toSnake(obj) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value;
        }
        return result;
    }
    toCamel(obj) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] =
                value;
        }
        return result;
    }
}
exports.MongoAdapter = MongoAdapter;
//# sourceMappingURL=mongo.adapter.js.map