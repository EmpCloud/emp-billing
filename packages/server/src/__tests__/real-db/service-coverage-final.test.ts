// ============================================================================
// EMP BILLING — Service Coverage Final Tests
// Targets: CSV utility, AppError factories, parseBillingAddress, safeParseJSON
// ============================================================================

process.env.DB_HOST = "localhost";
process.env.DB_PORT = "3306";
process.env.DB_USER = "empcloud";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "";
process.env.DB_NAME = "emp_billing";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-cov-final";
process.env.LOG_LEVEL = "error";

import { describe, it, expect, beforeAll } from "vitest";

// ── CSV UTILITY ──────────────────────────────────────────────────────────────

describe("CSV utility — parseCSV", () => {
  let parseCSV: any;
  let toCSV: any;

  beforeAll(async () => {
    const mod = await import("../../utils/csv");
    parseCSV = mod.parseCSV;
    toCSV = mod.toCSV;
  });

  it("parses simple CSV with header", () => {
    const csv = "name,email\nAlice,alice@test.com\nBob,bob@test.com";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].email).toBe("alice@test.com");
    expect(rows[1].name).toBe("Bob");
  });

  it("handles BOM character", () => {
    const csv = "\uFEFFname,email\nAlice,alice@test.com";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alice");
  });

  it("handles quoted fields with commas", () => {
    const csv = 'name,address\nAlice,"123 Main St, Apt 4"';
    const rows = parseCSV(csv);
    expect(rows[0].address).toBe("123 Main St, Apt 4");
  });

  it("handles escaped quotes", () => {
    const csv = 'name,note\nAlice,"She said ""hello"""';
    const rows = parseCSV(csv);
    expect(rows[0].note).toBe('She said "hello"');
  });

  it("returns empty array for header-only CSV", () => {
    const rows = parseCSV("name,email");
    expect(rows).toHaveLength(0);
  });

  it("returns empty array for empty string", () => {
    const rows = parseCSV("");
    expect(rows).toHaveLength(0);
  });

  it("handles CRLF line endings", () => {
    const csv = "name,email\r\nAlice,alice@test.com\r\nBob,bob@test.com";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });
});

describe("CSV utility — toCSV", () => {
  let toCSV: any;

  beforeAll(async () => {
    const mod = await import("../../utils/csv");
    toCSV = mod.toCSV;
  });

  it("serializes data to CSV string", () => {
    const data = [
      { name: "Alice", email: "alice@test.com" },
      { name: "Bob", email: "bob@test.com" },
    ];
    const columns = [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
    ];
    const result = toCSV(data, columns);
    expect(result).toContain("Name,Email");
    expect(result).toContain("Alice,alice@test.com");
    expect(result).toContain("Bob,bob@test.com");
  });

  it("escapes fields containing commas", () => {
    const data = [{ name: "Alice, Jr.", email: "a@t.com" }];
    const columns = [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
    ];
    const result = toCSV(data, columns);
    expect(result).toContain('"Alice, Jr."');
  });

  it("prevents CSV injection with formula triggers", () => {
    const data = [{ name: "=CMD()", email: "+danger" }];
    const columns = [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
    ];
    const result = toCSV(data, columns);
    // Should prefix with single quote
    expect(result).toContain("'=CMD()");
    expect(result).toContain("'+danger");
  });

  it("handles missing keys gracefully", () => {
    const data = [{ name: "Alice" }];
    const columns = [
      { key: "name", header: "Name" },
      { key: "missing", header: "Missing" },
    ];
    const result = toCSV(data, columns);
    expect(result).toContain("Alice,");
  });
});

// ── AppError FACTORIES ───────────────────────────────────────────────────────

describe("AppError factories", () => {
  let errors: any;

  beforeAll(async () => {
    errors = await import("../../utils/AppError");
  });

  it("AppError class properties", () => {
    const err = new errors.AppError(500, "SERVER_ERROR", "Internal error");
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("SERVER_ERROR");
    expect(err.message).toBe("Internal error");
    expect(err.name).toBe("AppError");
    expect(err instanceof Error).toBe(true);
  });

  it("AppError with details", () => {
    const err = new errors.AppError(400, "BAD", "Bad", { field: ["required"] });
    expect(err.details).toEqual({ field: ["required"] });
  });

  it("NotFoundError factory", () => {
    const err = errors.NotFoundError("Invoice");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Invoice not found");
  });

  it("UnauthorizedError factory", () => {
    const err = errors.UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe("Unauthorized");
  });

  it("UnauthorizedError with custom message", () => {
    const err = errors.UnauthorizedError("Token expired");
    expect(err.message).toBe("Token expired");
  });

  it("ForbiddenError factory", () => {
    const err = errors.ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe("Forbidden");
  });

  it("ValidationError factory", () => {
    const err = errors.ValidationError({ email: ["invalid"] });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ email: ["invalid"] });
  });

  it("ConflictError factory", () => {
    const err = errors.ConflictError("Duplicate entry");
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe("Duplicate entry");
  });

  it("BadRequestError factory", () => {
    const err = errors.BadRequestError("Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toBe("Invalid input");
  });
});
