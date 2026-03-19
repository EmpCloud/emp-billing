import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Mocks
// ============================================================================

const mockDb = {
  findById: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(() => Promise.resolve(mockDb)),
}));

import {
  getOrgSettings,
  updateOrgSettings,
  updateBranding,
  getNumberingConfig,
  updateNumberingConfig,
} from "./settings.service";

// ============================================================================
// Helpers
// ============================================================================

const ORG_ID = "org-001";

const sampleOrg = {
  id: ORG_ID,
  name: "Acme Corp",
  legalName: "Acme Corporation Pvt Ltd",
  email: "info@acme.com",
  defaultCurrency: "INR",
  country: "IN",
  invoicePrefix: "INV",
  invoiceNextNumber: 42,
  quotePrefix: "QTE",
  quoteNextNumber: 15,
  defaultPaymentTerms: 30,
  timezone: "Asia/Kolkata",
  logo: null,
  brandColors: null,
};

function resetMocks() {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
}

// ============================================================================
// getOrgSettings
// ============================================================================

describe("getOrgSettings", () => {
  beforeEach(() => resetMocks());

  it("returns org settings", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });

    const result = await getOrgSettings(ORG_ID);

    expect(result.name).toBe("Acme Corp");
    expect(result.defaultCurrency).toBe("INR");
    expect(mockDb.findById).toHaveBeenCalledWith("organizations", ORG_ID);
  });

  it("throws NotFoundError for non-existent org", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(getOrgSettings("bad-org")).rejects.toThrow("Organization not found");
  });
});

// ============================================================================
// updateOrgSettings
// ============================================================================

describe("updateOrgSettings", () => {
  beforeEach(() => resetMocks());

  it("updates name field", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg, name: "New Name" });

    const result = await updateOrgSettings(ORG_ID, { name: "New Name" });

    expect(result.name).toBe("New Name");
    expect(mockDb.update).toHaveBeenCalledWith(
      "organizations",
      ORG_ID,
      expect.objectContaining({ name: "New Name" })
    );
  });

  it("updates timezone", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg, timezone: "America/New_York" });

    const result = await updateOrgSettings(ORG_ID, { timezone: "America/New_York" });

    expect(result.timezone).toBe("America/New_York");
  });

  it("updates defaultPaymentTerms", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg, defaultPaymentTerms: 60 });

    const result = await updateOrgSettings(ORG_ID, { defaultPaymentTerms: 60 });

    expect(result.defaultPaymentTerms).toBe(60);
    expect(mockDb.update).toHaveBeenCalledWith(
      "organizations",
      ORG_ID,
      expect.objectContaining({ defaultPaymentTerms: 60 })
    );
  });

  it("serializes address as JSON string", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg });

    const address = {
      line1: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "IN",
    };

    await updateOrgSettings(ORG_ID, { address });

    expect(mockDb.update).toHaveBeenCalledWith(
      "organizations",
      ORG_ID,
      expect.objectContaining({ address: JSON.stringify(address) })
    );
  });

  it("updates defaultTerms", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg, defaultTerms: "Net 45 days" });

    const result = await updateOrgSettings(ORG_ID, { defaultTerms: "Net 45 days" });

    expect(result.defaultTerms).toBe("Net 45 days");
  });

  it("throws NotFoundError for non-existent org", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(
      updateOrgSettings("bad-org", { name: "Test" })
    ).rejects.toThrow("Organization not found");
  });

  it("always sets updatedAt in the update data", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg });

    await updateOrgSettings(ORG_ID, { name: "Test" });

    const updateCall = mockDb.update.mock.calls[0][2];
    expect(updateCall.updatedAt).toBeInstanceOf(Date);
  });
});

// ============================================================================
// updateBranding
// ============================================================================

describe("updateBranding", () => {
  beforeEach(() => resetMocks());

  it("updates logo", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg, logo: "https://cdn.example.com/logo.png" });

    const result = await updateBranding(ORG_ID, { logo: "https://cdn.example.com/logo.png" });

    expect(result.logo).toBe("https://cdn.example.com/logo.png");
    expect(mockDb.update).toHaveBeenCalledWith(
      "organizations",
      ORG_ID,
      expect.objectContaining({ logo: "https://cdn.example.com/logo.png" })
    );
  });

  it("updates brand colors and serializes as JSON", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg });

    const colors = { primary: "#4f46e5", accent: "#f59e0b" };
    await updateBranding(ORG_ID, { brandColors: colors });

    expect(mockDb.update).toHaveBeenCalledWith(
      "organizations",
      ORG_ID,
      expect.objectContaining({ brandColors: JSON.stringify(colors) })
    );
  });

  it("throws NotFoundError for non-existent org", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(
      updateBranding("bad-org", { logo: "test.png" })
    ).rejects.toThrow("Organization not found");
  });
});

// ============================================================================
// getNumberingConfig
// ============================================================================

describe("getNumberingConfig", () => {
  beforeEach(() => resetMocks());

  it("returns prefix and next number for invoices and quotes", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });

    const result = await getNumberingConfig(ORG_ID);

    expect(result.data.invoicePrefix).toBe("INV");
    expect(result.data.invoiceNextNumber).toBe(42);
    expect(result.data.quotePrefix).toBe("QTE");
    expect(result.data.quoteNextNumber).toBe(15);
  });

  it("throws NotFoundError for non-existent org", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(getNumberingConfig("bad-org")).rejects.toThrow("Organization not found");
  });
});

// ============================================================================
// updateNumberingConfig
// ============================================================================

describe("updateNumberingConfig", () => {
  beforeEach(() => resetMocks());

  it("updates invoice prefix and next number", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({
      ...sampleOrg,
      invoicePrefix: "BILL",
      invoiceNextNumber: 100,
    });

    const result = await updateNumberingConfig(ORG_ID, {
      invoicePrefix: "BILL",
      invoiceNextNumber: 100,
    });

    expect(result.invoicePrefix).toBe("BILL");
    expect(result.invoiceNextNumber).toBe(100);
    expect(mockDb.update).toHaveBeenCalledWith(
      "organizations",
      ORG_ID,
      expect.objectContaining({
        invoicePrefix: "BILL",
        invoiceNextNumber: 100,
      })
    );
  });

  it("updates quote prefix and next number", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({
      ...sampleOrg,
      quotePrefix: "EST",
      quoteNextNumber: 50,
    });

    const result = await updateNumberingConfig(ORG_ID, {
      quotePrefix: "EST",
      quoteNextNumber: 50,
    });

    expect(result.quotePrefix).toBe("EST");
    expect(result.quoteNextNumber).toBe(50);
  });

  it("only updates provided fields", async () => {
    mockDb.findById.mockResolvedValue({ ...sampleOrg });
    mockDb.update.mockResolvedValue({ ...sampleOrg, invoicePrefix: "NEW" });

    await updateNumberingConfig(ORG_ID, { invoicePrefix: "NEW" });

    const updateCall = mockDb.update.mock.calls[0][2];
    expect(updateCall.invoicePrefix).toBe("NEW");
    expect(updateCall.invoiceNextNumber).toBeUndefined();
    expect(updateCall.quotePrefix).toBeUndefined();
    expect(updateCall.quoteNextNumber).toBeUndefined();
  });

  it("throws NotFoundError for non-existent org", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(
      updateNumberingConfig("bad-org", { invoicePrefix: "X" })
    ).rejects.toThrow("Organization not found");
  });
});
