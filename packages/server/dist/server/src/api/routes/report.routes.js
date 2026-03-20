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
exports.reportRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const reportController = __importStar(require("../controllers/report.controller"));
const router = (0, express_1.Router)();
exports.reportRoutes = router;
router.use(auth_middleware_1.authenticate);
router.get("/dashboard", (0, error_middleware_1.asyncHandler)(reportController.getDashboardStats));
router.get("/revenue", (0, error_middleware_1.asyncHandler)(reportController.getRevenueReport));
router.get("/receivables", (0, error_middleware_1.asyncHandler)(reportController.getReceivablesReport));
router.get("/aging", (0, error_middleware_1.asyncHandler)(reportController.getAgingReport));
router.get("/expenses", (0, error_middleware_1.asyncHandler)(reportController.getExpenseReport));
router.get("/profit-loss", (0, error_middleware_1.asyncHandler)(reportController.getProfitLossReport));
router.get("/tax", (0, error_middleware_1.asyncHandler)(reportController.getTaxReport));
router.get("/clients/top", (0, error_middleware_1.asyncHandler)(reportController.getTopClients));
// CSV export endpoints
router.get("/revenue/export", (0, error_middleware_1.asyncHandler)(reportController.exportRevenueReport));
router.get("/receivables/export", (0, error_middleware_1.asyncHandler)(reportController.exportReceivablesReport));
router.get("/expenses/export", (0, error_middleware_1.asyncHandler)(reportController.exportExpenseReport));
router.get("/tax/export", (0, error_middleware_1.asyncHandler)(reportController.exportTaxReport));
//# sourceMappingURL=report.routes.js.map