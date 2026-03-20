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
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVendors = listVendors;
exports.getVendor = getVendor;
exports.createVendor = createVendor;
exports.updateVendor = updateVendor;
exports.deleteVendor = deleteVendor;
const vendorService = __importStar(require("../../services/vendor/vendor.service"));
async function listVendors(req, res) {
    const { page = "1", limit = "20", search, isActive } = req.query;
    const result = await vendorService.listVendors(req.user.orgId, {
        search,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
    });
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}
async function getVendor(req, res) {
    const vendor = await vendorService.getVendor(req.user.orgId, req.params.id);
    res.json({ success: true, data: vendor });
}
async function createVendor(req, res) {
    const vendor = await vendorService.createVendor(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: vendor });
}
async function updateVendor(req, res) {
    const vendor = await vendorService.updateVendor(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: vendor });
}
async function deleteVendor(req, res) {
    await vendorService.deleteVendor(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
//# sourceMappingURL=vendor.controller.js.map