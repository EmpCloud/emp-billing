"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const index_1 = require("../../config/index");
const store = new Map();
// Clean up expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.resetTime <= now)
            store.delete(key);
    }
}, 5 * 60 * 1000);
function rateLimit(opts) {
    const windowMs = opts?.windowMs ?? index_1.config.rateLimit.windowMs;
    const max = opts?.max ?? index_1.config.rateLimit.max;
    return (req, res, next) => {
        const key = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
        const now = Date.now();
        let entry = store.get(key);
        if (!entry || entry.resetTime <= now) {
            entry = { count: 0, resetTime: now + windowMs };
            store.set(key, entry);
        }
        entry.count++;
        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", max);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.count));
        res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));
        if (entry.count > max) {
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
    };
}
//# sourceMappingURL=rate-limit.middleware.js.map