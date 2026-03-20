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
Object.defineProperty(exports, "__esModule", { value: true });
exports.portalLogin = portalLogin;
exports.getPortalDashboard = getPortalDashboard;
exports.getPortalInvoices = getPortalInvoices;
exports.getPortalInvoice = getPortalInvoice;
exports.getPortalInvoicePdf = getPortalInvoicePdf;
exports.getPortalQuotes = getPortalQuotes;
exports.acceptPortalQuote = acceptPortalQuote;
exports.declinePortalQuote = declinePortalQuote;
exports.getPortalCreditNotes = getPortalCreditNotes;
exports.getPortalPayments = getPortalPayments;
exports.getPortalStatement = getPortalStatement;
exports.getPortalDisputes = getPortalDisputes;
exports.createPortalDispute = createPortalDispute;
exports.getPortalDispute = getPortalDispute;
exports.getPortalSubscriptions = getPortalSubscriptions;
exports.getPortalSubscription = getPortalSubscription;
exports.getPortalPlans = getPortalPlans;
exports.portalChangePlan = portalChangePlan;
exports.portalCancelSubscription = portalCancelSubscription;
exports.getPortalPaymentMethod = getPortalPaymentMethod;
exports.updatePortalPaymentMethod = updatePortalPaymentMethod;
exports.removePortalPaymentMethod = removePortalPaymentMethod;
const portalService = __importStar(require("../../services/portal/portal.service"));
const disputeService = __importStar(require("../../services/dispute/dispute.service"));
// ── Login (no auth required) ──────────────────────────────────────────────
async function portalLogin(req, res) {
    const { email, token } = req.body;
    const result = await portalService.portalLogin(email, token);
    res.json({ success: true, data: result });
}
// ── Dashboard ──────────────────────────────────────────────────────────────
async function getPortalDashboard(req, res) {
    const { clientId, orgId } = req.portalClient;
    const dashboard = await portalService.getPortalDashboard(clientId, orgId);
    res.json({ success: true, data: dashboard });
}
// ── Invoices ───────────────────────────────────────────────────────────────
async function getPortalInvoices(req, res) {
    const { clientId, orgId } = req.portalClient;
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
    };
    const result = await portalService.getPortalInvoices(clientId, orgId, opts);
    res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
}
async function getPortalInvoice(req, res) {
    const { clientId, orgId } = req.portalClient;
    const invoice = await portalService.getPortalInvoice(clientId, orgId, req.params.id);
    res.json({ success: true, data: invoice });
}
async function getPortalInvoicePdf(req, res) {
    const { clientId, orgId } = req.portalClient;
    const pdfBuffer = await portalService.getPortalInvoicePdf(clientId, orgId, req.params.id);
    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${req.params.id}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
}
// ── Quotes ─────────────────────────────────────────────────────────────────
async function getPortalQuotes(req, res) {
    const { clientId, orgId } = req.portalClient;
    const quotes = await portalService.getPortalQuotes(clientId, orgId);
    res.json({ success: true, data: quotes });
}
async function acceptPortalQuote(req, res) {
    const { clientId, orgId } = req.portalClient;
    const quote = await portalService.acceptPortalQuote(clientId, orgId, req.params.id);
    res.json({ success: true, data: quote });
}
async function declinePortalQuote(req, res) {
    const { clientId, orgId } = req.portalClient;
    const quote = await portalService.declinePortalQuote(clientId, orgId, req.params.id);
    res.json({ success: true, data: quote });
}
// ── Credit Notes ────────────────────────────────────────────────────────────
async function getPortalCreditNotes(req, res) {
    const { clientId, orgId } = req.portalClient;
    const creditNotes = await portalService.getPortalCreditNotes(clientId, orgId);
    res.json({ success: true, data: creditNotes });
}
// ── Payments ───────────────────────────────────────────────────────────────
async function getPortalPayments(req, res) {
    const { clientId, orgId } = req.portalClient;
    const payments = await portalService.getPortalPayments(clientId, orgId);
    res.json({ success: true, data: payments });
}
// ── Statement ──────────────────────────────────────────────────────────────
async function getPortalStatement(req, res) {
    const { clientId, orgId } = req.portalClient;
    const query = req.query;
    const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), 0, 1);
    const to = query.to ? new Date(query.to) : new Date();
    const statement = await portalService.getPortalStatement(clientId, orgId, from, to);
    res.json({ success: true, data: statement });
}
// ── Disputes ──────────────────────────────────────────────────────────────
async function getPortalDisputes(req, res) {
    const { clientId, orgId } = req.portalClient;
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        sortOrder: "desc",
        clientId,
    };
    const result = await disputeService.listDisputes(orgId, opts);
    res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
}
async function createPortalDispute(req, res) {
    const { clientId, orgId } = req.portalClient;
    const dispute = await disputeService.createDispute(orgId, clientId, req.body);
    res.status(201).json({ success: true, data: dispute });
}
async function getPortalDispute(req, res) {
    const { clientId, orgId } = req.portalClient;
    const dispute = await disputeService.getDispute(orgId, req.params.id);
    // Verify this dispute belongs to the client
    if (dispute.clientId !== clientId) {
        res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You do not have access to this dispute" } });
        return;
    }
    res.json({ success: true, data: dispute });
}
// ── Subscriptions ────────────────────────────────────────────────────────
async function getPortalSubscriptions(req, res) {
    const { clientId, orgId } = req.portalClient;
    const subscriptions = await portalService.getPortalSubscriptions(clientId, orgId);
    res.json({ success: true, data: subscriptions });
}
async function getPortalSubscription(req, res) {
    const { clientId, orgId } = req.portalClient;
    const subscription = await portalService.getPortalSubscription(clientId, orgId, req.params.id);
    res.json({ success: true, data: subscription });
}
async function getPortalPlans(req, res) {
    const { orgId } = req.portalClient;
    const plans = await portalService.getPortalPlans(orgId);
    res.json({ success: true, data: plans });
}
async function portalChangePlan(req, res) {
    const { clientId, orgId } = req.portalClient;
    const { newPlanId } = req.body;
    const subscription = await portalService.portalChangePlan(clientId, orgId, req.params.id, newPlanId);
    res.json({ success: true, data: subscription });
}
async function portalCancelSubscription(req, res) {
    const { clientId, orgId } = req.portalClient;
    const { reason } = req.body;
    const subscription = await portalService.portalCancelSubscription(clientId, orgId, req.params.id, reason);
    res.json({ success: true, data: subscription });
}
// ── Payment Method ────────────────────────────────────────────────────────
async function getPortalPaymentMethod(req, res) {
    const { clientId, orgId } = req.portalClient;
    const method = await portalService.getPortalPaymentMethod(clientId, orgId);
    res.json({ success: true, data: method });
}
async function updatePortalPaymentMethod(req, res) {
    const { clientId, orgId } = req.portalClient;
    const method = await portalService.updatePortalPaymentMethod(clientId, orgId, req.body);
    res.json({ success: true, data: method });
}
async function removePortalPaymentMethod(req, res) {
    const { clientId, orgId } = req.portalClient;
    const method = await portalService.removePortalPaymentMethod(clientId, orgId);
    res.json({ success: true, data: method });
}
//# sourceMappingURL=portal.controller.js.map