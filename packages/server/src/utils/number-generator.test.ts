import { describe, it, expect, vi, beforeEach } from "vitest";
import { nextInvoiceNumber, nextQuoteNumber } from "./number-generator";

// Mock the DB adapter
vi.mock("../db/adapters/index", () => ({
  getDB: vi.fn(),
}));

import { getDB } from "../db/adapters/index";

const mockedGetDB = vi.mocked(getDB);

describe("nextInvoiceNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted string like INV-YYYY-0001", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        invoicePrefix: "INV",
        invoiceNextNumber: 1,
      }),
      increment: vi.fn().mockResolvedValue(1),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const result = await nextInvoiceNumber("org-123");
    const year = new Date().getFullYear();

    expect(result).toBe(`INV-${year}-0000`);
    expect(mockDb.findById).toHaveBeenCalledWith("organizations", "org-123");
    expect(mockDb.increment).toHaveBeenCalledWith("organizations", "org-123", "invoice_next_number");
  });

  it("formats sequence number with zero-padding", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        invoicePrefix: "INV",
        invoiceNextNumber: 42,
      }),
      increment: vi.fn().mockResolvedValue(42),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const result = await nextInvoiceNumber("org-123");
    const year = new Date().getFullYear();

    expect(result).toBe(`INV-${year}-0041`);
  });

  it("uses custom prefix from organization", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        invoicePrefix: "BILL",
        invoiceNextNumber: 5,
      }),
      increment: vi.fn().mockResolvedValue(5),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const result = await nextInvoiceNumber("org-123");
    const year = new Date().getFullYear();

    expect(result).toBe(`BILL-${year}-0004`);
  });

  it("throws if organization not found", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue(null),
      increment: vi.fn(),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    await expect(nextInvoiceNumber("org-999")).rejects.toThrow("Organization not found");
  });
});

describe("nextQuoteNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns formatted string like QTE-YYYY-0001", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        quotePrefix: "QTE",
        quoteNextNumber: 1,
      }),
      increment: vi.fn().mockResolvedValue(1),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const result = await nextQuoteNumber("org-123");
    const year = new Date().getFullYear();

    expect(result).toBe(`QTE-${year}-0000`);
    expect(mockDb.findById).toHaveBeenCalledWith("organizations", "org-123");
    expect(mockDb.increment).toHaveBeenCalledWith("organizations", "org-123", "quote_next_number");
  });

  it("formats sequence number with zero-padding", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        quotePrefix: "QTE",
        quoteNextNumber: 100,
      }),
      increment: vi.fn().mockResolvedValue(100),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const result = await nextQuoteNumber("org-123");
    const year = new Date().getFullYear();

    expect(result).toBe(`QTE-${year}-0099`);
  });

  it("uses custom prefix from organization", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        quotePrefix: "EST",
        quoteNextNumber: 3,
      }),
      increment: vi.fn().mockResolvedValue(3),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const result = await nextQuoteNumber("org-123");
    const year = new Date().getFullYear();

    expect(result).toBe(`EST-${year}-0002`);
  });

  it("throws if organization not found", async () => {
    const mockDb = {
      findById: vi.fn().mockResolvedValue(null),
      increment: vi.fn(),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    await expect(nextQuoteNumber("org-999")).rejects.toThrow("Organization not found");
  });

  it("sequence increments correctly across calls", async () => {
    let seq = 5;
    const mockDb = {
      findById: vi.fn().mockResolvedValue({
        quotePrefix: "QTE",
        quoteNextNumber: seq,
      }),
      increment: vi.fn().mockImplementation(() => {
        return Promise.resolve(seq++);
      }),
    };
    mockedGetDB.mockResolvedValue(mockDb as any);

    const year = new Date().getFullYear();

    const first = await nextQuoteNumber("org-123");
    const second = await nextQuoteNumber("org-123");

    expect(first).toBe(`QTE-${year}-0004`);
    expect(second).toBe(`QTE-${year}-0005`);
  });
});
