"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeLineItem = computeLineItem;
exports.computeInvoiceTotals = computeInvoiceTotals;
const shared_1 = require("@emp-billing/shared");
const shared_2 = require("@emp-billing/shared");
// ── Per-item calculation ─────────────────────────────────────────────────────
function computeLineItem(item, gstContext) {
    // 1. Line subtotal before discount
    const lineSubtotal = Math.round(item.quantity * item.rate);
    // 2. Discount
    let discountAmount = 0;
    if (item.discountType === shared_1.DiscountType.PERCENTAGE && item.discountValue) {
        discountAmount = Math.round(lineSubtotal * item.discountValue / 100);
    }
    else if (item.discountType === shared_1.DiscountType.FIXED && item.discountValue) {
        discountAmount = Math.min(item.discountValue, lineSubtotal);
    }
    const taxableAmount = lineSubtotal - discountAmount;
    // 3. Tax
    let taxAmount = 0;
    let taxBreakdown = [];
    if (item.taxRate > 0) {
        if (gstContext && item.taxComponents?.length) {
            const isInterState = gstContext.buyerState
                ? (0, shared_2.isInterStateGST)(gstContext.sellerState, gstContext.buyerState)
                : false;
            const gst = (0, shared_2.computeGST)(taxableAmount, item.taxRate, isInterState);
            taxAmount = gst.total;
            if (isInterState) {
                taxBreakdown = [{ name: "IGST", rate: item.taxRate, amount: gst.igst }];
            }
            else {
                const cgstRate = item.taxRate / 2;
                const sgstRate = item.taxRate / 2;
                taxBreakdown = [
                    { name: "CGST", rate: cgstRate, amount: gst.cgst },
                    { name: "SGST", rate: sgstRate, amount: gst.sgst },
                ];
            }
        }
        else {
            // Generic tax
            taxAmount = Math.round(taxableAmount * item.taxRate / 100);
            if (item.taxComponents?.length) {
                taxBreakdown = item.taxComponents.map((c) => ({
                    name: c.name,
                    rate: c.rate,
                    amount: Math.round(taxableAmount * c.rate / 100),
                }));
            }
            else {
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
function computeInvoiceTotals(computedItems, invoiceDiscountType, invoiceDiscountValue, amountPaid = 0) {
    const subtotal = computedItems.reduce((s, i) => s + i.lineSubtotal, 0);
    const itemDiscounts = computedItems.reduce((s, i) => s + i.discountAmount, 0);
    const itemTaxableSum = computedItems.reduce((s, i) => s + i.taxableAmount, 0);
    // Invoice-level discount (applied after item discounts)
    let discountAmount = 0;
    if (invoiceDiscountType === shared_1.DiscountType.PERCENTAGE && invoiceDiscountValue) {
        discountAmount = Math.round(itemTaxableSum * invoiceDiscountValue / 100);
    }
    else if (invoiceDiscountType === shared_1.DiscountType.FIXED && invoiceDiscountValue) {
        discountAmount = Math.min(invoiceDiscountValue, itemTaxableSum);
    }
    const taxAmount = computedItems.reduce((s, i) => s + i.taxAmount, 0);
    const total = itemTaxableSum - discountAmount + taxAmount;
    const amountDue = Math.max(0, total - amountPaid);
    return { subtotal, itemDiscounts, discountAmount, taxAmount, total, amountDue };
}
//# sourceMappingURL=invoice.calculator.js.map