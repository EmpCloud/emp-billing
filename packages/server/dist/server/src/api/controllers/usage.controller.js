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
exports.recordUsage = recordUsage;
exports.listUsageRecords = listUsageRecords;
exports.getUsageSummary = getUsageSummary;
const pricingService = __importStar(require("../../services/pricing/pricing.service"));
async function recordUsage(req, res) {
    const record = await pricingService.recordUsage(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: record });
}
async function listUsageRecords(req, res) {
    const { page = "1", limit = "20", productId, clientId, periodStart, periodEnd } = req.query;
    const result = await pricingService.listUsageRecords(req.user.orgId, {
        page: parseInt(page),
        limit: parseInt(limit),
        sortOrder: "desc",
        productId,
        clientId,
        periodStart: periodStart ? new Date(periodStart) : undefined,
        periodEnd: periodEnd ? new Date(periodEnd) : undefined,
    });
    const body = {
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    };
    res.json(body);
}
async function getUsageSummary(req, res) {
    const { productId, clientId, periodStart, periodEnd } = req.query;
    if (!productId || !clientId || !periodStart || !periodEnd) {
        res.status(400).json({ success: false, error: { code: "BAD_REQUEST", message: "productId, clientId, periodStart, and periodEnd are required" } });
        return;
    }
    const summary = await pricingService.getUsageSummary(req.user.orgId, productId, clientId, new Date(periodStart), new Date(periodEnd));
    res.json({ success: true, data: summary });
}
//# sourceMappingURL=usage.controller.js.map