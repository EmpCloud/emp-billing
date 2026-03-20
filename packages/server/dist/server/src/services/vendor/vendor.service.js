"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVendors = listVendors;
exports.getVendor = getVendor;
exports.createVendor = createVendor;
exports.updateVendor = updateVendor;
exports.deleteVendor = deleteVendor;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
// ============================================================================
// VENDOR SERVICE
// ============================================================================
async function listVendors(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.isActive !== undefined)
        where.is_active = opts.isActive;
    const result = await db.findPaginated("vendors", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "name", direction: "asc" }],
    });
    let data = result.data;
    if (opts.search) {
        const q = opts.search.toLowerCase();
        data = data.filter((v) => v.name.toLowerCase().includes(q) ||
            (v.email && v.email.toLowerCase().includes(q)) ||
            (v.company && v.company.toLowerCase().includes(q)));
    }
    return { ...result, data };
}
async function getVendor(orgId, id) {
    const db = await (0, index_1.getDB)();
    const vendor = await db.findById("vendors", id, orgId);
    if (!vendor)
        throw (0, AppError_1.NotFoundError)("Vendor");
    return vendor;
}
async function createVendor(orgId, input) {
    const db = await (0, index_1.getDB)();
    const vendorId = (0, uuid_1.v4)();
    const now = new Date();
    await db.create("vendors", {
        id: vendorId,
        orgId,
        ...input,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });
    return getVendor(orgId, vendorId);
}
async function updateVendor(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("vendors", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Vendor");
    const updateData = { ...input, updatedAt: new Date() };
    await db.update("vendors", id, updateData, orgId);
    return getVendor(orgId, id);
}
async function deleteVendor(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("vendors", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Vendor");
    await db.softDelete("vendors", id, orgId);
}
//# sourceMappingURL=vendor.service.js.map