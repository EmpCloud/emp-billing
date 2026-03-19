// ============================================================================
// DB ADAPTER INTERFACE
// Shared abstraction used by all services — never raw Knex/Mongo in services.
// ============================================================================

export interface QueryOptions {
  where?: Record<string, unknown>;
  orderBy?: { column: string; direction: "asc" | "desc" }[];
  limit?: number;
  offset?: number;
  columns?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IDBAdapter {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Core CRUD
  findById<T>(table: string, id: string, orgId?: string): Promise<T | null>;
  findOne<T>(table: string, where: Record<string, unknown>): Promise<T | null>;
  findMany<T>(table: string, options?: QueryOptions): Promise<T[]>;
  findPaginated<T>(table: string, options: QueryOptions & { page: number; limit: number }): Promise<PaginatedResult<T>>;
  create<T>(table: string, data: Record<string, unknown>): Promise<T>;
  update<T>(table: string, id: string, data: Record<string, unknown>, orgId?: string): Promise<T>;
  delete(table: string, id: string, orgId?: string): Promise<boolean>;
  softDelete(table: string, id: string, orgId?: string): Promise<boolean>;

  // Batch
  createMany<T>(table: string, rows: Record<string, unknown>[]): Promise<T[]>;
  updateMany(table: string, where: Record<string, unknown>, data: Record<string, unknown>): Promise<number>;
  deleteMany(table: string, where: Record<string, unknown>): Promise<number>;

  // Raw query (escape hatch — use sparingly)
  raw<T>(query: string, bindings?: unknown[]): Promise<T>;

  // Transactions
  transaction<T>(fn: (trx: IDBAdapter) => Promise<T>): Promise<T>;

  // Count
  count(table: string, where?: Record<string, unknown>): Promise<number>;

  // Exists
  exists(table: string, where: Record<string, unknown>): Promise<boolean>;

  // Increment (e.g. invoice next number)
  increment(table: string, id: string, column: string, amount?: number): Promise<number>;

  // Migrations
  migrate(): Promise<void>;
  seed(): Promise<void>;
}
