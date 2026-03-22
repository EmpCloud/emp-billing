import type { Request, Response, NextFunction } from "express";
import { config } from "../../config/index";
import Redis from "ioredis";
import { logger } from "../../utils/logger";

// Lazy-initialized Redis client for rate limiting
let redis: Redis | null = null;
let redisAvailable = true;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on("error", (err) => {
      if (redisAvailable) {
        logger.warn("Rate-limit Redis connection lost — falling back to permissive mode", { err: err.message });
        redisAvailable = false;
      }
    });

    redis.on("connect", () => {
      redisAvailable = true;
    });

    redis.connect().catch(() => {
      redisAvailable = false;
    });
  }
  return redis;
}

export function rateLimit(opts?: { windowMs?: number; max?: number }) {
  const windowMs = opts?.windowMs ?? config.rateLimit.windowMs;
  const max = opts?.max ?? config.rateLimit.max;
  const windowSeconds = Math.ceil(windowMs / 1000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key =
      req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
    const redisKey = `rl:${key}:${windowSeconds}:${max}`;

    const client = getRedis();

    // If Redis is unavailable, allow the request through (fail-open)
    if (!redisAvailable) {
      next();
      return;
    }

    try {
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use a sorted set: score = timestamp, member = unique request id
      const multi = client.multi();
      // Remove expired entries
      multi.zremrangebyscore(redisKey, 0, windowStart);
      // Add current request
      multi.zadd(redisKey, now, `${now}:${Math.random()}`);
      // Count requests in window
      multi.zcard(redisKey);
      // Set TTL so the key auto-expires
      multi.expire(redisKey, windowSeconds + 1);

      const results = await multi.exec();
      if (!results) {
        next();
        return;
      }

      const count = results[2][1] as number;

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - count));
      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil((now + windowMs) / 1000)
      );

      if (count > max) {
        res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        });
        return;
      }

      next();
    } catch {
      // If Redis fails mid-request, allow through
      next();
    }
  };
}
