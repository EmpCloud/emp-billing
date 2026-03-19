export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}

// Convenience factories
export const NotFoundError = (resource: string) =>
  new AppError(404, "NOT_FOUND", `${resource} not found`);

export const UnauthorizedError = (message = "Unauthorized") =>
  new AppError(401, "UNAUTHORIZED", message);

export const ForbiddenError = (message = "Forbidden") =>
  new AppError(403, "FORBIDDEN", message);

export const ValidationError = (details: Record<string, string[]>) =>
  new AppError(422, "VALIDATION_ERROR", "Validation failed", details);

export const ConflictError = (message: string) =>
  new AppError(409, "CONFLICT", message);

export const BadRequestError = (message: string) =>
  new AppError(400, "BAD_REQUEST", message);
