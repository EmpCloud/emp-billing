import { getDB } from "../db/adapters/index";

// ============================================================================
// DOCUMENT NUMBER GENERATOR
// Atomically increments org counter and returns a formatted number.
// Format: {PREFIX}-{YYYY}-{NNN:04}  e.g. INV-2026-0001
// ============================================================================

export async function nextInvoiceNumber(orgId: string): Promise<string> {
  const db = await getDB();
  const org = await db.findById<{ invoicePrefix: string; invoiceNextNumber: number }>("organizations", orgId);
  if (!org) throw new Error("Organization not found");

  const seq = await db.increment("organizations", orgId, "invoice_next_number");
  const year = new Date().getFullYear();
  return `${org.invoicePrefix}-${year}-${String(seq - 1).padStart(4, "0")}`;
}

export async function nextQuoteNumber(orgId: string): Promise<string> {
  const db = await getDB();
  const org = await db.findById<{ quotePrefix: string; quoteNextNumber: number }>("organizations", orgId);
  if (!org) throw new Error("Organization not found");

  const seq = await db.increment("organizations", orgId, "quote_next_number");
  const year = new Date().getFullYear();
  return `${org.quotePrefix}-${year}-${String(seq - 1).padStart(4, "0")}`;
}
