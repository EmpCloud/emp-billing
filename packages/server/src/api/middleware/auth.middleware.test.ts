import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../../config/index", () => ({
  config: { jwt: { accessSecret: "test-secret" }, empcloud: { apiKey: "" } },
}));

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn().mockResolvedValue({ findOne: vi.fn().mockResolvedValue(null) }),
}));

vi.mock("../../services/auth/api-key.service", () => ({
  validateApiKey: vi.fn().mockRejectedValue(new Error("invalid")),
}));

vi.mock("@emp-billing/shared", () => ({
  UserRole: { ADMIN: "admin" },
}));

import { authenticate, optionalAuth } from "./auth.middleware";

function mockReq(headers: Record<string, string> = {}) {
  return { headers, user: undefined } as any;
}

function mockRes() {
  return {} as any;
}

const next = vi.fn();

describe("auth.middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authenticate", () => {
    it("sets req.user on valid token", () => {
      const token = jwt.sign(
        {
          sub: "usr-1",
          email: "test@example.com",
          role: "admin",
          orgId: "org-1",
          orgName: "Test Org",
          firstName: "John",
          lastName: "Doe",
        },
        "test-secret"
      );

      const req = mockReq({ authorization: `Bearer ${token}` });
      authenticate(req, mockRes(), next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("usr-1");
      expect(req.user.email).toBe("test@example.com");
      expect(req.user.orgId).toBe("org-1");
      expect(next).toHaveBeenCalled();
    });

    it("throws when no Authorization header", () => {
      expect(() => {
        authenticate(mockReq(), mockRes(), next);
      }).toThrow("Missing or malformed Authorization header");
    });

    it("throws when header does not start with Bearer", () => {
      expect(() => {
        authenticate(mockReq({ authorization: "Basic abc" }), mockRes(), next);
      }).toThrow("Missing or malformed Authorization header");
    });

    it("throws on invalid token", () => {
      expect(() => {
        authenticate(mockReq({ authorization: "Bearer invalid.token.here" }), mockRes(), next);
      }).toThrow("Invalid or expired token");
    });

    it("throws on expired token", () => {
      const token = jwt.sign({ sub: "usr-1" }, "test-secret", { expiresIn: "-1s" });

      expect(() => {
        authenticate(mockReq({ authorization: `Bearer ${token}` }), mockRes(), next);
      }).toThrow("Invalid or expired token");
    });
  });

  describe("optionalAuth", () => {
    it("sets req.user when valid token present", () => {
      const token = jwt.sign(
        {
          sub: "usr-1",
          email: "test@example.com",
          role: "viewer",
          orgId: "org-1",
          orgName: "Org",
          firstName: "A",
          lastName: "B",
        },
        "test-secret"
      );

      const req = mockReq({ authorization: `Bearer ${token}` });
      optionalAuth(req, mockRes(), next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("usr-1");
      expect(next).toHaveBeenCalled();
    });

    it("proceeds without user when no header", () => {
      const req = mockReq();
      optionalAuth(req, mockRes(), next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it("proceeds without user on invalid token", () => {
      const req = mockReq({ authorization: "Bearer bad-token" });
      optionalAuth(req, mockRes(), next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
