import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, ConflictError } from "../../utils/AppError";
import { formatMoney } from "@emp-billing/shared";
import type { Client, ClientContact } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateClientSchema, UpdateClientSchema } from "@emp-billing/shared";

// ============================================================================
// CLIENT SERVICE
// ============================================================================

export async function listClients(
  orgId: string,
  opts: { search?: string; tags?: string; isActive?: boolean; page: number; limit: number }
) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (opts.isActive !== undefined) where.is_active = opts.isActive;

  const result = await db.findPaginated<Client>("clients", {
    where,
    page: opts.page,
    limit: opts.limit,
    orderBy: [{ column: "name", direction: "asc" }],
  });

  let data = result.data.map((c) => ({
    ...c,
    tags: typeof c.tags === "string" ? safeParseJSON(c.tags, []) : (c.tags ?? []),
    billingAddress: typeof c.billingAddress === "string" ? safeParseJSON(c.billingAddress, null) : c.billingAddress,
    shippingAddress: typeof c.shippingAddress === "string" ? safeParseJSON(c.shippingAddress, null) : c.shippingAddress,
    customFields: typeof c.customFields === "string" ? safeParseJSON(c.customFields, null) : c.customFields,
  })) as Client[];

  if (opts.search) {
    const q = opts.search.toLowerCase();
    data = data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q)
    );
  }

  if (opts.tags) {
    const filterTags = opts.tags.split(",").map((t) => t.trim().toLowerCase());
    data = data.filter((c) => {
      const raw = c.tags;
      const clientTags: string[] = Array.isArray(raw)
        ? raw
        : typeof raw === "string"
          ? safeParseJSON(raw, [])
          : [];
      return filterTags.some((ft) =>
        clientTags.some((ct) => ct.toLowerCase().includes(ft))
      );
    });
  }

  return { ...result, data };
}

export async function getClient(orgId: string, id: string): Promise<Client & { contacts: ClientContact[] }> {
  const db = await getDB();
  const client = await db.findById<Client>("clients", id, orgId);
  if (!client) throw NotFoundError("Client");

  // Parse JSON string fields returned from DB
  if (typeof client.billingAddress === "string") client.billingAddress = safeParseJSON(client.billingAddress, null) as unknown as Client["billingAddress"];
  if (typeof client.shippingAddress === "string") client.shippingAddress = safeParseJSON(client.shippingAddress, null) as unknown as Client["shippingAddress"];
  if (typeof client.tags === "string") client.tags = safeParseJSON(client.tags, []);
  if (typeof client.customFields === "string") client.customFields = safeParseJSON(client.customFields, null) as unknown as Client["customFields"];

  const contacts = await db.findMany<ClientContact>("client_contacts", {
    where: { client_id: id },
    orderBy: [{ column: "is_primary", direction: "desc" }],
  });

  return { ...client, contacts };
}

