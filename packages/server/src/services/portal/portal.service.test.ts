import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvoiceStatus, QuoteStatus, CreditNoteStatus } from "@emp-billing/shared";

// ============================================================================
// Mocks
// ============================================================================

const mockDb = {
  findOne: vi.fn(),
  findById: vi.fn(),
  findMany: vi.fn(),
  findPaginated: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("../../config/index", () => ({
  config: {
    jwt: { accessSecret: "test-secret" },
  },
}));

vi.mock("../../utils/pdf", () => ({
  generateInvoicePdf: vi.fn(() => Promise.resolve(Buffer.from("pdf-content"))),
}));

vi.mock("../client/client.service", () => ({
  getClientStatement: vi.fn(() =>
    Promise.resolve({
      client: { id: "client-1", name: "Acme" },
      entries: [
        { type: "invoice", amount: 10000, date: new Date("2026-01-10") },
        { type: "payment", amount: -5000, date: new Date("2026-01-15") },
      ],
      openingBalance: 0,
      closingBalance: 5000,
      currency: "INR",
    })
  ),
}));

import {
  portalLogin,
  getPortalInvoices,
  getPortalQuotes,
  getPortalPayments,
  getPortalCreditNotes,
  getPortalStatement,
  getPortalDashboard,
} from "./portal.service";

// ============================================================================
// Helpers
// ============================================================================

const ORG_ID = "org-001";
const CLIENT_ID = "client-001";

function resetMocks() {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
}

// ============================================================================
// portalLogin
// ============================================================================

describe("portalLogin", () => {
  beforeEach(() => resetMocks());

  it("returns token and client info for valid credentials", async () => {
    mockDb.findOne.mockResolvedValue({
      id: "access-1",
      clientId: CLIENT_ID,
      orgId: ORG_ID,
      email: "client@test.com",
      tokenHash: "somehash",
      expiresAt: null,
      isActive: true,
    });
    mockDb.findById
      .mockResolvedValueOnce({ id: CLIENT_ID, name: "Acme Corp", displayName: "Acme" }) // client
      .mockResolvedValueOnce({ id: ORG_ID, name: "My Org", logo: null, brandColors: null }); // org

    const result = await portalLogin("client@test.com", "dummy-token");

    expect(result.clientId).toBe(CLIENT_ID);
    expect(result.clientName).toBe("Acme");
    expect(result.orgId).toBe(ORG_ID);
    expect(result.orgName).toBe("My Org");
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(0);
  });

  it("throws UnauthorizedError for invalid credentials", async () => {
    mockDb.findOne.mockResolvedValue(null);

    await expect(portalLogin("bad@test.com", "wrong-token")).rejects.toThrow(
      "Invalid email or portal access token"
    );
  });

  it("throws UnauthorizedError for expired token", async () => {
    mockDb.findOne.mockResolvedValue({
      id: "access-1",
      clientId: CLIENT_ID,
      orgId: ORG_ID,
      email: "client@test.com",
      expiresAt: new Date("2020-01-01"),
      isActive: true,
    });

    await expect(portalLogin("client@test.com", "expired-token")).rejects.toThrow(
      "Portal access token has expired"
    );
  });

  it("throws NotFoundError when client does not exist", async () => {
    mockDb.findOne.mockResolvedValue({
      id: "access-1",
      clientId: CLIENT_ID,
      orgId: ORG_ID,
      email: "client@test.com",
      expiresAt: null,
      isActive: true,
    });
    mockDb.findById.mockResolvedValueOnce(null); // client not found

    await expect(portalLogin("client@test.com", "token")).rejects.toThrow("Client not found");
  });
});

// ============================================================================
// getPortalInvoices
// ============================================================================

describe("getPortalInvoices", () => {
  beforeEach(() => resetMocks());

  it("returns client invoices excluding DRAFT and VOID", async () => {
    mockDb.findPaginated.mockResolvedValue({
      data: [
        { id: "inv-1", status: InvoiceStatus.SENT, clientId: CLIENT_ID },
        { id: "inv-2", status: InvoiceStatus.DRAFT, clientId: CLIENT_ID },
        { id: "inv-3", status: InvoiceStatus.PAID, clientId: CLIENT_ID },
        { id: "inv-4", status: InvoiceStatus.VOID, clientId: CLIENT_ID },
      ],
      total: 4,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await getPortalInvoices(CLIENT_ID, ORG_ID, { page: 1, limit: 20 });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe("inv-1");
    expect(result.data[1].id).toBe("inv-3");
  });

  it("passes pagination options to DB", async () => {
    mockDb.findPaginated.mockResolvedValue({
      data: [],
      total: 0,
      page: 3,
      limit: 10,
      totalPages: 0,
    });

    await getPortalInvoices(CLIENT_ID, ORG_ID, { page: 3, limit: 10 });

    expect(mockDb.findPaginated).toHaveBeenCalledWith("invoices", expect.objectContaining({
      page: 3,
      limit: 10,
      where: { org_id: ORG_ID, client_id: CLIENT_ID },
    }));
  });
});

// ============================================================================
// getPortalQuotes
// ============================================================================

describe("getPortalQuotes", () => {
  beforeEach(() => resetMocks());

  it("returns client quotes excluding DRAFT", async () => {
    mockDb.findMany.mockResolvedValue([
      { id: "q-1", status: QuoteStatus.SENT, clientId: CLIENT_ID },
      { id: "q-2", status: QuoteStatus.DRAFT, clientId: CLIENT_ID },
      { id: "q-3", status: QuoteStatus.ACCEPTED, clientId: CLIENT_ID },
    ]);

    const result = await getPortalQuotes(CLIENT_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result.find((q: { id: string }) => q.id === "q-2")).toBeUndefined();
  });

  it("queries with correct orgId and clientId", async () => {
    mockDb.findMany.mockResolvedValue([]);

    await getPortalQuotes(CLIENT_ID, ORG_ID);

    expect(mockDb.findMany).toHaveBeenCalledWith("quotes", expect.objectContaining({
      where: { org_id: ORG_ID, client_id: CLIENT_ID },
    }));
  });
});

// ============================================================================
// getPortalPayments
// ============================================================================

describe("getPortalPayments", () => {
  beforeEach(() => resetMocks());

  it("returns client payments (non-refund)", async () => {
    const payments = [
      { id: "pay-1", amount: 50000, method: "bank_transfer" },
      { id: "pay-2", amount: 30000, method: "upi" },
    ];
    mockDb.findMany.mockResolvedValue(payments);

    const result = await getPortalPayments(CLIENT_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("pay-1");
  });

  it("queries with is_refund false", async () => {
    mockDb.findMany.mockResolvedValue([]);

    await getPortalPayments(CLIENT_ID, ORG_ID);

    expect(mockDb.findMany).toHaveBeenCalledWith("payments", expect.objectContaining({
      where: { org_id: ORG_ID, client_id: CLIENT_ID, is_refund: false },
    }));
  });
});

// ============================================================================
// getPortalCreditNotes
// ============================================================================

describe("getPortalCreditNotes", () => {
  beforeEach(() => resetMocks());

  it("returns credit notes excluding DRAFT and VOID", async () => {
    mockDb.findMany.mockResolvedValue([
      { id: "cn-1", status: CreditNoteStatus.OPEN },
      { id: "cn-2", status: CreditNoteStatus.DRAFT },
      { id: "cn-3", status: CreditNoteStatus.APPLIED },
      { id: "cn-4", status: CreditNoteStatus.VOID },
    ]);

    const result = await getPortalCreditNotes(CLIENT_ID, ORG_ID);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("cn-1");
    expect(result[1].id).toBe("cn-3");
  });

  it("queries credit_notes table with correct filters", async () => {
    mockDb.findMany.mockResolvedValue([]);

    await getPortalCreditNotes(CLIENT_ID, ORG_ID);

    expect(mockDb.findMany).toHaveBeenCalledWith("credit_notes", expect.objectContaining({
      where: { org_id: ORG_ID, client_id: CLIENT_ID },
    }));
  });
});

// ============================================================================
// getPortalStatement
// ============================================================================

describe("getPortalStatement", () => {
  beforeEach(() => resetMocks());

  it("returns statement with entries and balance", async () => {
    const from = new Date("2026-01-01");
    const to = new Date("2026-01-31");

    const result = await getPortalStatement(CLIENT_ID, ORG_ID, from, to);

    expect(result.openingBalance).toBe(0);
    expect(result.closingBalance).toBe(5000);
    expect(result.entries).toHaveLength(2);
    expect(result.currency).toBe("INR");
  });
});

// ============================================================================
// getPortalDashboard
// ============================================================================

describe("getPortalDashboard", () => {
  beforeEach(() => resetMocks());

  it("returns dashboard with outstanding balance and recent items", async () => {
    mockDb.findById.mockResolvedValue({
      id: CLIENT_ID,
      outstandingBalance: 100000,
      currency: "INR",
    });
    mockDb.findMany
      .mockResolvedValueOnce([ // invoices
        { id: "inv-1", status: InvoiceStatus.SENT, issueDate: "2026-01-10" },
        { id: "inv-2", status: InvoiceStatus.PAID, issueDate: "2026-01-05" },
        { id: "inv-3", status: InvoiceStatus.DRAFT, issueDate: "2026-01-01" },
      ])
      .mockResolvedValueOnce([ // payments
        { id: "pay-1", amount: 50000, date: "2026-01-15" },
      ])
      .mockResolvedValueOnce([ // quotes
        { id: "q-1", status: QuoteStatus.SENT },
        { id: "q-2", status: QuoteStatus.ACCEPTED },
        { id: "q-3", status: QuoteStatus.VIEWED },
      ]);

    const result = await getPortalDashboard(CLIENT_ID, ORG_ID);

    expect(result.outstandingBalance).toBe(100000);
    expect(result.currency).toBe("INR");
    expect(result.recentInvoices).toHaveLength(2); // excludes DRAFT
    expect(result.recentPayments).toHaveLength(1);
    expect(result.pendingQuotesCount).toBe(2); // SENT + VIEWED
  });

  it("throws NotFoundError when client does not exist", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(getPortalDashboard(CLIENT_ID, ORG_ID)).rejects.toThrow("Client not found");
  });
});
