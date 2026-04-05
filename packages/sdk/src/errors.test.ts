/**
 * EMP Billing SDK — Error classes coverage tests.
 */
import { describe, it, expect } from "vitest";
import {
  BillingApiError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  ForbiddenError,
} from "./errors";

describe("BillingApiError", () => {
  it("sets status, code, message", () => {
    const err = new BillingApiError(500, "INTERNAL", "Something broke");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BillingApiError);
    expect(err.status).toBe(500);
    expect(err.code).toBe("INTERNAL");
    expect(err.message).toBe("Something broke");
    expect(err.name).toBe("BillingApiError");
  });

  it("stores details", () => {
    const details = { amount: ["must be positive"] };
    const err = new BillingApiError(422, "VALIDATION", "Bad", details);
    expect(err.details).toEqual(details);
  });

  it("details undefined when omitted", () => {
    expect(new BillingApiError(400, "X", "Y").details).toBeUndefined();
  });

  it("has a stack trace", () => {
    expect(new BillingApiError(500, "X", "Y").stack).toBeDefined();
  });
});

describe("RateLimitError", () => {
  it("creates 429 with default retryAfter null", () => {
    const err = new RateLimitError("Slow down");
    expect(err).toBeInstanceOf(BillingApiError);
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.name).toBe("RateLimitError");
    expect(err.retryAfterSeconds).toBeNull();
  });

  it("stores retryAfterSeconds", () => {
    const err = new RateLimitError("Wait", 30);
    expect(err.retryAfterSeconds).toBe(30);
  });
});

describe("ValidationError", () => {
  it("creates 422 with field errors", () => {
    const fields = { email: ["required"], amount: ["must be positive"] };
    const err = new ValidationError("Validation failed", fields);
    expect(err).toBeInstanceOf(BillingApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.fieldErrors).toEqual(fields);
    expect(err.details).toEqual(fields);
    expect(err.name).toBe("ValidationError");
  });
});

describe("NotFoundError", () => {
  it("creates 404 with default message", () => {
    const err = new NotFoundError();
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found");
    expect(err.name).toBe("NotFoundError");
  });

  it("accepts custom message", () => {
    expect(new NotFoundError("Invoice not found").message).toBe("Invoice not found");
  });
});

describe("AuthenticationError", () => {
  it("creates 401 with default message", () => {
    const err = new AuthenticationError();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Invalid or missing API key");
    expect(err.name).toBe("AuthenticationError");
  });

  it("accepts custom message", () => {
    expect(new AuthenticationError("Expired").message).toBe("Expired");
  });
});

describe("ForbiddenError", () => {
  it("creates 403 with default message", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("Insufficient permissions");
    expect(err.name).toBe("ForbiddenError");
  });

  it("accepts custom message", () => {
    expect(new ForbiddenError("Admin only").message).toBe("Admin only");
  });
});

describe("instanceof checks", () => {
  it("RateLimitError instanceof BillingApiError", () => {
    expect(new RateLimitError("x")).toBeInstanceOf(BillingApiError);
  });

  it("ValidationError instanceof BillingApiError", () => {
    expect(new ValidationError("x", {})).toBeInstanceOf(BillingApiError);
  });

  it("NotFoundError instanceof BillingApiError", () => {
    expect(new NotFoundError()).toBeInstanceOf(BillingApiError);
  });

  it("AuthenticationError instanceof BillingApiError", () => {
    expect(new AuthenticationError()).toBeInstanceOf(BillingApiError);
  });

  it("ForbiddenError instanceof BillingApiError", () => {
    expect(new ForbiddenError()).toBeInstanceOf(BillingApiError);
  });
});