export async function createClient(
  orgId: string,
  input: z.infer<typeof CreateClientSchema>
): Promise<Client> {
  const db = await getDB();

  const existing = await db.findOne("clients", { org_id: orgId, email: input.email });
  if (existing) throw ConflictError(`A client with email '${input.email}' already exists`);

  const clientId = uuid();
  const now = new Date();

  const { contacts, ...clientData } = input;

  await db.create<Client>("clients", {
    id: clientId,
    orgId,
    ...clientData,
    billingAddress: clientData.billingAddress ? JSON.stringify(clientData.billingAddress) : null,
    shippingAddress: clientData.shippingAddress ? JSON.stringify(clientData.shippingAddress) : null,
    tags: JSON.stringify(clientData.tags ?? []),
    customFields: clientData.customFields ? JSON.stringify(clientData.customFields) : null,
    outstandingBalance: 0,
    totalBilled: 0,
    totalPaid: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Create contacts
  if (contacts?.length) {
    await db.createMany(
      "client_contacts",
      contacts.map((c) => ({
        id: uuid(),
        clientId,
        orgId,
        ...c,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  return getClient(orgId, clientId);
}

export async function updateClient(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateClientSchema>
): Promise<Client> {
  const db = await getDB();
  const existing = await db.findById("clients", id, orgId);
  if (!existing) throw NotFoundError("Client");

  if (input.email && input.email !== (existing as Client).email) {
    const conflict = await db.findOne("clients", { org_id: orgId, email: input.email });
    if (conflict) throw ConflictError(`A client with email '${input.email}' already exists`);
  }

  const { contacts, ...clientData } = input;
  const updateData: Record<string, unknown> = { ...clientData, updatedAt: new Date() };

  if (clientData.billingAddress) updateData.billingAddress = JSON.stringify(clientData.billingAddress);
  if (clientData.shippingAddress) updateData.shippingAddress = JSON.stringify(clientData.shippingAddress);
  if (clientData.tags) updateData.tags = JSON.stringify(clientData.tags);
  if (clientData.customFields) updateData.customFields = JSON.stringify(clientData.customFields);

  await db.update("clients", id, updateData, orgId);
  return getClient(orgId, id);
}

export async function deleteClient(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById("clients", id, orgId);
  if (!existing) throw NotFoundError("Client");
  await db.softDelete("clients", id, orgId);
}

// ── Contacts ─────────────────────────────────────────────────────────────────

export async function addContact(orgId: string, clientId: string, input: ClientContact): Promise<ClientContact> {
  const db = await getDB();
  const client = await db.findById("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // If new contact is primary, demote others
  if (input.isPrimary) {
    await db.updateMany("client_contacts", { client_id: clientId }, { is_primary: false, updated_at: new Date() });
  }

  const now = new Date();
  const { id: _inputId, ...contactData } = input;
  return db.create<ClientContact>("client_contacts", {
    id: uuid(),
    clientId,
    orgId,
    ...contactData,
    createdAt: now,
    updatedAt: now,
  });
}

export async function listContacts(orgId: string, clientId: string): Promise<ClientContact[]> {
  const db = await getDB();
  const client = await db.findById("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");
  return db.findMany<ClientContact>("client_contacts", {
    where: { client_id: clientId },
    orderBy: [{ column: "is_primary", direction: "desc" }],
  });
}

// ── Statement ─────────────────────────────────────────────────────────────────

export interface StatementEntry {
  date: Date;
  type: "invoice" | "payment" | "credit_note";
  number: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function getClientStatement(
  orgId: string,
  clientId: string,
  from: Date,
  to: Date
): Promise<{ client: Client; entries: StatementEntry[]; openingBalance: number; closingBalance: number; currency: string }> {
  const db = await getDB();

  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Invoices
  const invoices = await db.findMany<Record<string, unknown>>("invoices", {
    where: { org_id: orgId, client_id: clientId },
    orderBy: [{ column: "issue_date", direction: "asc" }],
  });

  // Payments
  const payments = await db.findMany<Record<string, unknown>>("payments", {
    where: { org_id: orgId, client_id: clientId },
    orderBy: [{ column: "date", direction: "asc" }],
  });

  const entries: StatementEntry[] = [];
  let balance = 0;

  // Merge and sort
  const allEvents = [
    ...invoices
      .filter((i) => new Date(i.issueDate as string) >= from && new Date(i.issueDate as string) <= to)
      .map((i) => ({ type: "invoice" as const, date: new Date(i.issueDate as string), data: i })),
    ...payments
      .filter((p) => new Date(p.date as string) >= from && new Date(p.date as string) <= to)
      .map((p) => ({ type: "payment" as const, date: new Date(p.date as string), data: p })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const event of allEvents) {
    if (event.type === "invoice") {
      const inv = event.data;
      const amount = inv.total as number;
      balance += amount;
      entries.push({
        date: event.date,
        type: "invoice",
        number: inv.invoiceNumber as string,
        description: `Invoice ${inv.invoiceNumber}`,
        debit: amount,
        credit: 0,
        balance,
      });
    } else {
      const pay = event.data;
      const amount = pay.amount as number;
      balance -= amount;
      entries.push({
        date: event.date,
        type: "payment",
        number: pay.paymentNumber as string,
        description: `Payment ${pay.paymentNumber}`,
        debit: 0,
        credit: amount,
        balance,
      });
    }
  }

  return {
    client,
    entries,
    openingBalance: 0,
    closingBalance: balance,
    currency: client.currency,
  };
}

// ── Balance ─────────────────────────────────────────────────────────────────

export async function getClientBalance(orgId: string, clientId: string) {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  return {
    clientId,
    outstandingBalance: client.outstandingBalance,
    totalBilled: client.totalBilled,
    totalPaid: client.totalPaid,
    currency: client.currency,
    formatted: {
      outstandingBalance: formatMoney(client.outstandingBalance, client.currency),
      totalBilled: formatMoney(client.totalBilled, client.currency),
      totalPaid: formatMoney(client.totalPaid, client.currency),
    },
  };
}

// ── Payment Method ───────────────────────────────────────────────────────────

export async function updatePaymentMethod(
  orgId: string,
  clientId: string,
  data: { paymentGateway: string; paymentMethodId: string; last4: string; brand: string }
): Promise<Client> {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  await db.update("clients", clientId, {
    paymentGateway: data.paymentGateway,
    paymentMethodId: data.paymentMethodId,
    paymentMethodLast4: data.last4,
    paymentMethodBrand: data.brand,
    updatedAt: new Date(),
  }, orgId);

  return (await db.findById<Client>("clients", clientId, orgId))!;
}

export async function removePaymentMethod(
  orgId: string,
  clientId: string
): Promise<Client> {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  await db.update("clients", clientId, {
    paymentGateway: null,
    paymentMethodId: null,
    paymentMethodLast4: null,
    paymentMethodBrand: null,
    updatedAt: new Date(),
  }, orgId);

  return (await db.findById<Client>("clients", clientId, orgId))!;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
