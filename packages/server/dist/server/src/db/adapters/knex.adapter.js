"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnexAdapter = void 0;
const knex_1 = __importDefault(require("knex"));
const index_1 = require("../../config/index");
const logger_1 = require("../../utils/logger");
// ============================================================================
// KNEX ADAPTER — supports MySQL and PostgreSQL
// ============================================================================
class KnexAdapter {
    knex;
    _connected = false;
    constructor(knexInstance) {
        if (knexInstance) {
            this.knex = knexInstance;
            return;
        }
        const client = index_1.config.db.provider === "pg" ? "pg" : "mysql2";
        const pgPort = 5432;
        const port = index_1.config.db.provider === "pg" ? pgPort : index_1.config.db.port;
        this.knex = (0, knex_1.default)({
            client,
            connection: {
                host: index_1.config.db.host,
                port,
                user: index_1.config.db.user,
                password: index_1.config.db.password,
                database: index_1.config.db.name,
                ...(client === "mysql2" ? { timezone: "+00:00", charset: "utf8mb4" } : {}),
            },
            pool: { min: index_1.config.db.poolMin, max: index_1.config.db.poolMax },
            acquireConnectionTimeout: 10000,
        });
    }
    getKnex() {
        return this.knex;
    }
    async connect() {
        try {
            await this.knex.raw("SELECT 1");
            this._connected = true;
            logger_1.logger.info(`[DB] Connected to ${index_1.config.db.provider} at ${index_1.config.db.host}:${index_1.config.db.port}/${index_1.config.db.name}`);
        }
        catch (err) {
            logger_1.logger.error("[DB] Connection failed", { err });
            throw err;
        }
    }
    async disconnect() {
        await this.knex.destroy();
        this._connected = false;
        logger_1.logger.info("[DB] Disconnected");
    }
    isConnected() {
        return this._connected;
    }
    // --------------------------------------------------------------------------
    // CRUD
    // --------------------------------------------------------------------------
    async findById(table, id, orgId) {
        const q = this.knex(table).where({ id }).first();
        if (orgId)
            q.where({ org_id: orgId });
        const row = await q;
        return row ? this.toCamel(row) : null;
    }
    async findOne(table, where) {
        const row = await this.knex(table).where(where).first();
        return row ? this.toCamel(row) : null;
    }
    async findMany(table, options = {}) {
        const q = this.knex(table);
        if (options.where)
            q.where(options.where);
        if (options.columns)
            q.select(options.columns);
        if (options.orderBy) {
            options.orderBy.forEach(({ column, direction }) => q.orderBy(column, direction));
        }
        if (options.limit)
            q.limit(options.limit);
        if (options.offset)
            q.offset(options.offset);
        const rows = await q;
        return rows.map((r) => this.toCamel(r));
    }
    async findPaginated(table, options) {
        const { page, limit, where, orderBy, columns } = options;
        const offset = (page - 1) * limit;
        const countQ = this.knex(table).count("* as count");
        if (where)
            countQ.where(where);
        const countResult = await countQ.first();
        const total = parseInt(String(countResult?.count ?? 0));
        const q = this.knex(table);
        if (where)
            q.where(where);
        if (columns)
            q.select(columns);
        if (orderBy)
            orderBy.forEach(({ column, direction }) => q.orderBy(column, direction));
        q.limit(limit).offset(offset);
        const rows = await q;
        return {
            data: rows.map((r) => this.toCamel(r)),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    async create(table, data) {
        const snake = this.toSnake(data);
        const [id] = await this.knex(table).insert(snake);
        const row = await this.knex(table).where({ id: data.id ?? id }).first();
        return this.toCamel(row);
    }
    async update(table, id, data, orgId) {
        const snake = this.toSnake(data);
        const q = this.knex(table).where({ id }).update(snake);
        if (orgId)
            q.where({ org_id: orgId });
        await q;
        const row = await this.knex(table).where({ id }).first();
        return this.toCamel(row);
    }
    async delete(table, id, orgId) {
        const q = this.knex(table).where({ id }).delete();
        if (orgId)
            q.where({ org_id: orgId });
        const affected = await q;
        return affected > 0;
    }
    async softDelete(table, id, orgId) {
        const q = this.knex(table).where({ id }).update({ is_active: false, deleted_at: new Date() });
        if (orgId)
            q.where({ org_id: orgId });
        const affected = await q;
        return affected > 0;
    }
    async createMany(table, rows) {
        const snakeRows = rows.map((r) => this.toSnake(r));
        await this.knex(table).insert(snakeRows);
        return snakeRows.map((r) => this.toCamel(r));
    }
    async updateMany(table, where, data) {
        return this.knex(table).where(where).update(this.toSnake(data));
    }
    async deleteMany(table, where) {
        return this.knex(table).where(where).delete();
    }
    async raw(query, bindings = []) {
        const result = await this.knex.raw(query, bindings);
        return (index_1.config.db.provider === "pg" ? result.rows : result[0]);
    }
    async transaction(fn) {
        return this.knex.transaction(async (trxKnex) => {
            const trxAdapter = new KnexAdapter(trxKnex);
            trxAdapter._connected = true;
            return fn(trxAdapter);
        });
    }
    async count(table, where) {
        const q = this.knex(table).count("* as count");
        if (where)
            q.where(where);
        const result = await q.first();
        return parseInt(String(result?.count ?? 0));
    }
    async exists(table, where) {
        const count = await this.count(table, where);
        return count > 0;
    }
    async increment(table, id, column, amount = 1) {
        await this.knex(table).where({ id }).increment(column, amount);
        const row = await this.knex(table).where({ id }).select(column).first();
        return row[column];
    }
    async migrate() {
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        const dir = path.resolve(__dirname, "../migrations");
        await this.knex.migrate.latest({ directory: dir });
        logger_1.logger.info("[DB] Migrations complete");
    }
    async seed() {
        const path = await Promise.resolve().then(() => __importStar(require("path")));
        const dir = path.resolve(__dirname, "../seeds");
        await this.knex.seed.run({ directory: dir });
        logger_1.logger.info("[DB] Seeds complete");
    }
    // --------------------------------------------------------------------------
    // Case conversion helpers
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
            result[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = value;
        }
        return result;
    }
}
exports.KnexAdapter = KnexAdapter;
//# sourceMappingURL=knex.adapter.js.map