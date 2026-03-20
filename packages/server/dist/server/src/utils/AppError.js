"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestError = exports.ConflictError = exports.ValidationError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, code, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = "AppError";
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
// Convenience factories
const NotFoundError = (resource) => new AppError(404, "NOT_FOUND", `${resource} not found`);
exports.NotFoundError = NotFoundError;
const UnauthorizedError = (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message);
exports.UnauthorizedError = UnauthorizedError;
const ForbiddenError = (message = "Forbidden") => new AppError(403, "FORBIDDEN", message);
exports.ForbiddenError = ForbiddenError;
const ValidationError = (details) => new AppError(422, "VALIDATION_ERROR", "Validation failed", details);
exports.ValidationError = ValidationError;
const ConflictError = (message) => new AppError(409, "CONFLICT", message);
exports.ConflictError = ConflictError;
const BadRequestError = (message) => new AppError(400, "BAD_REQUEST", message);
exports.BadRequestError = BadRequestError;
//# sourceMappingURL=AppError.js.map