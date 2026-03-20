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
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.changePassword = changePassword;
exports.me = me;
const authService = __importStar(require("../../services/auth/auth.service"));
// POST /api/v1/auth/register
async function register(req, res) {
    const { accessToken, refreshToken, user } = await authService.register(req.body);
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/api/v1/auth",
    });
    const body = {
        success: true,
        data: { accessToken, user },
    };
    res.status(201).json(body);
}
// POST /api/v1/auth/login
async function login(req, res) {
    const { accessToken, refreshToken, user } = await authService.login(req.body);
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/api/v1/auth",
    });
    const body = {
        success: true,
        data: { accessToken, user },
    };
    res.json(body);
}
// POST /api/v1/auth/refresh
async function refresh(req, res) {
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
    const body = {
        success: true,
        data: { accessToken, user },
    };
    res.json(body);
}
// POST /api/v1/auth/logout
async function logout(req, res) {
    const refreshToken = req.cookies?.refreshToken ?? req.body?.refreshToken;
    if (refreshToken) {
        await authService.logout(refreshToken);
    }
    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    const body = { success: true, data: null };
    res.json(body);
}
// POST /api/v1/auth/forgot-password
async function forgotPassword(req, res) {
    const token = await authService.forgotPassword(req.body.email);
    // In production, send email here. For now, expose token in dev mode only.
    const responseData = process.env.NODE_ENV !== "production" && token ? { resetToken: token } : undefined;
    const body = {
        success: true,
        data: responseData,
    };
    // Always 200 to avoid email enumeration
    res.json(body);
}
// POST /api/v1/auth/reset-password
async function resetPassword(req, res) {
    await authService.resetPassword(req.body);
    const body = { success: true, data: null };
    res.json(body);
}
// POST /api/v1/auth/change-password
async function changePassword(req, res) {
    await authService.changePassword(req.user.id, req.body);
    const body = { success: true, data: null };
    res.json(body);
}
// GET /api/v1/auth/me
async function me(req, res) {
    const body = { success: true, data: req.user };
    res.json(body);
}
//# sourceMappingURL=auth.controller.js.map