import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, ConflictError } from "../../utils/AppError";
import type { Product } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateProductSchema, UpdateProductSchema } from "@emp-billing/shared";

// ============================================================================
// PRODUCT SERVICE
// ============================================================================

export async function listProducts(
  orgId: string,
  opts: { search?: string; type?: string; isActive?: boolean; page: number; limit: number }
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.type) where.type = opts.type;
  if (opts.isActive !== undefined) where.is_active = opts.isActive;

  const result = await db.findPaginated<Product>("products", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "name", direction: "asc" }],
  });

  // Parse pricingTiers JSON for all products
  result.data = result.data.map((p) => ({
    ...p,
    pricingTiers: p.pricingTiers && typeof p.pricingTiers === "string"
      ? JSON.parse(p.pricingTiers as unknown as string)
      : p.pricingTiers,
  }));

  // Client-side search filter (DB-level LIKE would require raw)
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result.data = result.data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }

  return result;
}

export async function getProduct(orgId: string, id: string): Promise<Product> {
  const db = await getDB();
  const product = await db.findById<Product>("products", id, orgId);
  if (!product) throw NotFoundError("Product");
  // Parse pricingTiers from JSON string if needed
  if (product.pricingTiers && typeof product.pricingTiers === "string") {
    product.pricingTiers = JSON.parse(product.pricingTiers as unknown as string);
  }
  return product;
}

export async function createProduct(
  orgId: string,
  userId: string,
  input: z.infer<typeof CreateProductSchema>
): Promise<Product> {
  const db = await getDB();

  if (input.sku) {
    const existing = await db.findOne("products", { org_id: orgId, sku: input.sku });
    if (existing) throw ConflictError(`A product with SKU '${input.sku}' already exists`);
  }

  const now = new Date();
  const product = await db.create<Product>("products", {
    id: uuid(),
    orgId,
    ...input,
    pricingTiers: input.pricingTiers ? JSON.stringify(input.pricingTiers) : null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return product;
}

export async function updateProduct(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateProductSchema>
): Promise<Product> {
  const db = await getDB();
  const existing = await db.findById("products", id, orgId);
  if (!existing) throw NotFoundError("Product");

  if (input.sku) {
    const conflict = await db.findOne("products", { org_id: orgId, sku: input.sku });
    if (conflict && (conflict as Product).id !== id) {
      throw ConflictError(`A product with SKU '${input.sku}' already exists`);
    }
  }

  const updateData: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.pricingTiers !== undefined) {
    updateData.pricingTiers = input.pricingTiers ? JSON.stringify(input.pricingTiers) : null;
  }

  return db.update<Product>("products", id, updateData, orgId);
}

export async function deleteProduct(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById("products", id, orgId);
  if (!existing) throw NotFoundError("Product");
  await db.softDelete("products", id, orgId);
}

export async function listTaxRates(orgId: string) {
  const db = await getDB();
  return db.findMany("tax_rates", {
    where: { org_id: orgId, is_active: true },
    orderBy: [{ column: "name", direction: "asc" }],
  });
}

export async function createTaxRate(
  orgId: string,
  input: { name: string; type: string; rate: number; isCompound: boolean; components?: unknown[]; isDefault: boolean }
) {
  const db = await getDB();

  if (input.isDefault) {
    await db.updateMany("tax_rates", { org_id: orgId }, { is_default: false, updated_at: new Date() });
  }

  const now = new Date();
  return db.create("tax_rates", {
    id: uuid(),
    orgId,
    ...input,
    components: input.components ? JSON.stringify(input.components) : null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateTaxRate(
  orgId: string,
  id: string,
  input: { name?: string; type?: string; rate?: number; isCompound?: boolean; components?: unknown[]; isDefault?: boolean }
) {
  const db = await getDB();
  const existing = await db.findById("tax_rates", id, orgId);
  if (!existing) throw NotFoundError("Tax rate");

  if (input.isDefault) {
    await db.updateMany("tax_rates", { org_id: orgId }, { is_default: false, updated_at: new Date() });
  }

  const updateData: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.components !== undefined) {
    updateData.components = input.components ? JSON.stringify(input.components) : null;
  }

  return db.update("tax_rates", id, updateData, orgId);
}

export async function deleteTaxRate(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById("tax_rates", id, orgId);
  if (!existing) throw NotFoundError("Tax rate");
  await db.softDelete("tax_rates", id, orgId);
}
