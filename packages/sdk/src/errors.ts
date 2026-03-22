// ============================================================================
// SDK Error Types
// ============================================================================

/**
 * Base error for all EMP Billing API errors.
 */
export class BillingApiError extends Error {
  /** HTTP status code returned by the API. */
  public readonly status: number;
  /** Machine-readable error code (e.g. "INVOICE_NOT_FOUND"). */
  public readonly code: string;
  /** Additional details provided by the API, if any. */
  public readonly details?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "BillingApiError";
    this.status = status;
    this.code = code;
    this.details = details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 429 Too Many Requests.
 * Contains retry timing information when available.
 */
export class RateLimitError extends BillingApiError {
  /** Seconds until the rate limit resets, if provided by the API. */
  public readonly retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null = null) {
    super(429, "RATE_LIMITED", message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 422 with field-level validation errors.
 */
export class ValidationError extends BillingApiError {
  /** Per-field validation errors. */
  public readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(422, "VALIDATION_ERROR", message, fieldErrors);
    this.name = "ValidationError";
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 404 Not Found.
 */
export class NotFoundError extends BillingApiError {
  constructor(message: string = "Resource not found") {
    super(404, "NOT_FOUND", message);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 401 Unauthorized (invalid or missing API key).
 */
export class AuthenticationError extends BillingApiError {
  constructor(message: string = "Invalid or missing API key") {
    super(401, "UNAUTHORIZED", message);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns 403 Forbidden (insufficient permissions).
 */
export class ForbiddenError extends BillingApiError {
  constructor(message: string = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
    this.name = "ForbiddenError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
