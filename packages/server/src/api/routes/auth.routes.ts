import { Router } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import * as authController from "../controllers/auth.controller";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from "@emp-billing/shared";

const router = Router();

router.post("/register",       validateBody(RegisterSchema),       asyncHandler(authController.register));
router.post("/login",          validateBody(LoginSchema),          asyncHandler(authController.login));
router.post("/refresh",                                             asyncHandler(authController.refresh));
router.post("/logout",                                              asyncHandler(authController.logout));
router.post("/forgot-password", validateBody(ForgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post("/reset-password",  validateBody(ResetPasswordSchema),  asyncHandler(authController.resetPassword));

// Authenticated routes
router.post("/change-password", authenticate, validateBody(ChangePasswordSchema), asyncHandler(authController.changePassword));
router.get("/me",               authenticate,                       asyncHandler(authController.me));

export { router as authRoutes };
