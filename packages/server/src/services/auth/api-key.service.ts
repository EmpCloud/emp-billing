import crypto from "crypto";
import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, UnauthorizedError } from "../../utils/AppError";

// ============================================================================
// TYPES
// ============================================================================

interface ApiKeyRow {
  id: string;
  orgId: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string | string[] | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyPublic {
  id: string;
  orgId: string;
  name: string;
  keyPrefix: string;
  scopes: string[] | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyCreateResult {
  apiKey: ApiKeyPublic;
  rawKey: string;
}

export interface ApiKeyValidation {
  orgId: string;
  scopes: string[] | null;
  keyId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const API_KEY_PREFIX = "empb_live_";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function generateRawKey(): string {
  const random = crypto.randomBytes(24).toString("base64url");
  return `${API_KEY_PREFIX}${random}`;
}

function parseScopes(scopes: string | string[] | null): string[] | null {
  if (scopes === null || scopes === undefined) return null;
  if (Array.isArray(scopes)) return scopes;
  try {
    const parsed = JSON.parse(scopes);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toPublic(row: ApiKeyRow): ApiKeyPublic {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: parseScopes(row.scopes),
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ============================================================================
// SERVICE
// ============================================================================

export async function createApiKey(
  orgId: string,
  name: string,
  scopes?: string[],
  expiresAt?: Date
): Promise<ApiKeyCreateResult> {
  const db = await getDB();
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  const id = uuid();
  const now = new Date();

  await db.create<ApiKeyRow>("api_keys", {
    id,
    orgId,
    name,
    keyHash,
    keyPrefix,
    scopes: scopes && scopes.length > 0 ? JSON.stringify(scopes) : null,
    lastUsedAt: null,
    expiresAt: expiresAt ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  const row = await db.findById<ApiKeyRow>("api_keys", id);
  return {
    apiKey: toPublic(row!),
    rawKey,
  };
}

export async function revokeApiKey(orgId: string, keyId: string): Promise<void> {
  const db = await getDB();
  const row = await db.findOne<ApiKeyRow>("api_keys", { id: keyId, org_id: orgId });
  if (!row) {
    throw NotFoundError("API key");
  }
  await db.update("api_keys", keyId, { isActive: false, updatedAt: new Date() });
}

export async function listApiKeys(orgId: string): Promise<ApiKeyPublic[]> {
  const db = await getDB();
  const rows = await db.findMany<ApiKeyRow>("api_keys", { where: { org_id: orgId } });
  return rows.map(toPublic);
}

export async function validateApiKey(rawKey: string): Promise<ApiKeyValidation> {
  const db = await getDB();
  const keyHash = hashKey(rawKey);

  const row = await db.findOne<ApiKeyRow>("api_keys", { key_hash: keyHash });
  if (!row) {
    throw UnauthorizedError("Invalid API key");
  }

  if (!row.isActive) {
    throw UnauthorizedError("API key has been revoked");
  }

  if (row.expiresAt && new Date() > new Date(row.expiresAt)) {
    throw UnauthorizedError("API key has expired");
  }

  // Update last_used_at (fire and forget — do not block the request)
  db.update("api_keys", row.id, { lastUsedAt: new Date(), updatedAt: new Date() }).catch(() => {});

  return {
    orgId: row.orgId,
    scopes: parseScopes(row.scopes),
    keyId: row.id,
  };
}
