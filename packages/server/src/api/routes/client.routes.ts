import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { requireSales, requireAccountant } from "../middleware/rbac.middleware";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { CreateClientSchema, UpdateClientSchema, ClientContactSchema, AutoProvisionClientSchema } from "@emp-billing/shared";
import * as clientController from "../controllers/client.controller";
import * as importExportController from "../controllers/import-export.controller";

const router = Router();
router.use(authenticate);

// Auto-provision (before /:id to avoid route conflicts)
router.post("/auto-provision", requireSales, validateBody(AutoProvisionClientSchema), asyncHandler(clientController.autoProvisionClient));

// Import / Export (before /:id to avoid route conflicts)
router.get("/export/csv",  requireSales, asyncHandler(importExportController.exportClients));
router.post("/import/csv", requireAccountant, asyncHandler(importExportController.importClients));

// CRUD
router.get("/",            asyncHandler(clientController.listClients));
router.get("/:id",         asyncHandler(clientController.getClient));
router.post("/",           requireSales, validateBody(CreateClientSchema), asyncHandler(clientController.createClient));
router.put("/:id",         requireSales, validateBody(UpdateClientSchema), asyncHandler(clientController.updateClient));
router.delete("/:id",      requireSales, asyncHandler(clientController.deleteClient));

// Contacts
router.get("/:id/contacts",  asyncHandler(clientController.listContacts));
router.post("/:id/contacts", requireSales, validateBody(ClientContactSchema), asyncHandler(clientController.addContact));

// Statement & balance
router.get("/:id/statement", asyncHandler(clientController.getClientStatement));
router.get("/:id/balance",   asyncHandler(clientController.getClientBalance));

// Portal access
router.get("/:id/portal-access",      asyncHandler(clientController.getPortalAccessStatus));
router.post("/:id/portal-access/regenerate", requireSales, asyncHandler(clientController.regeneratePortalToken));
router.delete("/:id/portal-access",   requireSales, asyncHandler(clientController.revokePortalAccess));

// Payment method
router.put("/:id/payment-method",    requireAccountant, asyncHandler(clientController.updatePaymentMethod));
router.delete("/:id/payment-method", requireAccountant, asyncHandler(clientController.removePaymentMethod));

export { router as clientRoutes };
