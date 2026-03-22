import { getDB } from "../../db/adapters/index";
import { InvoiceStatus, INDIAN_STATES, extractStateFromGSTIN } from "@emp-billing/shared";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

// ============================================================================
// GSTR-1 EXPORT SERVICE
// Generates GSTR-1 structured data for Indian GST filing.
// ============================================================================

// ── Types ───────────────────────────────────────────────────────────────────

/** B2B invoice record — Table 4 */
export interface GSTR1B2BInvoice {
  recipientGstin: string;
  recipientName: string;
  invoiceNumber: string;
  invoiceDate: string; // dd-mm-yyyy
  invoiceValue: number; // total invoice value in rupees
  placeOfSupply: string; // state code
  placeOfSupplyName: string;
  reverseCharge: boolean;
  invoiceType: "Regular" | "SEZ with payment" | "SEZ without payment" | "Deemed Exp";
  items: GSTR1RateItem[];
}

/** Rate-wise breakup within an invoice */
export interface GSTR1RateItem {
  rate: number;
  taxableValue: number; // in rupees
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

/** B2B grouped by recipient GSTIN — as expected by GST portal */
export interface GSTR1B2BEntry {
  recipientGstin: string;
  recipientName: string;
  invoices: GSTR1B2BInvoice[];
}

/** B2C Large (>2.5L interstate) — Table 5 */
export interface GSTR1B2CLEntry {
  placeOfSupply: string;
  placeOfSupplyName: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number;
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cessAmount: number;
}

/** B2C Small (others) — Table 7 */
export interface GSTR1B2CSEntry {
  placeOfSupply: string;
  placeOfSupplyName: string;
  taxType: "IGST" | "CGST/SGST";
  rate: number;
  taxableValue: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
}

/** Credit/Debit Notes — Table 9 */
export interface GSTR1CDNEntry {
  recipientGstin: string;
  recipientName: string;
  noteNumber: string;
  noteDate: string;
  noteType: "C" | "D"; // credit or debit
  originalInvoiceNumber: string;
  originalInvoiceDate: string;
  noteValue: number;
  items: GSTR1RateItem[];
}

/** HSN Summary — Table 12 */
export interface GSTR1HSNEntry {
  hsnCode: string;
  description: string;
  uqc: string; // unit quantity code
  quantity: number;
  taxableValue: number;
  rate: number;
  igstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  cessAmount: number;
  totalValue: number;
}

/** Document Summary — Table 13 */
export interface GSTR1DocSummaryEntry {
  documentType: string;
  fromNumber: string;
  toNumber: string;
  totalIssued: number;
  totalCancelled: number;
  netIssued: number;
}

/** Complete GSTR-1 data structure */
export interface GSTR1Data {
  period: string; // MMYYYY
  gstin: string;
  orgName: string;
  b2b: GSTR1B2BEntry[];
  b2cl: GSTR1B2CLEntry[];
  b2cs: GSTR1B2CSEntry[];
  cdnr: GSTR1CDNEntry[];
  hsn: GSTR1HSNEntry[];
  docs: GSTR1DocSummaryEntry[];
  summary: {
    totalTaxableValue: number;
    totalIgst: number;
    totalCgst: number;
    totalSgst: number;
    totalCess: number;
    totalTax: number;
    totalInvoiceValue: number;
    b2bCount: number;
    b2clCount: number;
    b2csCount: number;
    cdnrCount: number;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

/** B2C Large threshold — invoices above 2.5 lakh interstate to unregistered */
const B2CL_THRESHOLD_PAISE = 25000000; // 2,50,000 INR in paise

// ── Helper: Convert paise to rupees ──────────────────────────────────────────

function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function getStateName(stateCode: string): string {
  return INDIAN_STATES[stateCode] ?? `State ${stateCode}`;
}

// ── Main GSTR-1 Generation ────────────────────────────────────────────────

/**
 * Generate GSTR-1 data for a given period (YYYY-MM).
 * Fetches invoices and credit notes from the DB, classifies them into
 * B2B, B2CL, B2CS, CDNR, HSN, and Document Summary sections.
 */
export async function generateGSTR1(orgId: string, period: string): Promise<GSTR1Data> {
  const db = await getDB();

  // Validate period format YYYY-MM
  const periodMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (!periodMatch) {
    throw new AppError(400, "INVALID_PERIOD", "Period must be in YYYY-MM format");
  }

  const [, yearStr, monthStr] = periodMatch;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Period start/end dates
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // GST period format: MMYYYY
  const gstPeriod = `${monthStr}${yearStr}`;

  // Load org details for GSTIN and state code
  const org = await db.findOne("organizations", { id: orgId });
  if (!org) throw new AppError(404, "NOT_FOUND", "Organization not found");
  const orgData = org as Record<string, unknown>;

  const orgGstin = String(orgData.gstin ?? orgData.tax_id ?? "");
  const orgStateCode = orgGstin.length >= 2 ? extractStateFromGSTIN(orgGstin) : String(orgData.state_code ?? "");
  const orgName = String(orgData.legal_name ?? orgData.name ?? "");

  if (!orgGstin) {
    throw new AppError(400, "GSTIN_REQUIRED", "Organization GSTIN is required for GSTR-1 generation");
  }

  // Eligible invoice statuses
  const eligibleStatuses = [
    InvoiceStatus.SENT,
    InvoiceStatus.VIEWED,
    InvoiceStatus.PARTIALLY_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
  ];

  // Fetch invoices for the period
  const invoices = await db.raw<Record<string, unknown>[]>(
    `SELECT i.*, c.name as client_name, c.tax_id as client_gstin,
            c.billing_address as client_billing_address,
            c.state as client_state, c.state_code as client_state_code
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.org_id = ?
       AND i.issue_date >= ?
       AND i.issue_date <= ?
       AND i.status IN (${eligibleStatuses.map(() => "?").join(",")})
     ORDER BY i.invoice_number ASC`,
    [orgId, periodStart, periodEnd, ...eligibleStatuses]
  );

  // Fetch all invoice items for these invoices in one query
  const invoiceIds = invoices.map((i) => String(i.id));
  let allItems: Record<string, unknown>[] = [];
  if (invoiceIds.length > 0) {
    allItems = await db.raw<Record<string, unknown>[]>(
      `SELECT ii.*, p.hsn_code as product_hsn_code, p.name as product_name,
              p.type as product_type, p.unit as product_unit,
              tr.type as tax_type, tr.rate as tr_rate
       FROM invoice_items ii
       LEFT JOIN products p ON p.id = ii.product_id
       LEFT JOIN tax_rates tr ON tr.id = ii.tax_rate_id
       WHERE ii.invoice_id IN (${invoiceIds.map(() => "?").join(",")})
       ORDER BY ii.sort_order ASC`,
      invoiceIds
    );
  }

  // Group items by invoice_id
  const itemsByInvoice = new Map<string, Record<string, unknown>[]>();
  for (const item of allItems) {
    const invId = String(item.invoice_id);
    if (!itemsByInvoice.has(invId)) itemsByInvoice.set(invId, []);
    itemsByInvoice.get(invId)!.push(item);
  }

  // Fetch credit notes for the period
  const creditNotes = await db.raw<Record<string, unknown>[]>(
    `SELECT cn.*, c.name as client_name, c.tax_id as client_gstin,
            c.state as client_state, c.state_code as client_state_code
     FROM credit_notes cn
     LEFT JOIN clients c ON c.id = cn.client_id
     WHERE cn.org_id = ?
       AND cn.date >= ?
       AND cn.date <= ?
       AND cn.status NOT IN ('draft', 'void')
     ORDER BY cn.credit_note_number ASC`,
    [orgId, periodStart, periodEnd]
  );

  // Fetch credit note items
  const cnIds = creditNotes.map((cn) => String(cn.id));
  let allCNItems: Record<string, unknown>[] = [];
  if (cnIds.length > 0) {
    allCNItems = await db.raw<Record<string, unknown>[]>(
      `SELECT cni.*, p.hsn_code as product_hsn_code, p.name as product_name,
              p.type as product_type, p.unit as product_unit,
              tr.type as tax_type, tr.rate as tr_rate
       FROM credit_note_items cni
       LEFT JOIN products p ON p.id = cni.product_id
       LEFT JOIN tax_rates tr ON tr.id = cni.tax_rate_id
       WHERE cni.credit_note_id IN (${cnIds.map(() => "?").join(",")})
       ORDER BY cni.sort_order ASC`,
      cnIds
    );
  }

  const cnItemsByCN = new Map<string, Record<string, unknown>[]>();
  for (const item of allCNItems) {
    const cnId = String(item.credit_note_id);
    if (!cnItemsByCN.has(cnId)) cnItemsByCN.set(cnId, []);
    cnItemsByCN.get(cnId)!.push(item);
  }

  // ── Classify invoices ─────────────────────────────────────────────────

  const b2bMap = new Map<string, GSTR1B2BEntry>();
  const b2clList: GSTR1B2CLEntry[] = [];
  const b2csAgg = new Map<string, GSTR1B2CSEntry>(); // key: placeOfSupply|taxType|rate
  const hsnAgg = new Map<string, GSTR1HSNEntry>(); // key: hsnCode|rate

  for (const inv of invoices) {
    const clientGstin = String(inv.client_gstin ?? "").trim();
    const invoiceNumber = String(inv.invoice_number ?? "");
    const issueDate = formatDate(inv.issue_date as string);
    const invoiceTotal = paiseToRupees(Number(inv.total ?? 0));
    const items = itemsByInvoice.get(String(inv.id)) ?? [];

    // Determine place of supply (buyer state code)
    let buyerStateCode = String(inv.client_state_code ?? "");
    if (!buyerStateCode && clientGstin.length >= 2) {
      buyerStateCode = extractStateFromGSTIN(clientGstin);
    }
    const placeOfSupply = buyerStateCode || orgStateCode;
    const isInterState = placeOfSupply !== orgStateCode;
    const reverseCharge = String(inv.reverse_charge ?? "N") === "Y";

    // Build rate-wise breakup from line items
    const rateMap = new Map<number, GSTR1RateItem>();
    for (const item of items) {
      const rate = Number(item.tax_rate ?? item.tr_rate ?? 0);
      const taxableValue = paiseToRupees(Number(item.amount ?? 0) - Number(item.tax_amount ?? 0));
      const taxAmount = paiseToRupees(Number(item.tax_amount ?? 0));
      const taxType = String(item.tax_type ?? "");

      const existing = rateMap.get(rate) ?? {
        rate,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0,
      };

      existing.taxableValue += taxableValue;

      if (taxType === "igst" || isInterState) {
        existing.igstAmount += taxAmount;
      } else {
        const half = Math.round(taxAmount * 100) / 200;
        existing.cgstAmount += half;
        existing.sgstAmount += taxAmount - half;
      }

      rateMap.set(rate, existing);

      // HSN aggregation
      const hsnCode = String(item.hsn_code ?? item.product_hsn_code ?? "");
      if (hsnCode) {
        const hsnKey = `${hsnCode}|${rate}`;
        const hsnEntry = hsnAgg.get(hsnKey) ?? {
          hsnCode,
          description: String(item.name ?? item.product_name ?? ""),
          uqc: mapUnitToUQC(String(item.unit ?? item.product_unit ?? "")),
          quantity: 0,
          taxableValue: 0,
          rate,
          igstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          cessAmount: 0,
          totalValue: 0,
        };

        hsnEntry.quantity += Number(item.quantity ?? 1);
        hsnEntry.taxableValue += taxableValue;
        if (taxType === "igst" || isInterState) {
          hsnEntry.igstAmount += taxAmount;
        } else {
          const half = Math.round(taxAmount * 100) / 200;
          hsnEntry.cgstAmount += half;
          hsnEntry.sgstAmount += taxAmount - half;
        }
        hsnEntry.totalValue += paiseToRupees(Number(item.amount ?? 0));
        hsnAgg.set(hsnKey, hsnEntry);
      }
    }

    const rateItems = Array.from(rateMap.values());

    // Classify: B2B if client has GSTIN
    if (clientGstin && clientGstin.length >= 15) {
      // B2B invoice
      const b2bInvoice: GSTR1B2BInvoice = {
        recipientGstin: clientGstin,
        recipientName: String(inv.client_name ?? ""),
        invoiceNumber,
        invoiceDate: issueDate,
        invoiceValue: invoiceTotal,
        placeOfSupply,
        placeOfSupplyName: getStateName(placeOfSupply),
        reverseCharge,
        invoiceType: "Regular",
        items: rateItems,
      };

      if (!b2bMap.has(clientGstin)) {
        b2bMap.set(clientGstin, {
          recipientGstin: clientGstin,
          recipientName: String(inv.client_name ?? ""),
          invoices: [],
        });
      }
      b2bMap.get(clientGstin)!.invoices.push(b2bInvoice);
    } else if (isInterState && Number(inv.total ?? 0) > B2CL_THRESHOLD_PAISE) {
      // B2C Large — interstate > 2.5 lakh
      for (const ri of rateItems) {
        b2clList.push({
          placeOfSupply,
          placeOfSupplyName: getStateName(placeOfSupply),
          invoiceNumber,
          invoiceDate: issueDate,
          invoiceValue: invoiceTotal,
          rate: ri.rate,
          taxableValue: ri.taxableValue,
          igstAmount: ri.igstAmount,
          cessAmount: ri.cessAmount,
        });
      }
    } else {
      // B2C Small — state-wise summary
      for (const ri of rateItems) {
        const taxType = isInterState ? "IGST" : "CGST/SGST";
        const key = `${placeOfSupply}|${taxType}|${ri.rate}`;
        const existing = b2csAgg.get(key) ?? {
          placeOfSupply,
          placeOfSupplyName: getStateName(placeOfSupply),
          taxType: taxType as "IGST" | "CGST/SGST",
          rate: ri.rate,
          taxableValue: 0,
          igstAmount: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          cessAmount: 0,
        };
        existing.taxableValue += ri.taxableValue;
        existing.igstAmount += ri.igstAmount;
        existing.cgstAmount += ri.cgstAmount;
        existing.sgstAmount += ri.sgstAmount;
        existing.cessAmount += ri.cessAmount;
        b2csAgg.set(key, existing);
      }
    }
  }

  // ── Credit/Debit Notes (CDNR — Table 9) ────────────────────────────────

  const cdnrList: GSTR1CDNEntry[] = [];
  for (const cn of creditNotes) {
    const clientGstin = String(cn.client_gstin ?? "").trim();
    if (!clientGstin || clientGstin.length < 15) continue; // CDNR is only for registered (B2B)

    const cnItems = cnItemsByCN.get(String(cn.id)) ?? [];
    let buyerStateCode = String(cn.client_state_code ?? "");
    if (!buyerStateCode && clientGstin.length >= 2) {
      buyerStateCode = extractStateFromGSTIN(clientGstin);
    }
    const isInterState = buyerStateCode !== orgStateCode;

    const rateMap = new Map<number, GSTR1RateItem>();
    for (const item of cnItems) {
      const rate = Number(item.tax_rate ?? item.tr_rate ?? 0);
      const taxableValue = paiseToRupees(Number(item.amount ?? 0) - Number(item.tax_amount ?? 0));
      const taxAmount = paiseToRupees(Number(item.tax_amount ?? 0));
      const taxType = String(item.tax_type ?? "");

      const existing = rateMap.get(rate) ?? {
        rate,
        taxableValue: 0,
        igstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        cessAmount: 0,
      };

      existing.taxableValue += taxableValue;
      if (taxType === "igst" || isInterState) {
        existing.igstAmount += taxAmount;
      } else {
        const half = Math.round(taxAmount * 100) / 200;
        existing.cgstAmount += half;
        existing.sgstAmount += taxAmount - half;
      }
      rateMap.set(rate, existing);
    }

    // Try to find original invoice reference
    const appliedTo = cn.applied_to_invoices as string | undefined;
    let originalInvoiceNumber = "";
    let originalInvoiceDate = "";
    if (appliedTo) {
      try {
        const parsed = JSON.parse(appliedTo) as Array<{ invoiceId: string }>;
        if (parsed.length > 0) {
          const origInv = await db.findOne("invoices", { id: parsed[0].invoiceId, org_id: orgId });
          if (origInv) {
            const origData = origInv as Record<string, unknown>;
            originalInvoiceNumber = String(origData.invoice_number ?? "");
            originalInvoiceDate = formatDate(origData.issue_date as string);
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    cdnrList.push({
      recipientGstin: clientGstin,
      recipientName: String(cn.client_name ?? ""),
      noteNumber: String(cn.credit_note_number ?? ""),
      noteDate: formatDate(cn.date as string),
      noteType: "C",
      originalInvoiceNumber,
      originalInvoiceDate,
      noteValue: paiseToRupees(Number(cn.total ?? 0)),
      items: Array.from(rateMap.values()),
    });
  }

  // ── Document Summary (Table 13) ───────────────────────────────────────

  const docs: GSTR1DocSummaryEntry[] = [];

  if (invoices.length > 0) {
    const invoiceNumbers = invoices.map((i) => String(i.invoice_number ?? ""));
    docs.push({
      documentType: "Invoices for outward supply",
      fromNumber: invoiceNumbers[0],
      toNumber: invoiceNumbers[invoiceNumbers.length - 1],
      totalIssued: invoices.length,
      totalCancelled: 0, // TODO: count voided invoices in range
      netIssued: invoices.length,
    });
  }

  if (creditNotes.length > 0) {
    const cnNumbers = creditNotes.map((cn) => String(cn.credit_note_number ?? ""));
    docs.push({
      documentType: "Credit Notes",
      fromNumber: cnNumbers[0],
      toNumber: cnNumbers[cnNumbers.length - 1],
      totalIssued: creditNotes.length,
      totalCancelled: 0,
      netIssued: creditNotes.length,
    });
  }

  // Count voided invoices in the period for document summary
  const [voidedRow] = await db.raw<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM invoices
     WHERE org_id = ? AND issue_date >= ? AND issue_date <= ? AND status = ?`,
    [orgId, periodStart, periodEnd, InvoiceStatus.VOID]
  );
  if (voidedRow && Number(voidedRow.count) > 0 && docs.length > 0) {
    docs[0].totalCancelled = Number(voidedRow.count);
    docs[0].netIssued = docs[0].totalIssued - docs[0].totalCancelled;
  }

  // ── Build final result ────────────────────────────────────────────────

  const b2b = Array.from(b2bMap.values());
  const b2cs = Array.from(b2csAgg.values());
  const hsn = Array.from(hsnAgg.values());

  // Compute summary totals
  let totalTaxableValue = 0;
  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalCess = 0;
  let totalInvoiceValue = 0;

  for (const entry of b2b) {
    for (const inv of entry.invoices) {
      totalInvoiceValue += inv.invoiceValue;
      for (const ri of inv.items) {
        totalTaxableValue += ri.taxableValue;
        totalIgst += ri.igstAmount;
        totalCgst += ri.cgstAmount;
        totalSgst += ri.sgstAmount;
        totalCess += ri.cessAmount;
      }
    }
  }

  for (const entry of b2clList) {
    totalTaxableValue += entry.taxableValue;
    totalIgst += entry.igstAmount;
    totalCess += entry.cessAmount;
    totalInvoiceValue += entry.invoiceValue;
  }

  for (const entry of b2cs) {
    totalTaxableValue += entry.taxableValue;
    totalIgst += entry.igstAmount;
    totalCgst += entry.cgstAmount;
    totalSgst += entry.sgstAmount;
    totalCess += entry.cessAmount;
  }

  const totalTax = totalIgst + totalCgst + totalSgst + totalCess;

  // B2CS also contributes to invoice value — approximate from taxable + tax
  for (const entry of b2cs) {
    totalInvoiceValue += entry.taxableValue + entry.igstAmount + entry.cgstAmount + entry.sgstAmount + entry.cessAmount;
  }

  const b2bInvoiceCount = b2b.reduce((s, e) => s + e.invoices.length, 0);

  logger.info("GSTR-1 generated", {
    orgId,
    period,
    b2bCount: b2bInvoiceCount,
    b2clCount: b2clList.length,
    b2csCount: b2cs.length,
    cdnrCount: cdnrList.length,
    hsnCount: hsn.length,
  });

  return {
    period: gstPeriod,
    gstin: orgGstin,
    orgName,
    b2b,
    b2cl: b2clList,
    b2cs,
    cdnr: cdnrList,
    hsn,
    docs,
    summary: {
      totalTaxableValue: roundTwo(totalTaxableValue),
      totalIgst: roundTwo(totalIgst),
      totalCgst: roundTwo(totalCgst),
      totalSgst: roundTwo(totalSgst),
      totalCess: roundTwo(totalCess),
      totalTax: roundTwo(totalTax),
      totalInvoiceValue: roundTwo(totalInvoiceValue),
      b2bCount: b2bInvoiceCount,
      b2clCount: b2clList.length,
      b2csCount: b2cs.length,
      cdnrCount: cdnrList.length,
    },
  };
}

// ── GST Portal JSON format ──────────────────────────────────────────────────

/**
 * Convert GSTR-1 data to the JSON format expected by the GST portal for upload.
 */
export function toGSTPortalJSON(data: GSTR1Data): Record<string, unknown> {
  return {
    gstin: data.gstin,
    fp: data.period, // Filing period MMYYYY
    // B2B — Table 4
    b2b: data.b2b.map((entry) => ({
      ctin: entry.recipientGstin,
      inv: entry.invoices.map((inv) => ({
        inum: inv.invoiceNumber,
        idt: inv.invoiceDate,
        val: inv.invoiceValue,
        pos: inv.placeOfSupply,
        rchrg: inv.reverseCharge ? "Y" : "N",
        inv_typ: inv.invoiceType === "Regular" ? "R" : inv.invoiceType,
        itms: inv.items.map((ri) => ({
          num: 0,
          itm_det: {
            rt: ri.rate,
            txval: ri.taxableValue,
            iamt: ri.igstAmount,
            camt: ri.cgstAmount,
            samt: ri.sgstAmount,
            csamt: ri.cessAmount,
          },
        })),
      })),
    })),
    // B2CL — Table 5
    b2cl: groupB2CLByPOS(data.b2cl),
    // B2CS — Table 7
    b2cs: data.b2cs.map((entry) => ({
      sply_ty: entry.taxType === "IGST" ? "INTER" : "INTRA",
      pos: entry.placeOfSupply,
      rt: entry.rate,
      txval: entry.taxableValue,
      iamt: entry.igstAmount,
      camt: entry.cgstAmount,
      samt: entry.sgstAmount,
      csamt: entry.cessAmount,
    })),
    // CDNR — Table 9
    cdnr: groupCDNRByGSTIN(data.cdnr),
    // HSN — Table 12
    hsn: {
      data: data.hsn.map((h) => ({
        hsn_sc: h.hsnCode,
        desc: h.description,
        uqc: h.uqc,
        qty: h.quantity,
        txval: h.taxableValue,
        rt: h.rate,
        iamt: h.igstAmount,
        camt: h.cgstAmount,
        samt: h.sgstAmount,
        csamt: h.cessAmount,
      })),
    },
    // DOC — Table 13
    doc_issue: {
      doc_det: data.docs.map((d) => ({
        doc_num: 1,
        doc_typ: d.documentType,
        docs: [
          {
            num: 1,
            from: d.fromNumber,
            to: d.toNumber,
            totnum: d.totalIssued,
            cancel: d.totalCancelled,
            net_issue: d.netIssued,
          },
        ],
      })),
    },
  };
}

function groupB2CLByPOS(entries: GSTR1B2CLEntry[]): unknown[] {
  const map = new Map<string, GSTR1B2CLEntry[]>();
  for (const e of entries) {
    if (!map.has(e.placeOfSupply)) map.set(e.placeOfSupply, []);
    map.get(e.placeOfSupply)!.push(e);
  }
  return Array.from(map.entries()).map(([pos, invs]) => ({
    pos,
    inv: invs.map((inv) => ({
      inum: inv.invoiceNumber,
      idt: inv.invoiceDate,
      val: inv.invoiceValue,
      rt: inv.rate,
      txval: inv.taxableValue,
      iamt: inv.igstAmount,
      csamt: inv.cessAmount,
    })),
  }));
}

function groupCDNRByGSTIN(entries: GSTR1CDNEntry[]): unknown[] {
  const map = new Map<string, GSTR1CDNEntry[]>();
  for (const e of entries) {
    if (!map.has(e.recipientGstin)) map.set(e.recipientGstin, []);
    map.get(e.recipientGstin)!.push(e);
  }
  return Array.from(map.entries()).map(([ctin, notes]) => ({
    ctin,
    nt: notes.map((n) => ({
      ntty: n.noteType,
      nt_num: n.noteNumber,
      nt_dt: n.noteDate,
      val: n.noteValue,
      inum: n.originalInvoiceNumber,
      idt: n.originalInvoiceDate,
      itms: n.items.map((ri) => ({
        num: 0,
        itm_det: {
          rt: ri.rate,
          txval: ri.taxableValue,
          iamt: ri.igstAmount,
          camt: ri.cgstAmount,
          samt: ri.sgstAmount,
          csamt: ri.cessAmount,
        },
      })),
    })),
  }));
}

// ── CSV Export ───────────────────────────────────────────────────────────────

/**
 * Generate CSV content for each GSTR-1 section.
 * Returns an object with section name -> CSV string.
 */
export function toCSV(data: GSTR1Data): Record<string, string> {
  const result: Record<string, string> = {};

  // B2B CSV
  {
    const headers = [
      "GSTIN/UIN of Recipient", "Receiver Name", "Invoice Number", "Invoice Date",
      "Invoice Value", "Place of Supply", "Reverse Charge", "Invoice Type",
      "Rate", "Taxable Value", "IGST Amount", "CGST Amount", "SGST Amount", "Cess Amount",
    ];
    const rows: string[][] = [];
    for (const entry of data.b2b) {
      for (const inv of entry.invoices) {
        for (const ri of inv.items) {
          rows.push([
            entry.recipientGstin, entry.recipientName, inv.invoiceNumber,
            inv.invoiceDate, String(inv.invoiceValue),
            `${inv.placeOfSupply}-${inv.placeOfSupplyName}`,
            inv.reverseCharge ? "Y" : "N", inv.invoiceType,
            String(ri.rate), String(ri.taxableValue), String(ri.igstAmount),
            String(ri.cgstAmount), String(ri.sgstAmount), String(ri.cessAmount),
          ]);
        }
      }
    }
    result.b2b = buildCsvString(headers, rows);
  }

  // B2CL CSV
  {
    const headers = [
      "Invoice Number", "Invoice Date", "Invoice Value",
      "Place of Supply", "Rate", "Taxable Value", "IGST Amount", "Cess Amount",
    ];
    const rows = data.b2cl.map((e) => [
      e.invoiceNumber, e.invoiceDate, String(e.invoiceValue),
      `${e.placeOfSupply}-${e.placeOfSupplyName}`,
      String(e.rate), String(e.taxableValue), String(e.igstAmount), String(e.cessAmount),
    ]);
    result.b2cl = buildCsvString(headers, rows);
  }

  // B2CS CSV
  {
    const headers = [
      "Type", "Place of Supply", "Rate",
      "Taxable Value", "IGST Amount", "CGST Amount", "SGST Amount", "Cess Amount",
    ];
    const rows = data.b2cs.map((e) => [
      e.taxType, `${e.placeOfSupply}-${e.placeOfSupplyName}`,
      String(e.rate), String(e.taxableValue), String(e.igstAmount),
      String(e.cgstAmount), String(e.sgstAmount), String(e.cessAmount),
    ]);
    result.b2cs = buildCsvString(headers, rows);
  }

  // CDNR CSV
  {
    const headers = [
      "GSTIN/UIN of Recipient", "Receiver Name", "Note Number", "Note Date",
      "Note Type", "Original Invoice Number", "Original Invoice Date", "Note Value",
      "Rate", "Taxable Value", "IGST Amount", "CGST Amount", "SGST Amount", "Cess Amount",
    ];
    const rows: string[][] = [];
    for (const cn of data.cdnr) {
      for (const ri of cn.items) {
        rows.push([
          cn.recipientGstin, cn.recipientName, cn.noteNumber, cn.noteDate,
          cn.noteType === "C" ? "Credit Note" : "Debit Note",
          cn.originalInvoiceNumber, cn.originalInvoiceDate, String(cn.noteValue),
          String(ri.rate), String(ri.taxableValue), String(ri.igstAmount),
          String(ri.cgstAmount), String(ri.sgstAmount), String(ri.cessAmount),
        ]);
      }
    }
    result.cdnr = buildCsvString(headers, rows);
  }

  // HSN CSV
  {
    const headers = [
      "HSN Code", "Description", "UQC", "Quantity",
      "Taxable Value", "Rate", "IGST Amount", "CGST Amount", "SGST Amount",
      "Cess Amount", "Total Value",
    ];
    const rows = data.hsn.map((h) => [
      h.hsnCode, h.description, h.uqc, String(h.quantity),
      String(h.taxableValue), String(h.rate), String(h.igstAmount),
      String(h.cgstAmount), String(h.sgstAmount), String(h.cessAmount),
      String(h.totalValue),
    ]);
    result.hsn = buildCsvString(headers, rows);
  }

  // Document Summary CSV
  {
    const headers = [
      "Document Type", "From Number", "To Number",
      "Total Issued", "Total Cancelled", "Net Issued",
    ];
    const rows = data.docs.map((d) => [
      d.documentType, d.fromNumber, d.toNumber,
      String(d.totalIssued), String(d.totalCancelled), String(d.netIssued),
    ]);
    result.docs = buildCsvString(headers, rows);
  }

  return result;
}

function buildCsvString(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

// ── Unit Quantity Code mapping ──────────────────────────────────────────────

function mapUnitToUQC(unit: string): string {
  const u = unit.toLowerCase().trim();
  const map: Record<string, string> = {
    nos: "NOS-NUMBERS",
    numbers: "NOS-NUMBERS",
    pcs: "PCS-PIECES",
    pieces: "PCS-PIECES",
    kg: "KGS-KILOGRAMS",
    kgs: "KGS-KILOGRAMS",
    kilograms: "KGS-KILOGRAMS",
    gm: "GMS-GRAMMES",
    gms: "GMS-GRAMMES",
    grams: "GMS-GRAMMES",
    ltr: "LTR-LITRES",
    litres: "LTR-LITRES",
    liters: "LTR-LITRES",
    mtr: "MTR-METRES",
    metres: "MTR-METRES",
    meters: "MTR-METRES",
    sqm: "SQM-SQUARE METRES",
    sqf: "SQF-SQUARE FEET",
    cbm: "CBM-CUBIC METRES",
    ton: "TON-METRIC TON",
    tonnes: "TON-METRIC TON",
    hrs: "HRS-HOURS",
    hours: "HRS-HOURS",
    days: "DAY-DAYS",
    sets: "SET-SETS",
    pairs: "PRS-PAIRS",
    doz: "DOZ-DOZENS",
    dozens: "DOZ-DOZENS",
    box: "BOX-BOX",
    bags: "BAG-BAGS",
    bun: "BUN-BUNDLES",
    bundles: "BUN-BUNDLES",
    oth: "OTH-OTHERS",
  };
  return map[u] ?? "OTH-OTHERS";
}

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}
