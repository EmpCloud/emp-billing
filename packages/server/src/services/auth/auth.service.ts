import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { config } from "../../config/index";
import { getDB } from "../../db/adapters/index";
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from "../../utils/AppError";
import { UserRole, type AuthUser } from "@emp-billing/shared";
import type {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from "@emp-billing/shared";
import type { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================

interface UserRow {
  id: string;
  orgId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: AuthUser["role"];
  isActive: boolean;
  emailVerified: boolean;
  resetToken?: string | null;
  resetTokenExpires?: Date | null;
}

interface OrgRow {
  id: string;
  name: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateAccessToken(user: UserRow, org: OrgRow): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: org.id,
      orgName: org.name,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"] }
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function refreshExpiresAt(): Date {
  const d = new Date();
  // Parse e.g. "7d" → 7 days
  const match = config.jwt.refreshExpiresIn.match(/^(\d+)([dhm])$/);
  if (match) {
    const [, n, unit] = match;
    const ms = { d: 864e5, h: 36e5, m: 6e4 }[unit as "d" | "h" | "m"] ?? 864e5;
    d.setTime(d.getTime() + parseInt(n) * ms);
  } else {
    d.setDate(d.getDate() + 7);
  }
  return d;
}

// ============================================================================
// SERVICE
// ============================================================================

export async function register(input: z.infer<typeof RegisterSchema>): Promise<TokenPair> {
  const db = await getDB();

  // Check email uniqueness
  const existing = await db.findOne<UserRow>("users", { email: input.email });
  if (existing) {
    throw ConflictError("An account with this email already exists");
  }

  const orgId = uuid();
  const userId = uuid();
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
  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
  await db.create<UserRow>("users", {
    id: userId,
    orgId,
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: UserRole.OWNER,
    isActive: true,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  const user: UserRow = { id: userId, orgId, email: input.email, passwordHash, firstName: input.firstName, lastName: input.lastName, role: UserRole.OWNER, isActive: true, emailVerified: false };
  const org: OrgRow = { id: orgId, name: input.orgName };

  return issueTokens(db, user, org);
}

export async function login(input: z.infer<typeof LoginSchema>): Promise<TokenPair> {
  const db = await getDB();

  const user = await db.findOne<UserRow>("users", { email: input.email });
  if (!user) {
    throw UnauthorizedError("Invalid email or password");
  }
  if (!user.isActive) {
    throw UnauthorizedError("Account is disabled");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw UnauthorizedError("Invalid email or password");
  }

  const org = await db.findById<OrgRow>("organizations", user.orgId);
  if (!org) {
    throw UnauthorizedError("Organization not found");
  }

  // Update last login
  await db.update("users", user.id, { lastLoginAt: new Date(), updatedAt: new Date() });

  return issueTokens(db, user, org);
}

export async function refreshTokens(input: z.infer<typeof RefreshTokenSchema>): Promise<TokenPair> {
  const db = await getDB();

  const tokenHash = hashToken(input.refreshToken);
  const stored = await db.findOne<{ id: string; userId: string; expiresAt: Date; isRevoked: boolean }>(
    "refresh_tokens",
    { tokenHash }
  );

  if (!stored || stored.isRevoked || new Date() > new Date(stored.expiresAt)) {
    throw UnauthorizedError("Invalid or expired refresh token");
  }

  // Rotate token
  await db.update("refresh_tokens", stored.id, { isRevoked: true, updatedAt: new Date() });

  const user = await db.findById<UserRow>("users", stored.userId);
  if (!user || !user.isActive) {
    throw UnauthorizedError("User not found or disabled");
  }

  const org = await db.findById<OrgRow>("organizations", user.orgId);
  if (!org) {
    throw UnauthorizedError("Organization not found");
  }

  return issueTokens(db, user, org);
}

export async function logout(refreshToken: string): Promise<void> {
  const db = await getDB();
  const tokenHash = hashToken(refreshToken);
  await db.updateMany("refresh_tokens", { tokenHash }, { isRevoked: true, updatedAt: new Date() });
}

export async function forgotPassword(email: string): Promise<string> {
  const db = await getDB();

  const user = await db.findOne<UserRow>("users", { email });
  // Don't reveal whether email exists
  if (!user) return "";

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.update("users", user.id, {
    resetToken: hashToken(token),
    resetTokenExpires: expires,
    updatedAt: new Date(),
  });

  // Caller (controller) is responsible for sending the email
  return token;
}

export async function resetPassword(input: z.infer<typeof ResetPasswordSchema>): Promise<void> {
  const db = await getDB();

  const tokenHash = hashToken(input.token);
  const user = await db.findOne<UserRow>("users", { resetToken: tokenHash });

  if (!user || !user.resetTokenExpires || new Date() > new Date(user.resetTokenExpires)) {
    throw BadRequestError("Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
  await db.update("users", user.id, {
    passwordHash,
    resetToken: null,
    resetTokenExpires: null,
    updatedAt: new Date(),
  });
}

export async function changePassword(
  userId: string,
  input: z.infer<typeof ChangePasswordSchema>
): Promise<void> {
  const db = await getDB();

  const user = await db.findById<UserRow>("users", userId);
  if (!user) throw NotFoundError("User");

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw BadRequestError("Current password is incorrect");

  const passwordHash = await bcrypt.hash(input.newPassword, config.bcryptRounds);
  await db.update("users", userId, { passwordHash, updatedAt: new Date() });
}

// ── internal ─────────────────────────────────────────────────────────────────

async function issueTokens(db: Awaited<ReturnType<typeof getDB>>, user: UserRow, org: OrgRow): Promise<TokenPair> {
  const accessToken = generateAccessToken(user, org);
  const refreshToken = generateRefreshToken();

  await db.create("refresh_tokens", {
    id: uuid(),
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt(),
    isRevoked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const authUser: AuthUser = {
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
