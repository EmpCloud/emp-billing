import { DiscountType } from "@emp-billing/shared";
import { computeGST, isInterStateGST } from "@emp-billing/shared";

// ============================================================================
// INVOICE CALCULATOR
// All monetary values are in smallest unit (paise / cents).
// Quantities are decimals (e.g. 2.5 hours).
// ============================================================================

export interface RawLineItem {
  quantity: number;
  rate: number;                        // in smallest unit
  discountType?: DiscountType;
  discountValue?: number;              // percent or fixed smallest unit
  taxRate: number;                     // percent e.g. 18
  taxComponents?: { name: string; rate: number }[];
}

export interface ComputedLineItem extends RawLineItem {
  lineSubtotal: number;                // qty × rate
  discountAmount: number;              // computed discount (smallest unit)
  taxableAmount: number;               // lineSubtotal - discountAmount
  taxAmount: number;                   // computed tax (smallest unit)
  taxBreakdown: { name: string; rate: number; amount: number }[];
  amount: number;                      // taxableAmount + taxAmount
}

export interface InvoiceTotals {
  subtotal: number;        // sum of (qty × rate) for all items
  itemDiscounts: number;   // sum of per-item discounts
  discountAmount: number;  // invoice-level discount
  taxAmount: number;       // total tax
  total: number;           // grand total
  amountDue: number;       // total - amountPaid
}

// ── Per-item calculation ─────────────────────────────────────────────────────

export function computeLineItem(item: RawLineItem, gstContext?: { sellerState: string; buyerState?: string }): ComputedLineItem {
  // 1. Line subtotal before discount
  const lineSubtotal = Math.round(item.quantity * item.rate);

  // 2. Discount
  let discountAmount = 0;
  if (item.discountType === DiscountType.PERCENTAGE && item.discountValue) {
    discountAmount = Math.round(lineSubtotal * item.discountValue / 100);
  } else if (item.discountType === DiscountType.FIXED && item.discountValue) {
    discountAmount = Math.min(item.discountValue, lineSubtotal);
  }

  const taxableAmount = lineSubtotal - discountAmount;

  // 3. Tax
  let taxAmount = 0;
  let taxBreakdown: { name: string; rate: number; amount: number }[] = [];

  if (item.taxRate > 0) {
    if (gstContext && item.taxComponents?.length) {
      const isInterState = gstContext.buyerState
        ? isInterStateGST(gstContext.sellerState, gstContext.buyerState)
        : false;

      const gst = computeGST(taxableAmount, item.taxRate, isInterState);
      taxAmount = gst.total;

      if (isInterState) {
        taxBreakdown = [{ name: "IGST", rate: item.taxRate, amount: gst.igst }];
      } else {
        const cgstRate = item.taxRate / 2;
        const sgstRate = item.taxRate / 2;
        taxBreakdown = [
          { name: "CGST", rate: cgstRate, amount: gst.cgst },
          { name: "SGST", rate: sgstRate, amount: gst.sgst },
        ];
      }
    } else {
      // Generic tax
      taxAmount = Math.round(taxableAmount * item.taxRate / 100);
      if (item.taxComponents?.length) {
        taxBreakdown = item.taxComponents.map((c) => ({
          name: c.name,
          rate: c.rate,
          amount: Math.round(taxableAmount * c.rate / 100),
        }));
      } else {
        taxBreakdown = [{ name: "Tax", rate: item.taxRate, amount: taxAmount }];
      }
    }
  }

  return {
    ...item,
    lineSubtotal,
    discountAmount,
    taxableAmount,
    taxAmount,
    taxBreakdown,
    amount: taxableAmount + taxAmount,
  };
}

// ── Invoice-level totals ─────────────────────────────────────────────────────

export function computeInvoiceTotals(
  computedItems: ComputedLineItem[],
  invoiceDiscountType?: DiscountType,
  invoiceDiscountValue?: number,
  amountPaid = 0
): InvoiceTotals {
  const subtotal = computedItems.reduce((s, i) => s + i.lineSubtotal, 0);
  const itemDiscounts = computedItems.reduce((s, i) => s + i.discountAmount, 0);
  const itemTaxableSum = computedItems.reduce((s, i) => s + i.taxableAmount, 0);

  // Invoice-level discount (applied after item discounts)
  let discountAmount = 0;
  if (invoiceDiscountType === DiscountType.PERCENTAGE && invoiceDiscountValue) {
    discountAmount = Math.round(itemTaxableSum * invoiceDiscountValue / 100);
  } else if (invoiceDiscountType === DiscountType.FIXED && invoiceDiscountValue) {
    discountAmount = Math.min(invoiceDiscountValue, itemTaxableSum);
  }

  const taxAmount = computedItems.reduce((s, i) => s + i.taxAmount, 0);
  const total = itemTaxableSum - discountAmount + taxAmount;
  const amountDue = Math.max(0, total - amountPaid);

  return { subtotal, itemDiscounts, discountAmount, taxAmount, total, amountDue };
}
