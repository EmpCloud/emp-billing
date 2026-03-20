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
exports.metricsRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const metricsService = __importStar(require("../../services/metrics/metrics.service"));
const router = (0, express_1.Router)();
exports.metricsRoutes = router;
router.use(auth_middleware_1.authenticate);
// GET /mrr — Monthly Recurring Revenue
router.get("/mrr", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = await metricsService.getMRR(req.user.orgId);
    res.json({ success: true, data });
}));
// GET /arr — Annual Recurring Revenue
router.get("/arr", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = await metricsService.getARR(req.user.orgId);
    res.json({ success: true, data });
}));
// GET /churn — Churn metrics
router.get("/churn", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const from = q.from || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 10);
    const to = q.to || new Date().toISOString().slice(0, 10);
    const data = await metricsService.getChurnMetrics(req.user.orgId, { from, to });
    res.json({ success: true, data });
}));
// GET /ltv — Lifetime Value
router.get("/ltv", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = await metricsService.getLTV(req.user.orgId);
    res.json({ success: true, data });
}));
// GET /revenue-breakdown — Monthly revenue breakdown
router.get("/revenue-breakdown", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const months = q.months ? parseInt(q.months, 10) : 12;
    const data = await metricsService.getRevenueBreakdown(req.user.orgId, months);
    res.json({ success: true, data });
}));
// GET /subscription-stats — Subscription statistics
router.get("/subscription-stats", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const data = await metricsService.getSubscriptionStats(req.user.orgId);
    res.json({ success: true, data });
}));
// GET /cohort — Cohort retention analysis
router.get("/cohort", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const q = req.query;
    const months = q.months ? parseInt(q.months, 10) : 12;
    const data = await metricsService.getCohortAnalysis(req.user.orgId, months);
    res.json({ success: true, data });
}));
//# sourceMappingURL=metrics.routes.js.map