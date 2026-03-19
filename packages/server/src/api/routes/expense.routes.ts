import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateExpenseSchema, UpdateExpenseSchema, CreateExpenseCategorySchema } from "@emp-billing/shared";
import * as expenseController from "../controllers/expense.controller";

const router = Router();
router.use(authenticate);

// Categories (defined before /:id to avoid route conflicts)
router.get("/categories",      asyncHandler(expenseController.listCategories));
router.post("/categories",     requireAccountant, validateBody(CreateExpenseCategorySchema), asyncHandler(expenseController.createCategory));

// CRUD
router.get("/",                asyncHandler(expenseController.listExpenses));
router.get("/:id",             asyncHandler(expenseController.getExpense));
router.post("/",               requireSales, validateBody(CreateExpenseSchema), asyncHandler(expenseController.createExpense));
router.put("/:id",             requireSales, validateBody(UpdateExpenseSchema), asyncHandler(expenseController.updateExpense));
router.delete("/:id",          requireAccountant, asyncHandler(expenseController.deleteExpense));

// Actions
router.post("/:id/approve",   requireAccountant, asyncHandler(expenseController.approveExpense));
router.post("/:id/reject",    requireAccountant, asyncHandler(expenseController.rejectExpense));
router.post("/:id/bill",      requireAccountant, asyncHandler(expenseController.billExpenseToClient));

export { router as expenseRoutes };
