import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { logger } from "../../utils/logger";

export interface EmpCloudBootstrapIdentity {
  orgId: string;
  userId: string;
}

const BOOTSTRAP_ORG_EMAIL = "billing@empcloud.com";
const BOOTSTRAP_USER_EMAIL = "system@empcloud.com";

let cached: EmpCloudBootstrapIdentity | null = null;
let inflight: Promise<EmpCloudBootstrapIdentity> | null = null;

/**
 * Resolves (and seeds if missing) the EmpCloud billing organization + system
 * owner user. The EmpCloud-API-key auth path AND the /webhooks/empcloud route
 * both depend on a real `organizations.id` for inserts to satisfy FK
 * constraints — pre-fix, both fell back to `""` when the row was missing,
 * which crashed every /clients/auto-provision call with an FK error and made
 * every subscription.* webhook silently no-op.
 *
 * Idempotent: re-running is safe (resolves by well-known email). Process-local
 * cache avoids the DB roundtrip after first resolution.
 */
export async function ensureEmpCloudBillingOrg(): Promise<EmpCloudBootstrapIdentity> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = resolve().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function resolve(): Promise<EmpCloudBootstrapIdentity> {
  const db = await getDB();

  const orgId = await resolveOrCreateOrg(db);
  const userId = await resolveOrCreateOwner(db, orgId);

  cached = { orgId, userId };
  return cached;
}

async function resolveOrCreateOrg(db: Awaited<ReturnType<typeof getDB>>): Promise<string> {
  const existing = await db.findOne<{ id: string }>("organizations", {
    email: BOOTSTRAP_ORG_EMAIL,
  });
  if (existing) return existing.id;

  return db.transaction(async (trx) => {
    const racedExisting = await trx.findOne<{ id: string }>("organizations", {
      email: BOOTSTRAP_ORG_EMAIL,
    });
    if (racedExisting) return racedExisting.id;

    const newId = uuid();
    const now = new Date();
    await trx.create("organizations", {
      id: newId,
      name: "EmpCloud",
      legalName: "EmpCloud Pvt. Ltd.",
      email: BOOTSTRAP_ORG_EMAIL,
      address: JSON.stringify({ country: "IN" }),
      defaultCurrency: "INR",
      country: "IN",
      fiscalYearStart: 4,
      invoicePrefix: "INV",
      invoiceNextNumber: 1,
      quotePrefix: "QTE",
      quoteNextNumber: 1,
      defaultPaymentTerms: 30,
      isActive: true,
      timezone: "Asia/Kolkata",
      createdAt: now,
      updatedAt: now,
    });
    logger.info(`Bootstrapped EmpCloud billing organization: ${newId}`);
    return newId;
  });
}

async function resolveOrCreateOwner(
  db: Awaited<ReturnType<typeof getDB>>,
  orgId: string,
): Promise<string> {
  const existing = await db.findOne<{ id: string }>("users", {
    org_id: orgId,
    role: "owner",
  });
  if (existing) return existing.id;

  return db.transaction(async (trx) => {
    const racedExisting = await trx.findOne<{ id: string }>("users", {
      org_id: orgId,
      role: "owner",
    });
    if (racedExisting) return racedExisting.id;

    const newId = uuid();
    const now = new Date();
    await trx.create("users", {
      id: newId,
      orgId,
      email: BOOTSTRAP_USER_EMAIL,
      passwordHash: "$disabled$no-login-allowed",
      firstName: "EmpCloud",
      lastName: "System",
      role: "owner",
      isActive: true,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    logger.info(`Bootstrapped EmpCloud system owner user: ${newId}`);
    return newId;
  });
}

export function clearEmpCloudBootstrapCache(): void {
  cached = null;
}
