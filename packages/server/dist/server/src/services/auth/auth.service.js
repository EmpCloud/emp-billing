"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refreshTokens = refreshTokens;
exports.logout = logout;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.changePassword = changePassword;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../../config/index");
const index_2 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
// ============================================================================
// HELPERS
// ============================================================================
function generateAccessToken(user, org) {
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        orgId: org.id,
        orgName: org.name,
        firstName: user.firstName,
        lastName: user.lastName,
    }, index_1.config.jwt.accessSecret, { expiresIn: index_1.config.jwt.accessExpiresIn });
}
function generateRefreshToken() {
    return crypto_1.default.randomBytes(64).toString("hex");
}
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function refreshExpiresAt() {
    const d = new Date();
    // Parse e.g. "7d" → 7 days
    const match = index_1.config.jwt.refreshExpiresIn.match(/^(\d+)([dhm])$/);
    if (match) {
        const [, n, unit] = match;
        const ms = { d: 864e5, h: 36e5, m: 6e4 }[unit] ?? 864e5;
        d.setTime(d.getTime() + parseInt(n) * ms);
    }
    else {
        d.setDate(d.getDate() + 7);
    }
    return d;
}
// ============================================================================
// SERVICE
// ============================================================================
async function register(input) {
    const db = await (0, index_2.getDB)();
    // Check email uniqueness
    const existing = await db.findOne("users", { email: input.email });
    if (existing) {
        throw (0, AppError_1.ConflictError)("An account with this email already exists");
    }
    const orgId = (0, uuid_1.v4)();
    const userId = (0, uuid_1.v4)();
    const now = new Date();
    // Create org
    await db.create("organizations", {
        id: orgId,
        name: input.orgName,
        legalName: input.orgName,
        email: input.email,
        defaultCurrency: input.currency,
        country: input.country,
        address: JSON.stringify({ line1: "", city: "", state: "", postalCode: "", country: input.country }),
        fiscalYearStart: 4,
        invoicePrefix: "INV",
        invoiceNextNumber: 1,
        quotePrefix: "QTE",
        quoteNextNumber: 1,
        defaultPaymentTerms: 30,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });
    // Create user
    const passwordHash = await bcryptjs_1.default.hash(input.password, index_1.config.bcryptRounds);
    await db.create("users", {
        id: userId,
        orgId,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: shared_1.UserRole.OWNER,
        isActive: true,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
    });
    const user = { id: userId, orgId, email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, role: shared_1.UserRole.OWNER, isActive: true, emailVerified: false };
    const org = { id: orgId, name: input.orgName };
    return issueTokens(db, user, org);
}
async function login(input) {
    const db = await (0, index_2.getDB)();
    const user = await db.findOne("users", { email: input.email });
    if (!user) {
        throw (0, AppError_1.UnauthorizedError)("Invalid email or password");
    }
    if (!user.isActive) {
        throw (0, AppError_1.UnauthorizedError)("Account is disabled");
    }
    const valid = await bcryptjs_1.default.compare(input.password, user.passwordHash);
    if (!valid) {
        throw (0, AppError_1.UnauthorizedError)("Invalid email or password");
    }
    const org = await db.findById("organizations", user.orgId);
    if (!org) {
        throw (0, AppError_1.UnauthorizedError)("Organization not found");
    }
    // Update last login
    await db.update("users", user.id, { lastLoginAt: new Date(), updatedAt: new Date() });
    return issueTokens(db, user, org);
}
async function refreshTokens(input) {
    const db = await (0, index_2.getDB)();
    const tokenHash = hashToken(input.refreshToken);
    const stored = await db.findOne("refresh_tokens", { tokenHash });
    if (!stored || stored.isRevoked || new Date() > new Date(stored.expiresAt)) {
        throw (0, AppError_1.UnauthorizedError)("Invalid or expired refresh token");
    }
    // Rotate token
    await db.update("refresh_tokens", stored.id, { isRevoked: true, updatedAt: new Date() });
    const user = await db.findById("users", stored.userId);
    if (!user || !user.isActive) {
        throw (0, AppError_1.UnauthorizedError)("User not found or disabled");
    }
    const org = await db.findById("organizations", user.orgId);
    if (!org) {
        throw (0, AppError_1.UnauthorizedError)("Organization not found");
    }
    return issueTokens(db, user, org);
}
async function logout(refreshToken) {
    const db = await (0, index_2.getDB)();
    const tokenHash = hashToken(refreshToken);
    await db.updateMany("refresh_tokens", { tokenHash }, { isRevoked: true, updatedAt: new Date() });
}
async function forgotPassword(email) {
    const db = await (0, index_2.getDB)();
    const user = await db.findOne("users", { email });
    // Don't reveal whether email exists
    if (!user)
        return "";
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.update("users", user.id, {
        resetToken: hashToken(token),
        resetTokenExpires: expires,
        updatedAt: new Date(),
    });
    // Caller (controller) is responsible for sending the email
    return token;
}
async function resetPassword(input) {
    const db = await (0, index_2.getDB)();
    const tokenHash = hashToken(input.token);
    const user = await db.findOne("users", { resetToken: tokenHash });
    if (!user || !user.resetTokenExpires || new Date() > new Date(user.resetTokenExpires)) {
        throw (0, AppError_1.BadRequestError)("Invalid or expired reset token");
    }
    const passwordHash = await bcryptjs_1.default.hash(input.password, index_1.config.bcryptRounds);
    await db.update("users", user.id, {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
    });
}
async function changePassword(userId, input) {
    const db = await (0, index_2.getDB)();
    const user = await db.findById("users", userId);
    if (!user)
        throw (0, AppError_1.NotFoundError)("User");
    const valid = await bcryptjs_1.default.compare(input.currentPassword, user.passwordHash);
    if (!valid)
        throw (0, AppError_1.BadRequestError)("Current password is incorrect");
    const passwordHash = await bcryptjs_1.default.hash(input.newPassword, index_1.config.bcryptRounds);
    await db.update("users", userId, { passwordHash, updatedAt: new Date() });
}
// ── internal ─────────────────────────────────────────────────────────────────
async function issueTokens(db, user, org) {
    const accessToken = generateAccessToken(user, org);
    const refreshToken = generateRefreshToken();
    await db.create("refresh_tokens", {
        id: (0, uuid_1.v4)(),
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt(),
        isRevoked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    const authUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: org.id,
        orgName: org.name,
        firstName: user.firstName,
        lastName: user.lastName,
    };
    return { accessToken, refreshToken, user: authUser };
}
//# sourceMappingURL=auth.service.js.map