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
exports.clientRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const shared_1 = require("@emp-billing/shared");
const clientController = __importStar(require("../controllers/client.controller"));
const importExportController = __importStar(require("../controllers/import-export.controller"));
const router = (0, express_1.Router)();
exports.clientRoutes = router;
router.use(auth_middleware_1.authenticate);
// Import / Export (before /:id to avoid route conflicts)
router.get("/export/csv", rbac_middleware_1.requireSales, (0, error_middleware_1.asyncHandler)(importExportController.exportClients));
router.post("/import/csv", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(importExportController.importClients));
// CRUD
router.get("/", (0, error_middleware_1.asyncHandler)(clientController.listClients));
router.get("/:id", (0, error_middleware_1.asyncHandler)(clientController.getClient));
router.post("/", rbac_middleware_1.requireSales, (0, validate_middleware_1.validateBody)(shared_1.CreateClientSchema), (0, error_middleware_1.asyncHandler)(clientController.createClient));
router.put("/:id", rbac_middleware_1.requireSales, (0, validate_middleware_1.validateBody)(shared_1.UpdateClientSchema), (0, error_middleware_1.asyncHandler)(clientController.updateClient));
router.delete("/:id", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(clientController.deleteClient));
// Contacts
router.get("/:id/contacts", (0, error_middleware_1.asyncHandler)(clientController.listContacts));
router.post("/:id/contacts", rbac_middleware_1.requireSales, (0, error_middleware_1.asyncHandler)(clientController.addContact));
// Statement & balance
router.get("/:id/statement", (0, error_middleware_1.asyncHandler)(clientController.getClientStatement));
router.get("/:id/balance", (0, error_middleware_1.asyncHandler)(clientController.getClientBalance));
// Payment method
router.put("/:id/payment-method", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(clientController.updatePaymentMethod));
router.delete("/:id/payment-method", rbac_middleware_1.requireAccountant, (0, error_middleware_1.asyncHandler)(clientController.removePaymentMethod));
//# sourceMappingURL=client.routes.js.map