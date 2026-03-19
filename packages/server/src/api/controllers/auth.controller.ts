import type { Request, Response } from "express";
import * as authService from "../../services/auth/auth.service";
import type { ApiResponse, AuthUser } from "@emp-billing/shared";

// POST /api/v1/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  const { accessToken, refreshToken, user } = await authService.register(req.body);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/v1/auth",
  });

  const body: ApiResponse<{ accessToken: string; user: AuthUser }> = {
    success: true,
    data: { accessToken, user },
  };
  res.status(201).json(body);
}

// POST /api/v1/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { accessToken, refreshToken, user } = await authService.login(req.body);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });

  const body: ApiResponse<{ accessToken: string; user: AuthUser }> = {
    success: true,
    data: { accessToken, user },
  };
  res.json(body);
}

// POST /api/v1/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  // Prefer cookie, fall back to body
  const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "No refresh token" } });
    return;
  }

  const { accessToken, refreshToken: newRefreshToken, user } = await authService.refreshTokens({ refreshToken });

  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });

  const body: ApiResponse<{ accessToken: string; user: AuthUser }> = {
    success: true,
    data: { accessToken, user },
  };
  res.json(body);
}

// POST /api/v1/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie("refreshToken", { path: "/api/v1/auth" });
  const body: ApiResponse<null> = { success: true, data: null };
  res.json(body);
}

// POST /api/v1/auth/forgot-password
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const token = await authService.forgotPassword(req.body.email);

  // In production, send email here. For now, expose token in dev mode only.
  const responseData =
    process.env.NODE_ENV !== "production" && token ? { resetToken: token } : undefined;

  const body: ApiResponse<typeof responseData> = {
    success: true,
    data: responseData,
  };
  // Always 200 to avoid email enumeration
  res.json(body);
}

// POST /api/v1/auth/reset-password
export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body);
  const body: ApiResponse<null> = { success: true, data: null };
  res.json(body);
}

// POST /api/v1/auth/change-password
export async function changePassword(req: Request, res: Response): Promise<void> {
  await authService.changePassword(req.user!.id, req.body);
  const body: ApiResponse<null> = { success: true, data: null };
  res.json(body);
}

// GET /api/v1/auth/me
export async function me(req: Request, res: Response): Promise<void> {
  const body: ApiResponse<AuthUser> = { success: true, data: req.user! };
  res.json(body);
}
