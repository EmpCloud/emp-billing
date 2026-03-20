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
exports.authRoutes = void 0;
const express_1 = require("express");
const error_middleware_1 = require("../middleware/error.middleware");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const authController = __importStar(require("../controllers/auth.controller"));
const shared_1 = require("@emp-billing/shared");
const router = (0, express_1.Router)();
exports.authRoutes = router;
router.post("/register", (0, validate_middleware_1.validateBody)(shared_1.RegisterSchema), (0, error_middleware_1.asyncHandler)(authController.register));
router.post("/login", (0, validate_middleware_1.validateBody)(shared_1.LoginSchema), (0, error_middleware_1.asyncHandler)(authController.login));
router.post("/refresh", (0, error_middleware_1.asyncHandler)(authController.refresh));
router.post("/logout", (0, error_middleware_1.asyncHandler)(authController.logout));
router.post("/forgot-password", (0, validate_middleware_1.validateBody)(shared_1.ForgotPasswordSchema), (0, error_middleware_1.asyncHandler)(authController.forgotPassword));
router.post("/reset-password", (0, validate_middleware_1.validateBody)(shared_1.ResetPasswordSchema), (0, error_middleware_1.asyncHandler)(authController.resetPassword));
// Authenticated routes
router.post("/change-password", auth_middleware_1.authenticate, (0, validate_middleware_1.validateBody)(shared_1.ChangePasswordSchema), (0, error_middleware_1.asyncHandler)(authController.changePassword));
router.get("/me", auth_middleware_1.authenticate, (0, error_middleware_1.asyncHandler)(authController.me));
//# sourceMappingURL=auth.routes.js.map