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
exports.invoiceRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const shared_1 = require("@emp-billing/shared");
const invoiceController = __importStar(require("../controllers/invoice.controller"));
const router = (0, express_1.Router)();
exports.invoiceRoutes = router;
router.use(auth_middleware_1.authenticate);
// Bulk actions (must come before /:id routes)
router.post("/bulk-pdf", (0, error_middleware_1.asyncHandler)(invoiceController.bulkDownloadPdf));
// CRUD
router.get("/", (0, error_middleware_1.asyncHandler)(invoiceController.listInvoices));
router.get("/:id", (0, error_middleware_1.asyncHandler)(invoiceController.getInvoice));
router.post("/", rbac_middleware_1.requireSales, (0, validate_middleware_1.validateBody)(shared_1.CreateInvoiceSchema), (0, error_middleware_1.asyncHandler)(invoiceController.createInvoice));
router.put("/:id", rbac_middleware_1.requireSales, (0, validate_middleware_1.validateBody)(shared_1.UpdateInvoiceSchema), (0, error_middleware_1.asyncHandler)(invoiceController.updateInvoice));
router.delete("/:id", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(invoiceController.deleteInvoice));
// Actions
router.post("/:id/send", rbac_middleware_1.requireSales, (0, error_middleware_1.asyncHandler)(invoiceController.sendInvoice));
router.post("/:id/duplicate", rbac_middleware_1.requireSales, (0, error_middleware_1.asyncHandler)(invoiceController.duplicateInvoice));
router.post("/:id/void", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(invoiceController.voidInvoice));
router.post("/:id/write-off", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(invoiceController.writeOffInvoice));
// PDF
router.get("/:id/pdf", (0, error_middleware_1.asyncHandler)(invoiceController.getInvoicePdf));
// Payments on invoice
router.get("/:id/payments", (0, error_middleware_1.asyncHandler)(invoiceController.getInvoicePayments));
//# sourceMappingURL=invoice.routes.js.map