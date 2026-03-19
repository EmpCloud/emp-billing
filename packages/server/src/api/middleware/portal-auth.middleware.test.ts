import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("../../config/index", () => ({
  config: { jwt: { accessSecret: "test-secret" } },
}));

import { portalAuth } from "./portal-auth.middleware";

function mockReq(headers: Record<string, string> = {}) {
  return { headers, portalClient: undefined } as any;
}

const mockRes = () => ({} as any);
const next = vi.fn();

describe("portal-auth.middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets portalClient on valid portal token", () => {
    const token = jwt.sign(
      { sub: "client-1", orgId: "org-1", type: "portal" },
      "test-secret"
    );

    const req = mockReq({ authorization: `Bearer ${token}` });
    portalAuth(req, mockRes(), next);

    expect(req.portalClient).toEqual({
      clientId: "client-1",
      orgId: "org-1",
    });
    expect(next).toHaveBeenCalled();
  });

  it("throws when no Authorization header", () => {
    expect(() => portalAuth(mockReq(), mockRes(), next)).toThrow("Missing or malformed");
  });

  it("throws when token is not portal type", () => {
    const token = jwt.sign(
      { sub: "usr-1", orgId: "org-1", type: "user" },
      "test-secret"
    );

    expect(() => portalAuth(mockReq({ authorization: `Bearer ${token}` }), mockRes(), next))
      .toThrow("Invalid portal token");
  });

  it("throws on invalid token", () => {
    expect(() => portalAuth(mockReq({ authorization: "Bearer bad.token" }), mockRes(), next))
      .toThrow("Invalid or expired");
  });

  it("throws on expired token", () => {
    const token = jwt.sign(
      { sub: "client-1", orgId: "org-1", type: "portal" },
      "test-secret",
      { expiresIn: "-1s" }
    );

    expect(() => portalAuth(mockReq({ authorization: `Bearer ${token}` }), mockRes(), next))
      .toThrow("Invalid or expired");
  });
});
