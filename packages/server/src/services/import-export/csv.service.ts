import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { parseCSV, toCSV } from "../../utils/csv";
import { BadRequestError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import type { Client, Product } from "@emp-billing/shared";

// ============================================================================
// CSV IMPORT / EXPORT SERVICE
// ============================================================================

// ── Client Export ────────────────────────────────────────────────────────────

const CLIENT_COLUMNS = [
  { key: "name", header: "name" },
  { key: "displayName", header: "displayName" },
  { key: "email", header: "email" },
  { key: "phone", header: "phone" },
  { key: "taxId", header: "taxId" },
  { key: "currency", header: "currency" },
  { key: "paymentTerms", header: "paymentTerms" },
  { key: "tags", header: "tags" },
  { key: "billingAddressLine1", header: "billingAddress.line1" },
  { key: "billingAddressCity", header: "billingAddress.city" },
  { key: "billingAddressState", header: "billingAddress.state" },
  { key: "billingAddressPostalCode", header: "billingAddress.postalCode" },
  { key: "billingAddressCountry", header: "billingAddress.country" },
];

export async function exportClientsCSV(orgId: string): Promise<string> {
  const db = await getDB();
  const clients = await db.findMany<Client>("clients", {
    where: { org_id: orgId, is_active: true },
    orderBy: [{ column: "name", direction: "asc" }],
  });

  const rows = clients.map((c) => {
    const billing = parseBillingAddress(c.billingAddress);
    const tags: string[] = Array.isArray(c.tags)
      ? c.tags
      : typeof c.tags === "string"
        ? safeParseJSON(c.tags, [])
        : [];

    return {
      name: c.name,
      displayName: c.displayName ?? "",
      email: c.email,
      phone: c.phone ?? "",
      taxId: c.taxId ?? "",
      currency: c.currency ?? "",
      paymentTerms: c.paymentTerms ?? "",
      tags: tags.join(";"),
      billingAddressLine1: billing.line1,
      billingAddressCity: billing.city,
      billingAddressState: billing.state,
      billingAddressPostalCode: billing.postalCode,
      billingAddressCountry: billing.country,
    };
  });

  return toCSV(rows, CLIENT_COLUMNS);
}

// ── Client Import ────────────────────────────────────────────────────────────

export async function importClientsCSV(
  orgId: string,
  csvString: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  if (!csvString || !csvString.trim()) {
    throw BadRequestError("CSV data is empty");
  }

  const rows = parseCSV(csvString);
  if (rows.length === 0) {
    throw BadRequestError("CSV contains no data rows");
  }

  const db = await getDB();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 because row 1 is header, data starts at row 2

    try {
      const name = row["name"]?.trim();
      const email = row["email"]?.trim();

      if (!name) {
        errors.push(`Row ${rowNum}: missing required field "name"`);
        skipped++;
        continue;
      }
      if (!email) {
        errors.push(`Row ${rowNum}: missing required field "email"`);
        skipped++;
        continue;
      }

      // Check for duplicate by email within org
      const existing = await db.findOne("clients", { org_id: orgId, email });
      if (existing) {
        errors.push(`Row ${rowNum}: client with email "${email}" already exists — skipped`);
        skipped++;
        continue;
      }

      const tags = row["tags"]
        ? row["tags"].split(";").map((t) => t.trim()).filter(Boolean)
        : [];

      const billingAddress: Record<string, string> = {};
      const line1 = row["billingAddress.line1"]?.trim();
      const city = row["billingAddress.city"]?.trim();
      const state = row["billingAddress.state"]?.trim();
      const postalCode = row["billingAddress.postalCode"]?.trim();
      const country = row["billingAddress.country"]?.trim();
      if (line1 || city || state || postalCode || country) {
        if (line1) billingAddress.line1 = line1;
        if (city) billingAddress.city = city;
        if (state) billingAddress.state = state;
        if (postalCode) billingAddress.postalCode = postalCode;
        if (country) billingAddress.country = country;
      }

      const now = new Date();
      const clientId = uuid();

      // Parse paymentTerms as integer (days) — default to 30 days
      const rawTerms = row["paymentTerms"]?.trim();
      const paymentTerms = rawTerms ? (parseInt(rawTerms, 10) || 30) : 30;

      await db.create<Client>("clients", {
        id: clientId,
        orgId,
        name,
        displayName: row["displayName"]?.trim() || name,
        email,
        phone: row["phone"]?.trim() || null,
        taxId: row["taxId"]?.trim() || null,
        currency: row["currency"]?.trim() || "USD",
        paymentTerms,
        tags: JSON.stringify(tags),
        billingAddress: Object.keys(billingAddress).length > 0
          ? JSON.stringify(billingAddress)
          : null,
        shippingAddress: null,
        customFields: null,
        outstandingBalance: 0,
        totalBilled: 0,
        totalPaid: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`CSV client import row ${rowNum} failed: ${message}`);
      errors.push(`Row ${rowNum}: ${message}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

// ── Product Export ───────────────────────────────────────────────────────────

const PRODUCT_COLUMNS = [
  { key: "name", header: "name" },
  { key: "description", header: "description" },
  { key: "sku", header: "sku" },
  { key: "type", header: "type" },
  { key: "unit", header: "unit" },
  { key: "rate", header: "rate" },
  { key: "hsnCode", header: "hsnCode" },
  { key: "trackInventory", header: "trackInventory" },
  { key: "stockOnHand", header: "stockOnHand" },
];

export async function exportProductsCSV(orgId: string): Promise<string> {
  const db = await getDB();
  const products = await db.findMany<Product>("products", {
    where: { org_id: orgId, is_active: true },
    orderBy: [{ column: "name", direction: "asc" }],
  });

  const rows = products.map((p) => ({
    name: p.name,
    description: p.description ?? "",
    sku: p.sku ?? "",
    type: p.type ?? "",
    unit: p.unit ?? "",
    rate: p.rate != null ? (p.rate / 100).toFixed(2) : "",
    hsnCode: (p as unknown as Record<string, unknown>).hsnCode ?? "",
    trackInventory: (p as unknown as Record<string, unknown>).trackInventory ? "true" : "false",
    stockOnHand: (p as unknown as Record<string, unknown>).stockOnHand ?? "",
  }));

  return toCSV(rows, PRODUCT_COLUMNS);
}

// ── Product Import ───────────────────────────────────────────────────────────

export async function importProductsCSV(
  orgId: string,
  csvString: string
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  if (!csvString || !csvString.trim()) {
    throw BadRequestError("CSV data is empty");
  }

  const rows = parseCSV(csvString);
  if (rows.length === 0) {
    throw BadRequestError("CSV contains no data rows");
  }

  const db = await getDB();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const name = row["name"]?.trim();

      if (!name) {
        errors.push(`Row ${rowNum}: missing required field "name"`);
        skipped++;
        continue;
      }

      // Skip duplicates: check by SKU first, then by name
      const sku = row["sku"]?.trim() || null;
      if (sku) {
        const existingBySku = await db.findOne("products", { org_id: orgId, sku });
        if (existingBySku) {
          errors.push(`Row ${rowNum}: product with SKU "${sku}" already exists — skipped`);
          skipped++;
          continue;
        }
      } else {
        const existingByName = await db.findOne("products", { org_id: orgId, name });
        if (existingByName) {
          errors.push(`Row ${rowNum}: product with name "${name}" already exists — skipped`);
          skipped++;
          continue;
        }
      }

      // Convert rate from display value to smallest unit (*100)
      let rate = 0;
      const rateStr = row["rate"]?.trim();
      if (rateStr) {
        const parsed = parseFloat(rateStr);
        if (isNaN(parsed)) {
          errors.push(`Row ${rowNum}: invalid rate value "${rateStr}"`);
          skipped++;
          continue;
        }
        rate = Math.round(parsed * 100);
      }

      const trackInventory = row["trackInventory"]?.trim().toLowerCase() === "true";
      const stockOnHandStr = row["stockOnHand"]?.trim();
      const stockOnHand = stockOnHandStr ? parseInt(stockOnHandStr, 10) : 0;

      const now = new Date();
      await db.create<Product>("products", {
        id: uuid(),
        orgId,
        name,
        description: row["description"]?.trim() || null,
        sku,
        type: row["type"]?.trim() || "service",
        unit: row["unit"]?.trim() || "unit",
        rate,
        hsnCode: row["hsnCode"]?.trim() || null,
        trackInventory,
        stockOnHand: trackInventory ? stockOnHand : 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      imported++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`CSV product import row ${rowNum} failed: ${message}`);
      errors.push(`Row ${rowNum}: ${message}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseBillingAddress(raw: unknown): {
  line1: string; city: string; state: string; postalCode: string; country: string;
} {
  const empty = { line1: "", city: "", state: "", postalCode: "", country: "" };
  if (!raw) return empty;
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      line1: obj.line1 ?? "",
      city: obj.city ?? "",
      state: obj.state ?? "",
      postalCode: obj.postalCode ?? "",
      country: obj.country ?? "",
    };
  } catch {
    return empty;
  }
}

function safeParseJSON<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
