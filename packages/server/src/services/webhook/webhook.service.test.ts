import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookEvent } from "@emp-billing/shared";

// ============================================================================
// Mocks
// ============================================================================

const mockDb = {
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../../db/adapters/index", () => ({
  getDB: vi.fn(() => Promise.resolve(mockDb)),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  dispatchEvent,
  getDeliveries,
  retryDelivery,
} from "./webhook.service";

// ============================================================================
// Helpers
// ============================================================================

const ORG_ID = "org-001";
const WEBHOOK_ID = "wh-001";

function resetMocks() {
  Object.values(mockDb).forEach((fn) => fn.mockReset());
  mockFetch.mockReset();
}

// ============================================================================
// listWebhooks
// ============================================================================

describe("listWebhooks", () => {
  beforeEach(() => resetMocks());

  it("returns webhooks for the org", async () => {
    const webhooks = [
      { id: "wh-1", url: "https://example.com/hook1", events: ["invoice.created"] },
      { id: "wh-2", url: "https://example.com/hook2", events: ["payment.received"] },
    ];
    mockDb.findMany.mockResolvedValue(webhooks);

    const result = await listWebhooks(ORG_ID);

    expect(result).toHaveLength(2);
    expect(mockDb.findMany).toHaveBeenCalledWith("webhooks", expect.objectContaining({
      where: { org_id: ORG_ID },
    }));
  });

  it("returns empty array when no webhooks exist", async () => {
    mockDb.findMany.mockResolvedValue([]);

    const result = await listWebhooks(ORG_ID);

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// createWebhook
// ============================================================================

describe("createWebhook", () => {
  beforeEach(() => resetMocks());

  it("creates a webhook with URL and events", async () => {
    mockDb.create.mockResolvedValue(undefined);
    mockDb.findById.mockResolvedValue({
      id: "generated-id",
      orgId: ORG_ID,
      url: "https://example.com/hook",
      events: ["invoice.created", "payment.received"],
      secret: "some-secret",
      isActive: true,
      failureCount: 0,
    });

    const result = await createWebhook(ORG_ID, {
      url: "https://example.com/hook",
      events: ["invoice.created", "payment.received"],
    });

    expect(result.url).toBe("https://example.com/hook");
    expect(result.isActive).toBe(true);
    expect(mockDb.create).toHaveBeenCalledWith("webhooks", expect.objectContaining({
      orgId: ORG_ID,
      url: "https://example.com/hook",
      isActive: true,
      failureCount: 0,
    }));
  });

  it("generates a secret for the webhook", async () => {
    mockDb.create.mockResolvedValue(undefined);
    mockDb.findById.mockResolvedValue({
      id: "wh-new",
      secret: "generated-secret-hash",
      isActive: true,
    });

    await createWebhook(ORG_ID, {
      url: "https://example.com/hook",
      events: ["invoice.created"],
    });

    const createCall = mockDb.create.mock.calls[0][1];
    expect(typeof createCall.secret).toBe("string");
    expect(createCall.secret.length).toBeGreaterThan(0);
  });

  it("throws NotFoundError if webhook cannot be found after creation", async () => {
    mockDb.create.mockResolvedValue(undefined);
    mockDb.findById.mockResolvedValue(null);

    await expect(
      createWebhook(ORG_ID, { url: "https://example.com/hook", events: ["invoice.created"] })
    ).rejects.toThrow("Webhook not found");
  });
});

// ============================================================================
// updateWebhook
// ============================================================================

describe("updateWebhook", () => {
  beforeEach(() => resetMocks());

  it("updates webhook URL", async () => {
    mockDb.findById
      .mockResolvedValueOnce({ id: WEBHOOK_ID, url: "https://old.com/hook", events: ["invoice.created"] })
      .mockResolvedValueOnce({ id: WEBHOOK_ID, url: "https://new.com/hook", events: ["invoice.created"] });
    mockDb.update.mockResolvedValue(undefined);

    const result = await updateWebhook(ORG_ID, WEBHOOK_ID, { url: "https://new.com/hook" });

    expect(result.url).toBe("https://new.com/hook");
    expect(mockDb.update).toHaveBeenCalledWith("webhooks", WEBHOOK_ID, expect.objectContaining({
      url: "https://new.com/hook",
    }), ORG_ID);
  });

  it("updates webhook events", async () => {
    mockDb.findById
      .mockResolvedValueOnce({ id: WEBHOOK_ID, events: ["invoice.created"] })
      .mockResolvedValueOnce({ id: WEBHOOK_ID, events: ["payment.received"] });
    mockDb.update.mockResolvedValue(undefined);

    const result = await updateWebhook(ORG_ID, WEBHOOK_ID, {
      events: ["payment.received"],
    });

    expect(mockDb.update).toHaveBeenCalledWith("webhooks", WEBHOOK_ID, expect.objectContaining({
      events: JSON.stringify(["payment.received"]),
    }), ORG_ID);
  });

  it("throws NotFoundError for non-existent webhook", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(
      updateWebhook(ORG_ID, "non-existent", { url: "https://new.com" })
    ).rejects.toThrow("Webhook not found");
  });
});

// ============================================================================
// deleteWebhook
// ============================================================================

describe("deleteWebhook", () => {
  beforeEach(() => resetMocks());

  it("deletes an existing webhook", async () => {
    mockDb.findById.mockResolvedValue({ id: WEBHOOK_ID });
    mockDb.delete.mockResolvedValue(true);

    await deleteWebhook(ORG_ID, WEBHOOK_ID);

    expect(mockDb.delete).toHaveBeenCalledWith("webhooks", WEBHOOK_ID, ORG_ID);
  });

  it("throws NotFoundError for non-existent webhook", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(deleteWebhook(ORG_ID, "non-existent")).rejects.toThrow("Webhook not found");
  });
});

// ============================================================================
// dispatchEvent
// ============================================================================

describe("dispatchEvent", () => {
  beforeEach(() => resetMocks());

  it("sends POST to subscribed webhooks and logs delivery", async () => {
    mockDb.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook1",
        events: [WebhookEvent.INVOICE_CREATED],
        secret: "secret1",
        isActive: true,
        failureCount: 0,
      },
    ]);
    mockDb.create.mockResolvedValue(undefined);
    mockDb.update.mockResolvedValue(undefined);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("OK"),
    });

    await dispatchEvent(ORG_ID, WebhookEvent.INVOICE_CREATED, { invoiceId: "inv-1" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/hook1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Webhook-Event": "invoice.created",
        }),
      })
    );
    // Should log the delivery
    expect(mockDb.create).toHaveBeenCalledWith("webhook_deliveries", expect.objectContaining({
      event: "invoice.created",
      success: true,
    }));
    // Should reset failure count on success
    expect(mockDb.update).toHaveBeenCalledWith("webhooks", "wh-1", expect.objectContaining({
      failureCount: 0,
    }), ORG_ID);
  });

  it("does not send to webhooks not subscribed to the event", async () => {
    mockDb.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook1",
        events: [WebhookEvent.PAYMENT_RECEIVED],
        secret: "secret1",
        isActive: true,
      },
    ]);

    await dispatchEvent(ORG_ID, WebhookEvent.INVOICE_CREATED, { invoiceId: "inv-1" });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("logs failure and increments failureCount on HTTP error", async () => {
    mockDb.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook1",
        events: [WebhookEvent.INVOICE_CREATED],
        secret: "secret1",
        isActive: true,
        failureCount: 2,
      },
    ]);
    mockDb.create.mockResolvedValue(undefined);
    mockDb.update.mockResolvedValue(undefined);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await dispatchEvent(ORG_ID, WebhookEvent.INVOICE_CREATED, { invoiceId: "inv-1" });

    expect(mockDb.create).toHaveBeenCalledWith("webhook_deliveries", expect.objectContaining({
      success: false,
    }));
    expect(mockDb.update).toHaveBeenCalledWith("webhooks", "wh-1", expect.objectContaining({
      failureCount: 3,
    }), ORG_ID);
  });

  it("handles fetch network error gracefully", async () => {
    mockDb.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook1",
        events: [WebhookEvent.INVOICE_CREATED],
        secret: "secret1",
        isActive: true,
        failureCount: 0,
      },
    ]);
    mockDb.create.mockResolvedValue(undefined);
    mockDb.update.mockResolvedValue(undefined);

    mockFetch.mockRejectedValue(new Error("Connection refused"));

    await dispatchEvent(ORG_ID, WebhookEvent.INVOICE_CREATED, { invoiceId: "inv-1" });

    expect(mockDb.create).toHaveBeenCalledWith("webhook_deliveries", expect.objectContaining({
      success: false,
      error: "Connection refused",
    }));
  });
});

