import { describe, it, expect } from "vitest";
import { computeLineItem, computeInvoiceTotals } from "./invoice.calculator";
import { DiscountType } from "@emp-billing/shared";

// ============================================================================
// computeLineItem
// ============================================================================

describe("computeLineItem", () => {
  it("basic calculation: qty=2, rate=10000, no discount, no tax", () => {
    const result = computeLineItem({
      quantity: 2,
      rate: 10000,
      taxRate: 0,
    });

    expect(result.lineSubtotal).toBe(20000);
    expect(result.discountAmount).toBe(0);
    expect(result.taxableAmount).toBe(20000);
    expect(result.taxAmount).toBe(0);
    expect(result.amount).toBe(20000);
  });

  it("percentage discount: qty=1, rate=50000, 10% discount", () => {
    const result = computeLineItem({
      quantity: 1,
      rate: 50000,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      taxRate: 0,
    });

    expect(result.lineSubtotal).toBe(50000);
    expect(result.discountAmount).toBe(5000);
    expect(result.taxableAmount).toBe(45000);
    expect(result.amount).toBe(45000);
  });

  it("fixed discount: qty=1, rate=50000, fixed 3000 discount", () => {
    const result = computeLineItem({
      quantity: 1,
      rate: 50000,
      discountType: DiscountType.FIXED,
      discountValue: 3000,
      taxRate: 0,
    });

    expect(result.lineSubtotal).toBe(50000);
    expect(result.discountAmount).toBe(3000);
    expect(result.taxableAmount).toBe(47000);
    expect(result.amount).toBe(47000);
  });

  it("fixed discount exceeding subtotal is capped to subtotal", () => {
    const result = computeLineItem({
      quantity: 1,
      rate: 1000,
      discountType: DiscountType.FIXED,
      discountValue: 5000,
      taxRate: 0,
    });

    expect(result.lineSubtotal).toBe(1000);
    expect(result.discountAmount).toBe(1000); // capped at subtotal
    expect(result.taxableAmount).toBe(0);
    expect(result.amount).toBe(0);
  });

  it("tax calculation: qty=1, rate=100000, taxRate=18", () => {
    const result = computeLineItem({
      quantity: 1,
      rate: 100000,
      taxRate: 18,
    });

    expect(result.lineSubtotal).toBe(100000);
    expect(result.discountAmount).toBe(0);
    expect(result.taxableAmount).toBe(100000);
    expect(result.taxAmount).toBe(18000);
    expect(result.amount).toBe(118000);
  });

  it("tax with percentage discount: qty=2, rate=50000, 10% discount, 18% tax", () => {
    const result = computeLineItem({
      quantity: 2,
      rate: 50000,
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      taxRate: 18,
    });

    // lineSubtotal = 2 * 50000 = 100000
    expect(result.lineSubtotal).toBe(100000);
    // discount = 100000 * 10 / 100 = 10000
    expect(result.discountAmount).toBe(10000);
    // taxable = 100000 - 10000 = 90000
    expect(result.taxableAmount).toBe(90000);
    // tax = 90000 * 18 / 100 = 16200
    expect(result.taxAmount).toBe(16200);
    // amount = 90000 + 16200 = 106200
    expect(result.amount).toBe(106200);
  });

  it("zero quantity edge case", () => {
    const result = computeLineItem({
      quantity: 0,
      rate: 10000,
      taxRate: 18,
    });

    expect(result.lineSubtotal).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.taxableAmount).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.amount).toBe(0);
  });

  it("tax components breakdown: qty=1, rate=100000, taxRate=18 with CGST+SGST", () => {
    const result = computeLineItem({
      quantity: 1,
      rate: 100000,
      taxRate: 18,
      taxComponents: [
        { name: "CGST", rate: 9 },
        { name: "SGST", rate: 9 },
      ],
    });

    expect(result.taxAmount).toBe(18000);
    expect(result.taxBreakdown).toHaveLength(2);
    expect(result.taxBreakdown[0]).toEqual({ name: "CGST", rate: 9, amount: 9000 });
    expect(result.taxBreakdown[1]).toEqual({ name: "SGST", rate: 9, amount: 9000 });
    expect(result.amount).toBe(118000);
  });

  it("generic tax without components produces single Tax entry", () => {
    const result = computeLineItem({
      quantity: 1,
      rate: 100000,
      taxRate: 18,
    });

    expect(result.taxBreakdown).toHaveLength(1);
    expect(result.taxBreakdown[0]).toEqual({ name: "Tax", rate: 18, amount: 18000 });
  });

  it("GST context intra-state produces CGST+SGST breakdown", () => {
    const result = computeLineItem(
      {
        quantity: 1,
        rate: 100000,
        taxRate: 18,
        taxComponents: [
          { name: "CGST", rate: 9 },
          { name: "SGST", rate: 9 },
        ],
      },
      { sellerState: "27", buyerState: "27" } // same state = intra-state
    );

    expect(result.taxAmount).toBe(18000);
    expect(result.taxBreakdown).toHaveLength(2);
    expect(result.taxBreakdown[0].name).toBe("CGST");
    expect(result.taxBreakdown[1].name).toBe("SGST");
  });

  it("GST context inter-state produces IGST breakdown", () => {
    const result = computeLineItem(
      {
        quantity: 1,
        rate: 100000,
        taxRate: 18,
        taxComponents: [
          { name: "CGST", rate: 9 },
          { name: "SGST", rate: 9 },
        ],
      },
      { sellerState: "27", buyerState: "29" } // different state = inter-state
    );

    expect(result.taxAmount).toBe(18000);
    expect(result.taxBreakdown).toHaveLength(1);
    expect(result.taxBreakdown[0]).toEqual({ name: "IGST", rate: 18, amount: 18000 });
  });
});

