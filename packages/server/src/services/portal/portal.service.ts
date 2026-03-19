import jwt from "jsonwebtoken";
import crypto from "crypto";
import { getDB } from "../../db/adapters/index";
import { config } from "../../config/index";
import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../utils/AppError";
import { InvoiceStatus, QuoteStatus, CreditNoteStatus } from "@emp-billing/shared";
import { generateInvoicePdf } from "../../utils/pdf";
import * as clientService from "../client/client.service";
import * as subscriptionService from "../subscription/subscription.service";
import type { Invoice, InvoiceItem, Quote, Payment, Client, CreditNote, Subscription, Plan, SubscriptionEvent } from "@emp-billing/shared";

// ============================================================================
// PORTAL SERVICE — Client-facing portal backend
// ============================================================================

// ── Types ──────────────────────────────────────────────────────────────────

interface PortalAccessRow {
  id: string;
  clientId: string;
  orgId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date | null;
  isActive: boolean;
}

interface PortalLoginResult {
  token: string;
  clientId: string;
  clientName: string;
  orgId: string;
  orgName: string;
  brandPrimary?: string;
  logoUrl?: string;
}

interface PortalDashboard {
  outstandingBalance: number;
  currency: string;
  recentInvoices: Invoice[];
  recentPayments: Payment[];
  pendingQuotesCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generatePortalJwt(clientId: string, orgId: string): string {
  return jwt.sign(
    { sub: clientId, orgId, type: "portal" },
    config.jwt.accessSecret,
    { expiresIn: "24h" }
  );
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function portalLogin(email: string, token: string): Promise<PortalLoginResult> {
  const db = await getDB();

  const tokenHash = hashToken(token);

  const access = await db.findOne<PortalAccessRow>("client_portal_access", {
    email,
    token_hash: tokenHash,
    is_active: true,
  });

  if (!access) {
    throw UnauthorizedError("Invalid email or portal access token");
  }

  // Check expiry
  if (access.expiresAt && new Date() > new Date(access.expiresAt)) {
    throw UnauthorizedError("Portal access token has expired");
  }

  // Fetch client
  const client = await db.findById<Client>("clients", access.clientId, access.orgId);
  if (!client) {
    throw NotFoundError("Client");
  }

  // Fetch org (include branding fields)
  const org = await db.findById<{ id: string; name: string; brandColors?: string | { primary: string; accent: string }; logo?: string }>("organizations", access.orgId);
  if (!org) {
    throw NotFoundError("Organization");
  }

  // Parse brandColors if stored as JSON string
  let brandColors: { primary?: string; accent?: string } | undefined;
  if (typeof org.brandColors === "string") {
    try { brandColors = JSON.parse(org.brandColors); } catch { /* ignore */ }
  } else if (org.brandColors) {
    brandColors = org.brandColors;
  }

  // Generate portal JWT
  const jwtToken = generatePortalJwt(access.clientId, access.orgId);

  return {
    token: jwtToken,
    clientId: access.clientId,
    clientName: client.displayName || client.name,
    orgId: access.orgId,
    orgName: org.name,
    brandPrimary: brandColors?.primary,
    logoUrl: org.logo,
  };
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getPortalDashboard(clientId: string, orgId: string): Promise<PortalDashboard> {
  const db = await getDB();

  // Client balance
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Recent 5 invoices (exclude draft and void)
  const invoices = await db.findMany<Invoice>("invoices", {
    where: { org_id: orgId, client_id: clientId },
    orderBy: [{ column: "issue_date", direction: "desc" }],
    limit: 20,
  });

  const visibleInvoices = invoices.filter(
    (i) => i.status !== InvoiceStatus.DRAFT && i.status !== InvoiceStatus.VOID
  );

  // Recent 5 payments
  const payments = await db.findMany<Payment>("payments", {
    where: { org_id: orgId, client_id: clientId, is_refund: false },
    orderBy: [{ column: "date", direction: "desc" }],
    limit: 5,
  });

  // Pending quotes count
  const allQuotes = await db.findMany<Quote>("quotes", {
    where: { org_id: orgId, client_id: clientId },
  });
  const pendingQuotesCount = allQuotes.filter(
    (q) => q.status === QuoteStatus.SENT || q.status === QuoteStatus.VIEWED
  ).length;

  return {
    outstandingBalance: client.outstandingBalance,
    currency: client.currency,
    recentInvoices: visibleInvoices.slice(0, 5),
    recentPayments: payments.slice(0, 5),
    pendingQuotesCount,
  };
}

// ── Invoices ───────────────────────────────────────────────────────────────

export async function getPortalInvoices(
  clientId: string,
  orgId: string,
  opts: { page: number; limit: number }
) {
  const db = await getDB();

  const result = await db.findPaginated<Invoice>("invoices", {
    where: { org_id: orgId, client_id: clientId },
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "issue_date", direction: "desc" }],
  });

  // Exclude DRAFT and VOID from client portal
  result.data = result.data.filter(
    (i) => i.status !== InvoiceStatus.DRAFT && i.status !== InvoiceStatus.VOID
  );

  return result;
}

export async function getPortalInvoice(
  clientId: string,
  orgId: string,
  invoiceId: string
): Promise<Invoice & { items: InvoiceItem[] }> {
  const db = await getDB();

  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  // Verify this invoice belongs to the client
  if (invoice.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this invoice");
  }

  // Exclude DRAFT and VOID
  if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) {
    throw NotFoundError("Invoice");
  }

