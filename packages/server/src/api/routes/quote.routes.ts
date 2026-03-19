import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateQuoteSchema, UpdateQuoteSchema } from "@emp-billing/shared";
import * as quoteController from "../controllers/quote.controller";

const router = Router();
router.use(authenticate);

// CRUD
router.get("/",                asyncHandler(quoteController.listQuotes));
router.get("/:id",             asyncHandler(quoteController.getQuote));
router.post("/",               requireSales, validateBody(CreateQuoteSchema), asyncHandler(quoteController.createQuote));
router.put("/:id",             requireSales, validateBody(UpdateQuoteSchema), asyncHandler(quoteController.updateQuote));
router.delete("/:id",          requireAccountant, asyncHandler(quoteController.deleteQuote));

// Actions
router.post("/:id/send",       requireSales, asyncHandler(quoteController.sendQuote));
router.post("/:id/convert",    requireSales, asyncHandler(quoteController.convertToInvoice));

// PDF
router.get("/:id/pdf",          asyncHandler(quoteController.getQuotePdf));

// Portal (no RBAC)
router.post("/:id/accept",     asyncHandler(quoteController.acceptQuote));
router.post("/:id/decline",    asyncHandler(quoteController.declineQuote));

export { router as quoteRoutes };
