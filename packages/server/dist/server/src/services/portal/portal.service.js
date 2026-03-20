"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalLogin = portalLogin;
exports.getPortalDashboard = getPortalDashboard;
exports.getPortalInvoices = getPortalInvoices;
exports.getPortalInvoice = getPortalInvoice;
exports.getPortalInvoicePdf = getPortalInvoicePdf;
exports.getPortalQuotes = getPortalQuotes;
exports.acceptPortalQuote = acceptPortalQuote;
exports.declinePortalQuote = declinePortalQuote;
exports.getPortalPayments = getPortalPayments;
exports.getPortalCreditNotes = getPortalCreditNotes;
exports.getPortalStatement = getPortalStatement;
exports.getPortalSubscriptions = getPortalSubscriptions;
exports.getPortalSubscription = getPortalSubscription;
exports.getPortalPlans = getPortalPlans;
exports.portalChangePlan = portalChangePlan;
exports.portalCancelSubscription = portalCancelSubscription;
exports.getPortalPaymentMethod = getPortalPaymentMethod;
exports.updatePortalPaymentMethod = updatePortalPaymentMethod;
exports.removePortalPaymentMethod = removePortalPaymentMethod;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../../db/adapters/index");
const index_2 = require("../../config/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
const pdf_1 = require("../../utils/pdf");
const clientService = __importStar(require("../client/client.service"));
const subscriptionService = __importStar(require("../subscription/subscription.service"));
// ── Helpers ────────────────────────────────────────────────────────────────
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
function generatePortalJwt(clientId, orgId) {
    return jsonwebtoken_1.default.sign({ sub: clientId, orgId, type: "portal" }, index_2.config.jwt.accessSecret, { expiresIn: "24h" });
}
// ── Login ──────────────────────────────────────────────────────────────────
async function portalLogin(email, token) {
    const db = await (0, index_1.getDB)();
    const tokenHash = hashToken(token);
    const access = await db.findOne("client_portal_access", {
        email,
        token_hash: tokenHash,
        is_active: true,
    });
    if (!access) {
        throw (0, AppError_1.UnauthorizedError)("Invalid email or portal access token");
    }
    // Check expiry
    if (access.expiresAt && new Date() > new Date(access.expiresAt)) {
        throw (0, AppError_1.UnauthorizedError)("Portal access token has expired");
    }
    // Fetch client
    const client = await db.findById("clients", access.clientId, access.orgId);
    if (!client) {
        throw (0, AppError_1.NotFoundError)("Client");
    }
    // Fetch org (include branding fields)
    const org = await db.findById("organizations", access.orgId);
    if (!org) {
        throw (0, AppError_1.NotFoundError)("Organization");
    }
    // Parse brandColors if stored as JSON string
    let brandColors;
    if (typeof org.brandColors === "string") {
        try {
            brandColors = JSON.parse(org.brandColors);
        }
        catch { /* ignore */ }
    }
    else if (org.brandColors) {
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
async function getPortalDashboard(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    // Client balance
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Recent 5 invoices (exclude draft and void)
    const invoices = await db.findMany("invoices", {
        where: { org_id: orgId, client_id: clientId },
        orderBy: [{ column: "issue_date", direction: "desc" }],
        limit: 20,
    });
    const visibleInvoices = invoices.filter((i) => i.status !== shared_1.InvoiceStatus.DRAFT && i.status !== shared_1.InvoiceStatus.VOID);
    // Recent 5 payments
    const payments = await db.findMany("payments", {
        where: { org_id: orgId, client_id: clientId, is_refund: false },
        orderBy: [{ column: "date", direction: "desc" }],
        limit: 5,
    });
    // Pending quotes count
    const allQuotes = await db.findMany("quotes", {
        where: { org_id: orgId, client_id: clientId },
    });
    const pendingQuotesCount = allQuotes.filter((q) => q.status === shared_1.QuoteStatus.SENT || q.status === shared_1.QuoteStatus.VIEWED).length;
    return {
        outstandingBalance: client.outstandingBalance,
        currency: client.currency,
        recentInvoices: visibleInvoices.slice(0, 5),
        recentPayments: payments.slice(0, 5),
        pendingQuotesCount,
    };
}
// ── Invoices ───────────────────────────────────────────────────────────────
async function getPortalInvoices(clientId, orgId, opts) {
    const db = await (0, index_1.getDB)();
    const result = await db.findPaginated("invoices", {
        where: { org_id: orgId, client_id: clientId },
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "issue_date", direction: "desc" }],
    });
    // Exclude DRAFT and VOID from client portal
    result.data = result.data.filter((i) => i.status !== shared_1.InvoiceStatus.DRAFT && i.status !== shared_1.InvoiceStatus.VOID);
    return result;
}
async function getPortalInvoice(clientId, orgId, invoiceId) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    // Verify this invoice belongs to the client
    if (invoice.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this invoice");
    }
    // Exclude DRAFT and VOID
    if (invoice.status === shared_1.InvoiceStatus.DRAFT || invoice.status === shared_1.InvoiceStatus.VOID) {
        throw (0, AppError_1.NotFoundError)("Invoice");
    }
    // Fetch items
    const items = await db.findMany("invoice_items", {
        where: { invoice_id: invoiceId },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    // Mark as VIEWED if status is SENT
    if (invoice.status === shared_1.InvoiceStatus.SENT) {
        const now = new Date();
        await db.update("invoices", invoiceId, {
            status: shared_1.InvoiceStatus.VIEWED,
            viewedAt: now,
            updatedAt: now,
        }, orgId);
        invoice.status = shared_1.InvoiceStatus.VIEWED;
    }
    return { ...invoice, items };
}
async function getPortalInvoicePdf(clientId, orgId, invoiceId) {
    const db = await (0, index_1.getDB)();
    const invoice = await db.findById("invoices", invoiceId, orgId);
    if (!invoice)
        throw (0, AppError_1.NotFoundError)("Invoice");
    if (invoice.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this invoice");
    }
    if (invoice.status === shared_1.InvoiceStatus.DRAFT || invoice.status === shared_1.InvoiceStatus.VOID) {
        throw (0, AppError_1.NotFoundError)("Invoice");
    }
    // Fetch items
    const items = await db.findMany("invoice_items", {
        where: { invoice_id: invoiceId },
        orderBy: [{ column: "sort_order", direction: "asc" }],
    });
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Parse JSON fields
    if (typeof org.address === "string")
        org.address = JSON.parse(org.address);
    if (typeof client.billingAddress === "string")
        client.billingAddress = JSON.parse(client.billingAddress);
    if (typeof org.brandColors === "string")
        org.brandColors = JSON.parse(org.brandColors);
    const mappedItems = items.map((item) => ({
        ...item,
        taxBreakdown: typeof item.taxComponents === "string"
            ? JSON.parse(item.taxComponents)
            : (item.taxComponents ?? []),
    }));
    return (0, pdf_1.generateInvoicePdf)({
        invoice: { ...invoice, items },
        items: mappedItems,
        org,
        client,
    });
}
// ── Quotes ─────────────────────────────────────────────────────────────────
async function getPortalQuotes(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    const quotes = await db.findMany("quotes", {
        where: { org_id: orgId, client_id: clientId },
        orderBy: [{ column: "issue_date", direction: "desc" }],
    });
    // Exclude DRAFT
    return quotes.filter((q) => q.status !== shared_1.QuoteStatus.DRAFT);
}
async function acceptPortalQuote(clientId, orgId, quoteId) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", quoteId, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    if (quote.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this quote");
    }
    if (quote.status === shared_1.QuoteStatus.DRAFT) {
        throw (0, AppError_1.NotFoundError)("Quote");
    }
    if (quote.status === shared_1.QuoteStatus.ACCEPTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been accepted");
    }
    if (quote.status === shared_1.QuoteStatus.DECLINED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been declined");
    }
    if (quote.status === shared_1.QuoteStatus.CONVERTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been converted");
    }
    const now = new Date();
    return db.update("quotes", quoteId, {
        status: shared_1.QuoteStatus.ACCEPTED,
        acceptedAt: now,
        updatedAt: now,
    }, orgId);
}
async function declinePortalQuote(clientId, orgId, quoteId) {
    const db = await (0, index_1.getDB)();
    const quote = await db.findById("quotes", quoteId, orgId);
    if (!quote)
        throw (0, AppError_1.NotFoundError)("Quote");
    if (quote.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this quote");
    }
    if (quote.status === shared_1.QuoteStatus.DRAFT) {
        throw (0, AppError_1.NotFoundError)("Quote");
    }
    if (quote.status === shared_1.QuoteStatus.DECLINED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been declined");
    }
    if (quote.status === shared_1.QuoteStatus.CONVERTED) {
        throw (0, AppError_1.BadRequestError)("Quote has already been converted");
    }
    const now = new Date();
    return db.update("quotes", quoteId, {
        status: shared_1.QuoteStatus.DECLINED,
        updatedAt: now,
    }, orgId);
}
// ── Payments ───────────────────────────────────────────────────────────────
async function getPortalPayments(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    return db.findMany("payments", {
        where: { org_id: orgId, client_id: clientId, is_refund: false },
        orderBy: [{ column: "date", direction: "desc" }],
    });
}
// ── Credit Notes ────────────────────────────────────────────────────────────
async function getPortalCreditNotes(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    const creditNotes = await db.findMany("credit_notes", {
        where: { org_id: orgId, client_id: clientId },
        orderBy: [{ column: "date", direction: "desc" }],
    });
    // Exclude DRAFT and VOID from client portal
    return creditNotes.filter((cn) => cn.status !== shared_1.CreditNoteStatus.DRAFT && cn.status !== shared_1.CreditNoteStatus.VOID);
}
// ── Statement ──────────────────────────────────────────────────────────────
async function getPortalStatement(clientId, orgId, from, to) {
    return clientService.getClientStatement(orgId, clientId, from, to);
}
// ── Subscriptions ─────────────────────────────────────────────────────────
async function getPortalSubscriptions(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    const subscriptions = await db.findMany("subscriptions", {
        where: { org_id: orgId, client_id: clientId },
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    // Load plan details for each subscription
    const result = [];
    for (const sub of subscriptions) {
        let plan;
        try {
            plan = await subscriptionService.getPlan(orgId, sub.planId);
        }
        catch {
            // plan may have been deactivated
        }
        result.push({ ...sub, plan });
    }
    return result;
}
async function getPortalSubscription(clientId, orgId, subscriptionId) {
    const db = await (0, index_1.getDB)();
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    // Verify this subscription belongs to the client
    if (subscription.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this subscription");
    }
    // Load plan details
    let plan;
    try {
        plan = await subscriptionService.getPlan(orgId, subscription.planId);
    }
    catch {
        // plan may have been deactivated
    }
    // Load events
    const events = await db.findMany("subscription_events", {
        where: { subscription_id: subscriptionId, org_id: orgId },
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
    return { ...subscription, plan, events };
}
async function getPortalPlans(orgId) {
    return subscriptionService.listPlans(orgId);
}
async function portalChangePlan(clientId, orgId, subscriptionId, newPlanId) {
    const db = await (0, index_1.getDB)();
    // Verify subscription belongs to client
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if (subscription.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this subscription");
    }
    // Delegate to subscription service (prorate by default for portal changes)
    return subscriptionService.changePlan(orgId, subscriptionId, {
        newPlanId,
        prorate: true,
    });
}
async function portalCancelSubscription(clientId, orgId, subscriptionId, reason) {
    const db = await (0, index_1.getDB)();
    // Verify subscription belongs to client
    const subscription = await db.findById("subscriptions", subscriptionId, orgId);
    if (!subscription)
        throw (0, AppError_1.NotFoundError)("Subscription");
    if (subscription.clientId !== clientId) {
        throw (0, AppError_1.ForbiddenError)("You do not have access to this subscription");
    }
    // Portal cancellations happen at period end (not immediately)
    return subscriptionService.cancelSubscription(orgId, subscriptionId, {
        reason,
        cancelImmediately: false,
    });
}
// ── Payment Method ────────────────────────────────────────────────────────
async function getPortalPaymentMethod(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    return {
        paymentGateway: client.paymentGateway ?? null,
        last4: client.paymentMethodLast4 ?? null,
        brand: client.paymentMethodBrand ?? null,
        hasPaymentMethod: !!(client.paymentGateway && client.paymentMethodId),
    };
}
async function updatePortalPaymentMethod(clientId, orgId, data) {
    const db = await (0, index_1.getDB)();
    await db.update("clients", clientId, {
        paymentGateway: data.paymentGateway,
        paymentMethodId: data.paymentMethodId,
        paymentMethodLast4: data.last4,
        paymentMethodBrand: data.brand,
        updatedAt: new Date(),
    }, orgId);
    return getPortalPaymentMethod(clientId, orgId);
}
async function removePortalPaymentMethod(clientId, orgId) {
    const db = await (0, index_1.getDB)();
    await db.update("clients", clientId, {
        paymentGateway: null,
        paymentMethodId: null,
        paymentMethodLast4: null,
        paymentMethodBrand: null,
        updatedAt: new Date(),
    }, orgId);
    return { hasPaymentMethod: false, paymentGateway: null, last4: null, brand: null };
}
//# sourceMappingURL=portal.service.js.map