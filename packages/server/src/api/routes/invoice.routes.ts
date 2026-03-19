import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateInvoiceSchema, UpdateInvoiceSchema } from "@emp-billing/shared";
import * as invoiceController from "../controllers/invoice.controller";

const router = Router();
router.use(authenticate);

// Bulk actions (must come before /:id routes)
router.post("/bulk-pdf",       asyncHandler(invoiceController.bulkDownloadPdf));

// CRUD
router.get("/",                asyncHandler(invoiceController.listInvoices));
router.get("/:id",             asyncHandler(invoiceController.getInvoice));
router.post("/",               requireSales, validateBody(CreateInvoiceSchema), asyncHandler(invoiceController.createInvoice));
router.put("/:id",             requireSales, validateBody(UpdateInvoiceSchema), asyncHandler(invoiceController.updateInvoice));
router.delete("/:id",          requireAccountant, asyncHandler(invoiceController.deleteInvoice));

// Actions
router.post("/:id/send",       requireSales, asyncHandler(invoiceController.sendInvoice));
router.post("/:id/duplicate",  requireSales, asyncHandler(invoiceController.duplicateInvoice));
router.post("/:id/void",       requireAccountant, asyncHandler(invoiceController.voidInvoice));
router.post("/:id/write-off",  requireAccountant, asyncHandler(invoiceController.writeOffInvoice));

// PDF
router.get("/:id/pdf",         asyncHandler(invoiceController.getInvoicePdf));

// Payments on invoice
router.get("/:id/payments",    asyncHandler(invoiceController.getInvoicePayments));

export { router as invoiceRoutes };
