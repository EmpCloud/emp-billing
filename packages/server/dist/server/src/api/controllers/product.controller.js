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
exports.listProducts = listProducts;
exports.getProduct = getProduct;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.listTaxRates = listTaxRates;
exports.createTaxRate = createTaxRate;
exports.updateTaxRate = updateTaxRate;
exports.deleteTaxRate = deleteTaxRate;
const productService = __importStar(require("../../services/product/product.service"));
async function listProducts(req, res) {
    const { page = "1", limit = "20", search, type, isActive } = req.query;
    const result = await productService.listProducts(req.user.orgId, {
        search,
        type,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
    });
    const body = { success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } };
    res.json(body);
}
async function getProduct(req, res) {
    const product = await productService.getProduct(req.user.orgId, req.params.id);
    res.json({ success: true, data: product });
}
async function createProduct(req, res) {
    const product = await productService.createProduct(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: product });
}
async function updateProduct(req, res) {
    const product = await productService.updateProduct(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: product });
}
async function deleteProduct(req, res) {
    await productService.deleteProduct(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function listTaxRates(req, res) {
    const rates = await productService.listTaxRates(req.user.orgId);
    res.json({ success: true, data: rates });
}
async function createTaxRate(req, res) {
    const rate = await productService.createTaxRate(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: rate });
}
async function updateTaxRate(req, res) {
    const rate = await productService.updateTaxRate(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: rate });
}
async function deleteTaxRate(req, res) {
    await productService.deleteTaxRate(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
//# sourceMappingURL=product.controller.js.map