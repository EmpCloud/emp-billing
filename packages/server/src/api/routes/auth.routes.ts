import { Router } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { authenticate } from "../middleware/auth.middleware";
import { rateLimit } from "../middleware/rate-limit.middleware";
import * as authController from "../controllers/auth.controller";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from "@emp-billing/shared";

const router = Router();

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

router.post("/register",       authRateLimit, validateBody(RegisterSchema),       asyncHandler(authController.register));
router.post("/login",          authRateLimit, validateBody(LoginSchema),          asyncHandler(authController.login));
router.post("/refresh",                                                            asyncHandler(authController.refresh));
router.post("/logout",                                                             asyncHandler(authController.logout));
router.post("/forgot-password", authRateLimit, validateBody(ForgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post("/reset-password",  validateBody(ResetPasswordSchema),  asyncHandler(authController.resetPassword));

// Authenticated routes
router.post("/change-password", authenticate, validateBody(ChangePasswordSchema), asyncHandler(authController.changePassword));
router.get("/me",               authenticate,                       asyncHandler(authController.me));

export { router as authRoutes };
