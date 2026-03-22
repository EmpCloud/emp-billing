import type { Request, Response } from "express";
import * as clientService from "../../services/client/client.service";

export async function listClients(req: Request, res: Response): Promise<void> {
  const { page = "1", limit = "20", search, tags, isActive } = req.query as Record<string, string>;
  const result = await clientService.listClients(req.user!.orgId, {
    search,
    tags,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    page: parseInt(page),
    limit: parseInt(limit),
  });
  res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}

export async function getClient(req: Request, res: Response): Promise<void> {
  const client = await clientService.getClient(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: client });
}

export async function createClient(req: Request, res: Response): Promise<void> {
  const client = await clientService.createClient(req.user!.orgId, req.body);
  res.status(201).json({ success: true, data: client });
}

export async function updateClient(req: Request, res: Response): Promise<void> {
  const client = await clientService.updateClient(req.user!.orgId, req.params.id as string, req.body);
  res.json({ success: true, data: client });
}

export async function deleteClient(req: Request, res: Response): Promise<void> {
  await clientService.deleteClient(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: null });
}

export async function listContacts(req: Request, res: Response): Promise<void> {
  const contacts = await clientService.listContacts(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: contacts });
}

export async function addContact(req: Request, res: Response): Promise<void> {
  const contact = await clientService.addContact(req.user!.orgId, req.params.id as string, req.body);
  res.status(201).json({ success: true, data: contact });
}

export async function getClientStatement(req: Request, res: Response): Promise<void> {
  const { from, to } = req.query as Record<string, string>;
  const statement = await clientService.getClientStatement(
    req.user!.orgId,
    req.params.id as string,
    new Date(from || new Date(new Date().getFullYear(), 0, 1)),
    new Date(to || new Date())
  );
  res.json({ success: true, data: statement });
}

export async function getClientBalance(req: Request, res: Response): Promise<void> {
  const balance = await clientService.getClientBalance(req.user!.orgId, req.params.id as string);
  res.json({ success: true, data: balance });
}

export async function updatePaymentMethod(req: Request, res: Response): Promise<void> {
  const client = await clientService.updatePaymentMethod(
    req.user!.orgId,
    req.params.id as string,
    req.body
  );
  res.json({ success: true, data: client });
}

export async function removePaymentMethod(req: Request, res: Response): Promise<void> {
  const client = await clientService.removePaymentMethod(
    req.user!.orgId,
    req.params.id as string
  );
  res.json({ success: true, data: client });
}

export async function autoProvisionClient(req: Request, res: Response): Promise<void> {
  const result = await clientService.autoProvisionClient(req.user!.orgId, req.body);
  const status = result.isNew ? 201 : 200;
  res.status(status).json({ success: true, data: result });
}
