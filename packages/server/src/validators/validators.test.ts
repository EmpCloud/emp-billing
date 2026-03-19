import { describe, it, expect } from "vitest";
import {
  RegisterSchema,
  LoginSchema,
  CreateClientSchema,
  CreateInvoiceSchema,
  CreateCreditNoteSchema,
  ApplyCreditNoteSchema,
  PaginationSchema,
} from "@emp-billing/shared";

// ============================================================================
// RegisterSchema
// ============================================================================

describe("RegisterSchema", () => {
  const validRegister = {
    email: "test@example.com",
    password: "StrongPass1",
    firstName: "John",
    lastName: "Doe",
    orgName: "Acme Corp",
  };

  it("accepts valid input", () => {
    const result = RegisterSchema.safeParse(validRegister);
    expect(result.success).toBe(true);
  });

  it("applies default country and currency", () => {
    const result = RegisterSchema.safeParse(validRegister);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country).toBe("IN");
      expect(result.data.currency).toBe("INR");
    }
  });

  it("rejects missing email", () => {
    const { email, ...rest } = validRegister;
    const result = RegisterSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects short password (< 8 chars)", () => {
    const result = RegisterSchema.safeParse({ ...validRegister, password: "Ab1" });
    expect(result.success).toBe(false);
  });

  it("rejects password missing uppercase letter", () => {
    const result = RegisterSchema.safeParse({ ...validRegister, password: "nouppercase1" });
    expect(result.success).toBe(false);
  });

  it("rejects password missing number", () => {
    const result = RegisterSchema.safeParse({ ...validRegister, password: "NoNumberHere" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = RegisterSchema.safeParse({ ...validRegister, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing orgName", () => {
    const { orgName, ...rest } = validRegister;
    const result = RegisterSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// LoginSchema
// ============================================================================

describe("LoginSchema", () => {
  it("accepts valid credentials", () => {
    const result = LoginSchema.safeParse({ email: "a@b.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = LoginSchema.safeParse({ password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = LoginSchema.safeParse({ email: "a@b.com" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = LoginSchema.safeParse({ email: "bad", password: "secret" });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CreateClientSchema
// ============================================================================

describe("CreateClientSchema", () => {
  const validClient = {
    name: "Acme Corp",
    displayName: "Acme",
    email: "billing@acme.com",
  };

  it("accepts valid minimal input", () => {
    const result = CreateClientSchema.safeParse(validClient);
    expect(result.success).toBe(true);
  });

  it("accepts valid input with all optional fields", () => {
    const result = CreateClientSchema.safeParse({
      ...validClient,
      phone: "+91-9876543210",
      website: "https://acme.com",
      taxId: "GSTIN123456",
      currency: "USD",
      paymentTerms: 45,
      notes: "VIP client",
      tags: ["enterprise", "international"],
      portalEnabled: true,
      portalEmail: "portal@acme.com",
      billingAddress: {
        line1: "123 Main St",
        city: "Mumbai",
        state: "Maharashtra",
        postalCode: "400001",
        country: "IN",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name, ...rest } = validClient;
    const result = CreateClientSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const { email, ...rest } = validClient;
    const result = CreateClientSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = CreateClientSchema.safeParse({ ...validClient, email: "not-valid" });
    expect(result.success).toBe(false);
  });

  it("applies default currency and paymentTerms", () => {
    const result = CreateClientSchema.safeParse(validClient);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("INR");
      expect(result.data.paymentTerms).toBe(30);
    }
  });
});

// ============================================================================
// CreateInvoiceSchema
// ============================================================================

describe("CreateInvoiceSchema", () => {
  const validInvoice = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    issueDate: "2026-01-15",
    dueDate: "2026-02-14",
    items: [
      {
        name: "Web Development",
        quantity: 10,
        rate: 500000,
      },
    ],
  };

  it("accepts valid invoice with items", () => {
    const result = CreateInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing clientId", () => {
    const { clientId, ...rest } = validInvoice;
    const result = CreateInvoiceSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid clientId", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, clientId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("applies default currency", () => {
    const result = CreateInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("INR");
    }
  });

  it("accepts invoice with discount", () => {
    const result = CreateInvoiceSchema.safeParse({
      ...validInvoice,
      discountType: "percentage",
      discountValue: 10,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// CreateCreditNoteSchema
// ============================================================================

describe("CreateCreditNoteSchema", () => {
  const validCreditNote = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    date: "2026-03-01",
    items: [
      {
        name: "Refund for overcharge",
        quantity: 1,
        rate: 10000,
      },
    ],
  };

  it("accepts valid credit note", () => {
    const result = CreateCreditNoteSchema.safeParse(validCreditNote);
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = CreateCreditNoteSchema.safeParse({ ...validCreditNote, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing clientId", () => {
    const { clientId, ...rest } = validCreditNote;
    const result = CreateCreditNoteSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// ApplyCreditNoteSchema
// ============================================================================

describe("ApplyCreditNoteSchema", () => {
  it("accepts valid input", () => {
    const result = ApplyCreditNoteSchema.safeParse({
      invoiceId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing invoiceId", () => {
    const result = ApplyCreditNoteSchema.safeParse({ amount: 5000 });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = ApplyCreditNoteSchema.safeParse({
      invoiceId: "550e8400-e29b-41d4-a716-446655440000",
      amount: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = ApplyCreditNoteSchema.safeParse({
      invoiceId: "550e8400-e29b-41d4-a716-446655440000",
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid invoiceId", () => {
    const result = ApplyCreditNoteSchema.safeParse({
      invoiceId: "bad-id",
      amount: 5000,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// PaginationSchema
// ============================================================================

describe("PaginationSchema", () => {
  it("applies defaults when no input given", () => {
    const result = PaginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("accepts custom page and limit", () => {
    const result = PaginationSchema.safeParse({ page: 3, limit: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects page=0 (must be positive)", () => {
    const result = PaginationSchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative page", () => {
    const result = PaginationSchema.safeParse({ page: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 100", () => {
    const result = PaginationSchema.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });

  it("rejects limit=0", () => {
    const result = PaginationSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("coerces string page to number", () => {
    const result = PaginationSchema.safeParse({ page: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(5);
    }
  });

  it("accepts optional sortBy", () => {
    const result = PaginationSchema.safeParse({ sortBy: "createdAt" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortBy).toBe("createdAt");
    }
  });

  it("accepts sortOrder asc", () => {
    const result = PaginationSchema.safeParse({ sortOrder: "asc" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sortOrder).toBe("asc");
    }
  });

  it("rejects invalid sortOrder", () => {
    const result = PaginationSchema.safeParse({ sortOrder: "random" });
    expect(result.success).toBe(false);
  });
});
