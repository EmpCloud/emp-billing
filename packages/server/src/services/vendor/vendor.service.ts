import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, ConflictError } from "../../utils/AppError";
import type { Vendor } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateVendorSchema, UpdateVendorSchema } from "@emp-billing/shared";

// ============================================================================
// VENDOR SERVICE
// ============================================================================

export async function listVendors(
  orgId: string,
  opts: { search?: string; isActive?: boolean; page: number; limit: number }
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.isActive !== undefined) where.is_active = opts.isActive;

  const result = await db.findPaginated<Vendor>("vendors", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "name", direction: "asc" }],
  });

  let data = result.data;

  if (opts.search) {
    const q = opts.search.toLowerCase();
    data = data.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.company && v.company.toLowerCase().includes(q))
    );
  }

  return { ...result, data };
}

export async function getVendor(orgId: string, id: string): Promise<Vendor> {
  const db = await getDB();
  const vendor = await db.findById<Vendor>("vendors", id, orgId);
  if (!vendor) throw NotFoundError("Vendor");
  return vendor;
}

export async function createVendor(
  orgId: string,
  input: z.infer<typeof CreateVendorSchema>
): Promise<Vendor> {
  const db = await getDB();

  const vendorId = uuid();
  const now = new Date();

  await db.create<Vendor>("vendors", {
    id: vendorId,
    orgId,
    ...input,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return getVendor(orgId, vendorId);
}

export async function updateVendor(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateVendorSchema>
): Promise<Vendor> {
  const db = await getDB();
  const existing = await db.findById("vendors", id, orgId);
  if (!existing) throw NotFoundError("Vendor");

  const updateData: Record<string, unknown> = { ...input, updatedAt: new Date() };

  await db.update("vendors", id, updateData, orgId);
  return getVendor(orgId, id);
}

export async function deleteVendor(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById("vendors", id, orgId);
  if (!existing) throw NotFoundError("Vendor");
  await db.softDelete("vendors", id, orgId);
}
