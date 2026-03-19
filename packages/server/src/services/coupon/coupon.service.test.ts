import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/adapters/index", () => ({ getDB: vi.fn() }));
vi.mock("../../events/index", () => ({ emit: vi.fn() }));

import { getDB } from "../../db/adapters/index";
import {
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getRedemptions,
  applyCouponToSubscription,
  removeCouponFromSubscription,
} from "./coupon.service";
import { CouponType, CouponAppliesTo, InvoiceStatus } from "@emp-billing/shared";

const mockedGetDB = vi.mocked(getDB);
const ORG_ID = "org-100";
const USER_ID = "usr-1";

function makeMockDb() {
  return {
    findPaginated: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn().mockImplementation((_t: string, data: Record<string, unknown>) => data),
    update: vi.fn().mockImplementation((_t: string, _id: string, data: Record<string, unknown>) => data),
    raw: vi.fn(),
  };
}

function makeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: "cpn-1",
    orgId: ORG_ID,
    code: "SAVE10",
    name: "Save 10%",
    type: CouponType.PERCENTAGE,
    value: 10,
    currency: null,
    appliesTo: CouponAppliesTo.INVOICE,
    productId: null,
    maxRedemptions: null,
    maxRedemptionsPerClient: null,
    timesRedeemed: 0,
    minAmount: 0,
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    isActive: true,
    createdBy: USER_ID,
    ...overrides,
  };
}

