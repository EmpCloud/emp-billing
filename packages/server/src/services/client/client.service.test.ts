import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB adapter
vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

import { getDB } from "../../db/adapters/index";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  getClientStatement,
} from "./client.service";

const mockedGetDB = vi.mocked(getDB);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = "org-100";
const CLIENT_ID = "client-200";

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    id: CLIENT_ID,
    orgId: ORG_ID,
    name: "Acme Corp",
    displayName: "Acme",
    email: "billing@acme.com",
    phone: "+919999999999",
    currency: "INR",
    tags: ["vip"],
    isActive: true,
    outstandingBalance: 500000, // 5000.00 INR in paise
    totalBilled: 1000000,
    totalPaid: 500000,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-06-01"),
    ...overrides,
  };
}

function makeContact(overrides: Record<string, unknown> = {}) {
  return {
    id: "contact-1",
    clientId: CLIENT_ID,
    orgId: ORG_ID,
    name: "John Doe",
    email: "john@acme.com",
    phone: "+919999999900",
    isPrimary: true,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

function makeMockDb(overrides: Record<string, unknown> = {}) {
  return {
    findPaginated: vi.fn(),
    findById: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    softDelete: vi.fn(),
    increment: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("client.service", () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = makeMockDb();
    mockedGetDB.mockResolvedValue(mockDb as any);
  });

  // ── listClients ──────────────────────────────────────────────────────────

  describe("listClients", () => {
    it("returns paginated results", async () => {
      const clients = [makeClient(), makeClient({ id: "client-201", name: "Beta Inc", displayName: "Beta", email: "beta@test.com" })];
      mockDb.findPaginated.mockResolvedValue({
        data: clients,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await listClients(ORG_ID, { page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("clients", {
        where: { org_id: ORG_ID },
        page: 1,
        limit: 20,
        orderBy: [{ column: "name", direction: "asc" }],
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it("filters by search across name, email, and displayName", async () => {
      const clients = [
        makeClient({ name: "Acme Corp", displayName: "Acme", email: "billing@acme.com" }),
        makeClient({ id: "client-201", name: "Beta Inc", displayName: "Beta", email: "beta@test.com" }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: clients, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listClients(ORG_ID, { search: "beta", page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Beta Inc");
    });

    it("filters by tags (comma-separated)", async () => {
      const clients = [
        makeClient({ tags: ["vip", "enterprise"] }),
        makeClient({ id: "client-201", name: "Beta Inc", displayName: "Beta", email: "beta@test.com", tags: ["sme"] }),
      ];
      mockDb.findPaginated.mockResolvedValue({ data: clients, total: 2, page: 1, limit: 20, totalPages: 1 });

      const result = await listClients(ORG_ID, { tags: "enterprise,premium", page: 1, limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].tags).toContain("enterprise");
    });

    it("passes isActive filter to the DB where clause", async () => {
      mockDb.findPaginated.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 });

      await listClients(ORG_ID, { isActive: true, page: 1, limit: 20 });

      expect(mockDb.findPaginated).toHaveBeenCalledWith("clients", expect.objectContaining({
        where: { org_id: ORG_ID, is_active: true },
      }));
    });
  });

  // ── getClient ────────────────────────────────────────────────────────────

  describe("getClient", () => {
    it("returns client with contacts", async () => {
      const client = makeClient();
      const contacts = [makeContact(), makeContact({ id: "contact-2", isPrimary: false, name: "Jane" })];
      mockDb.findById.mockResolvedValue(client);
      mockDb.findMany.mockResolvedValue(contacts);

      const result = await getClient(ORG_ID, CLIENT_ID);

      expect(result.id).toBe(CLIENT_ID);
      expect(result.contacts).toHaveLength(2);
      expect(mockDb.findById).toHaveBeenCalledWith("clients", CLIENT_ID, ORG_ID);
      expect(mockDb.findMany).toHaveBeenCalledWith("client_contacts", {
        where: { client_id: CLIENT_ID },
        orderBy: [{ column: "is_primary", direction: "desc" }],
      });
    });

    it("throws NotFoundError when client does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(getClient(ORG_ID, "missing-id")).rejects.toThrow("Client not found");
    });
  });

  // ── createClient ─────────────────────────────────────────────────────────

  describe("createClient", () => {
    it("creates a client and returns it with contacts", async () => {
      mockDb.findOne.mockResolvedValue(null); // no duplicate
      mockDb.create.mockResolvedValue(undefined);
      mockDb.createMany.mockResolvedValue(undefined);

      // For the getClient call inside createClient
      const createdClient = makeClient();
      const contacts = [makeContact()];
      mockDb.findById.mockResolvedValue(createdClient);
      mockDb.findMany.mockResolvedValue(contacts);

      const input = {
        name: "Acme Corp",
        displayName: "Acme",
        email: "billing@acme.com",
        phone: "+919999999999",
        currency: "INR",
        contacts: [{ name: "John Doe", email: "john@acme.com", phone: "+919999999900", isPrimary: true }],
      };

      const result = await createClient(ORG_ID, input as any);

      expect(mockDb.findOne).toHaveBeenCalledWith("clients", { org_id: ORG_ID, email: "billing@acme.com" });
      expect(mockDb.create).toHaveBeenCalledWith("clients", expect.objectContaining({
        orgId: ORG_ID,
        name: "Acme Corp",
        email: "billing@acme.com",
        outstandingBalance: 0,
        totalBilled: 0,
        totalPaid: 0,
        isActive: true,
      }));
      expect(mockDb.createMany).toHaveBeenCalledWith("client_contacts", expect.any(Array));
      expect(result.id).toBe(CLIENT_ID);
    });

    it("throws ConflictError when email already exists", async () => {
      mockDb.findOne.mockResolvedValue(makeClient()); // existing client with same email

      const input = {
        name: "Duplicate Corp",
        displayName: "Dup",
        email: "billing@acme.com",
        currency: "INR",
      };

      await expect(createClient(ORG_ID, input as any)).rejects.toThrow(
        "A client with email 'billing@acme.com' already exists"
      );
    });

    it("creates client without contacts when none provided", async () => {
      mockDb.findOne.mockResolvedValue(null);
      mockDb.create.mockResolvedValue(undefined);
      mockDb.findById.mockResolvedValue(makeClient());
      mockDb.findMany.mockResolvedValue([]);

      const input = {
        name: "Solo Corp",
        displayName: "Solo",
        email: "solo@test.com",
        currency: "INR",
      };

      await createClient(ORG_ID, input as any);

      expect(mockDb.createMany).not.toHaveBeenCalled();
    });
  });

  // ── updateClient ─────────────────────────────────────────────────────────

  describe("updateClient", () => {
    it("updates client fields and returns updated client", async () => {
      const existing = makeClient();
      mockDb.findById.mockResolvedValue(existing);
      mockDb.findOne.mockResolvedValue(null); // no email conflict
      mockDb.update.mockResolvedValue(undefined);
      mockDb.findMany.mockResolvedValue([]);

      const input = { name: "Acme Corp Updated", email: "new@acme.com" };

      const result = await updateClient(ORG_ID, CLIENT_ID, input as any);

      expect(mockDb.update).toHaveBeenCalledWith("clients", CLIENT_ID, expect.objectContaining({
        name: "Acme Corp Updated",
        email: "new@acme.com",
      }), ORG_ID);
      expect(result).toBeDefined();
    });

    it("throws NotFoundError when client does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(updateClient(ORG_ID, "missing-id", { name: "X" } as any)).rejects.toThrow(
        "Client not found"
      );
    });

    it("throws ConflictError when changing to an existing email", async () => {
      const existing = makeClient({ email: "old@acme.com" });
      mockDb.findById.mockResolvedValue(existing);
      mockDb.findOne.mockResolvedValue(makeClient({ id: "other-client", email: "taken@test.com" }));

      await expect(
        updateClient(ORG_ID, CLIENT_ID, { email: "taken@test.com" } as any)
      ).rejects.toThrow("A client with email 'taken@test.com' already exists");
    });
  });

  // ── deleteClient ─────────────────────────────────────────────────────────

  describe("deleteClient", () => {
    it("soft-deletes an existing client", async () => {
      mockDb.findById.mockResolvedValue(makeClient());

      await deleteClient(ORG_ID, CLIENT_ID);

      expect(mockDb.softDelete).toHaveBeenCalledWith("clients", CLIENT_ID, ORG_ID);
    });

    it("throws NotFoundError when client does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(deleteClient(ORG_ID, "missing-id")).rejects.toThrow("Client not found");
    });
  });

  // ── getClientStatement ───────────────────────────────────────────────────

  describe("getClientStatement", () => {
    it("returns statement entries with running balance", async () => {
      const client = makeClient({ currency: "INR" });
      mockDb.findById.mockResolvedValue(client);

      const invoices = [
        { issueDate: "2025-03-01", total: 100000, invoiceNumber: "INV-2025-0001" },
        { issueDate: "2025-03-15", total: 50000, invoiceNumber: "INV-2025-0002" },
      ];
      const payments = [
        { date: "2025-03-10", amount: 60000, paymentNumber: "PAY-001" },
      ];

      mockDb.findMany
        .mockResolvedValueOnce(invoices)  // invoices query
        .mockResolvedValueOnce(payments); // payments query

      const from = new Date("2025-01-01");
      const to = new Date("2025-12-31");

      const result = await getClientStatement(ORG_ID, CLIENT_ID, from, to);

      expect(result.client.id).toBe(CLIENT_ID);
      expect(result.currency).toBe("INR");
      expect(result.entries).toHaveLength(3);

      // Entry 1: Invoice 100000 paise => balance 100000
      expect(result.entries[0].type).toBe("invoice");
      expect(result.entries[0].debit).toBe(100000);
      expect(result.entries[0].balance).toBe(100000);

      // Entry 2: Payment 60000 paise => balance 40000
      expect(result.entries[1].type).toBe("payment");
      expect(result.entries[1].credit).toBe(60000);
      expect(result.entries[1].balance).toBe(40000);

      // Entry 3: Invoice 50000 paise => balance 90000
      expect(result.entries[2].type).toBe("invoice");
      expect(result.entries[2].debit).toBe(50000);
      expect(result.entries[2].balance).toBe(90000);

      expect(result.openingBalance).toBe(0);
      expect(result.closingBalance).toBe(90000);
    });

    it("throws NotFoundError when client does not exist", async () => {
      mockDb.findById.mockResolvedValue(null);

      await expect(
        getClientStatement(ORG_ID, "missing-id", new Date(), new Date())
      ).rejects.toThrow("Client not found");
    });

    it("returns empty entries when no invoices or payments in date range", async () => {
      mockDb.findById.mockResolvedValue(makeClient({ currency: "USD" }));
      mockDb.findMany
        .mockResolvedValueOnce([]) // no invoices
        .mockResolvedValueOnce([]); // no payments

      const result = await getClientStatement(
        ORG_ID,
        CLIENT_ID,
        new Date("2025-01-01"),
        new Date("2025-12-31")
      );

      expect(result.entries).toHaveLength(0);
      expect(result.closingBalance).toBe(0);
      expect(result.currency).toBe("USD");
    });

    it("filters events outside the date range", async () => {
      mockDb.findById.mockResolvedValue(makeClient({ currency: "INR" }));

      const invoices = [
        { issueDate: "2024-06-01", total: 100000, invoiceNumber: "INV-OLD" }, // outside range
        { issueDate: "2025-03-01", total: 50000, invoiceNumber: "INV-IN-RANGE" },
      ];
      mockDb.findMany
        .mockResolvedValueOnce(invoices)
        .mockResolvedValueOnce([]);

      const result = await getClientStatement(
        ORG_ID,
        CLIENT_ID,
        new Date("2025-01-01"),
        new Date("2025-12-31")
      );

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].number).toBe("INV-IN-RANGE");
    });
  });
});
