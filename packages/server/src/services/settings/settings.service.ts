import * as fs from "fs";
import * as path from "path";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import type { Organization } from "@emp-billing/shared";
import type { z } from "zod";
import type { UpdateOrgSchema } from "@emp-billing/shared";

// ============================================================================
// SETTINGS SERVICE
// ============================================================================

// ── Get Org Settings ────────────────────────────────────────────────────────

export async function getOrgSettings(orgId: string): Promise<Organization> {
  const db = await getDB();
  const org = await db.findById<Organization>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");
  return org;
}

// ── Update Org Settings ─────────────────────────────────────────────────────

export async function updateOrgSettings(
  orgId: string,
  input: z.infer<typeof UpdateOrgSchema>
): Promise<Organization> {
  const db = await getDB();
  const org = await db.findById<Organization>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.legalName !== undefined) updateData.legalName = input.legalName;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.website !== undefined) updateData.website = input.website;
  if (input.address !== undefined) updateData.address = JSON.stringify(input.address);
  if (input.taxId !== undefined) updateData.taxId = input.taxId;
  if (input.pan !== undefined) updateData.pan = input.pan;
  if (input.defaultCurrency !== undefined) updateData.defaultCurrency = input.defaultCurrency;
  if (input.country !== undefined) updateData.country = input.country;
  if (input.fiscalYearStart !== undefined) updateData.fiscalYearStart = input.fiscalYearStart;
  if (input.invoicePrefix !== undefined) updateData.invoicePrefix = input.invoicePrefix;
  if (input.quotePrefix !== undefined) updateData.quotePrefix = input.quotePrefix;
  if (input.defaultPaymentTerms !== undefined) updateData.defaultPaymentTerms = input.defaultPaymentTerms;
  if (input.defaultNotes !== undefined) updateData.defaultNotes = input.defaultNotes;
  if (input.defaultTerms !== undefined) updateData.defaultTerms = input.defaultTerms;

  if (input.timezone !== undefined) updateData.timezone = input.timezone;

  return db.update<Organization>("organizations", orgId, updateData);
}

// ── Update Branding ─────────────────────────────────────────────────────────

export async function updateBranding(
  orgId: string,
  input: { logo?: string; brandColors?: { primary: string; accent: string } }
): Promise<Organization> {
  const db = await getDB();
  const org = await db.findById<Organization>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.logo !== undefined) updateData.logo = input.logo;
  if (input.brandColors !== undefined) updateData.brandColors = JSON.stringify(input.brandColors);

  return db.update<Organization>("organizations", orgId, updateData);
}

// ── Get Numbering Config ────────────────────────────────────────────────────

export async function getNumberingConfig(orgId: string) {
  const db = await getDB();
  const org = await db.findById<Organization>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");

  return {
    data: {
      invoicePrefix: org.invoicePrefix,
      invoiceNextNumber: org.invoiceNextNumber,
      quotePrefix: org.quotePrefix,
      quoteNextNumber: org.quoteNextNumber,
    },
  };
}

// ── Update Numbering Config ─────────────────────────────────────────────────

export async function updateNumberingConfig(
  orgId: string,
  input: {
    invoicePrefix?: string;
    invoiceNextNumber?: number;
    quotePrefix?: string;
    quoteNextNumber?: number;
  }
): Promise<Organization> {
  const db = await getDB();
  const org = await db.findById<Organization>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");

  const now = new Date();
  const updateData: Record<string, unknown> = { updatedAt: now };

  if (input.invoicePrefix !== undefined) updateData.invoicePrefix = input.invoicePrefix;
  if (input.invoiceNextNumber !== undefined) updateData.invoiceNextNumber = input.invoiceNextNumber;
  if (input.quotePrefix !== undefined) updateData.quotePrefix = input.quotePrefix;
  if (input.quoteNextNumber !== undefined) updateData.quoteNextNumber = input.quoteNextNumber;

  return db.update<Organization>("organizations", orgId, updateData);
}

// ── Email Templates ────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");

/** Allowed email template basenames (without extension). */
const ALLOWED_TEMPLATES = [
  "email-invoice",
  "email-payment-receipt",
  "email-payment-reminder",
  "email-quote",
];

interface EmailTemplate {
  name: string;
  subject: string;
  body: string;
}

/**
 * Read subject from a JSON sidecar file next to the .hbs template.
 * Falls back to a default derived from the template name.
 */
function readSubject(templateName: string): string {
  const sidecarPath = path.join(TEMPLATES_DIR, `${templateName}.meta.json`);
  try {
    const raw = fs.readFileSync(sidecarPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.subject === "string") return parsed.subject;
  } catch {
    // Sidecar doesn't exist or is invalid — use default
  }
  const defaults: Record<string, string> = {
    "email-invoice": "New Invoice from {{org.name}}",
    "email-payment-receipt": "Payment Receipt from {{org.name}}",
    "email-payment-reminder": "Payment Reminder - {{invoice.invoiceNumber}}",
    "email-quote": "New Quote from {{org.name}}",
  };
  return defaults[templateName] ?? templateName;
}

function writeSubject(templateName: string, subject: string): void {
  const sidecarPath = path.join(TEMPLATES_DIR, `${templateName}.meta.json`);
  fs.writeFileSync(sidecarPath, JSON.stringify({ subject }, null, 2), "utf-8");
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const templates: EmailTemplate[] = [];

  for (const name of ALLOWED_TEMPLATES) {
    const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
    if (!fs.existsSync(filePath)) continue;

    const body = fs.readFileSync(filePath, "utf-8");
    const subject = readSubject(name);
    templates.push({ name, subject, body });
  }

  return templates;
}

export async function updateEmailTemplate(
  name: string,
  input: { subject?: string; body?: string }
): Promise<EmailTemplate> {
  if (!ALLOWED_TEMPLATES.includes(name)) {
    throw BadRequestError(`Unknown email template: ${name}`);
  }

  const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
  if (!fs.existsSync(filePath)) {
    throw NotFoundError("Email template");
  }

  if (input.body !== undefined) {
    fs.writeFileSync(filePath, input.body, "utf-8");
  }

  if (input.subject !== undefined) {
    writeSubject(name, input.subject);
  }

  const body = fs.readFileSync(filePath, "utf-8");
  const subject = readSubject(name);

  return { name, subject, body };
}
