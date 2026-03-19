import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/index", () => ({
  config: { rateLimit: { windowMs: 60000, max: 100 } },
}));

import { rateLimit } from "./rate-limit.middleware";

function mockReq(ip = "127.0.0.1") {
  return { ip, headers: {} } as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn();
  return res;
}

const next = vi.fn();

describe("rate-limit.middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows requests within limit", () => {
    const middleware = rateLimit({ windowMs: 60000, max: 5 });
    const res = mockRes();

    middleware(mockReq("10.0.0.1"), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 4);
  });

  it("returns 429 when limit exceeded", () => {
    const middleware = rateLimit({ windowMs: 60000, max: 2 });
    const ip = "10.0.0.2";

    // First 2 requests should pass
    middleware(mockReq(ip), mockRes(), next);
    middleware(mockReq(ip), mockRes(), next);

    // Third request should be blocked
    const res = mockRes();
    middleware(mockReq(ip), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED" }),
    }));
  });

  it("tracks different IPs independently", () => {
    const middleware = rateLimit({ windowMs: 60000, max: 1 });

    middleware(mockReq("10.0.0.3"), mockRes(), next);
    middleware(mockReq("10.0.0.4"), mockRes(), next);

    // Both should have passed (different IPs)
    expect(next).toHaveBeenCalledTimes(2);
  });
});
