import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));
vi.mock("../../config/index", () => ({
  config: {
    jwt: { accessSecret: "test-secret", accessExpiresIn: "15m", refreshExpiresIn: "7d" },
    bcryptRounds: 4,
  },
}));

import { getDB } from "../../db/adapters/index";
import {
  register,
  login,
  refreshTokens,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} from "./auth.service";

const mockedGetDB = vi.mocked(getDB);

function makeMockDb(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn(),
    findById: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    update: vi.fn().mockImplementation((_t: string, _id: string, data: Record<string, unknown>) => data),
    updateMany: vi.fn(),
    ...overrides,
  };
}

const ORG_ID = "org-100";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr-1",
    orgId: ORG_ID,
    email: "test@example.com",
    // bcrypt hash of "Password1" with 4 rounds
    passwordHash: "$2a$04$8nI6j0q3VCXVGiGHVt0pT.5iHsBHPjQl3I1GjNsAz3jS0dXmUZ7cK",
    firstName: "John",
    lastName: "Doe",
    role: "owner",
    isActive: true,
    emailVerified: false,
    ...overrides,
  };
}

describe("auth.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── register ────────────────────────────────────────────────────────────

  describe("register", () => {
    it("creates org + user and returns tokens", async () => {
      mockDb.findOne.mockResolvedValue(null); // no existing user

      const result = await register({
        email: "new@example.com",
        password: "StrongPass1",
        firstName: "Jane",
        lastName: "Smith",
        orgName: "Acme",
        country: "IN",
        currency: "INR",
      });

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user.email).toBe("new@example.com");
      expect(result.user.role).toBe("owner");
      expect(mockDb.create).toHaveBeenCalledTimes(3); // org + user + refresh_token
    });

    it("throws ConflictError when email exists", async () => {
      mockDb.findOne.mockResolvedValue(makeUser());

      await expect(
        register({
          email: "test@example.com",
          password: "StrongPass1",
          firstName: "Jane",
          lastName: "Smith",
          orgName: "Acme",
          country: "IN",
          currency: "INR",
        })
      ).rejects.toThrow("An account with this email already exists");
    });
  });

  // ── login ───────────────────────────────────────────────────────────────

  describe("login", () => {
    it("throws when user not found", async () => {
      mockDb.findOne.mockResolvedValue(null);

      await expect(
        login({ email: "nope@example.com", password: "x" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("throws when account is disabled", async () => {
      mockDb.findOne.mockResolvedValue(makeUser({ isActive: false }));

      await expect(
        login({ email: "test@example.com", password: "x" })
      ).rejects.toThrow("Account is disabled");
    });

    it("throws when password is wrong", async () => {
      // Use bcrypt to generate a proper hash so comparison works
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("CorrectPassword", 4);
      mockDb.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(
        login({ email: "test@example.com", password: "WrongPassword" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("returns tokens on valid login", async () => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("CorrectPass1", 4);
      const user = makeUser({ passwordHash: hash });
      mockDb.findOne.mockResolvedValue(user);
      mockDb.findById.mockResolvedValue({ id: ORG_ID, name: "TestOrg" });

      const result = await login({ email: "test@example.com", password: "CorrectPass1" });

      expect(result).toHaveProperty("accessToken");
      expect(result.user.email).toBe("test@example.com");
      // Should update lastLoginAt
      expect(mockDb.update).toHaveBeenCalledWith(
        "users",
        user.id,
        expect.objectContaining({ lastLoginAt: expect.any(Date) })
      );
    });
  });

  // ── refreshTokens ─────────────────────────────────────────────────────

  describe("refreshTokens", () => {
    it("throws when token not found", async () => {
      mockDb.findOne.mockResolvedValue(null);

      await expect(
        refreshTokens({ refreshToken: "bad-token" })
      ).rejects.toThrow("Invalid or expired refresh token");
    });

    it("throws when token is revoked", async () => {
      mockDb.findOne.mockResolvedValue({
        id: "rt-1",
        userId: "usr-1",
        expiresAt: new Date(Date.now() + 86400000),
        isRevoked: true,
      });

      await expect(
        refreshTokens({ refreshToken: "revoked-token" })
      ).rejects.toThrow("Invalid or expired refresh token");
    });

    it("throws when token is expired", async () => {
      mockDb.findOne.mockResolvedValue({
        id: "rt-1",
        userId: "usr-1",
        expiresAt: new Date(Date.now() - 1000),
        isRevoked: false,
      });

      await expect(
        refreshTokens({ refreshToken: "expired-token" })
      ).rejects.toThrow("Invalid or expired refresh token");
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("revokes the refresh token", async () => {
      await logout("some-token");

      expect(mockDb.updateMany).toHaveBeenCalledWith(
        "refresh_tokens",
        expect.objectContaining({ tokenHash: expect.any(String) }),
        expect.objectContaining({ isRevoked: true })
      );
    });
  });

  // ── forgotPassword ──────────────────────────────────────────────────────

  describe("forgotPassword", () => {
    it("returns empty string if email not found (no leak)", async () => {
      mockDb.findOne.mockResolvedValue(null);

      const token = await forgotPassword("missing@example.com");
      expect(token).toBe("");
    });

    it("sets reset token on user", async () => {
      mockDb.findOne.mockResolvedValue(makeUser());

      const token = await forgotPassword("test@example.com");
      expect(token).toBeTruthy();
      expect(mockDb.update).toHaveBeenCalledWith(
        "users",
        "usr-1",
        expect.objectContaining({ resetToken: expect.any(String) })
      );
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("throws when token is invalid", async () => {
      mockDb.findOne.mockResolvedValue(null);

      await expect(
        resetPassword({ token: "bad", password: "NewPass1" })
      ).rejects.toThrow("Invalid or expired reset token");
    });

    it("throws when token is expired", async () => {
      mockDb.findOne.mockResolvedValue(
        makeUser({ resetToken: "hash", resetTokenExpires: new Date(Date.now() - 1000) })
      );

      await expect(
        resetPassword({ token: "x", password: "NewPass1" })
      ).rejects.toThrow("Invalid or expired reset token");
    });
  });

  // ── changePassword ──────────────────────────────────────────────────────

  describe("changePassword", () => {
    it("throws when user not found", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        changePassword("missing-id", { currentPassword: "x", newPassword: "y" })
      ).rejects.toThrow("User");
    });

    it("throws when current password is wrong", async () => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("RealPass", 4);
      mockDb.findById.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(
        changePassword("usr-1", { currentPassword: "WrongPass", newPassword: "NewPass1" })
      ).rejects.toThrow("Current password is incorrect");
    });

    it("updates password on valid current password", async () => {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.hash("RealPass", 4);
      mockDb.findById.mockResolvedValue(makeUser({ passwordHash: hash }));

      await changePassword("usr-1", { currentPassword: "RealPass", newPassword: "NewPass1" });

      expect(mockDb.update).toHaveBeenCalledWith(
        "users",
        "usr-1",
        expect.objectContaining({ passwordHash: expect.any(String) })
      );
    });
  });
});