  // Fetch items
  const items = await db.findMany<InvoiceItem>("invoice_items", {
    where: { invoice_id: invoiceId },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });

  // Mark as VIEWED if status is SENT
  if (invoice.status === InvoiceStatus.SENT) {
    const now = new Date();
    await db.update("invoices", invoiceId, {
      status: InvoiceStatus.VIEWED,
      viewedAt: now,
      updatedAt: now,
    }, orgId);
    invoice.status = InvoiceStatus.VIEWED;
  }

  return { ...invoice, items };
}

export async function getPortalInvoicePdf(
  clientId: string,
  orgId: string,
  invoiceId: string
): Promise<Buffer> {
  const db = await getDB();

  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if (invoice.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this invoice");
  }

  if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) {
    throw NotFoundError("Invoice");
  }

  // Fetch items
  const items = await db.findMany<InvoiceItem>("invoice_items", {
    where: { invoice_id: invoiceId },
    orderBy: [{ column: "sort_order", direction: "asc" }],
  });

  const org = await db.findById<Record<string, unknown>>("organizations", orgId);
  if (!org) throw NotFoundError("Organization");

  const client = await db.findById<Record<string, unknown>>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Parse JSON fields
  if (typeof org.address === "string") org.address = JSON.parse(org.address);
  if (typeof client.billingAddress === "string") client.billingAddress = JSON.parse(client.billingAddress);
  if (typeof org.brandColors === "string") org.brandColors = JSON.parse(org.brandColors);

  const mappedItems = items.map((item) => ({
    ...item,
    taxBreakdown: typeof item.taxComponents === "string"
      ? JSON.parse(item.taxComponents as unknown as string)
      : (item.taxComponents ?? []),
  }));

  return generateInvoicePdf({
    invoice: { ...invoice, items } as unknown as Record<string, unknown>,
    items: mappedItems as unknown as Record<string, unknown>[],
    org,
    client,
  });
}

// ── Quotes ─────────────────────────────────────────────────────────────────

export async function getPortalQuotes(clientId: string, orgId: string) {
  const db = await getDB();

  const quotes = await db.findMany<Quote>("quotes", {
    where: { org_id: orgId, client_id: clientId },
    orderBy: [{ column: "issue_date", direction: "desc" }],
  });

  // Exclude DRAFT
  return quotes.filter((q) => q.status !== QuoteStatus.DRAFT);
}

export async function acceptPortalQuote(
  clientId: string,
  orgId: string,
  quoteId: string
): Promise<Quote> {
  const db = await getDB();

  const quote = await db.findById<Quote>("quotes", quoteId, orgId);
  if (!quote) throw NotFoundError("Quote");

  if (quote.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this quote");
  }

  if (quote.status === QuoteStatus.DRAFT) {
    throw NotFoundError("Quote");
  }

  if (quote.status === QuoteStatus.ACCEPTED) {
    throw BadRequestError("Quote has already been accepted");
  }
  if (quote.status === QuoteStatus.DECLINED) {
    throw BadRequestError("Quote has already been declined");
  }
  if (quote.status === QuoteStatus.CONVERTED) {
    throw BadRequestError("Quote has already been converted");
  }

  const now = new Date();
  return db.update<Quote>("quotes", quoteId, {
    status: QuoteStatus.ACCEPTED,
    acceptedAt: now,
    updatedAt: now,
  }, orgId);
}

