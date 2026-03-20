"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWebhooks = listWebhooks;
exports.createWebhook = createWebhook;
exports.updateWebhook = updateWebhook;
exports.deleteWebhook = deleteWebhook;
exports.testWebhook = testWebhook;
exports.getDeliveries = getDeliveries;
exports.retryDelivery = retryDelivery;
exports.dispatchEvent = dispatchEvent;
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
// ============================================================================
// WEBHOOK SERVICE
// ============================================================================
// ── List ─────────────────────────────────────────────────────────────────────
async function listWebhooks(orgId) {
    const db = await (0, index_1.getDB)();
    return db.findMany("webhooks", {
        where: { org_id: orgId },
        orderBy: [{ column: "created_at", direction: "desc" }],
    });
}
// ── Create ────────────────────────────────────────────────────────────────────
async function createWebhook(orgId, input) {
    const db = await (0, index_1.getDB)();
    const id = (0, uuid_1.v4)();
    const secret = crypto_1.default.randomBytes(32).toString("hex");
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
    const webhook = await db.findById("webhooks", id, orgId);
    if (!webhook)
        throw (0, AppError_1.NotFoundError)("Webhook");
    return webhook;
}
// ── Update ────────────────────────────────────────────────────────────────────
async function updateWebhook(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("webhooks", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Webhook");
    const updateData = { updatedAt: new Date() };
    if (input.url !== undefined)
        updateData.url = input.url;
    if (input.events !== undefined)
        updateData.events = JSON.stringify(input.events);
    await db.update("webhooks", id, updateData, orgId);
    const webhook = await db.findById("webhooks", id, orgId);
    if (!webhook)
        throw (0, AppError_1.NotFoundError)("Webhook");
    return webhook;
}
// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteWebhook(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("webhooks", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Webhook");
    await db.delete("webhooks", id, orgId);
}
// ── Test ──────────────────────────────────────────────────────────────────────
async function testWebhook(orgId, id) {
    const db = await (0, index_1.getDB)();
    const webhook = await db.findById("webhooks", id, orgId);
    if (!webhook)
        throw (0, AppError_1.NotFoundError)("Webhook");
    const timestamp = new Date().toISOString();
    const testPayload = {
        event: "webhook.test",
        timestamp,
        data: { message: "This is a test webhook delivery" },
    };
    const body = JSON.stringify(testPayload);
    const signature = crypto_1.default
        .createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");
    const deliveryId = (0, uuid_1.v4)();
    const now = new Date();
    const startTime = Date.now();
    let statusCode;
    let responseBody;
    let success = false;
    let error;
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
    }
    catch (err) {
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
async function getDeliveries(orgId, webhookId) {
    const db = await (0, index_1.getDB)();
    // Validate webhook exists
    const webhook = await db.findById("webhooks", webhookId, orgId);
    if (!webhook)
        throw (0, AppError_1.NotFoundError)("Webhook");
    return db.findMany("webhook_deliveries", {
        where: { webhook_id: webhookId, org_id: orgId },
        orderBy: [{ column: "delivered_at", direction: "desc" }],
    });
}
// ── Retry Delivery ───────────────────────────────────────────────────────────
async function retryDelivery(orgId, webhookId, deliveryId) {
    const db = await (0, index_1.getDB)();
    const webhook = await db.findById("webhooks", webhookId, orgId);
    if (!webhook)
        throw (0, AppError_1.NotFoundError)("Webhook");
    // Find the original delivery
    const deliveries = await db.findMany("webhook_deliveries", {
        where: { id: deliveryId, webhook_id: webhookId, org_id: orgId },
    });
    const original = deliveries[0];
    if (!original)
        throw (0, AppError_1.NotFoundError)("Delivery");
    const body = original.requestBody;
    const signature = crypto_1.default
        .createHmac("sha256", webhook.secret)
        .update(body)
        .digest("hex");
    const newDeliveryId = (0, uuid_1.v4)();
    const now = new Date();
    const startTime = Date.now();
    let statusCode;
    let responseBody;
    let success = false;
    let error;
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
    }
    catch (err) {
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
    const updateData = {
        lastDeliveredAt: now,
        updatedAt: now,
    };
    if (success) {
        updateData.failureCount = 0;
    }
    else {
        updateData.failureCount = (webhook.failureCount ?? 0) + 1;
    }
    await db.update("webhooks", webhook.id, updateData, orgId);
    return { success, statusCode, error };
}
// ── Dispatch Event ────────────────────────────────────────────────────────────
async function dispatchEvent(orgId, event, payload) {
    const db = await (0, index_1.getDB)();
    // Find all active webhooks for this org
    const webhooks = await db.findMany("webhooks", {
        where: { org_id: orgId, is_active: true },
    });
    // Filter to those subscribed to this event
    const subscribers = webhooks.filter((wh) => {
        const events = typeof wh.events === "string" ? JSON.parse(wh.events) : wh.events;
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
        const signature = crypto_1.default
            .createHmac("sha256", webhook.secret)
            .update(body)
            .digest("hex");
        const deliveryId = (0, uuid_1.v4)();
        const now = new Date();
        const startTime = Date.now();
        let statusCode;
        let responseBody;
        let success = false;
        let error;
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
        }
        catch (err) {
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
        const updateData = {
            lastDeliveredAt: now,
            updatedAt: now,
        };
        if (success) {
            updateData.failureCount = 0;
        }
        else {
            updateData.failureCount = (webhook.failureCount ?? 0) + 1;
        }
        await db.update("webhooks", webhook.id, updateData, orgId);
    }
}
//# sourceMappingURL=webhook.service.js.map