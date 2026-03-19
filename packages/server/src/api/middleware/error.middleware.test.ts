import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError, z } from "zod";

vi.mock("../../utils/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

import { errorMiddleware, asyncHandler } from "./error.middleware";
import { AppError } from "../../utils/AppError";

function mockReq() {
  return {} as any;
}

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const next = vi.fn();

describe("error.middleware", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("errorMiddleware", () => {
    it("handles ZodError with 422", () => {
      const schema = z.object({ name: z.string() });
      let zodErr: ZodError | undefined;
      try {
        schema.parse({ name: 123 });
      } catch (e) {
        zodErr = e as ZodError;
      }

      const res = mockRes();
      errorMiddleware(zodErr!, mockReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
        }),
      }));
    });

    it("handles AppError with correct status code", () => {
      const err = new AppError(404, "NOT_FOUND", "Resource not found");
      const res = mockRes();
      errorMiddleware(err, mockReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "NOT_FOUND",
          message: "Resource not found",
        }),
      }));
    });

    it("handles AppError with details", () => {
      const err = new AppError(400, "BAD_REQUEST", "Oops", { field: "email" });
      const res = mockRes();
      errorMiddleware(err, mockReq(), res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          details: { field: "email" },
        }),
      }));
    });

    it("handles unknown errors with 500", () => {
      const res = mockRes();
      errorMiddleware(new Error("boom"), mockReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({
          code: "INTERNAL_ERROR",
        }),
      }));
    });

    it("handles non-Error objects with 500", () => {
      const res = mockRes();
      errorMiddleware("string error", mockReq(), res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("asyncHandler", () => {
    it("calls next with error on rejection", async () => {
      const err = new Error("async fail");
      const handler = asyncHandler(async () => {
        throw err;
      });

      const res = mockRes();
      handler(mockReq(), res, next);

      // Wait for the microtask
      await new Promise((r) => setTimeout(r, 10));

      expect(next).toHaveBeenCalledWith(err);
    });

    it("does not call next on success", async () => {
      const handler = asyncHandler(async (_req, res) => {
        res.json({ ok: true });
      });

      const res = mockRes();
      handler(mockReq(), res, next);

      await new Promise((r) => setTimeout(r, 10));

      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
