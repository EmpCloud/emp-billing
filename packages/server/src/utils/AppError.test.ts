import { describe, it, expect } from "vitest";
import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ValidationError,
  ConflictError,
  BadRequestError,
} from "./AppError";

describe("AppError", () => {
  it("sets statusCode, code, and message", () => {
    const err = new AppError(500, "INTERNAL", "Something went wrong");

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("INTERNAL");
    expect(err.message).toBe("Something went wrong");
    expect(err.name).toBe("AppError");
  });

  it("stores optional details", () => {
    const details = { email: ["Email is already taken"] };
    const err = new AppError(422, "VALIDATION_ERROR", "Validation failed", details);

    expect(err.details).toEqual(details);
  });

  it("has undefined details when not provided", () => {
    const err = new AppError(400, "BAD_REQUEST", "Bad");
    expect(err.details).toBeUndefined();
  });

  it("has a stack trace", () => {
    const err = new AppError(500, "TEST", "test");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("AppError");
  });
});

describe("NotFoundError", () => {
  it("returns 404 with formatted message", () => {
    const err = NotFoundError("Invoice");

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Invoice not found");
  });

  it("includes the resource name in the message", () => {
    const err = NotFoundError("Client");
    expect(err.message).toBe("Client not found");
  });
});

describe("UnauthorizedError", () => {
  it("returns 401 with default message", () => {
    const err = UnauthorizedError();

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.message).toBe("Unauthorized");
  });

  it("accepts custom message", () => {
    const err = UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });
});

describe("ForbiddenError", () => {
  it("returns 403 with default message", () => {
    const err = ForbiddenError();

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toBe("Forbidden");
  });

  it("accepts custom message", () => {
    const err = ForbiddenError("Insufficient permissions");
    expect(err.message).toBe("Insufficient permissions");
  });
});

describe("ValidationError", () => {
  it("returns 422 with details", () => {
    const details = {
      email: ["Invalid email format"],
      password: ["Too short", "Must contain a number"],
    };
    const err = ValidationError(details);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.message).toBe("Validation failed");
    expect(err.details).toEqual(details);
  });
});

describe("ConflictError", () => {
  it("returns 409 with message", () => {
    const err = ConflictError("Duplicate invoice number");

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Duplicate invoice number");
  });
});

describe("BadRequestError", () => {
  it("returns 400 with message", () => {
    const err = BadRequestError("Invalid input");

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid input");
  });
});
