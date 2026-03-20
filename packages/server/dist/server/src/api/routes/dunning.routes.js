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
exports.dunningRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const dunningService = __importStar(require("../../services/dunning/dunning.service"));
const router = (0, express_1.Router)();
exports.dunningRoutes = router;
router.use(auth_middleware_1.authenticate);
// GET /config — get dunning config
router.get("/config", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const config = await dunningService.getDunningConfig(req.user.orgId);
    res.json({ success: true, data: config });
}));
// PUT /config — update dunning config
router.put("/config", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const config = await dunningService.updateDunningConfig(req.user.orgId, req.body);
    res.json({ success: true, data: config });
}));
// GET /attempts — list dunning attempts (filterable)
router.get("/attempts", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const result = await dunningService.listDunningAttempts(req.user.orgId, {
        page: q.page ? parseInt(q.page, 10) : 1,
        limit: q.limit ? parseInt(q.limit, 10) : 20,
        status: q.status,
        invoiceId: q.invoiceId,
    });
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}));
// GET /summary — get dunning summary stats
router.get("/summary", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const summary = await dunningService.getDunningSummary(req.user.orgId);
    res.json({ success: true, data: summary });
}));
// POST /attempts/:id/retry — manual retry
router.post("/attempts/:id/retry", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const attemptId = req.params.id;
    await dunningService.processDunningAttempt(attemptId);
    res.json({ success: true, data: { message: "Retry processed" } });
}));
//# sourceMappingURL=dunning.routes.js.map