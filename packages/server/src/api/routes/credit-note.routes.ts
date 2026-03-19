import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateCreditNoteSchema, ApplyCreditNoteSchema } from "@emp-billing/shared";
import * as creditNoteController from "../controllers/credit-note.controller";

const router = Router();
router.use(authenticate);

// CRUD
router.get("/",                asyncHandler(creditNoteController.listCreditNotes));
router.get("/:id",             asyncHandler(creditNoteController.getCreditNote));
router.post("/",               requireAccountant, validateBody(CreateCreditNoteSchema), asyncHandler(creditNoteController.createCreditNote));
router.delete("/:id",          requireAccountant, asyncHandler(creditNoteController.deleteCreditNote));

// Actions
router.post("/:id/apply",     requireAccountant, validateBody(ApplyCreditNoteSchema), asyncHandler(creditNoteController.applyCreditNote));
router.post("/:id/void",      requireAccountant, asyncHandler(creditNoteController.voidCreditNote));

// PDF
router.get("/:id/pdf",        asyncHandler(creditNoteController.getCreditNotePdf));

export { router as creditNoteRoutes };
