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
exports.listDisputes = listDisputes;
exports.getDispute = getDispute;
exports.updateDispute = updateDispute;
const disputeService = __importStar(require("../../services/dispute/dispute.service"));
// ── List Disputes (admin) ────────────────────────────────────────────────────
async function listDisputes(req, res) {
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        sortOrder: (query.sortOrder || "desc"),
        status: query.status,
        clientId: query.clientId,
    };
    const result = await disputeService.listDisputes(req.user.orgId, opts);
    res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
}
// ── Get Dispute (admin) ──────────────────────────────────────────────────────
async function getDispute(req, res) {
    const dispute = await disputeService.getDispute(req.user.orgId, req.params.id);
    res.json({ success: true, data: dispute });
}
// ── Update Dispute (admin) ───────────────────────────────────────────────────
async function updateDispute(req, res) {
    const dispute = await disputeService.updateDispute(req.user.orgId, req.params.id, req.body, req.user.id);
    res.json({ success: true, data: dispute });
}
//# sourceMappingURL=dispute.controller.js.map