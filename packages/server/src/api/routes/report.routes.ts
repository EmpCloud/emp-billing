import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import * as reportController from "../controllers/report.controller";

const router = Router();
router.use(authenticate);
router.use(requireAccountant);

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

// GSTR-1 endpoints (Indian GST filing)
router.get("/gstr1",               asyncHandler(reportController.getGSTR1));
router.get("/gstr1/json",          asyncHandler(reportController.getGSTR1JSON));
router.get("/gstr1/csv",           asyncHandler(reportController.getGSTR1CSV));

export { router as reportRoutes };
