import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRole } from "@emp-billing/shared";
import { requireRole, requireOwner, requireAdmin, requireAccountant, requireSales } from "./rbac.middleware";

function mockReq(user?: { role: string }) {
  return { user: user ? { ...user, id: "usr-1", email: "a@b.com", orgId: "org-1", orgName: "X", firstName: "A", lastName: "B" } : undefined } as any;
}

const mockRes = () => ({} as any);
const next = vi.fn();

describe("rbac.middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("requireRole", () => {
    it("calls next when user has sufficient role", () => {
      const middleware = requireRole(UserRole.SALES);
      middleware(mockReq({ role: UserRole.ADMIN }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("throws UnauthorizedError when no user", () => {
      const middleware = requireRole(UserRole.VIEWER);
      expect(() => middleware(mockReq(), mockRes(), next)).toThrow();
    });

    it("throws ForbiddenError when role is insufficient", () => {
      const middleware = requireRole(UserRole.ADMIN);
      expect(() => middleware(mockReq({ role: UserRole.VIEWER }), mockRes(), next)).toThrow("requires at least");
    });

    it("allows exact role match", () => {
      const middleware = requireRole(UserRole.ACCOUNTANT);
      middleware(mockReq({ role: UserRole.ACCOUNTANT }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("shorthand guards", () => {
    it("requireOwner blocks non-owner", () => {
      expect(() => requireOwner(mockReq({ role: UserRole.ADMIN }), mockRes(), next)).toThrow();
    });

    it("requireOwner allows owner", () => {
      requireOwner(mockReq({ role: UserRole.OWNER }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("requireAdmin allows admin", () => {
      requireAdmin(mockReq({ role: UserRole.ADMIN }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("requireAccountant allows accountant", () => {
      requireAccountant(mockReq({ role: UserRole.ACCOUNTANT }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });

    it("requireSales allows sales", () => {
      requireSales(mockReq({ role: UserRole.SALES }), mockRes(), next);
      expect(next).toHaveBeenCalled();
    });
  });
});
