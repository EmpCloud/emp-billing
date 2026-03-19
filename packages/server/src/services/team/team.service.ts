import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { getDB } from "../../db/adapters/index";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "../../utils/AppError";
import { UserRole } from "@emp-billing/shared";
import { config } from "../../config/index";
import type { z } from "zod";
import type {
  InviteUserSchema,
  UpdateUserRoleSchema,
} from "@emp-billing/shared";
import crypto from "crypto";

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
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MemberView {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.VIEWER,
  UserRole.SALES,
  UserRole.ACCOUNTANT,
  UserRole.ADMIN,
  UserRole.OWNER,
];

function roleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

// ============================================================================
// SERVICE
// ============================================================================

export async function listMembers(orgId: string): Promise<MemberView[]> {
  const db = await getDB();
  const users = await db.findMany<UserRow>("users", {
    where: { org_id: orgId },
    orderBy: [{ column: "created_at", direction: "asc" }],
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt || null,
    createdAt: u.createdAt,
  }));
}

export async function inviteMember(
  orgId: string,
  inviterId: string,
  input: z.infer<typeof InviteUserSchema>
): Promise<MemberView> {
  const db = await getDB();

  // Check inviter exists and is admin+
  const inviter = await db.findById<UserRow>("users", inviterId);
  if (!inviter || inviter.orgId !== orgId) {
    throw ForbiddenError("Not authorized to invite members");
  }
  if (roleLevel(inviter.role) < roleLevel(UserRole.ADMIN)) {
    throw ForbiddenError("Only admins and above can invite members");
  }

  // Prevent inviting with a role higher than inviter's
  if (roleLevel(input.role) > roleLevel(inviter.role)) {
    throw ForbiddenError("Cannot assign a role higher than your own");
  }

  // Check email not taken
  const existing = await db.findOne<UserRow>("users", {
    email: input.email,
  });
  if (existing) {
    throw ConflictError("A user with this email already exists");
  }

  // Generate a random temporary password
  const tempPassword = crypto.randomBytes(16).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, config.bcryptRounds);

  const now = new Date();
  const userId = uuid();
  await db.create("users", {
    id: userId,
    orgId,
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    isActive: true,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });

  // In production this would send an invite email with a setup-password link
  return {
    id: userId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    isActive: true,
    lastLoginAt: null,
    createdAt: now,
  };
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  updaterRole: UserRole,
  input: z.infer<typeof UpdateUserRoleSchema>
): Promise<MemberView> {
  const db = await getDB();

  const user = await db.findById<UserRow>("users", userId);
  if (!user || user.orgId !== orgId) {
    throw NotFoundError("User");
  }

  // Prevent demoting the owner unless updater is also an owner
  if (
    user.role === UserRole.OWNER &&
    updaterRole !== UserRole.OWNER
  ) {
    throw ForbiddenError("Only an owner can change another owner's role");
  }

  // Prevent setting role higher than updater's role
  if (roleLevel(input.role) > roleLevel(updaterRole)) {
    throw ForbiddenError("Cannot assign a role higher than your own");
  }

  const updated = await db.update<UserRow>("users", userId, {
    role: input.role,
    updatedAt: new Date(),
  });

  return {
    id: updated.id,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
    isActive: updated.isActive,
    lastLoginAt: updated.lastLoginAt || null,
    createdAt: updated.createdAt,
  };
}

export async function removeMember(
  orgId: string,
  targetUserId: string,
  removerId: string
): Promise<void> {
  const db = await getDB();

  if (targetUserId === removerId) {
    throw BadRequestError("You cannot remove yourself from the organization");
  }

  const target = await db.findById<UserRow>("users", targetUserId);
  if (!target || target.orgId !== orgId) {
    throw NotFoundError("User");
  }

  if (target.role === UserRole.OWNER) {
    throw ForbiddenError("The organization owner cannot be removed");
  }

  // Soft-delete: mark as inactive
  await db.update("users", targetUserId, {
    isActive: false,
    updatedAt: new Date(),
  });
}
