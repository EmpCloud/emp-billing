import { describe, it, expect } from "vitest";
import {
  UAE_VAT_RATE,
  UAEVATCategory,
  UAE_ZERO_RATED_CATEGORIES,
  UAE_EXEMPT_CATEGORIES,
  UAE_EXCISE_TAX_RATES,
  UAE_CORPORATE_TAX_THRESHOLD,
  UAE_EMIRATES,
  isValidTRN,
  formatTRN,
  computeUAEVAT,
  computeExciseTax,
  computeCorporateTax,
  isUAEReverseChargeApplicable,
} from "./uae-tax";

describe("UAE Tax", () => {
  // ── Constants ─────────────────────────────────────────────────────────────

  describe("constants", () => {
    it("UAE VAT rate is 5%", () => {
      expect(UAE_VAT_RATE).toBe(5);
    });

    it("has zero-rated categories", () => {
      expect(UAE_ZERO_RATED_CATEGORIES).toContain("export_goods");
      expect(UAE_ZERO_RATED_CATEGORIES).toContain("healthcare_services");
    });

    it("has exempt categories", () => {
      expect(UAE_EXEMPT_CATEGORIES).toContain("bare_land");
      expect(UAE_EXEMPT_CATEGORIES).toContain("local_passenger_transport");
    });

    it("has all 7 emirates", () => {
      expect(Object.keys(UAE_EMIRATES)).toHaveLength(7);
      expect(UAE_EMIRATES.DXB).toBe("Dubai");
      expect(UAE_EMIRATES.AUH).toBe("Abu Dhabi");
    });

    it("has excise tax rates", () => {
      const tobacco = UAE_EXCISE_TAX_RATES.find((e) => e.category === "tobacco_products");
      expect(tobacco?.rate).toBe(100);
      const carbonated = UAE_EXCISE_TAX_RATES.find((e) => e.category === "carbonated_drinks");
      expect(carbonated?.rate).toBe(50);
    });
  });

  // ── TRN Validation ────────────────────────────────────────────────────────

  describe("isValidTRN", () => {
    it("validates a correct 15-digit TRN starting with 100", () => {
      expect(isValidTRN("100234567890123")).toBe(true);
    });

    it("accepts TRN with dashes/spaces", () => {
      expect(isValidTRN("100-2345-6789012-3")).toBe(true);
      expect(isValidTRN("100 2345 6789012 3")).toBe(true);
    });

    it("rejects TRN not starting with 100", () => {
      expect(isValidTRN("200234567890123")).toBe(false);
    });

    it("rejects TRN with wrong length", () => {
      expect(isValidTRN("10023456789012")).toBe(false); // 14 digits
      expect(isValidTRN("1002345678901234")).toBe(false); // 16 digits
    });

    it("rejects TRN with letters", () => {
      expect(isValidTRN("100ABCDEFGHIJ12")).toBe(false);
    });
  });

  describe("formatTRN", () => {
    it("formats a valid TRN", () => {
      expect(formatTRN("100234567890123")).toBe("100-2345-6789012-3");
    });

    it("throws on invalid TRN", () => {
      expect(() => formatTRN("invalid")).toThrow("Invalid UAE TRN");
    });
  });

  // ── VAT Computation ───────────────────────────────────────────────────────

  describe("computeUAEVAT", () => {
    it("computes standard VAT (exclusive)", () => {
      // 10000 fils (100 AED) at 5%
      const result = computeUAEVAT(10000, UAEVATCategory.STANDARD, false);
      expect(result.netAmount).toBe(10000);
      expect(result.vatAmount).toBe(500);
      expect(result.grossAmount).toBe(10500);
      expect(result.vatRate).toBe(5);
      expect(result.vatCategory).toBe(UAEVATCategory.STANDARD);
    });

    it("computes standard VAT (inclusive)", () => {
      // 10500 fils gross at 5%
      const result = computeUAEVAT(10500, UAEVATCategory.STANDARD, true);
      expect(result.grossAmount).toBe(10500);
      expect(result.netAmount).toBe(10000);
      expect(result.vatAmount).toBe(500);
    });

    it("defaults to standard category", () => {
      const result = computeUAEVAT(10000);
      expect(result.vatAmount).toBe(500);
    });

    it("zero-rated returns zero VAT", () => {
      const result = computeUAEVAT(10000, UAEVATCategory.ZERO_RATED);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(10000);
      expect(result.vatCategory).toBe(UAEVATCategory.ZERO_RATED);
    });

    it("exempt returns zero VAT", () => {
      const result = computeUAEVAT(10000, UAEVATCategory.EXEMPT);
      expect(result.vatAmount).toBe(0);
      expect(result.grossAmount).toBe(10000);
    });

    it("handles rounding correctly", () => {
      // 999 fils at 5% = 49.95 → rounds to 50
      const result = computeUAEVAT(999, UAEVATCategory.STANDARD);
      expect(result.vatAmount).toBe(50);
      expect(result.grossAmount).toBe(1049);
    });
  });

  // ── Excise Tax ────────────────────────────────────────────────────────────

  describe("computeExciseTax", () => {
    it("computes 100% excise for tobacco", () => {
      const result = computeExciseTax(5000, "tobacco_products");
      expect(result.exciseAmount).toBe(5000);
      expect(result.totalAmount).toBe(10000);
      expect(result.exciseRate).toBe(100);
    });

    it("computes 50% excise for carbonated drinks", () => {
      const result = computeExciseTax(2000, "carbonated_drinks");
      expect(result.exciseAmount).toBe(1000);
      expect(result.totalAmount).toBe(3000);
      expect(result.exciseRate).toBe(50);
    });

    it("returns 0 excise for non-excisable category", () => {
      const result = computeExciseTax(5000, "office_supplies");
      expect(result.exciseAmount).toBe(0);
      expect(result.totalAmount).toBe(5000);
      expect(result.exciseRate).toBe(0);
    });
  });

  // ── Corporate Tax ─────────────────────────────────────────────────────────

  describe("computeCorporateTax", () => {
    it("returns 0 tax for income below threshold", () => {
      const result = computeCorporateTax(UAE_CORPORATE_TAX_THRESHOLD);
      expect(result.taxAmount).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });

    it("taxes at 9% above the threshold", () => {
      // AED 500,000 = 50,000,000 fils; threshold = 37,500,000 fils
      const income = 50_000_000;
      const result = computeCorporateTax(income);
      const expectedTax = Math.round(((income - UAE_CORPORATE_TAX_THRESHOLD) * 9) / 100);
      expect(result.taxAmount).toBe(expectedTax);
      expect(result.effectiveRate).toBeGreaterThan(0);
      expect(result.effectiveRate).toBeLessThan(9);
    });

    it("returns 0 for zero or negative income", () => {
      expect(computeCorporateTax(0).taxAmount).toBe(0);
      expect(computeCorporateTax(-1000).taxAmount).toBe(0);
    });

    it("applies 15% for large MNCs", () => {
      const income = 50_000_000;
      const result = computeCorporateTax(income, true);
      expect(result.taxAmount).toBe(Math.round((income * 15) / 100));
      expect(result.effectiveRate).toBe(15);
    });
  });

  // ── Reverse Charge ────────────────────────────────────────────────────────

  describe("isUAEReverseChargeApplicable", () => {
    it("applies when importing services from outside UAE", () => {
      expect(isUAEReverseChargeApplicable("US", true)).toBe(true);
      expect(isUAEReverseChargeApplicable("IN", true)).toBe(true);
    });

    it("does not apply for domestic suppliers", () => {
      expect(isUAEReverseChargeApplicable("AE", true)).toBe(false);
    });

    it("does not apply for goods import (not service)", () => {
      expect(isUAEReverseChargeApplicable("US", false)).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(isUAEReverseChargeApplicable("ae", true)).toBe(false);
    });
  });
});
