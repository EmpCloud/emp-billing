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
exports.orgRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const shared_1 = require("@emp-billing/shared");
const orgController = __importStar(require("../controllers/org.controller"));
const auditController = __importStar(require("../controllers/audit.controller"));
const teamController = __importStar(require("../controllers/team.controller"));
const router = (0, express_1.Router)();
exports.orgRoutes = router;
router.use(auth_middleware_1.authenticate);
router.get("/", (0, error_middleware_1.asyncHandler)(orgController.getOrg));
router.put("/", rbac_middleware_1.requireAdmin, (0, validate_middleware_1.validateBody)(shared_1.UpdateOrgSchema), (0, error_middleware_1.asyncHandler)(orgController.updateOrg));
// Audit logs
router.get("/audit-logs", rbac_middleware_1.requireAdmin, (0, error_middleware_1.asyncHandler)(auditController.listAuditLogs));
// Team management
router.get("/members", (0, error_middleware_1.asyncHandler)(teamController.listMembers));
router.post("/members", rbac_middleware_1.requireAdmin, (0, validate_middleware_1.validateBody)(shared_1.InviteUserSchema), (0, error_middleware_1.asyncHandler)(teamController.inviteMember));
router.put("/members/:userId/role", rbac_middleware_1.requireAdmin, (0, validate_middleware_1.validateBody)(shared_1.UpdateUserRoleSchema), (0, error_middleware_1.asyncHandler)(teamController.updateMemberRole));
router.delete("/members/:userId", rbac_middleware_1.requireAdmin, (0, error_middleware_1.asyncHandler)(teamController.removeMember));
//# sourceMappingURL=org.routes.js.map