import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateProductSchema, UpdateProductSchema, CreateTaxRateSchema, UpdateTaxRateSchema } from "@emp-billing/shared";
import * as productController from "../controllers/product.controller";
import * as importExportController from "../controllers/import-export.controller";

const router = Router();
router.use(authenticate);

// Import / Export (before /:id to avoid route conflicts)
router.get("/export/csv",  asyncHandler(importExportController.exportProducts));
router.post("/import/csv", requireAccountant, asyncHandler(importExportController.importProducts));

// Products
router.get("/",            asyncHandler(productController.listProducts));
router.get("/:id",         asyncHandler(productController.getProduct));
router.post("/",           requireAccountant, validateBody(CreateProductSchema), asyncHandler(productController.createProduct));
router.put("/:id",         requireAccountant, validateBody(UpdateProductSchema), asyncHandler(productController.updateProduct));
router.delete("/:id",      requireAccountant, asyncHandler(productController.deleteProduct));

// Tax rates
router.get("/tax-rates",        asyncHandler(productController.listTaxRates));
router.post("/tax-rates",       requireAccountant, validateBody(CreateTaxRateSchema), asyncHandler(productController.createTaxRate));
router.put("/tax-rates/:id",    requireAccountant, validateBody(UpdateTaxRateSchema), asyncHandler(productController.updateTaxRate));
router.delete("/tax-rates/:id", requireAccountant, asyncHandler(productController.deleteTaxRate));

export { router as productRoutes };
