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
exports.productRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const shared_1 = require("@emp-billing/shared");
const productController = __importStar(require("../controllers/product.controller"));
const importExportController = __importStar(require("../controllers/import-export.controller"));
const router = (0, express_1.Router)();
exports.productRoutes = router;
router.use(auth_middleware_1.authenticate);
// Import / Export (before /:id to avoid route conflicts)
router.get("/export/csv", (0, error_middleware_1.asyncHandler)(importExportController.exportProducts));
router.post("/import/csv", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(importExportController.importProducts));
// Products
router.get("/", (0, error_middleware_1.asyncHandler)(productController.listProducts));
router.get("/:id", (0, error_middleware_1.asyncHandler)(productController.getProduct));
router.post("/", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.CreateProductSchema), (0, error_middleware_1.asyncHandler)(productController.createProduct));
router.put("/:id", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.UpdateProductSchema), (0, error_middleware_1.asyncHandler)(productController.updateProduct));
router.delete("/:id", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(productController.deleteProduct));
// Tax rates
router.get("/tax-rates", (0, error_middleware_1.asyncHandler)(productController.listTaxRates));
router.post("/tax-rates", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.CreateTaxRateSchema), (0, error_middleware_1.asyncHandler)(productController.createTaxRate));
router.put("/tax-rates/:id", rbac_middleware_1.requireAccountant, (0, validate_middleware_1.validateBody)(shared_1.UpdateTaxRateSchema), (0, error_middleware_1.asyncHandler)(productController.updateTaxRate));
router.delete("/tax-rates/:id", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(productController.deleteTaxRate));
//# sourceMappingURL=product.routes.js.map