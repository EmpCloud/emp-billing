// =============================================================================
// EMP BILLING — Middleware, Error, RBAC, Validate, Response Unit Tests
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import { z, ZodError } from "zod";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config/index", () => ({
  config: {
    jwt: { accessSecret: "billing-test-secret" },
    empcloud: { apiKey: "empcloud-api-key-123" },
  },
}));

const mockFindOne = vi.fn();
vi.mock("../db/adapters/index", () => ({
  getDB: () => Promise.resolve({ findOne: mockFindOne }),
  createDBAdapter: vi.fn(),
  initDB: vi.fn(),
  closeDB: vi.fn(),
}));

vi.mock("../services/auth/api-key.service", () => ({
  validateApiKey: vi.fn().mockRejectedValue(new Error("Invalid key")),
}));

vi.mock("@emp-billing/shared", () => ({
  UserRole: { OWNER: "owner", ADMIN: "admin", ACCOUNTANT: "accountant", SALES: "sales", VIEWER: "viewer" },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { authenticate, optionalAuth } from "../api/middleware/auth.middleware";
import { errorMiddleware, asyncHandler } from "../api/middleware/error.middleware";
import { requireRole } from "../api/middleware/rbac.middleware";
import { validateBody, validateQuery, validateParams } from "../api/middleware/validate.middleware";
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError, BadRequestError } from "../utils/AppError";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockReq(overrides: any = {}): any {
  return { headers: {}, params: {}, query: {}, body: {}, ...overrides };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

// =============================================================================
// Auth Middleware
// =============================================================================
describe("Billing Auth Middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("authenticate()", () => {
    it("throws on missing Authorization header", () => {
      const req = mockReq();
      expect(() => authenticate(req, mockRes(), vi.fn())).toThrow();
    });

    it("throws on non-Bearer Authorization", () => {
      const req = mockReq({ headers: { authorization: "Basic abc" } });
      expect(() => authenticate(req, mockRes(), vi.fn())).toThrow();
    });

    it("authenticates with EmpCloud API key", async () => {
      mockFindOne.mockResolvedValue({ id: "org-1" });
      const req = mockReq({ headers: { authorization: "Bearer empcloud-api-key-123" } });
      const next = vi.fn();

      authenticate(req, mockRes(), next);
      // API key path is async — wait for promise resolution
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ id: "empcloud-system", role: "admin" });
    });

    it("EmpCloud API key still works even if DB lookup fails", async () => {
      mockFindOne.mockRejectedValue(new Error("DB down"));
      const req = mockReq({ headers: { authorization: "Bearer empcloud-api-key-123" } });
      const next = vi.fn();

      authenticate(req, mockRes(), next);
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe("empcloud-system");
      expect(req.user.orgId).toBe("");
    });

    it("authenticates with valid JWT", () => {
      const payload = { sub: "user-1", email: "a@b.com", role: "admin", orgId: "org-1", orgName: "Org", firstName: "A", lastName: "B" };
      const token = jwt.sign(payload, "billing-test-secret");
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const next = vi.fn();

      authenticate(req, mockRes(), next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toMatchObject({ id: "user-1", email: "a@b.com", role: "admin" });
    });

    it("throws on invalid JWT", () => {
      const req = mockReq({ headers: { authorization: "Bearer invalid.jwt.token" } });
      expect(() => authenticate(req, mockRes(), vi.fn())).toThrow();
    });
  });

  describe("optionalAuth()", () => {
    it("calls next without user when no auth header", () => {
      const req = mockReq();
      const next = vi.fn();
      optionalAuth(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it("attaches user from valid JWT", () => {
      const payload = { sub: "u-2", email: "x@y.com", role: "viewer", orgId: "o-2", orgName: "O2", firstName: "X", lastName: "Y" };
      const token = jwt.sign(payload, "billing-test-secret");
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const next = vi.fn();

      optionalAuth(req, mockRes(), next);

      expect(req.user).toMatchObject({ id: "u-2", role: "viewer" });
      expect(next).toHaveBeenCalled();
    });

    it("continues without user on invalid JWT", () => {
      const req = mockReq({ headers: { authorization: "Bearer bad.token" } });
      const next = vi.fn();
      optionalAuth(req, mockRes(), next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// RBAC Middleware
// =============================================================================
describe("Billing RBAC Middleware", () => {
  it("throws when no user is attached", () => {
    const mw = requireRole("admin" as any);
    const req = mockReq();
    expect(() => mw(req, mockRes(), vi.fn())).toThrow();
  });

  it("throws when role is below minimum", () => {
    const mw = requireRole("admin" as any);
    const req = mockReq({ user: { role: "viewer" } });
    expect(() => mw(req, mockRes(), vi.fn())).toThrow();
  });

  it("allows when role meets minimum", () => {
    const mw = requireRole("accountant" as any);
    const req = mockReq({ user: { role: "admin" } });
    const next = vi.fn();
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it("allows owner for any role check", () => {
    const mw = requireRole("viewer" as any);
    const req = mockReq({ user: { role: "owner" } });
    const next = vi.fn();
    mw(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// =============================================================================
// Error Middleware
// =============================================================================
describe("Billing Error Middleware", () => {
  it("handles ZodError as 422", () => {
    const err = new ZodError([
      { code: "invalid_type", expected: "string", received: "number", path: ["name"], message: "Expected string" },
    ]);
    const res = mockRes();
    errorMiddleware(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: "VALIDATION_ERROR" }) })
    );
  });

  it("handles AppError with correct status", () => {
    const err = new AppError(409, "CONFLICT", "Duplicate entry");
    const res = mockRes();
    errorMiddleware(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("handles AppError with details", () => {
    const err = new AppError(400, "BAD", "Bad input", { field: ["required"] });
    const res = mockRes();
    errorMiddleware(err, mockReq(), res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ details: { field: ["required"] } }) })
    );
  });

  it("logs and returns 500 for unknown errors", () => {
    const err = new Error("unexpected");
    const res = mockRes();
    errorMiddleware(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: "INTERNAL_ERROR" }) })
    );
  });

  it("handles non-Error unknown values", () => {
    const res = mockRes();
    errorMiddleware("string error", mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
// asyncHandler
// =============================================================================
describe("asyncHandler", () => {
  it("forwards async errors to next", async () => {
    const handler = asyncHandler(async () => { throw new Error("async fail"); });
    const next = vi.fn();
    handler(mockReq(), mockRes(), next);
    await new Promise((r) => setTimeout(r, 10));
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("does not call next on success", async () => {
    const handler = asyncHandler(async (_req, res) => { res.json({ ok: true }); });
    const res = mockRes();
    const next = vi.fn();
    handler(mockReq(), res, next);
    await new Promise((r) => setTimeout(r, 10));
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});

// =============================================================================
// Validate Middleware
// =============================================================================
describe("Billing Validate Middleware", () => {
  const nameSchema = z.object({ name: z.string().min(1) });

  describe("validateBody()", () => {
    it("passes valid body through", () => {
      const mw = validateBody(nameSchema);
      const req = mockReq({ body: { name: "Test" } });
      const next = vi.fn();
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.body.name).toBe("Test");
    });

    it("throws ZodError on invalid body", () => {
      const mw = validateBody(nameSchema);
      const req = mockReq({ body: { name: "" } });
      expect(() => mw(req, mockRes(), vi.fn())).toThrow(ZodError);
    });

    it("throws ZodError on missing field", () => {
      const mw = validateBody(nameSchema);
      const req = mockReq({ body: {} });
      expect(() => mw(req, mockRes(), vi.fn())).toThrow(ZodError);
    });
  });

  describe("validateQuery()", () => {
    const pageSchema = z.object({ page: z.string().regex(/^\d+$/) });

    it("passes valid query through", () => {
      const mw = validateQuery(pageSchema);
      const req = mockReq({ query: { page: "1" } });
      const next = vi.fn();
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("throws on invalid query", () => {
      const mw = validateQuery(pageSchema);
      const req = mockReq({ query: { page: "abc" } });
      expect(() => mw(req, mockRes(), vi.fn())).toThrow(ZodError);
    });
  });

  describe("validateParams()", () => {
    const idSchema = z.object({ id: z.string().uuid() });

    it("passes valid params through", () => {
      const mw = validateParams(idSchema);
      const req = mockReq({ params: { id: "550e8400-e29b-41d4-a716-446655440000" } });
      const next = vi.fn();
      mw(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("throws on invalid params", () => {
      const mw = validateParams(idSchema);
      const req = mockReq({ params: { id: "not-uuid" } });
      expect(() => mw(req, mockRes(), vi.fn())).toThrow(ZodError);
    });
  });
});

// =============================================================================
// AppError Factory Functions
// =============================================================================
describe("Billing AppError Classes", () => {
  it("AppError stores statusCode, code, message, details", () => {
    const err = new AppError(400, "BAD", "bad", { f: ["r"] });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD");
    expect(err.message).toBe("bad");
    expect(err.details).toEqual({ f: ["r"] });
    expect(err instanceof Error).toBe(true);
  });

  it("NotFoundError returns 404", () => {
    const err = NotFoundError("Invoice");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Invoice not found");
  });

  it("UnauthorizedError returns 401", () => {
    const err = UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it("UnauthorizedError accepts custom message", () => {
    const err = UnauthorizedError("Session expired");
    expect(err.message).toBe("Session expired");
  });

  it("ForbiddenError returns 403", () => {
    const err = ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it("ValidationError returns 422 with details", () => {
    const err = ValidationError({ name: ["required"] });
    expect(err.statusCode).toBe(422);
    expect(err.details).toEqual({ name: ["required"] });
  });

  it("ConflictError returns 409", () => {
    const err = ConflictError("Duplicate");
    expect(err.statusCode).toBe(409);
  });

  it("BadRequestError returns 400", () => {
    const err = BadRequestError("Missing param");
    expect(err.statusCode).toBe(400);
  });
});
