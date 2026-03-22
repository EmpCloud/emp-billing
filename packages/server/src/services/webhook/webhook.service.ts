import { v4 as uuid } from "uuid";
import crypto from "crypto";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import type { Webhook, WebhookEvent } from "@emp-billing/shared";
import type { z } from "zod";
import type { CreateWebhookSchema, UpdateWebhookSchema } from "@emp-billing/shared";

// ============================================================================
// WEBHOOK SERVICE
// ============================================================================

// ── SSRF Protection ─────────────────────────────────────────────────────────

/**
 * Validate that a webhook URL does not point to internal/private networks.
 * Blocks: localhost, 127.x, ::1, 10.x, 172.16-31.x, 192.168.x, 169.254.x,
 * AWS metadata (169.254.169.254), and non-http(s) schemes.
 */
function isInternalUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true; // malformed URLs are blocked
  }

  // Only allow http and https schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost variants
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0"
  ) {
    return true;
  }

  // Block .local and .internal TLDs
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return true;
  }

  // Check for IPv4 private/reserved ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);

    // 127.0.0.0/8 — loopback
    if (a === 127) return true;
    // 10.0.0.0/8 — private
    if (a === 10) return true;
    // 172.16.0.0/12 — private
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16 — private
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 — link-local (includes AWS metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
  }

  return false;
}

/**
 * Validate a webhook URL is safe to call. Throws if the URL targets an
 * internal or private network address.
 */
function assertExternalUrl(url: string): void {
  if (isInternalUrl(url)) {
    throw BadRequestError(
      "Webhook URL must not point to internal or private network addresses"
    );
  }
}

// ── List ─────────────────────────────────────────────────────────────────────

export async function listWebhooks(orgId: string): Promise<Omit<Webhook, "secret">[]> {
  const db = await getDB();
  const webhooks = await db.findMany<Webhook>("webhooks", {
    where: { org_id: orgId },
    orderBy: [{ column: "created_at", direction: "desc" }],
  });
  // Strip secret from list responses — only expose on create
  return webhooks.map(({ secret: _secret, ...rest }) => rest);
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createWebhook(
  orgId: string,
  input: z.infer<typeof CreateWebhookSchema>
): Promise<Webhook> {
  assertExternalUrl(input.url);
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

  if (input.url !== undefined) assertExternalUrl(input.url);

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

  assertExternalUrl(webhook.url);

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

  assertExternalUrl(webhook.url);

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
    // Skip webhooks targeting internal URLs (may have been created before
    // the SSRF check was added)
    if (isInternalUrl(webhook.url)) continue;

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
