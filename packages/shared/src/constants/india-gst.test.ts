import { describe, it, expect } from "vitest";
import { computeGST, isInterStateGST, extractStateFromGSTIN, GST_RATES } from "./india-gst";

// ============================================================================
// computeGST
// ============================================================================

describe("computeGST", () => {
  it("intra-state: returns CGST + SGST, no IGST", () => {
    const result = computeGST(100000, 18, false);

    expect(result.igst).toBe(0);
    expect(result.cgst).toBe(9000);
    expect(result.sgst).toBe(9000);
    expect(result.total).toBe(18000);
  });

  it("inter-state: returns IGST only, no CGST/SGST", () => {
    const result = computeGST(100000, 18, true);

    expect(result.igst).toBe(18000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.total).toBe(18000);
  });

  it("5% rate intra-state", () => {
    const result = computeGST(100000, 5, false);

    expect(result.total).toBe(5000);
    expect(result.cgst).toBe(2500);
    expect(result.sgst).toBe(2500);
    expect(result.igst).toBe(0);
  });

  it("5% rate inter-state", () => {
    const result = computeGST(100000, 5, true);

    expect(result.total).toBe(5000);
    expect(result.igst).toBe(5000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });

  it("12% rate intra-state", () => {
    const result = computeGST(100000, 12, false);

    expect(result.total).toBe(12000);
    expect(result.cgst).toBe(6000);
    expect(result.sgst).toBe(6000);
  });

  it("12% rate inter-state", () => {
    const result = computeGST(100000, 12, true);

    expect(result.total).toBe(12000);
    expect(result.igst).toBe(12000);
  });

  it("28% rate intra-state", () => {
    const result = computeGST(100000, 28, false);

    expect(result.total).toBe(28000);
    expect(result.cgst).toBe(14000);
    expect(result.sgst).toBe(14000);
  });

  it("28% rate inter-state", () => {
    const result = computeGST(100000, 28, true);

    expect(result.total).toBe(28000);
    expect(result.igst).toBe(28000);
  });

  it("returns rounded integers for odd amounts", () => {
    // 333 * 18 / 100 = 59.94 -> rounds to 60
    const result = computeGST(333, 18, true);
    expect(result.total).toBe(60);
    expect(result.igst).toBe(60);
    expect(Number.isInteger(result.total)).toBe(true);
  });

  it("intra-state split rounds correctly for odd tax amounts", () => {
    // 333 * 18 / 100 = 59.94 -> rounds to 60
    // half = round(60 / 2) = 30
    // sgst = 60 - 30 = 30
    const result = computeGST(333, 18, false);
    expect(result.total).toBe(60);
    expect(result.cgst + result.sgst).toBe(result.total);
    expect(Number.isInteger(result.cgst)).toBe(true);
    expect(Number.isInteger(result.sgst)).toBe(true);
  });

  it("zero amount returns all zeros", () => {
    const result = computeGST(0, 18, false);

    expect(result.total).toBe(0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(0);
  });

  it("0% rate returns all zeros", () => {
    const result = computeGST(100000, 0, false);

    expect(result.total).toBe(0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });
});

// ============================================================================
// isInterStateGST
// ============================================================================

describe("isInterStateGST", () => {
  it("returns false for same state", () => {
    expect(isInterStateGST("27", "27")).toBe(false);
  });

  it("returns true for different states", () => {
    expect(isInterStateGST("27", "29")).toBe(true); // Maharashtra -> Karnataka
  });

  it("returns false for identical state codes", () => {
    expect(isInterStateGST("07", "07")).toBe(false); // Delhi -> Delhi
  });

  it("returns true for any two different codes", () => {
    expect(isInterStateGST("33", "07")).toBe(true); // Tamil Nadu -> Delhi
  });
});

// ============================================================================
// extractStateFromGSTIN
// ============================================================================

describe("extractStateFromGSTIN", () => {
  it("extracts state code from standard GSTIN", () => {
    // GSTIN format: 2-digit state code + 10 char PAN + 1 entity + 1 check
    expect(extractStateFromGSTIN("27AADCB2230M1ZT")).toBe("27"); // Maharashtra
  });

  it("extracts 07 for Delhi", () => {
    expect(extractStateFromGSTIN("07AAACH7409R1ZZ")).toBe("07");
  });

  it("extracts 29 for Karnataka", () => {
    expect(extractStateFromGSTIN("29AADCB2230M1ZT")).toBe("29");
  });

  it("extracts first two characters regardless of format", () => {
    expect(extractStateFromGSTIN("33XXXXX")).toBe("33");
  });
});

// ============================================================================
// GST_RATES
// ============================================================================

describe("GST_RATES", () => {
  it("contains all standard GST slabs", () => {
    expect(GST_RATES).toContain(0);
    expect(GST_RATES).toContain(5);
    expect(GST_RATES).toContain(12);
    expect(GST_RATES).toContain(18);
    expect(GST_RATES).toContain(28);
  });

  it("has exactly 5 standard rates", () => {
    expect(GST_RATES).toHaveLength(5);
  });
});
