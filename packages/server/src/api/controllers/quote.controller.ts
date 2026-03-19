import type { Request, Response } from "express";
import * as quoteService from "../../services/quote/quote.service";

export async function listQuotes(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    status: query.status as Parameters<typeof quoteService.listQuotes>[1]["status"],
    clientId: query.clientId,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    search: query.search,
  };
  const result = await quoteService.listQuotes(req.user!.orgId, opts);
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getQuote(req: Request, res: Response): Promise<void> {
  const quote = await quoteService.getQuote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: quote });
}

export async function createQuote(req: Request, res: Response): Promise<void> {
  const quote = await quoteService.createQuote(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: quote });
}

export async function updateQuote(req: Request, res: Response): Promise<void> {
  const quote = await quoteService.updateQuote(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: quote });
}

export async function deleteQuote(req: Request, res: Response): Promise<void> {
  await quoteService.deleteQuote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function sendQuote(req: Request, res: Response): Promise<void> {
  const quote = await quoteService.sendQuote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: quote });
}

export async function convertToInvoice(req: Request, res: Response): Promise<void> {
  const result = await quoteService.convertToInvoice(req.user!.orgId, req.params.id as string, req.user!.id);
  res.status(201).json({ success: true, data: result });
}

export async function acceptQuote(req: Request, res: Response): Promise<void> {
  const quote = await quoteService.acceptQuote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: quote });
}

export async function declineQuote(req: Request, res: Response): Promise<void> {
  const quote = await quoteService.declineQuote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: quote });
}

export async function getQuotePdf(req: Request, res: Response): Promise<void> {
  const pdfBuffer = await quoteService.getQuotePdf(req.user!.orgId, req.params.id as string);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="quote-${req.params.id as string}.pdf"`,
    "Content-Length": pdfBuffer.length,
  });
  res.send(pdfBuffer);
}
