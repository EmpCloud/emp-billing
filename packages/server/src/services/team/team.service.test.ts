import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));
vi.mock("../../config/index", () => ({
  config: { bcryptRounds: 4 },
}));

import { getDB } from "../../db/adapters/index";
import { UserRole } from "@emp-billing/shared";
import {
  listMembers,
  inviteMember,
  updateMemberRole,
  removeMember,
} from "./team.service";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";

function makeMockDb() {
  return {
    findMany: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    update: vi.fn().mockImplementation((_t: string, _id: string, data: Record<string, unknown>) => ({
      id: "usr-target",
      email: "target@test.com",
      firstName: "Target",
      lastName: "User",
      isActive: true,
      createdAt: new Date(),
      ...data,
    })),
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr-1",
    orgId: ORG_ID,
    email: "admin@test.com",
    firstName: "Admin",
    lastName: "User",
    role: UserRole.ADMIN,
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("team.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("listMembers", () => {
    it("returns mapped member views", async () => {
      mockDb.findMany.mockResolvedValue([
        makeUser(),
        makeUser({ id: "usr-2", email: "viewer@test.com", role: UserRole.VIEWER }),
      ]);

      const result = await listMembers(ORG_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("email");
      expect(result[0]).not.toHaveProperty("passwordHash");
    });
  });

  describe("inviteMember", () => {
    it("creates a new team member", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      mockDb.findOne.mockResolvedValue(null);

      const result = await inviteMember(ORG_ID, "usr-1", {
        email: "new@test.com",
        firstName: "New",
        lastName: "Member",
        role: UserRole.VIEWER,
      });

      expect(result.email).toBe("new@test.com");
      expect(result.role).toBe(UserRole.VIEWER);
      expect(mockDb.create).toHaveBeenCalledWith("users", expect.objectContaining({
        email: "new@test.com",
        role: UserRole.VIEWER,
      }));
    });

    it("throws ForbiddenError when inviter is below admin", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ role: UserRole.SALES }));

      await expect(
        inviteMember(ORG_ID, "usr-1", {
          email: "new@test.com",
          firstName: "New",
          lastName: "Member",
          role: UserRole.VIEWER,
        })
      ).rejects.toThrow("Only admins and above");
    });

    it("throws ForbiddenError when assigning higher role than inviter", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      mockDb.findOne.mockResolvedValue(null);

      await expect(
        inviteMember(ORG_ID, "usr-1", {
          email: "new@test.com",
          firstName: "New",
          lastName: "Member",
          role: UserRole.OWNER,
        })
      ).rejects.toThrow("Cannot assign a role higher than your own");
    });

    it("throws ConflictError when email already exists", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ role: UserRole.ADMIN }));
      mockDb.findOne.mockResolvedValue(makeUser({ email: "existing@test.com" }));

      await expect(
        inviteMember(ORG_ID, "usr-1", {
          email: "existing@test.com",
          firstName: "Dup",
          lastName: "User",
          role: UserRole.VIEWER,
        })
      ).rejects.toThrow("already exists");
    });
  });

  describe("updateMemberRole", () => {
    it("updates member role", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ id: "usr-target", role: UserRole.VIEWER }));

      const result = await updateMemberRole(ORG_ID, "usr-target", UserRole.ADMIN, {
        role: UserRole.SALES,
      });

      expect(result.role).toBe(UserRole.SALES);
    });

    it("throws NotFoundError when user not found", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        updateMemberRole(ORG_ID, "missing", UserRole.ADMIN, { role: UserRole.VIEWER })
      ).rejects.toThrow("User");
    });

    it("prevents non-owner from changing owner role", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ id: "usr-target", role: UserRole.OWNER }));

      await expect(
        updateMemberRole(ORG_ID, "usr-target", UserRole.ADMIN, { role: UserRole.ADMIN })
      ).rejects.toThrow("Only an owner");
    });

    it("prevents assigning role higher than updater", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ id: "usr-target", role: UserRole.VIEWER }));

      await expect(
        updateMemberRole(ORG_ID, "usr-target", UserRole.ADMIN, { role: UserRole.OWNER })
      ).rejects.toThrow("Cannot assign a role higher");
    });
  });

  describe("removeMember", () => {
    it("soft-deletes a member", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ id: "usr-target", role: UserRole.VIEWER }));

      await removeMember(ORG_ID, "usr-target", "usr-admin");

      expect(mockDb.update).toHaveBeenCalledWith("users", "usr-target", expect.objectContaining({
        isActive: false,
      }));
    });

    it("throws when trying to remove yourself", async () => {
      await expect(
        removeMember(ORG_ID, "usr-1", "usr-1")
      ).rejects.toThrow("cannot remove yourself");
    });

    it("throws NotFoundError when target not found", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(removeMember(ORG_ID, "missing", "usr-admin")).rejects.toThrow("User");
    });

    it("prevents removing the owner", async () => {
      mockDb.findById.mockResolvedValue(makeUser({ id: "usr-owner", role: UserRole.OWNER }));

      await expect(
        removeMember(ORG_ID, "usr-owner", "usr-admin")
      ).rejects.toThrow("owner cannot be removed");
    });
  });
});