// ============================================================================
// getDeliveries
// ============================================================================

describe("getDeliveries", () => {
  beforeEach(() => resetMocks());

  it("returns delivery logs for a webhook", async () => {
    mockDb.findById.mockResolvedValue({ id: WEBHOOK_ID });
    const deliveries = [
      { id: "del-1", event: "invoice.created", success: true },
      { id: "del-2", event: "invoice.created", success: false },
    ];
    mockDb.findMany.mockResolvedValue(deliveries);

    const result = await getDeliveries(ORG_ID, WEBHOOK_ID);

    expect(result).toHaveLength(2);
    expect(mockDb.findMany).toHaveBeenCalledWith("webhook_deliveries", expect.objectContaining({
      where: { webhook_id: WEBHOOK_ID, org_id: ORG_ID },
    }));
  });

  it("throws NotFoundError for non-existent webhook", async () => {
    mockDb.findById.mockResolvedValue(null);

    await expect(getDeliveries(ORG_ID, "non-existent")).rejects.toThrow("Webhook not found");
  });
});

// ============================================================================
// retryDelivery
// ============================================================================

describe("retryDelivery", () => {
  beforeEach(() => resetMocks());

  it("retries a failed delivery and logs a new delivery", async () => {
    mockDb.findById.mockResolvedValue({
      id: WEBHOOK_ID,
      url: "https://example.com/hook",
      secret: "secret1",
      failureCount: 1,
    });
    mockDb.findMany.mockResolvedValue([
      {
        id: "del-1",
        event: "invoice.created",
        requestBody: JSON.stringify({ event: "invoice.created", data: {} }),
      },
    ]);
    mockDb.create.mockResolvedValue(undefined);
    mockDb.update.mockResolvedValue(undefined);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("OK"),
    });

    const result = await retryDelivery(ORG_ID, WEBHOOK_ID, "del-1");

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Webhook-Retry": "true",
        }),
      })
    );
    // New delivery record created
    expect(mockDb.create).toHaveBeenCalledWith("webhook_deliveries", expect.objectContaining({
      event: "invoice.created",
      success: true,
    }));
    // Failure count reset on success
    expect(mockDb.update).toHaveBeenCalledWith("webhooks", WEBHOOK_ID, expect.objectContaining({
      failureCount: 0,
    }), ORG_ID);
  });

  it("throws NotFoundError for non-existent delivery", async () => {
    mockDb.findById.mockResolvedValue({
      id: WEBHOOK_ID,
      url: "https://example.com/hook",
      secret: "secret1",
    });
    mockDb.findMany.mockResolvedValue([]); // no delivery found

    await expect(retryDelivery(ORG_ID, WEBHOOK_ID, "non-existent")).rejects.toThrow(
      "Delivery not found"
    );
  });

  it("increments failureCount on retry failure", async () => {
    mockDb.findById.mockResolvedValue({
      id: WEBHOOK_ID,
      url: "https://example.com/hook",
      secret: "secret1",
      failureCount: 3,
    });
    mockDb.findMany.mockResolvedValue([
      {
        id: "del-1",
        event: "invoice.created",
        requestBody: JSON.stringify({ event: "invoice.created", data: {} }),
      },
    ]);
    mockDb.create.mockResolvedValue(undefined);
    mockDb.update.mockResolvedValue(undefined);

    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve("Bad Gateway"),
    });

    const result = await retryDelivery(ORG_ID, WEBHOOK_ID, "del-1");

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(502);
    expect(mockDb.update).toHaveBeenCalledWith("webhooks", WEBHOOK_ID, expect.objectContaining({
      failureCount: 4,
    }), ORG_ID);
  });
});