// ============================================================================
// computeInvoiceTotals
// ============================================================================

describe("computeInvoiceTotals", () => {
  it("single item, no discounts: totals match item", () => {
    const items = [
      computeLineItem({ quantity: 2, rate: 10000, taxRate: 0 }),
    ];

    const totals = computeInvoiceTotals(items);

    expect(totals.subtotal).toBe(20000);
    expect(totals.itemDiscounts).toBe(0);
    expect(totals.discountAmount).toBe(0);
    expect(totals.taxAmount).toBe(0);
    expect(totals.total).toBe(20000);
    expect(totals.amountDue).toBe(20000);
  });

  it("multiple items sum correctly", () => {
    const items = [
      computeLineItem({ quantity: 1, rate: 10000, taxRate: 0 }),
      computeLineItem({ quantity: 3, rate: 5000, taxRate: 0 }),
    ];

    const totals = computeInvoiceTotals(items);

    expect(totals.subtotal).toBe(25000); // 10000 + 15000
    expect(totals.total).toBe(25000);
    expect(totals.amountDue).toBe(25000);
  });

  it("invoice-level percentage discount", () => {
    const items = [
      computeLineItem({ quantity: 1, rate: 100000, taxRate: 0 }),
    ];

    const totals = computeInvoiceTotals(
      items,
      DiscountType.PERCENTAGE,
      10 // 10% off
    );

    expect(totals.subtotal).toBe(100000);
    expect(totals.discountAmount).toBe(10000);
    expect(totals.total).toBe(90000);
    expect(totals.amountDue).toBe(90000);
  });

  it("invoice-level fixed discount", () => {
    const items = [
      computeLineItem({ quantity: 1, rate: 100000, taxRate: 0 }),
    ];

    const totals = computeInvoiceTotals(
      items,
      DiscountType.FIXED,
      15000
    );

    expect(totals.subtotal).toBe(100000);
    expect(totals.discountAmount).toBe(15000);
    expect(totals.total).toBe(85000);
    expect(totals.amountDue).toBe(85000);
  });

  it("with amountPaid, amountDue is reduced", () => {
    const items = [
      computeLineItem({ quantity: 1, rate: 100000, taxRate: 0 }),
    ];

    const totals = computeInvoiceTotals(items, undefined, undefined, 30000);

    expect(totals.total).toBe(100000);
    expect(totals.amountDue).toBe(70000);
  });

  it("amountDue never goes negative even if overpaid", () => {
    const items = [
      computeLineItem({ quantity: 1, rate: 10000, taxRate: 0 }),
    ];

    const totals = computeInvoiceTotals(items, undefined, undefined, 50000);

    expect(totals.total).toBe(10000);
    expect(totals.amountDue).toBe(0);
  });

  it("multiple items with item discounts and tax", () => {
    const items = [
      computeLineItem({
        quantity: 2,
        rate: 50000,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        taxRate: 18,
      }),
      computeLineItem({
        quantity: 1,
        rate: 30000,
        taxRate: 18,
      }),
    ];

    // item1: subtotal=100000, discount=10000, taxable=90000, tax=16200, amount=106200
    // item2: subtotal=30000,  discount=0,     taxable=30000, tax=5400,  amount=35400
    const totals = computeInvoiceTotals(items);

    expect(totals.subtotal).toBe(130000);          // 100000 + 30000
    expect(totals.itemDiscounts).toBe(10000);       // 10000 + 0
    expect(totals.taxAmount).toBe(21600);           // 16200 + 5400
    expect(totals.total).toBe(141600);              // (90000 + 30000) - 0 + 21600
    expect(totals.amountDue).toBe(141600);
  });

  it("invoice-level discount applied after item discounts on taxable sum", () => {
    const items = [
      computeLineItem({
        quantity: 1,
        rate: 100000,
        discountType: DiscountType.FIXED,
        discountValue: 20000,
        taxRate: 0,
      }),
    ];
    // item: subtotal=100000, discount=20000, taxable=80000

    const totals = computeInvoiceTotals(
      items,
      DiscountType.PERCENTAGE,
      10 // 10% of itemTaxableSum = 10% of 80000 = 8000
    );

    expect(totals.subtotal).toBe(100000);
    expect(totals.itemDiscounts).toBe(20000);
    expect(totals.discountAmount).toBe(8000);
    expect(totals.total).toBe(72000); // 80000 - 8000
    expect(totals.amountDue).toBe(72000);
  });
});
