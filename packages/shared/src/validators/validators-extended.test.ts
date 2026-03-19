import { describe, it, expect } from "vitest";
import {
  CreateVendorSchema,
  UpdateVendorSchema,
  CreateDisputeSchema,
  UpdateDisputeSchema,
  CreateScheduledReportSchema,
  CreateInvoiceSchema,
  CreateExpenseSchema,
  CreateRecurringProfileSchema,
  DisputeFilterSchema,
} from "./index";
import {
  DisputeStatus,
  ScheduledReportType,
  ScheduledReportFrequency,
  RecurringFrequency,
} from "../types/index";

// ============================================================================
// CreateVendorSchema
// ============================================================================

describe("CreateVendorSchema", () => {
  const validVendor = {
    name: "Office Supplies Inc",
  };

  it("accepts valid vendor with only name", () => {
    const result = CreateVendorSchema.safeParse(validVendor);
    expect(result.success).toBe(true);
  });

  it("accepts vendor with all optional fields", () => {
    const result = CreateVendorSchema.safeParse({
      ...validVendor,
      email: "vendor@example.com",
      phone: "+91-9876543210",
      company: "Supplies Corp",
      addressLine1: "123 Vendor St",
      addressLine2: "Suite 5",
      city: "Mumbai",
      state: "Maharashtra",
      postalCode: "400001",
      country: "IN",
      taxId: "GSTIN123",
      notes: "Preferred supplier",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = CreateVendorSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = CreateVendorSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 100 characters", () => {
    const result = CreateVendorSchema.safeParse({ name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts empty string email (allows blank email)", () => {
    const result = CreateVendorSchema.safeParse({ name: "Test", email: "" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = CreateVendorSchema.safeParse({ name: "Test", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("accepts valid email", () => {
    const result = CreateVendorSchema.safeParse({ name: "Test", email: "vendor@test.com" });
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// UpdateVendorSchema
// ============================================================================

describe("UpdateVendorSchema", () => {
  it("accepts partial update with only name", () => {
    const result = UpdateVendorSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with only email", () => {
    const result = UpdateVendorSchema.safeParse({ email: "new@test.com" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = UpdateVendorSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid email in partial update", () => {
    const result = UpdateVendorSchema.safeParse({ email: "bad-email" });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CreateDisputeSchema
// ============================================================================

describe("CreateDisputeSchema", () => {
  it("accepts dispute with reason only", () => {
    const result = CreateDisputeSchema.safeParse({ reason: "Incorrect amount charged" });
    expect(result.success).toBe(true);
  });

  it("accepts dispute with reason and invoiceId", () => {
    const result = CreateDisputeSchema.safeParse({
      reason: "Duplicate invoice",
      invoiceId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing reason", () => {
    const result = CreateDisputeSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty reason", () => {
    const result = CreateDisputeSchema.safeParse({ reason: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid invoiceId", () => {
    const result = CreateDisputeSchema.safeParse({
      reason: "Some reason",
      invoiceId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("allows invoiceId to be omitted", () => {
    const result = CreateDisputeSchema.safeParse({ reason: "General dispute" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoiceId).toBeUndefined();
    }
  });
});

// ============================================================================
// UpdateDisputeSchema
// ============================================================================

describe("UpdateDisputeSchema", () => {
  it("accepts valid status update", () => {
    const result = UpdateDisputeSchema.safeParse({ status: DisputeStatus.RESOLVED });
    expect(result.success).toBe(true);
  });

  it("accepts all DisputeStatus enum values", () => {
    for (const status of Object.values(DisputeStatus)) {
      const result = UpdateDisputeSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status value", () => {
    const result = UpdateDisputeSchema.safeParse({ status: "invalid_status" });
    expect(result.success).toBe(false);
  });

  it("accepts resolution text", () => {
    const result = UpdateDisputeSchema.safeParse({ resolution: "Credit issued" });
    expect(result.success).toBe(true);
  });

  it("accepts adminNotes", () => {
    const result = UpdateDisputeSchema.safeParse({ adminNotes: "Reviewed by admin" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = UpdateDisputeSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// CreateScheduledReportSchema
// ============================================================================

describe("CreateScheduledReportSchema", () => {
  const validReport = {
    reportType: ScheduledReportType.REVENUE,
    frequency: ScheduledReportFrequency.WEEKLY,
    recipientEmail: "reports@company.com",
  };

  it("accepts valid scheduled report", () => {
    const result = CreateScheduledReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it("defaults isActive to true", () => {
    const result = CreateScheduledReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("accepts all report type enum values", () => {
    for (const reportType of Object.values(ScheduledReportType)) {
      const result = CreateScheduledReportSchema.safeParse({ ...validReport, reportType });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all frequency enum values", () => {
    for (const frequency of Object.values(ScheduledReportFrequency)) {
      const result = CreateScheduledReportSchema.safeParse({ ...validReport, frequency });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid report type", () => {
    const result = CreateScheduledReportSchema.safeParse({
      ...validReport,
      reportType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid frequency", () => {
    const result = CreateScheduledReportSchema.safeParse({
      ...validReport,
      frequency: "hourly",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = CreateScheduledReportSchema.safeParse({
      ...validReport,
      recipientEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing recipientEmail", () => {
    const { recipientEmail, ...rest } = validReport;
    const result = CreateScheduledReportSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CreateInvoiceSchema — TDS fields
// ============================================================================

describe("CreateInvoiceSchema — TDS fields", () => {
  const validInvoice = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    issueDate: "2026-01-15",
    dueDate: "2026-02-14",
    items: [{ name: "Service", quantity: 1, rate: 100000 }],
  };

  it("accepts invoice with tdsRate within 0-100", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, tdsRate: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tdsRate).toBe(10);
    }
  });

  it("accepts invoice with tdsRate of 0", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, tdsRate: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts invoice with tdsRate of 100", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, tdsRate: 100 });
    expect(result.success).toBe(true);
  });

  it("rejects tdsRate exceeding 100", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, tdsRate: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects negative tdsRate", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, tdsRate: -5 });
    expect(result.success).toBe(false);
  });

  it("accepts invoice with tdsSection", () => {
    const result = CreateInvoiceSchema.safeParse({
      ...validInvoice,
      tdsRate: 10,
      tdsSection: "194C",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tdsSection).toBe("194C");
    }
  });

  it("allows tdsSection to be omitted", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, tdsRate: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tdsSection).toBeUndefined();
    }
  });

  it("rejects tdsSection exceeding 20 characters", () => {
    const result = CreateInvoiceSchema.safeParse({
      ...validInvoice,
      tdsSection: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// CreateInvoiceSchema — autoApplyCredits
// ============================================================================

describe("CreateInvoiceSchema — autoApplyCredits", () => {
  const validInvoice = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    issueDate: "2026-01-15",
    dueDate: "2026-02-14",
    items: [{ name: "Service", quantity: 1, rate: 100000 }],
  };

  it("defaults autoApplyCredits to false", () => {
    const result = CreateInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoApplyCredits).toBe(false);
    }
  });

  it("accepts autoApplyCredits set to true", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, autoApplyCredits: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoApplyCredits).toBe(true);
    }
  });

  it("accepts autoApplyCredits set to false explicitly", () => {
    const result = CreateInvoiceSchema.safeParse({ ...validInvoice, autoApplyCredits: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoApplyCredits).toBe(false);
    }
  });
});

// ============================================================================
// CreateExpenseSchema — mileage fields
// ============================================================================

describe("CreateExpenseSchema — mileage fields", () => {
  const validExpense = {
    categoryId: "550e8400-e29b-41d4-a716-446655440000",
    date: "2026-03-01",
    amount: 5000,
    description: "Travel expense",
  };

  it("accepts expense with distance and mileageRate", () => {
    const result = CreateExpenseSchema.safeParse({
      ...validExpense,
      distance: 25.5,
      mileageRate: 1200,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distance).toBe(25.5);
      expect(result.data.mileageRate).toBe(1200);
    }
  });

  it("allows distance to be omitted", () => {
    const result = CreateExpenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.distance).toBeUndefined();
    }
  });

  it("allows mileageRate to be omitted", () => {
    const result = CreateExpenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mileageRate).toBeUndefined();
    }
  });

  it("rejects negative distance", () => {
    const result = CreateExpenseSchema.safeParse({ ...validExpense, distance: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects negative mileageRate", () => {
    const result = CreateExpenseSchema.safeParse({ ...validExpense, mileageRate: -100 });
    expect(result.success).toBe(false);
  });

  it("accepts distance of 0", () => {
    const result = CreateExpenseSchema.safeParse({ ...validExpense, distance: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts mileageRate of 0", () => {
    const result = CreateExpenseSchema.safeParse({ ...validExpense, mileageRate: 0 });
    expect(result.success).toBe(true);
  });

  it("defaults currency to INR", () => {
    const result = CreateExpenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("INR");
    }
  });
});

// ============================================================================
// CreateRecurringProfileSchema
// ============================================================================

describe("CreateRecurringProfileSchema", () => {
  const validProfile = {
    clientId: "550e8400-e29b-41d4-a716-446655440000",
    type: "invoice" as const,
    frequency: RecurringFrequency.MONTHLY,
    startDate: "2026-04-01",
    templateData: { items: [{ name: "Monthly retainer", quantity: 1, rate: 50000 }] },
  };

  it("accepts valid recurring profile", () => {
    const result = CreateRecurringProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("rejects missing clientId", () => {
    const { clientId, ...rest } = validProfile;
    const result = CreateRecurringProfileSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid clientId", () => {
    const result = CreateRecurringProfileSchema.safeParse({
      ...validProfile,
      clientId: "bad-id",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all RecurringFrequency enum values", () => {
    for (const frequency of Object.values(RecurringFrequency)) {
      const result = CreateRecurringProfileSchema.safeParse({ ...validProfile, frequency });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid frequency value", () => {
    const result = CreateRecurringProfileSchema.safeParse({
      ...validProfile,
      frequency: "biweekly",
    });
    expect(result.success).toBe(false);
  });

  it("accepts type expense", () => {
    const result = CreateRecurringProfileSchema.safeParse({
      ...validProfile,
      type: "expense",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = CreateRecurringProfileSchema.safeParse({
      ...validProfile,
      type: "subscription",
    });
    expect(result.success).toBe(false);
  });

  it("defaults autoSend to false", () => {
    const result = CreateRecurringProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoSend).toBe(false);
    }
  });

  it("defaults autoCharge to false", () => {
    const result = CreateRecurringProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoCharge).toBe(false);
    }
  });
});

// ============================================================================
// DisputeFilterSchema
// ============================================================================

describe("DisputeFilterSchema", () => {
  it("applies pagination defaults when no input given", () => {
    const result = DisputeFilterSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sortOrder).toBe("desc");
    }
  });

  it("accepts status filter", () => {
    const result = DisputeFilterSchema.safeParse({ status: DisputeStatus.OPEN });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe(DisputeStatus.OPEN);
    }
  });

  it("accepts clientId filter", () => {
    const result = DisputeFilterSchema.safeParse({
      clientId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid clientId", () => {
    const result = DisputeFilterSchema.safeParse({ clientId: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = DisputeFilterSchema.safeParse({ status: "pending" });
    expect(result.success).toBe(false);
  });

  it("accepts custom page and limit", () => {
    const result = DisputeFilterSchema.safeParse({ page: 2, limit: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(50);
    }
  });
});
