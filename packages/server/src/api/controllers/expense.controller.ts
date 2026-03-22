import type { Request, Response } from "express";
import * as expenseService from "../../services/expense/expense.service";

export async function listExpenses(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string>;
  const opts = {
    page: parseInt(query.page || "1"),
    limit: parseInt(query.limit || "20"),
    sortOrder: (query.sortOrder as "asc" | "desc") || "desc",
    search: query.search || undefined,
    categoryId: query.categoryId,
    clientId: query.clientId,
    status: query.status as Parameters<typeof expenseService.listExpenses>[1]["status"],
    isBillable: query.isBillable !== undefined ? query.isBillable === "true" : undefined,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
  const result = await expenseService.listExpenses(req.user!.orgId, opts);
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getExpense(req: Request, res: Response): Promise<void> {
  const expense = await expenseService.getExpense(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: expense });
}

export async function createExpense(req: Request, res: Response): Promise<void> {
  const expense = await expenseService.createExpense(req.user!.orgId, req.user!.id, req.body);
  res.status(201).json({ success: true, data: expense });
}

export async function updateExpense(req: Request, res: Response): Promise<void> {
  const expense = await expenseService.updateExpense(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: expense });
}

export async function deleteExpense(req: Request, res: Response): Promise<void> {
  await expenseService.deleteExpense(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function approveExpense(req: Request, res: Response): Promise<void> {
  const expense = await expenseService.approveExpense(req.user!.orgId, req.params.id as string, req.user!.id);
  res.json({ success: true, data: expense });
}

export async function rejectExpense(req: Request, res: Response): Promise<void> {
  const expense = await expenseService.rejectExpense(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: expense });
}

export async function billExpenseToClient(req: Request, res: Response): Promise<void> {
  const result = await expenseService.billExpenseToClient(req.user!.orgId, req.params.id as string, req.user!.id);
  res.json({ success: true, data: result });
}

export async function listCategories(req: Request, res: Response): Promise<void> {
  const categories = await expenseService.listCategories(req.user!.orgId);
  res.json({ success: true, data: categories });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const category = await expenseService.createCategory(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: category });
}
