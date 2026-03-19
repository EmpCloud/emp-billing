import { describe, it, expect } from "vitest";
import { formatMoney, toSmallestUnit, fromSmallestUnit, PAYMENT_TERMS, CURRENCIES } from "./billing";

// ============================================================================
// formatMoney
// ============================================================================

describe("formatMoney", () => {
  it("formats INR correctly", () => {
    const result = formatMoney(10050, "INR");
    // 10050 paise = 100.50 INR
    expect(result).toContain("100.50");
    expect(result).toContain("\u20B9"); // ₹ symbol
  });

  it("formats USD correctly", () => {
    const result = formatMoney(2599, "USD");
    // 2599 cents = 25.99 USD
    expect(result).toContain("25.99");
    expect(result).toContain("$");
  });

  it("formats zero amount", () => {
    const result = formatMoney(0, "INR");
    expect(result).toContain("0.00");
  });

  it("formats large INR amounts with locale grouping", () => {
    // 1,00,000.00 INR = 10000000 paise
    const result = formatMoney(10000000, "INR");
    // en-IN locale uses lakhs grouping: 1,00,000.00
    expect(result).toContain("1,00,000.00");
  });

  it("formats JPY with zero decimals", () => {
    const result = formatMoney(500, "JPY");
    // JPY has 0 decimals, so 500 smallest unit = 500 yen
    expect(result).toContain("500");
    expect(result).toContain("\u00A5"); // ¥ symbol
  });

  it("falls back to INR for unknown currency", () => {
    const result = formatMoney(10000, "XYZ");
    // Should use INR as fallback
    expect(result).toContain("100.00");
  });
});

// ============================================================================
// toSmallestUnit
// ============================================================================

describe("toSmallestUnit", () => {
  it("converts 100.50 INR to 10050 paise", () => {
    expect(toSmallestUnit(100.50, "INR")).toBe(10050);
  });

  it("converts 25.99 USD to 2599 cents", () => {
    expect(toSmallestUnit(25.99, "USD")).toBe(2599);
  });

  it("converts whole number", () => {
    expect(toSmallestUnit(100, "INR")).toBe(10000);
  });

  it("rounds to nearest integer", () => {
    // 10.005 * 100 = 1000.5 -> rounds to 1001
    expect(toSmallestUnit(10.005, "INR")).toBe(1001);
  });

  it("handles zero", () => {
    expect(toSmallestUnit(0, "USD")).toBe(0);
  });

  it("handles JPY (0 decimals) correctly", () => {
    // JPY has no fractional units: 500 yen stays 500
    expect(toSmallestUnit(500, "JPY")).toBe(500);
  });

  it("falls back to INR for unknown currency", () => {
    expect(toSmallestUnit(100, "XYZ")).toBe(10000);
  });
});

// ============================================================================
// fromSmallestUnit
// ============================================================================

describe("fromSmallestUnit", () => {
  it("converts 10050 paise to 100.50 INR", () => {
    expect(fromSmallestUnit(10050, "INR")).toBe(100.50);
  });

  it("converts 2599 cents to 25.99 USD", () => {
    expect(fromSmallestUnit(2599, "USD")).toBe(25.99);
  });

  it("converts zero", () => {
    expect(fromSmallestUnit(0, "INR")).toBe(0);
  });

  it("handles JPY (0 decimals) correctly", () => {
    expect(fromSmallestUnit(500, "JPY")).toBe(500);
  });

  it("falls back to INR for unknown currency", () => {
    expect(fromSmallestUnit(10000, "XYZ")).toBe(100);
  });

  it("round-trips with toSmallestUnit", () => {
    const original = 123.45;
    const smallest = toSmallestUnit(original, "INR");
    const backToOriginal = fromSmallestUnit(smallest, "INR");
    expect(backToOriginal).toBe(original);
  });
});

// ============================================================================
// PAYMENT_TERMS
// ============================================================================

describe("PAYMENT_TERMS", () => {
  it("contains Due on receipt", () => {
    const entry = PAYMENT_TERMS.find((t) => t.days === 0);
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Due on receipt");
  });

  it("contains Net 15", () => {
    const entry = PAYMENT_TERMS.find((t) => t.days === 15);
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Net 15");
  });

  it("contains Net 30", () => {
    const entry = PAYMENT_TERMS.find((t) => t.days === 30);
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Net 30");
  });

  it("contains Net 60", () => {
    const entry = PAYMENT_TERMS.find((t) => t.days === 60);
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Net 60");
  });

  it("contains Net 90", () => {
    const entry = PAYMENT_TERMS.find((t) => t.days === 90);
    expect(entry).toBeDefined();
    expect(entry!.label).toBe("Net 90");
  });

  it("has 7 entries total", () => {
    expect(PAYMENT_TERMS).toHaveLength(7);
  });

  it("days values are sorted in ascending order", () => {
    for (let i = 1; i < PAYMENT_TERMS.length; i++) {
      expect(PAYMENT_TERMS[i].days).toBeGreaterThan(PAYMENT_TERMS[i - 1].days);
    }
  });
});

// ============================================================================
// CURRENCIES
// ============================================================================

describe("CURRENCIES", () => {
  it("has INR", () => {
    expect(CURRENCIES.INR).toBeDefined();
    expect(CURRENCIES.INR.symbol).toBe("\u20B9"); // ₹
    expect(CURRENCIES.INR.decimals).toBe(2);
  });

  it("has USD", () => {
    expect(CURRENCIES.USD).toBeDefined();
    expect(CURRENCIES.USD.symbol).toBe("$");
    expect(CURRENCIES.USD.decimals).toBe(2);
  });

  it("has EUR", () => {
    expect(CURRENCIES.EUR).toBeDefined();
    expect(CURRENCIES.EUR.symbol).toBe("\u20AC"); // €
    expect(CURRENCIES.EUR.decimals).toBe(2);
  });

  it("has GBP", () => {
    expect(CURRENCIES.GBP).toBeDefined();
    expect(CURRENCIES.GBP.symbol).toBe("\u00A3"); // £
    expect(CURRENCIES.GBP.decimals).toBe(2);
  });

  it("has JPY with 0 decimals", () => {
    expect(CURRENCIES.JPY).toBeDefined();
    expect(CURRENCIES.JPY.decimals).toBe(0);
  });

  it("has AED", () => {
    expect(CURRENCIES.AED).toBeDefined();
  });

  it("each currency has required fields", () => {
    for (const [key, currency] of Object.entries(CURRENCIES)) {
      expect(currency.code).toBe(key);
      expect(currency.symbol).toBeDefined();
      expect(currency.name).toBeDefined();
      expect(typeof currency.decimals).toBe("number");
    }
  });
});
