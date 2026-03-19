import type { Request, Response } from "express";
import * as paymentService from "../../services/payment/payment.service";

export async function listPayments(req: Request, res: Response): Promise<void> {
  const q = req.query as Record<string, string>;
  const result = await paymentService.listPayments(req.user!.orgId, {
    page: parseInt(q.page || "1"),
    limit: parseInt(q.limit || "20"),
    sortOrder: (q.sortOrder as "asc" | "desc") || "desc",
    clientId: q.clientId,
    invoiceId: q.invoiceId,
    method: q.method as Parameters<typeof paymentService.listPayments>[1]["method"],
    from: q.from ? new Date(q.from) : undefined,
    to: q.to ? new Date(q.to) : undefined,
  });
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getPayment(req: Request, res: Response): Promise<void> {
  const payment = await paymentService.getPayment(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: payment });
}

export async function recordPayment(req: Request, res: Response): Promise<void> {
  const payment = await paymentService.recordPayment(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: payment });
}

export async function deletePayment(req: Request, res: Response): Promise<void> {
  await paymentService.deletePayment(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function refundPayment(req: Request, res: Response): Promise<void> {
  const refund = await paymentService.refundPayment(req.user!.orgId, req.params.id as string, req.user!.id, req.body);
  res.status(201).json({ success: true, data: refund });
}

export async function downloadReceipt(req: Request, res: Response): Promise<void> {
  const pdfBuffer = await paymentService.getPaymentReceiptPdf(req.user!.orgId, req.params.id as string);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="receipt-${req.params.id as string}.pdf"`,
    "Content-Length": pdfBuffer.length,
  });
  res.send(pdfBuffer);
}
