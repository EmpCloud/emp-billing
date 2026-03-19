import type { Request, Response } from "express";
import * as creditNoteService from "../../services/credit-note/credit-note.service";

export async function listCreditNotes(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    clientId: query.clientId,
    status: query.status,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    search: query.search,
  };
  const result = await creditNoteService.listCreditNotes(req.user!.orgId, opts);
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getCreditNote(req: Request, res: Response): Promise<void> {
  const creditNote = await creditNoteService.getCreditNote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: creditNote });
}

export async function createCreditNote(req: Request, res: Response): Promise<void> {
  const creditNote = await creditNoteService.createCreditNote(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: creditNote });
}

export async function applyCreditNote(req: Request, res: Response): Promise<void> {
  const creditNote = await creditNoteService.applyCreditNote(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: creditNote });
}

export async function voidCreditNote(req: Request, res: Response): Promise<void> {
  const creditNote = await creditNoteService.voidCreditNote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: creditNote });
}

export async function deleteCreditNote(req: Request, res: Response): Promise<void> {
  await creditNoteService.deleteCreditNote(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function getCreditNotePdf(req: Request, res: Response): Promise<void> {
  const pdfBuffer = await creditNoteService.getCreditNotePdf(req.user!.orgId, req.params.id as string);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="credit-note-${req.params.id as string}.pdf"`,
    "Content-Length": pdfBuffer.length,
  });
  res.send(pdfBuffer);
}