describe("coupon.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  describe("listCoupons", () => {
    it("returns paginated coupons", async () => {
      const coupons = [makeCoupon()];
      mockDb.findPaginated.mockResolvedValue({ data: coupons, total: 1, page: 1, limit: 20, totalPages: 1 });

      const result = await listCoupons(ORG_ID, { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
    });

    it("filters by search term", async () => {
      const coupons = [
        makeCoupon({ code: "SAVE10", name: "Save 10%" }),
        makeCoupon({ code: "FLAT50", name: "Flat 50" }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: coupons, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listCoupons(ORG_ID, { page: 1, limit: 20, search: "flat" });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe("FLAT50");
    });
  });

  describe("getCoupon", () => {
    it("returns coupon by id", async () => {
      mockDb.findById.mockResolvedValue(makeCoupon());
      const result = await getCoupon(ORG_ID, "cpn-1");
      expect(result.code).toBe("SAVE10");
    });

    it("throws NotFoundError when coupon does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(getCoupon(ORG_ID, "missing")).rejects.toThrow("Coupon");
    });
  });

  describe("createCoupon", () => {
    it("creates a coupon", async () => {
      mockDb.findOne.mockResolvedValue(null);

      const result = await createCoupon(ORG_ID, USER_ID, {
        code: "NEW20",
        name: "New 20%",
        type: CouponType.PERCENTAGE,
        value: 20,
        appliesTo: CouponAppliesTo.INVOICE,
        validFrom: new Date("2026-01-01"),
      });

      expect(result.code).toBe("NEW20");
      expect(mockDb.create).toHaveBeenCalledWith("coupons", expect.objectContaining({ code: "NEW20" }));
    });

    it("throws ConflictError on duplicate code", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon());

      await expect(
        createCoupon(ORG_ID, USER_ID, {
          code: "SAVE10",
          name: "Dup",
          type: CouponType.PERCENTAGE,
          value: 10,
          appliesTo: CouponAppliesTo.INVOICE,
          validFrom: new Date("2026-01-01"),
        })
      ).rejects.toThrow("already exists");
    });

    it("throws BadRequestError for invalid percentage", async () => {
      mockDb.findOne.mockResolvedValue(null);

      await expect(
        createCoupon(ORG_ID, USER_ID, {
          code: "BAD",
          name: "Bad",
          type: CouponType.PERCENTAGE,
          value: 150,
          appliesTo: CouponAppliesTo.INVOICE,
          validFrom: new Date("2026-01-01"),
        })
      ).rejects.toThrow("Percentage value must be between 0 and 100");
    });
  });

  describe("updateCoupon", () => {
    it("updates an existing coupon", async () => {
      mockDb.findById.mockResolvedValue(makeCoupon());
      mockDb.update.mockResolvedValue(makeCoupon({ name: "Updated" }));

      const result = await updateCoupon(ORG_ID, "cpn-1", { name: "Updated" });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("throws NotFoundError when coupon does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(updateCoupon(ORG_ID, "missing", { name: "x" })).rejects.toThrow("Coupon");
    });
  });

  describe("deleteCoupon", () => {
    it("deactivates the coupon", async () => {
      mockDb.findById.mockResolvedValue(makeCoupon());
      await deleteCoupon(ORG_ID, "cpn-1");
      expect(mockDb.update).toHaveBeenCalledWith("coupons", "cpn-1", expect.objectContaining({ isActive: false }), ORG_ID);
    });

    it("throws NotFoundError when coupon does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(deleteCoupon(ORG_ID, "missing")).rejects.toThrow("Coupon");
    });
  });

  describe("validateCoupon", () => {
    it("validates a valid coupon", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon());

      const result = await validateCoupon(ORG_ID, "SAVE10", 10000);
      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(1000); // 10% of 10000
    });

    it("throws for invalid code", async () => {
      mockDb.findOne.mockResolvedValue(null);
      await expect(validateCoupon(ORG_ID, "BAD")).rejects.toThrow("Invalid coupon code");
    });

    it("throws for inactive coupon", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ isActive: false }));
      await expect(validateCoupon(ORG_ID, "SAVE10")).rejects.toThrow("no longer active");
    });

    it("throws when coupon is not yet valid", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ validFrom: new Date("2099-01-01") }));
      await expect(validateCoupon(ORG_ID, "SAVE10")).rejects.toThrow("not yet valid");
    });

    it("throws when coupon has expired", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ validUntil: new Date("2020-01-01") }));
      await expect(validateCoupon(ORG_ID, "SAVE10")).rejects.toThrow("expired");
    });

    it("throws when max redemptions reached", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ maxRedemptions: 5, timesRedeemed: 5 }));
      await expect(validateCoupon(ORG_ID, "SAVE10")).rejects.toThrow("maximum redemptions");
    });

    it("throws when minimum amount not met", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ minAmount: 5000 }));
      await expect(validateCoupon(ORG_ID, "SAVE10", 2000)).rejects.toThrow("Minimum order amount");
    });

    it("calculates fixed discount correctly", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ type: CouponType.FIXED, value: 500 }));

      const result = await validateCoupon(ORG_ID, "SAVE10", 1000);
      expect(result.discountAmount).toBe(500);
    });

    it("caps fixed discount to invoice amount", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ type: CouponType.FIXED, value: 5000 }));

      const result = await validateCoupon(ORG_ID, "SAVE10", 1000);
      expect(result.discountAmount).toBe(1000);
    });

    it("checks per-client redemption limit", async () => {
      mockDb.findOne.mockResolvedValue(makeCoupon({ maxRedemptionsPerClient: 1 }));
      mockDb.raw.mockResolvedValue([{ count: 1 }]);

      await expect(validateCoupon(ORG_ID, "SAVE10", 10000, "client-1")).rejects.toThrow("maximum number of times");
    });
  });

  describe("applyCoupon", () => {
    it("applies coupon to invoice and creates redemption", async () => {
      const invoice = {
        id: "inv-1",
        orgId: ORG_ID,
        total: 10000,
        discountAmount: 0,
        amountPaid: 0,
        status: InvoiceStatus.SENT,
      };
      mockDb.findById.mockResolvedValue(invoice);
      mockDb.findOne.mockResolvedValue(makeCoupon());

      const result = await applyCoupon(ORG_ID, "SAVE10", "inv-1", "client-1");

      expect(result.discountAmount).toBe(1000);
      expect(mockDb.create).toHaveBeenCalledWith("coupon_redemptions", expect.objectContaining({
        couponId: "cpn-1",
        invoiceId: "inv-1",
      }));
    });

    it("throws for void invoice", async () => {
      mockDb.findById.mockResolvedValue({ id: "inv-1", status: InvoiceStatus.VOID, total: 10000, discountAmount: 0, amountPaid: 0 });

      await expect(applyCoupon(ORG_ID, "SAVE10", "inv-1", "client-1")).rejects.toThrow("Cannot apply coupon");
    });
  });

  describe("getRedemptions", () => {
    it("returns redemptions for a coupon", async () => {
      mockDb.findById.mockResolvedValue(makeCoupon());
      mockDb.findMany.mockResolvedValue([{ id: "r-1" }]);

      const result = await getRedemptions(ORG_ID, "cpn-1");
      expect(result).toHaveLength(1);
    });

    it("throws when coupon not found", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(getRedemptions(ORG_ID, "missing")).rejects.toThrow("Coupon");
    });
  });

  describe("removeCouponFromSubscription", () => {
    it("removes coupon from subscription", async () => {
      mockDb.findById.mockResolvedValue({ id: "sub-1", couponId: "cpn-1" });

      await removeCouponFromSubscription(ORG_ID, "sub-1");

      expect(mockDb.update).toHaveBeenCalledWith("subscriptions", "sub-1", expect.objectContaining({ couponId: null }), ORG_ID);
    });

    it("throws when subscription not found", async () => {
      mockDb.findById.mockResolvedValue(null);
      await expect(removeCouponFromSubscription(ORG_ID, "missing")).rejects.toThrow("Subscription");
    });

    it("throws when no coupon applied", async () => {
      mockDb.findById.mockResolvedValue({ id: "sub-1", couponId: null });
      await expect(removeCouponFromSubscription(ORG_ID, "sub-1")).rejects.toThrow("no coupon applied");
    });
  });
});
