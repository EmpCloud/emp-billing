import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, ConflictError } from "../../utils/AppError";
import { formatMoney } from "@emp-billing/shared";
import { emit } from "../../events/index";
import type { Client, ClientContact } from "@emp-billing/shared";
import crypto from "crypto";
import type { z } from "zod";
import type { CreateClientSchema, UpdateClientSchema, AutoProvisionClientSchema } from "@emp-billing/shared";
import { config } from "../../config/index";

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
): Promise<Client & { portalToken?: string }> {
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

  // Create portal access if portalEnabled
  let portalToken: string | undefined;
  if (clientData.portalEnabled) {
    portalToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(portalToken).digest("hex");

    await db.create("client_portal_access", {
      id: uuid(),
      clientId,
      orgId,
      email: clientData.portalEmail || input.email,
      tokenHash,
      expiresAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const createdClient = await getClient(orgId, clientId);

  emit("client.created", {
    orgId,
    clientId,
    client: createdClient as unknown as Record<string, unknown>,
  });

  return { ...createdClient, portalToken };
}

export async function updateClient(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateClientSchema>
): Promise<Client & { portalToken?: string }> {
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

  // Handle portal access changes
  const wasPortalEnabled = (existing as Client).portalEnabled;
  const isPortalEnabled = input.portalEnabled;

  if (isPortalEnabled === true && !wasPortalEnabled) {
    // Enabling portal — create access record with new token
    const portalEmail = input.portalEmail || (existing as Client).email;
    const portalToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(portalToken).digest("hex");
    const now = new Date();

    await db.create("client_portal_access", {
      id: uuid(),
      clientId: id,
      orgId,
      email: portalEmail,
      tokenHash,
      expiresAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const updatedClient = await getClient(orgId, id);
    return { ...updatedClient, portalToken };
  } else if (isPortalEnabled === false && wasPortalEnabled) {
    // Disabling portal — deactivate all access records
    const accessRecords = await db.findMany("client_portal_access", {
      where: { client_id: id, org_id: orgId },
    });
    for (const record of accessRecords) {
      await db.update("client_portal_access", (record as { id: string }).id, {
        isActive: false,
        updatedAt: new Date(),
      });
    }
  }

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

// ── Auto-Provision ───────────────────────────────────────────────────────────

export interface AutoProvisionResult {
  client: Client;
  isNew: boolean;
  portalUrl?: string;
  portalToken?: string;
}

export async function autoProvisionClient(
  orgId: string,
  input: z.infer<typeof AutoProvisionClientSchema>
): Promise<AutoProvisionResult> {
  const db = await getDB();

  // Check if a client with this email already exists for the org
  const existing = await db.findOne<Client>("clients", { org_id: orgId, email: input.email });
  if (existing) {
    // Parse JSON fields for consistent output
    const client = await getClient(orgId, existing.id);
    return { client, isNew: false };
  }

  // Resolve currency: use provided value, or fall back to org default
  let currency = input.currency;
  if (!currency) {
    const org = await db.findById<Record<string, unknown>>("organizations", orgId);
    currency = (org?.defaultCurrency as string) ?? "INR";
  }

  // Create the client with sensible defaults
  const clientId = uuid();
  const now = new Date();

  await db.create<Client>("clients", {
    id: clientId,
    orgId,
    name: input.name,
    displayName: input.company || input.name,
    email: input.email,
    phone: input.phone || null,
    currency,
    paymentTerms: 30,
    tags: JSON.stringify([]),
    customFields: input.metadata ? JSON.stringify(input.metadata) : null,
    outstandingBalance: 0,
    totalBilled: 0,
    totalPaid: 0,
    portalEnabled: input.enablePortal ?? false,
    portalEmail: input.enablePortal ? input.email : null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Optionally create portal access with a login token
  let portalUrl: string | undefined;
  let portalToken: string | undefined;

  if (input.enablePortal) {
    portalToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(portalToken).digest("hex");

    await db.create("client_portal_access", {
      id: uuid(),
      clientId,
      orgId,
      email: input.email,
      tokenHash,
      expiresAt: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    portalUrl = `${config.corsOrigin}/portal/login`;
  }

  const client = await getClient(orgId, clientId);
  return { client, isNew: true, portalUrl, portalToken };
}

// ── Portal Access Management ────────────────────────────────────────────────

export interface PortalAccessStatus {
  portalEnabled: boolean;
  portalEmail: string | null;
  hasActiveAccess: boolean;
}

export async function getPortalAccessStatus(
  orgId: string,
  clientId: string
): Promise<PortalAccessStatus> {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  const access = await db.findOne("client_portal_access", {
    client_id: clientId,
    org_id: orgId,
    is_active: true,
  });

  return {
    portalEnabled: client.portalEnabled ?? false,
    portalEmail: client.portalEmail ?? null,
    hasActiveAccess: !!access,
  };
}

export async function regeneratePortalToken(
  orgId: string,
  clientId: string
): Promise<{ portalToken: string; portalUrl: string }> {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Deactivate all existing access records
  const existing = await db.findMany("client_portal_access", {
    where: { client_id: clientId, org_id: orgId },
  });
  for (const record of existing) {
    await db.update("client_portal_access", (record as { id: string }).id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  // Create new access record
  const portalToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(portalToken).digest("hex");
  const now = new Date();

  await db.create("client_portal_access", {
    id: uuid(),
    clientId,
    orgId,
    email: client.portalEmail || client.email,
    tokenHash,
    expiresAt: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  // Ensure client is marked as portal enabled
  if (!client.portalEnabled) {
    await db.update("clients", clientId, {
      portalEnabled: true,
      portalEmail: client.portalEmail || client.email,
      updatedAt: now,
    }, orgId);
  }

  const portalUrl = `${config.corsOrigin}/portal/login`;
  return { portalToken, portalUrl };
}

export async function revokePortalAccess(
  orgId: string,
  clientId: string
): Promise<void> {
  const db = await getDB();
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) throw NotFoundError("Client");

  // Deactivate all access records
  const records = await db.findMany("client_portal_access", {
    where: { client_id: clientId, org_id: orgId },
  });
  for (const record of records) {
    await db.update("client_portal_access", (record as { id: string }).id, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  // Mark client as portal disabled
  await db.update("clients", clientId, {
    portalEnabled: false,
    updatedAt: new Date(),
  }, orgId);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJSON<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
