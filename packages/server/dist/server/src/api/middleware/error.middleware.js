"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
exports.asyncHandler = asyncHandler;
const zod_1 = require("zod");
const AppError_1 = require("../../utils/AppError");
const logger_1 = require("../../utils/logger");
function errorMiddleware(err, _req, res, _next) {
    // Zod validation errors
    if (err instanceof zod_1.ZodError) {
        const details = {};
        for (const issue of err.issues) {
            const key = issue.path.join(".");
            details[key] = details[key] || [];
            details[key].push(issue.message);
        }
        const body = {
            success: false,
            error: { code: "VALIDATION_ERROR", message: "Validation failed", details },
        };
        res.status(422).json(body);
        return;
    }
    // Known application errors
    if (err instanceof AppError_1.AppError) {
        const body = {
            success: false,
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {}),
            },
        };
        if (err.statusCode >= 500) {
            logger_1.logger.error(`[AppError] ${err.code}: ${err.message}`, { stack: err.stack });
        }
        res.status(err.statusCode).json(body);
        return;
    }
    // Unknown errors
    logger_1.logger.error("[Unhandled error]", { err });
    const body = {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    };
    res.status(500).json(body);
}
// Catch async route handler errors and forward to errorMiddleware
function asyncHandler(fn) {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
//# sourceMappingURL=error.middleware.js.map