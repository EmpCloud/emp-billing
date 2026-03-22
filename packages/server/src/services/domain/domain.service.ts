import { v4 as uuid } from "uuid";
import dns from "dns";
import { promisify } from "util";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError, ConflictError } from "../../utils/AppError";
import { config } from "../../config/index";
import type { CustomDomain } from "@emp-billing/shared";

const resolveCname = promisify(dns.resolveCname);

// ============================================================================
// IN-MEMORY CACHE (domain → org_id) with TTL
// ============================================================================

interface CacheEntry {
  orgId: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const domainCache = new Map<string, CacheEntry>();

function getCached(domain: string): string | null {
  const entry = domainCache.get(domain);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    domainCache.delete(domain);
    return null;
  }
  return entry.orgId;
}

function setCache(domain: string, orgId: string): void {
  domainCache.set(domain, { orgId, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(domain: string): void {
  domainCache.delete(domain);
}

// ============================================================================
// HELPERS
// ============================================================================

function rowToDomain(row: Record<string, unknown>): CustomDomain {
  return {
    id: row.id as string,
    orgId: (row.org_id ?? row.orgId) as string,
    domain: row.domain as string,
    verified: Boolean(row.verified),
    sslProvisioned: Boolean(row.ssl_provisioned ?? row.sslProvisioned),
    createdAt: new Date(row.created_at as string ?? row.createdAt as string),
    updatedAt: new Date(row.updated_at as string ?? row.updatedAt as string),
  };
}

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Add a custom domain for an organization.
 */
export async function addCustomDomain(orgId: string, domain: string): Promise<CustomDomain> {
  const db = await getDB();

  // Check for duplicate — find by domain across all orgs
  const existing = await db.findMany<Record<string, unknown>>("custom_domains", { where: { domain } });
  if (existing.length > 0) {
    throw ConflictError(`Domain "${domain}" is already registered`);
  }

  const id = uuid();
  const now = new Date();

  await db.create("custom_domains", {
    id,
    orgId,
    domain,
    verified: false,
    sslProvisioned: false,
    createdAt: now,
    updatedAt: now,
  });

  return { id, orgId, domain, verified: false, sslProvisioned: false, createdAt: now, updatedAt: now };
}

/**
 * Remove a custom domain.
 */
export async function removeCustomDomain(orgId: string, domainId: string): Promise<void> {
  const db = await getDB();

  const row = await db.findById<Record<string, unknown>>("custom_domains", domainId);
  if (!row || (row.org_id ?? row.orgId) !== orgId) {
    throw NotFoundError("Custom domain");
  }

  invalidateCache((row.domain ?? row.domain) as string);
  await db.delete("custom_domains", domainId);
}

/**
 * List all custom domains for an organization.
 */
export async function listCustomDomains(orgId: string): Promise<CustomDomain[]> {
  const db = await getDB();
  const rows = await db.findMany<Record<string, unknown>>("custom_domains", { where: { org_id: orgId } });
  return rows.map(rowToDomain);
}

/**
 * Verify that a domain's DNS CNAME resolves to the default domain.
 */
export async function verifyDomain(orgId: string, domainId: string): Promise<CustomDomain> {
  const db = await getDB();

  const row = await db.findById<Record<string, unknown>>("custom_domains", domainId);
  if (!row || (row.org_id ?? row.orgId) !== orgId) {
    throw NotFoundError("Custom domain");
  }

  const domain = row.domain as string;
  const defaultDomain = getDefaultDomain();
  let verified = false;

  try {
    const records = await resolveCname(domain);
    verified = records.some(
      (record) =>
        record.toLowerCase() === defaultDomain.toLowerCase() ||
        record.toLowerCase() === `${defaultDomain}.`
    );
  } catch {
    verified = false;
  }

  await db.update("custom_domains", domainId, { verified, updatedAt: new Date() });

  if (verified) {
    setCache(domain, (row.org_id ?? row.orgId) as string);
  } else {
    invalidateCache(domain);
  }

  return rowToDomain({ ...row, verified, updated_at: new Date() });
}

/**
 * Resolve an org_id from a custom domain. Uses in-memory cache.
 */
export async function resolveOrgByDomain(domain: string): Promise<string | null> {
  const cached = getCached(domain);
  if (cached) return cached;

  const db = await getDB();
  const rows = await db.findMany<Record<string, unknown>>("custom_domains", { where: { domain, verified: true } });

  if (rows.length === 0) return null;

  const orgId = (rows[0].org_id ?? rows[0].orgId) as string;
  setCache(domain, orgId);
  return orgId;
}

/**
 * Get the default domain from environment config.
 */
export function getDefaultDomain(): string {
  return config.defaultDomain;
}
