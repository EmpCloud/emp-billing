import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { getDB } from "../../db/adapters/index";
import { NotFoundError } from "../../utils/AppError";
import type { Webhook, WebhookEvent } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateWebhookSchema, UpdateWebhookSchema } from "@emp-billing/shared";

// ============================================================================
// WEBHOOK SERVICE
// ============================================================================

// ── List ─────────────────────────────────────────────────────────────────────

export async function listWebhooks(orgId: string): Promise<Webhook[]> {
  const db = await getDB();
  return db.findMany<Webhook>("webhooks", {
    where: { org_id: orgId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createWebhook(
  orgId: string,
  input: z.infer<typeof CreateWebhookSchema>
): Promise<Webhook> {
  const db = await getDB();

  const id = uuid();
  const secret = crypto.randomBytes(32).toString("hex");
  const now = new Date();

  await db.create("webhooks", {
    id,
    orgId,
    url: input.url,
    events: JSON.stringify(input.events),
    secret,
    isActive: true,
    failureCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const webhook = await db.findById<Webhook>("webhooks", id, orgId);
  if (!webhook) throw NotFoundError("Webhook");
  return webhook;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateWebhook(
  orgId: string,
  id: string,
  input: z.infer<typeof UpdateWebhookSchema>
): Promise<Webhook> {
  const db = await getDB();
  const existing = await db.findById<Webhook>("webhooks", id, orgId);
  if (!existing) throw NotFoundError("Webhook");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (input.url !== undefined) updateData.url = input.url;
  if (input.events !== undefined) updateData.events = JSON.stringify(input.events);

  await db.update("webhooks", id, updateData, orgId);

  const webhook = await db.findById<Webhook>("webhooks", id, orgId);
  if (!webhook) throw NotFoundError("Webhook");
  return webhook;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWebhook(orgId: string, id: string): Promise<void> {
  const db = await getDB();
  const existing = await db.findById<Webhook>("webhooks", id, orgId);
  if (!existing) throw NotFoundError("Webhook");

  await db.delete("webhooks", id, orgId);
}

// ── Test ──────────────────────────────────────────────────────────────────────

export async function testWebhook(orgId: string, id: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const db = await getDB();
  const webhook = await db.findById<Webhook>("webhooks", id, orgId);
  if (!webhook) throw NotFoundError("Webhook");

  const timestamp = new Date().toISOString();
  const testPayload = {
    event: "webhook.test",
    timestamp,
    data: { message: "This is a test webhook delivery" },
  };

  const body = JSON.stringify(testPayload);
  const signature = crypto
    .createHmac("sha256", webhook.secret)
    .update(body)
    .digest("hex");

  const deliveryId = uuid();
  const now = new Date();
  const startTime = Date.now();

  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let success = false;
  let error: string | undefined;

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": "webhook.test",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": timestamp,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    statusCode = response.status;
    responseBody = await response.text().catch(() => "");
    success = response.ok;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  const durationMs = Date.now() - startTime;

  // Record delivery
  await db.create("webhook_deliveries", {
    id: deliveryId,
    webhookId: id,
    orgId,
    event: "webhook.test",
    requestBody: body,
    responseStatus: statusCode ?? null,
    responseBody: responseBody ?? null,
    success,
    error: error ?? null,
    durationMs,
    deliveredAt: now,
  });

  return { success, statusCode, error };
}

// ── Deliveries ────────────────────────────────────────────────────────────────

export async function getDeliveries(orgId: string, webhookId: string) {
  const db = await getDB();

  // Validate webhook exists
  const webhook = await db.findById<Webhook>("webhooks", webhookId, orgId);
  if (!webhook) throw NotFoundError("Webhook");

  return db.findMany("webhook_deliveries", {
    where: { webhook_id: webhookId, org_id: orgId },
    orderBy: [{ column: "delivered_at", direction: "desc" }],
  });
}

// ── Retry Delivery ───────────────────────────────────────────────────────────

export async function retryDelivery(
  orgId: string,
  webhookId: string,
  deliveryId: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const db = await getDB();

  const webhook = await db.findById<Webhook>("webhooks", webhookId, orgId);
  if (!webhook) throw NotFoundError("Webhook");

  // Find the original delivery
  const deliveries = await db.findMany<{
    id: string;
    event: string;
    requestBody: string;
  }>("webhook_deliveries", {
    where: { id: deliveryId, webhook_id: webhookId, org_id: orgId },
  });
  const original = deliveries[0];
  if (!original) throw NotFoundError("Delivery");

  const body = original.requestBody;
  const signature = crypto
    .createHmac("sha256", webhook.secret)
    .update(body)
    .digest("hex");

  const newDeliveryId = uuid();
  const now = new Date();
  const startTime = Date.now();

  let statusCode: number | undefined;
  let responseBody: string | undefined;
  let success = false;
  let error: string | undefined;

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": original.event,
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": now.toISOString(),
        "X-Webhook-Retry": "true",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    statusCode = response.status;
    responseBody = await response.text().catch(() => "");
    success = response.ok;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  const durationMs = Date.now() - startTime;

  // Record the retry as a new delivery
  await db.create("webhook_deliveries", {
    id: newDeliveryId,
    webhookId,
    orgId,
    event: original.event,
    requestBody: body,
    responseStatus: statusCode ?? null,
    responseBody: responseBody ?? null,
    success,
    error: error ?? null,
    durationMs,
    deliveredAt: now,
  });

  // Update webhook metadata
  const updateData: Record<string, unknown> = {
    lastDeliveredAt: now,
    updatedAt: now,
  };
  if (success) {
    updateData.failureCount = 0;
  } else {
    updateData.failureCount = (webhook.failureCount ?? 0) + 1;
  }
  await db.update("webhooks", webhook.id, updateData, orgId);

  return { success, statusCode, error };
}

// ── Dispatch Event ────────────────────────────────────────────────────────────

export async function dispatchEvent(
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>
): Promise<void> {
  const db = await getDB();

  // Find all active webhooks for this org
  const webhooks = await db.findMany<Webhook>("webhooks", {
    where: { org_id: orgId, is_active: true },
  });

  // Filter to those subscribed to this event
  const subscribers = webhooks.filter((wh) => {
    const events = typeof wh.events === "string" ? JSON.parse(wh.events as unknown as string) : wh.events;
    return Array.isArray(events) && events.includes(event);
  });

  const timestamp = new Date().toISOString();

  for (const webhook of subscribers) {
    const eventPayload = {
      event,
      timestamp,
      data: payload,
    };

    const body = JSON.stringify(eventPayload);
    const signature = crypto
      .createHmac("sha256", webhook.secret)
      .update(body)
      .digest("hex");

    const deliveryId = uuid();
    const now = new Date();
    const startTime = Date.now();

    let statusCode: number | undefined;
    let responseBody: string | undefined;
    let success = false;
    let error: string | undefined;

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Event": event,
          "X-Webhook-Signature": signature,
          "X-Webhook-Timestamp": timestamp,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });

      statusCode = response.status;
      responseBody = await response.text().catch(() => "");
      success = response.ok;
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : "Unknown error";
    }

    const durationMs = Date.now() - startTime;

    // Record delivery
    await db.create("webhook_deliveries", {
      id: deliveryId,
      webhookId: webhook.id,
      orgId,
      event,
      requestBody: body,
      responseStatus: statusCode ?? null,
      responseBody: responseBody ?? null,
      success,
      error: error ?? null,
      durationMs,
      deliveredAt: now,
    });

    // Update webhook metadata
    const updateData: Record<string, unknown> = {
      lastDeliveredAt: now,
      updatedAt: now,
    };

    if (success) {
      updateData.failureCount = 0;
    } else {
      updateData.failureCount = (webhook.failureCount ?? 0) + 1;
    }

    await db.update("webhooks", webhook.id, updateData, orgId);
  }
}
