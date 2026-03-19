import type { Request, Response } from "express";
import * as csvService from "../../services/import-export/csv.service";

// ============================================================================
// IMPORT / EXPORT CONTROLLER
// ============================================================================

// ── Clients ──────────────────────────────────────────────────────────────────

export async function exportClients(req: Request, res: Response): Promise<void> {
  const csv = await csvService.exportClientsCSV(req.user!.orgId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=clients.csv");
  res.send(csv);
}

export async function importClients(req: Request, res: Response): Promise<void> {
  const { csv } = req.body as { csv: string };
  const result = await csvService.importClientsCSV(req.user!.orgId, csv);
  res.json({ success: true, data: result });
}

// ── Products ─────────────────────────────────────────────────────────────────

export async function exportProducts(req: Request, res: Response): Promise<void> {
  const csv = await csvService.exportProductsCSV(req.user!.orgId);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=products.csv");
  res.send(csv);
}

export async function importProducts(req: Request, res: Response): Promise<void> {
  const { csv } = req.body as { csv: string };
  const result = await csvService.importProductsCSV(req.user!.orgId, csv);
  res.json({ success: true, data: result });
}
