import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, ForbiddenError } from "../../utils/AppError";
import { DisputeStatus } from "@emp-billing/shared";
import type { Dispute } from "@emp-billing/shared";
import type { z } from "zod";
import type { DisputeFilterSchema } from "@emp-billing/shared";

// ============================================================================
// DISPUTE SERVICE
// ============================================================================

// ── List ─────────────────────────────────────────────────────────────────────

export async function listDisputes(orgId: string, opts: z.infer<typeof DisputeFilterSchema>) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.status) where.status = opts.status;
  if (opts.clientId) where.client_id = opts.clientId;

  const result = await db.findPaginated<Dispute>("disputes", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return result;
}

// ── Get ──────────────────────────────────────────────────────────────────────

export async function getDispute(orgId: string, id: string): Promise<Dispute> {
  const db = await getDB();
  const dispute = await db.findById<Dispute>("disputes", id, orgId);
  if (!dispute) throw NotFoundError("Dispute");
  return dispute;
}

// ── Create (Portal — client-facing) ─────────────────────────────────────────

export async function createDispute(
  orgId: string,
  clientId: string,
  data: { invoiceId?: string; reason: string }
): Promise<Dispute> {
  const db = await getDB();

  // If invoiceId is provided, verify it belongs to this client + org
  if (data.invoiceId) {
    const invoice = await db.findById<{ id: string; clientId: string }>("invoices", data.invoiceId, orgId);
    if (!invoice) throw NotFoundError("Invoice");
    if (invoice.clientId !== clientId) {
      throw ForbiddenError("You do not have access to this invoice");
    }
  }

  const id = uuid();
  const now = new Date();

  const dispute = await db.create<Dispute>("disputes", {
    id,
    orgId,
    clientId,
    invoiceId: data.invoiceId || null,
    reason: data.reason,
    status: DisputeStatus.OPEN,
    resolution: null,
    adminNotes: null,
    attachments: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return dispute;
}

// ── Update (Admin — change status, add resolution) ──────────────────────────

export async function updateDispute(
  orgId: string,
  id: string,
  data: { status?: string; resolution?: string; adminNotes?: string },
  userId: string
): Promise<Dispute> {
  const db = await getDB();

  const existing = await db.findById<Dispute>("disputes", id, orgId);
  if (!existing) throw NotFoundError("Dispute");

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (data.status !== undefined) updates.status = data.status;
  if (data.resolution !== undefined) updates.resolution = data.resolution;
  if (data.adminNotes !== undefined) updates.adminNotes = data.adminNotes;

  // If resolving or closing, record who and when
  if (data.status === DisputeStatus.RESOLVED || data.status === DisputeStatus.CLOSED) {
    updates.resolvedBy = userId;
    updates.resolvedAt = now;
  }

  return db.update<Dispute>("disputes", id, updates, orgId);
}
