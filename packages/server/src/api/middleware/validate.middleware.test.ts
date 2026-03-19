import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validateBody, validateQuery, validateParams } from "./validate.middleware";

const next = vi.fn();

function mockReq(body?: unknown, query?: unknown, params?: unknown) {
  return { body, query, params } as any;
}

function mockRes() {
  return {} as any;
}

describe("validate.middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("validateBody", () => {
    const schema = z.object({ name: z.string(), age: z.number().optional() });

    it("passes valid body through", () => {
      const req = mockReq({ name: "John" });
      const middleware = validateBody(schema);
      middleware(req, mockRes(), next);

      expect(req.body).toEqual({ name: "John" });
      expect(next).toHaveBeenCalled();
    });

    it("strips unknown fields", () => {
      const req = mockReq({ name: "John", extra: "field" });
      const middleware = validateBody(schema);
      middleware(req, mockRes(), next);

      expect(req.body).not.toHaveProperty("extra");
    });

    it("throws ZodError on invalid body", () => {
      const req = mockReq({ name: 123 });
      const middleware = validateBody(schema);

      expect(() => middleware(req, mockRes(), next)).toThrow();
    });
  });

  describe("validateQuery", () => {
    const schema = z.object({ page: z.coerce.number().default(1) });

    it("parses and replaces query", () => {
      const req = mockReq(undefined, { page: "5" });
      const middleware = validateQuery(schema);
      middleware(req, mockRes(), next);

      expect(req.query.page).toBe(5);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("validateParams", () => {
    const schema = z.object({ id: z.string().uuid() });

    it("passes valid params", () => {
      const req = mockReq(undefined, undefined, { id: "550e8400-e29b-41d4-a716-446655440000" });
      const middleware = validateParams(schema);
      middleware(req, mockRes(), next);

      expect(next).toHaveBeenCalled();
    });

    it("throws on invalid params", () => {
      const req = mockReq(undefined, undefined, { id: "not-a-uuid" });
      const middleware = validateParams(schema);

      expect(() => middleware(req, mockRes(), next)).toThrow();
    });
  });
});
