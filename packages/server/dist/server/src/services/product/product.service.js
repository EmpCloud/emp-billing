"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listProducts = listProducts;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.listTaxRates = listTaxRates;
exports.createTaxRate = createTaxRate;
exports.updateTaxRate = updateTaxRate;
exports.deleteTaxRate = deleteTaxRate;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
// ============================================================================
// PRODUCT SERVICE
// ============================================================================
async function listProducts(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.type)
        where.type = opts.type;
    if (opts.isActive !== undefined)
        where.is_active = opts.isActive;
    const result = await db.findPaginated("products", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "name", direction: "asc" }],
    });
    // Parse pricingTiers JSON for all products
    result.data = result.data.map((p) => ({
        ...p,
        pricingTiers: p.pricingTiers && typeof p.pricingTiers === "string"
            ? JSON.parse(p.pricingTiers)
            : p.pricingTiers,
    }));
    // Client-side search filter (DB-level LIKE would require raw)
    if (opts.search) {
        const q = opts.search.toLowerCase();
        result.data = result.data.filter((p) => p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q));
    }
    return result;
}
async function getProduct(orgId, id) {
    const db = await (0, index_1.getDB)();
    const product = await db.findById("products", id, orgId);
    if (!product)
        throw (0, AppError_1.NotFoundError)("Product");
    // Parse pricingTiers from JSON string if needed
    if (product.pricingTiers && typeof product.pricingTiers === "string") {
        product.pricingTiers = JSON.parse(product.pricingTiers);
    }
    return product;
}
async function createProduct(orgId, userId, input) {
    const db = await (0, index_1.getDB)();
    if (input.sku) {
        const existing = await db.findOne("products", { org_id: orgId, sku: input.sku });
        if (existing)
            throw (0, AppError_1.ConflictError)(`A product with SKU '${input.sku}' already exists`);
    }
    const now = new Date();
    const product = await db.create("products", {
        id: (0, uuid_1.v4)(),
        orgId,
        ...input,
        pricingTiers: input.pricingTiers ? JSON.stringify(input.pricingTiers) : null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });
    return product;
}
async function updateProduct(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("products", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Product");
    if (input.sku) {
        const conflict = await db.findOne("products", { org_id: orgId, sku: input.sku });
        if (conflict && conflict.id !== id) {
            throw (0, AppError_1.ConflictError)(`A product with SKU '${input.sku}' already exists`);
        }
    }
    const updateData = { ...input, updatedAt: new Date() };
    if (input.pricingTiers !== undefined) {
        updateData.pricingTiers = input.pricingTiers ? JSON.stringify(input.pricingTiers) : null;
    }
    return db.update("products", id, updateData, orgId);
}
async function deleteProduct(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("products", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Product");
    await db.softDelete("products", id, orgId);
}
async function listTaxRates(orgId) {
    const db = await (0, index_1.getDB)();
    return db.findMany("tax_rates", {
        where: { org_id: orgId, is_active: true },
        orderBy: [{ column: "name", direction: "asc" }],
    });
}
async function createTaxRate(orgId, input) {
    const db = await (0, index_1.getDB)();
    if (input.isDefault) {
        await db.updateMany("tax_rates", { org_id: orgId }, { is_default: false, updated_at: new Date() });
    }
    const now = new Date();
    return db.create("tax_rates", {
        id: (0, uuid_1.v4)(),
        orgId,
        ...input,
        components: input.components ? JSON.stringify(input.components) : null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });
}
async function updateTaxRate(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("tax_rates", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Tax rate");
    if (input.isDefault) {
        await db.updateMany("tax_rates", { org_id: orgId }, { is_default: false, updated_at: new Date() });
    }
    const updateData = { ...input, updatedAt: new Date() };
    if (input.components !== undefined) {
        updateData.components = input.components ? JSON.stringify(input.components) : null;
    }
    return db.update("tax_rates", id, updateData, orgId);
}
async function deleteTaxRate(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("tax_rates", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Tax rate");
    await db.softDelete("tax_rates", id, orgId);
}
//# sourceMappingURL=product.service.js.map