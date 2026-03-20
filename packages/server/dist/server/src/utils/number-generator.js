"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextInvoiceNumber = nextInvoiceNumber;
exports.nextQuoteNumber = nextQuoteNumber;
const index_1 = require("../db/adapters/index");
// ============================================================================
// DOCUMENT NUMBER GENERATOR
// Atomically increments org counter and returns a formatted number.
// Format: {PREFIX}-{YYYY}-{NNN:04}  e.g. INV-2026-0001
// ============================================================================
async function nextInvoiceNumber(orgId) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw new Error("Organization not found");
    const seq = await db.increment("organizations", orgId, "invoice_next_number");
    const year = new Date().getFullYear();
    return `${org.invoicePrefix}-${year}-${String(seq - 1).padStart(4, "0")}`;
}
async function nextQuoteNumber(orgId) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw new Error("Organization not found");
    const seq = await db.increment("organizations", orgId, "quote_next_number");
    const year = new Date().getFullYear();
    return `${org.quotePrefix}-${year}-${String(seq - 1).padStart(4, "0")}`;
}
//# sourceMappingURL=number-generator.js.map