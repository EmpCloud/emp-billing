"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listMembers = listMembers;
exports.inviteMember = inviteMember;
exports.updateMemberRole = updateMemberRole;
exports.removeMember = removeMember;
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const index_2 = require("../../config/index");
const crypto_1 = __importDefault(require("crypto"));
// Role hierarchy — higher index = more permissions
const ROLE_HIERARCHY = [
    shared_1.UserRole.VIEWER,
    shared_1.UserRole.SALES,
    shared_1.UserRole.ACCOUNTANT,
    shared_1.UserRole.ADMIN,
    shared_1.UserRole.OWNER,
];
function roleLevel(role) {
    return ROLE_HIERARCHY.indexOf(role);
}
// ============================================================================
// SERVICE
// ============================================================================
async function listMembers(orgId) {
    const db = await (0, index_1.getDB)();
    const users = await db.findMany("users", {
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
async function inviteMember(orgId, inviterId, input) {
    const db = await (0, index_1.getDB)();
    // Check inviter exists and is admin+
    const inviter = await db.findById("users", inviterId);
    if (!inviter || inviter.orgId !== orgId) {
        throw (0, AppError_1.ForbiddenError)("Not authorized to invite members");
    }
    if (roleLevel(inviter.role) < roleLevel(shared_1.UserRole.ADMIN)) {
        throw (0, AppError_1.ForbiddenError)("Only admins and above can invite members");
    }
    // Prevent inviting with a role higher than inviter's
    if (roleLevel(input.role) > roleLevel(inviter.role)) {
        throw (0, AppError_1.ForbiddenError)("Cannot assign a role higher than your own");
    }
    // Check email not taken
    const existing = await db.findOne("users", {
        email: input.email,
    });
    if (existing) {
        throw (0, AppError_1.ConflictError)("A user with this email already exists");
    }
    // Generate a random temporary password
    const tempPassword = crypto_1.default.randomBytes(16).toString("hex");
    const passwordHash = await bcryptjs_1.default.hash(tempPassword, index_2.config.bcryptRounds);
    const now = new Date();
    const userId = (0, uuid_1.v4)();
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
async function updateMemberRole(orgId, userId, updaterRole, input) {
    const db = await (0, index_1.getDB)();
    const user = await db.findById("users", userId);
    if (!user || user.orgId !== orgId) {
        throw (0, AppError_1.NotFoundError)("User");
    }
    // Prevent demoting the owner unless updater is also an owner
    if (user.role === shared_1.UserRole.OWNER &&
        updaterRole !== shared_1.UserRole.OWNER) {
        throw (0, AppError_1.ForbiddenError)("Only an owner can change another owner's role");
    }
    // Prevent setting role higher than updater's role
    if (roleLevel(input.role) > roleLevel(updaterRole)) {
        throw (0, AppError_1.ForbiddenError)("Cannot assign a role higher than your own");
    }
    const updated = await db.update("users", userId, {
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
async function removeMember(orgId, targetUserId, removerId) {
    const db = await (0, index_1.getDB)();
    if (targetUserId === removerId) {
        throw (0, AppError_1.BadRequestError)("You cannot remove yourself from the organization");
    }
    const target = await db.findById("users", targetUserId);
    if (!target || target.orgId !== orgId) {
        throw (0, AppError_1.NotFoundError)("User");
    }
    if (target.role === shared_1.UserRole.OWNER) {
        throw (0, AppError_1.ForbiddenError)("The organization owner cannot be removed");
    }
    // Soft-delete: mark as inactive
    await db.update("users", targetUserId, {
        isActive: false,
        updatedAt: new Date(),
    });
}
//# sourceMappingURL=team.service.js.map