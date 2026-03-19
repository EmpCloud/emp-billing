import type { Request, Response } from "express";
import * as searchService from "../../services/search/search.service";

export async function globalSearch(req: Request, res: Response): Promise<void> {
  const q = (req.query.q as string) || "";
  const results = await searchService.globalSearch(req.user!.orgId, q);
  res.json({ success: true, data: results });
}
