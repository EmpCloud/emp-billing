import type { Request, Response } from "express";
import * as portalService from "../../services/portal/portal.service";
import * as disputeService from "../../services/dispute/dispute.service";

// ── Login (no auth required) ──────────────────────────────────────────────

export async function portalLogin(req: Request, res: Response): Promise<void> {
  const { email, token } = req.body;
  const result = await portalService.portalLogin(email, token);
  res.json({ success: true, data: result });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getPortalDashboard(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const dashboard = await portalService.getPortalDashboard(clientId, orgId);
  res.json({ success: true, data: dashboard });
}

// ── Invoices ───────────────────────────────────────────────────────────────

export async function getPortalInvoices(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const query = req.query as Record<string, string>;
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

export async function getPortalInvoice(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const invoice = await portalService.getPortalInvoice(clientId, orgId, req.params.id as string);
  res.json({ success: true, data: invoice });
}

export async function getPortalInvoicePdf(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const pdfBuffer = await portalService.getPortalInvoicePdf(clientId, orgId, req.params.id as string);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="invoice-${req.params.id as string}.pdf"`,
    "Content-Length": String(pdfBuffer.length),
  });
  res.send(pdfBuffer);
}

// ── Quotes ─────────────────────────────────────────────────────────────────

export async function getPortalQuotes(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const quotes = await portalService.getPortalQuotes(clientId, orgId);
  res.json({ success: true, data: quotes });
}

export async function acceptPortalQuote(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const quote = await portalService.acceptPortalQuote(clientId, orgId, req.params.id as string);
  res.json({ success: true, data: quote });
}

export async function declinePortalQuote(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const quote = await portalService.declinePortalQuote(clientId, orgId, req.params.id as string);
  res.json({ success: true, data: quote });
}

// ── Credit Notes ────────────────────────────────────────────────────────────

export async function getPortalCreditNotes(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const creditNotes = await portalService.getPortalCreditNotes(clientId, orgId);
  res.json({ success: true, data: creditNotes });
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function getPortalPayments(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const payments = await portalService.getPortalPayments(clientId, orgId);
  res.json({ success: true, data: payments });
}

// ── Statement ──────────────────────────────────────────────────────────────

export async function getPortalStatement(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const query = req.query as Record<string, string>;

  const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), 0, 1);
  const to = query.to ? new Date(query.to) : new Date();

  const statement = await portalService.getPortalStatement(clientId, orgId, from, to);
  res.json({ success: true, data: statement });
}

// ── Disputes ──────────────────────────────────────────────────────────────

export async function getPortalDisputes(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: "desc" as const,
    clientId,
  };
  const result = await disputeService.listDisputes(orgId, opts);
  res.json({
    success: true,
    data: result.data,
    meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
  });
}

export async function createPortalDispute(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const dispute = await disputeService.createDispute(orgId, clientId, req.body);
  res.status(201).json({ success: true, data: dispute });
}

export async function getPortalDispute(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const dispute = await disputeService.getDispute(orgId, req.params.id as string);
  // Verify this dispute belongs to the client
  if (dispute.clientId !== clientId) {
    res.status(403).json({ success: false, error: { code: "FORBIDDEN", message: "You do not have access to this dispute" } });
    return;
  }
  res.json({ success: true, data: dispute });
}

// ── Subscriptions ────────────────────────────────────────────────────────

export async function getPortalSubscriptions(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const subscriptions = await portalService.getPortalSubscriptions(clientId, orgId);
  res.json({ success: true, data: subscriptions });
}

export async function getPortalSubscription(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const subscription = await portalService.getPortalSubscription(clientId, orgId, req.params.id as string);
  res.json({ success: true, data: subscription });
}

export async function getPortalPlans(req: Request, res: Response): Promise<void> {
  const { orgId } = req.portalClient!;
  const plans = await portalService.getPortalPlans(orgId);
  res.json({ success: true, data: plans });
}

export async function portalChangePlan(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const { newPlanId } = req.body;
  const subscription = await portalService.portalChangePlan(clientId, orgId, req.params.id as string, newPlanId);
  res.json({ success: true, data: subscription });
}

export async function portalCancelSubscription(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const { reason } = req.body;
  const subscription = await portalService.portalCancelSubscription(clientId, orgId, req.params.id as string, reason);
  res.json({ success: true, data: subscription });
}

// ── Payment Method ────────────────────────────────────────────────────────

export async function getPortalPaymentMethod(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const method = await portalService.getPortalPaymentMethod(clientId, orgId);
  res.json({ success: true, data: method });
}

export async function updatePortalPaymentMethod(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const method = await portalService.updatePortalPaymentMethod(clientId, orgId, req.body);
  res.json({ success: true, data: method });
}

export async function removePortalPaymentMethod(req: Request, res: Response): Promise<void> {
  const { clientId, orgId } = req.portalClient!;
  const method = await portalService.removePortalPaymentMethod(clientId, orgId);
  res.json({ success: true, data: method });
}
