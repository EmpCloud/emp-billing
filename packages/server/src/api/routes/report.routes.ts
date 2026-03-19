import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import * as reportController from "../controllers/report.controller";

const router = Router();
router.use(authenticate);

router.get("/dashboard",     asyncHandler(reportController.getDashboardStats));
router.get("/revenue",       asyncHandler(reportController.getRevenueReport));
router.get("/receivables",   asyncHandler(reportController.getReceivablesReport));
router.get("/aging",         asyncHandler(reportController.getAgingReport));
router.get("/expenses",      asyncHandler(reportController.getExpenseReport));
router.get("/profit-loss",   asyncHandler(reportController.getProfitLossReport));
router.get("/tax",           asyncHandler(reportController.getTaxReport));
router.get("/clients/top",   asyncHandler(reportController.getTopClients));

// CSV export endpoints
router.get("/revenue/export",      asyncHandler(reportController.exportRevenueReport));
router.get("/receivables/export",  asyncHandler(reportController.exportReceivablesReport));
router.get("/expenses/export",     asyncHandler(reportController.exportExpenseReport));
router.get("/tax/export",          asyncHandler(reportController.exportTaxReport));

export { router as reportRoutes };