export async function declinePortalQuote(
  clientId: string,
  orgId: string,
  quoteId: string
): Promise<Quote> {
  const db = await getDB();

  const quote = await db.findById<Quote>("quotes", quoteId, orgId);
  if (!quote) throw NotFoundError("Quote");

  if (quote.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this quote");
  }

  if (quote.status === QuoteStatus.DRAFT) {
    throw NotFoundError("Quote");
  }

  if (quote.status === QuoteStatus.DECLINED) {
    throw BadRequestError("Quote has already been declined");
  }
  if (quote.status === QuoteStatus.CONVERTED) {
    throw BadRequestError("Quote has already been converted");
  }

  const now = new Date();
  return db.update<Quote>("quotes", quoteId, {
    status: QuoteStatus.DECLINED,
    updatedAt: now,
  }, orgId);
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function getPortalPayments(clientId: string, orgId: string) {
  const db = await getDB();

  return db.findMany<Payment>("payments", {
    where: { org_id: orgId, client_id: clientId, is_refund: false },
    orderBy: [{ column: "date", direction: "desc" }],
  });
}

// ── Credit Notes ────────────────────────────────────────────────────────────

export async function getPortalCreditNotes(clientId: string, orgId: string) {
  const db = await getDB();

  const creditNotes = await db.findMany<CreditNote>("credit_notes", {
    where: { org_id: orgId, client_id: clientId },
    orderBy: [{ column: "date", direction: "desc" }],
  });

  // Exclude DRAFT and VOID from client portal
  return creditNotes.filter(
    (cn) => cn.status !== CreditNoteStatus.DRAFT && cn.status !== CreditNoteStatus.VOID
  );
}

// ── Statement ──────────────────────────────────────────────────────────────

export async function getPortalStatement(
  clientId: string,
  orgId: string,
  from: Date,
  to: Date
) {
  return clientService.getClientStatement(orgId, clientId, from, to);
}

// ── Subscriptions ─────────────────────────────────────────────────────────

export async function getPortalSubscriptions(
  clientId: string,
  orgId: string
): Promise<(Subscription & { plan?: Plan })[]> {
  const db = await getDB();

  const subscriptions = await db.findMany<Subscription>("subscriptions", {
    where: { org_id: orgId, client_id: clientId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  // Load plan details for each subscription
  const result: (Subscription & { plan?: Plan })[] = [];
  for (const sub of subscriptions) {
    let plan: Plan | undefined;
    try {
      plan = await subscriptionService.getPlan(orgId, sub.planId);
    } catch {
      // plan may have been deactivated
    }
    result.push({ ...sub, plan });
  }

  return result;
}

export async function getPortalSubscription(
  clientId: string,
  orgId: string,
  subscriptionId: string
): Promise<Subscription & { plan?: Plan; events?: SubscriptionEvent[] }> {
  const db = await getDB();

  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");

  // Verify this subscription belongs to the client
  if (subscription.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this subscription");
  }

  // Load plan details
  let plan: Plan | undefined;
  try {
    plan = await subscriptionService.getPlan(orgId, subscription.planId);
  } catch {
    // plan may have been deactivated
  }

  // Load events
  const events = await db.findMany<SubscriptionEvent>("subscription_events", {
    where: { subscription_id: subscriptionId, org_id: orgId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return { ...subscription, plan, events };
}

export async function getPortalPlans(orgId: string): Promise<Plan[]> {
  return subscriptionService.listPlans(orgId);
}

export async function portalChangePlan(
  clientId: string,
  orgId: string,
  subscriptionId: string,
  newPlanId: string
): Promise<Subscription & { plan?: Plan }> {
  const db = await getDB();

  // Verify subscription belongs to client
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");
  if (subscription.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this subscription");
  }

  // Delegate to subscription service (prorate by default for portal changes)
  return subscriptionService.changePlan(orgId, subscriptionId, {
    newPlanId,
    prorate: true,
  });
}

export async function portalCancelSubscription(
  clientId: string,
  orgId: string,
  subscriptionId: string,
  reason?: string
): Promise<Subscription> {
  const db = await getDB();

  // Verify subscription belongs to client
  const subscription = await db.findById<Subscription>("subscriptions", subscriptionId, orgId);
  if (!subscription) throw NotFoundError("Subscription");
  if (subscription.clientId !== clientId) {
    throw ForbiddenError("You do not have access to this subscription");
  }

  // Portal cancellations happen at period end (not immediately)
  return subscriptionService.cancelSubscription(orgId, subscriptionId, {
    reason,
    cancelImmediately: false,
  });
}

// ── Payment Method ────────────────────────────────────────────────────────

export async function getPortalPaymentMethod(clientId: string, orgId: string) {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");
  return {
    paymentGateway: client.paymentGateway ?? null,
    last4: client.paymentMethodLast4 ?? null,
    brand: client.paymentMethodBrand ?? null,
    hasPaymentMethod: !!(client.paymentGateway && client.paymentMethodId),
  };
}

export async function updatePortalPaymentMethod(
  clientId: string,
  orgId: string,
  data: { paymentGateway: string; paymentMethodId: string; last4: string; brand: string }
) {
  const db = await getDB();
  await db.update("clients", clientId, {
    paymentGateway: data.paymentGateway,
    paymentMethodId: data.paymentMethodId,
    paymentMethodLast4: data.last4,
    paymentMethodBrand: data.brand,
    updatedAt: new Date(),
  }, orgId);
  return getPortalPaymentMethod(clientId, orgId);
}

export async function removePortalPaymentMethod(clientId: string, orgId: string) {
  const db = await getDB();
  await db.update("clients", clientId, {
    paymentGateway: null,
    paymentMethodId: null,
    paymentMethodLast4: null,
    paymentMethodBrand: null,
    updatedAt: new Date(),
  }, orgId);
  return { hasPaymentMethod: false, paymentGateway: null, last4: null, brand: null };
}
