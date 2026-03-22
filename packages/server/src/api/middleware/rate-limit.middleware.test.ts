import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ioredis before importing the module
const mockMulti = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedis = {
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
  multi: vi.fn(() => mockMulti),
};

vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
}));

vi.mock("../../config/index", () => ({
  config: {
    rateLimit: { windowMs: 60000, max: 100 },
    redis: { host: "localhost", port: 6379, password: "" },
  },
}));

vi.mock("../../utils/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
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

describe("rate-limit.middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMulti.zremrangebyscore.mockReturnThis();
    mockMulti.zadd.mockReturnThis();
    mockMulti.zcard.mockReturnThis();
    mockMulti.expire.mockReturnThis();
  });

  it("allows requests within limit", async () => {
    // Simulate 1 request in window (under limit of 5)
    mockMulti.exec.mockResolvedValue([
      [null, 0], // zremrangebyscore
      [null, 1], // zadd
      [null, 1], // zcard — 1 request, under limit
      [null, 1], // expire
    ]);

    const middleware = rateLimit({ windowMs: 60000, max: 5 });
    const res = mockRes();
    const next = vi.fn();

    await middleware(mockReq("10.0.0.1"), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 5);
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 4);
  });

  it("returns 429 when limit exceeded", async () => {
    // Simulate 3 requests in window (over limit of 2)
    mockMulti.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 3], // zcard — 3 requests, over limit of 2
      [null, 1],
    ]);

    const middleware = rateLimit({ windowMs: 60000, max: 2 });
    const res = mockRes();
    const next = vi.fn();

    await middleware(mockReq("10.0.0.2"), res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: "RATE_LIMIT_EXCEEDED" }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it("tracks different IPs independently", async () => {
    // Both requests are under limit
    mockMulti.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1], // zcard — 1 request each
      [null, 1],
    ]);

    const middleware = rateLimit({ windowMs: 60000, max: 1 });
    const next = vi.fn();

    await middleware(mockReq("10.0.0.3"), mockRes(), next);
    await middleware(mockReq("10.0.0.4"), mockRes(), next);

    // Both should have passed (different IPs, different Redis keys)
    expect(next).toHaveBeenCalledTimes(2);
  });
});
