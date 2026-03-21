import type { Request, Response } from "express";
import * as invoiceService from "../../services/invoice/invoice.service";

export async function listInvoices(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    status: query.status as Parameters<typeof invoiceService.listInvoices>[1]["status"],
    clientId: query.clientId,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    search: query.search,
    overdue: query.overdue === "true",
  };
  const result = await invoiceService.listInvoices(req.user!.orgId, opts);
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceService.getInvoice(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: invoice });
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const { autoSend, attachments, ...input } = req.body;
  const invoice = await invoiceService.createInvoice(req.user!.orgId, req.user!.id, input);

  // If autoSend is true, attempt to send — but don't fail the creation
  if (autoSend === true) {
    try {
      const sentInvoice = await invoiceService.sendInvoice(req.user!.orgId, invoice.id);
      res.status(201).json({ success: true, data: { ...invoice, ...sentInvoice } });
      return;
    } catch {
      // Send failed but invoice was created — return it anyway
      res.status(201).json({ success: true, data: invoice });
      return;
    }
  }

  res.status(201).json({ success: true, data: invoice });
}

export async function updateInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceService.updateInvoice(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: invoice });
}

export async function deleteInvoice(req: Request, res: Response): Promise<void> {
  await invoiceService.deleteInvoice(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function sendInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceService.sendInvoice(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: invoice });
}

export async function duplicateInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceService.duplicateInvoice(req.user!.orgId, req.params.id as string, req.user!.id);
  res.status(201).json({ success: true, data: invoice });
}

export async function voidInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceService.voidInvoice(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: invoice });
}

export async function writeOffInvoice(req: Request, res: Response): Promise<void> {
  const invoice = await invoiceService.writeOffInvoice(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: invoice });
}

export async function getInvoicePdf(req: Request, res: Response): Promise<void> {
  const pdfBuffer = await invoiceService.getInvoicePdf(req.user!.orgId, req.params.id as string);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="invoice-${req.params.id as string}.pdf"`,
    "Content-Length": pdfBuffer.length,
  });
  res.send(pdfBuffer);
}

export async function getInvoicePayments(req: Request, res: Response): Promise<void> {
  const payments = await invoiceService.getInvoicePayments(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: payments });
}

export async function bulkDownloadPdf(req: Request, res: Response): Promise<void> {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: "INVALID_IDS", message: "ids must be a non-empty array" },
    });
    return;
  }

  if (ids.length > 50) {
    res.status(400).json({
      success: false,
      error: { code: "TOO_MANY_IDS", message: "Maximum 50 invoices per bulk download" },
    });
    return;
  }

  const zipBuffer = await invoiceService.bulkGeneratePdfZip(req.user!.orgId, ids as string[]);

  res.set({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="invoices-${Date.now()}.zip"`,
    "Content-Length": String(zipBuffer.length),
  });
  res.send(zipBuffer);
}
