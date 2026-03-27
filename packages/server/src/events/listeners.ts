import { v4 as uuid } from "uuid";
import { on } from "./index";
import type { BillingEvent } from "./index";
import { logger } from "../utils/logger";
import { getDB } from "../db/adapters/index";
import { dispatchEvent } from "../services/webhook/webhook.service";
import type { WebhookEvent } from "@emp-billing/shared";
import {
  sendInvoiceEmail,
  sendPaymentReceiptEmail,
  sendPaymentReminderEmail,
} from "../services/notification/email.service";
import { createNotification } from "../services/notification/notification.service";

// ============================================================================
// EVENT LISTENERS
// ============================================================================

// Events that should trigger webhook dispatch
const WEBHOOK_EVENTS: BillingEvent[] = [
  "invoice.created",
  "invoice.sent",
  "invoice.paid",
  "invoice.overdue",
  "payment.received",
  "quote.created",
  "quote.accepted",
  "quote.declined",
  "client.created",
  "expense.created",
  "subscription.created",
  "subscription.activated",
  "subscription.trial_ending",
  "subscription.renewed",
  "subscription.upgraded",
  "subscription.downgraded",
  "subscription.paused",
  "subscription.resumed",
  "subscription.cancelled",
  "subscription.expired",
  "payment.failed",
  "subscription.payment_failed",
  "coupon.redeemed",
];

/**
 * Register all event listeners. Call once during server startup.
 */
export function registerListeners(): void {
  // ── Webhook dispatch for all events ─────────────────────────────────────
  for (const event of WEBHOOK_EVENTS) {
    on(event, (payload) => {
      logger.info(`Event fired: ${event}`, { event, orgId: (payload as unknown as Record<string, unknown>).orgId });

      dispatchEvent(
        (payload as unknown as Record<string, unknown>).orgId as string,
        event as unknown as WebhookEvent,
        payload as unknown as Record<string, unknown>,
      ).catch((err) => {
        logger.error(`Webhook dispatch failed for ${event}`, { err });
      });
    });
  }

  // ── Invoice sent → send email ───────────────────────────────────────────
  on("invoice.sent", (payload) => {
    sendInvoiceEmail(payload.orgId, payload.invoiceId, payload.clientEmail).catch(
      (err) => {
        logger.error("Failed to send invoice email", {
          invoiceId: payload.invoiceId,
          err,
        });
      },
    );
  });

  // ── Payment received → send receipt email ───────────────────────────────
  on("payment.received", (payload) => {
    // Only send receipt if there is payment data with a client email
    const clientEmail = (payload.payment as Record<string, unknown>)?.clientEmail as string | undefined;
    if (clientEmail) {
      sendPaymentReceiptEmail(payload.orgId, payload.paymentId, clientEmail).catch(
        (err) => {
          logger.error("Failed to send payment receipt email", {
            paymentId: payload.paymentId,
            err,
          });
        },
      );
    }
  });

  // ── Invoice created → send invoice email with PDF attachment ────────────
  on("invoice.created", (payload) => {
    const clientEmail = (payload.invoice as Record<string, unknown>).clientEmail as string
      ?? (payload.invoice as Record<string, unknown>).client_email as string
      ?? undefined;
    if (clientEmail) {
      sendInvoiceEmail(payload.orgId, payload.invoiceId, clientEmail).catch(
        (err) => {
          logger.error("Failed to send invoice email on creation", {
            invoiceId: payload.invoiceId,
            err,
          });
        },
      );
    }
  });

  // ── Invoice overdue → send overdue reminder email ─────────────────────
  on("invoice.overdue", (payload) => {
    const clientEmail = (payload.invoice as Record<string, unknown>).clientEmail as string
      ?? (payload.invoice as Record<string, unknown>).client_email as string
      ?? undefined;
    if (clientEmail) {
      sendPaymentReminderEmail(payload.orgId, payload.invoiceId, clientEmail).catch(
        (err) => {
          logger.error("Failed to send overdue reminder email", {
            invoiceId: payload.invoiceId,
            err,
          });
        },
      );
    }
  });

  // ── In-app notifications ──────────────────────────────────────────────────

  on("invoice.created", (payload) => {
    const inv = payload.invoice;
    createNotification(payload.orgId, {
      type: "invoice_created",
      title: "Invoice Created",
      message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} has been created.`,
      entityType: "invoice",
      entityId: payload.invoiceId,
    }).catch((err) => logger.error("Failed to create notification for invoice.created", { err }));
  });

  on("invoice.sent", (payload) => {
    const inv = payload.invoice;
    createNotification(payload.orgId, {
      type: "invoice_sent",
      title: "Invoice Sent",
      message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} was sent to ${payload.clientEmail}.`,
      entityType: "invoice",
      entityId: payload.invoiceId,
    }).catch((err) => logger.error("Failed to create notification for invoice.sent", { err }));
  });

  on("invoice.paid", (payload) => {
    const inv = payload.invoice;
    createNotification(payload.orgId, {
      type: "invoice_paid",
      title: "Invoice Paid",
      message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} has been fully paid.`,
      entityType: "invoice",
      entityId: payload.invoiceId,
    }).catch((err) => logger.error("Failed to create notification for invoice.paid", { err }));
  });

  on("invoice.overdue", (payload) => {
    const inv = payload.invoice;
    createNotification(payload.orgId, {
      type: "invoice_overdue",
      title: "Invoice Overdue",
      message: `Invoice ${inv.invoiceNumber || inv.invoice_number || ""} is now overdue.`,
      entityType: "invoice",
      entityId: payload.invoiceId,
    }).catch((err) => logger.error("Failed to create notification for invoice.overdue", { err }));
  });

  on("payment.received", (payload) => {
    const pay = payload.payment;
    createNotification(payload.orgId, {
      type: "payment_received",
      title: "Payment Received",
      message: `Payment ${pay.paymentNumber || pay.payment_number || ""} has been recorded.`,
      entityType: "payment",
      entityId: payload.paymentId,
    }).catch((err) => logger.error("Failed to create notification for payment.received", { err }));
  });

  on("quote.accepted", (payload) => {
    const qt = payload.quote;
    createNotification(payload.orgId, {
      type: "quote_accepted",
      title: "Quote Accepted",
      message: `Quote ${qt.quoteNumber || qt.quote_number || ""} has been accepted by the client.`,
      entityType: "quote",
      entityId: payload.quoteId,
    }).catch((err) => logger.error("Failed to create notification for quote.accepted", { err }));
  });

  on("expense.created", (payload) => {
    const exp = payload.expense;
    createNotification(payload.orgId, {
      type: "expense_approved",
      title: "Expense Created",
      message: `A new expense "${exp.description || ""}" has been created.`,
      entityType: "expense",
      entityId: payload.expenseId,
    }).catch((err) => logger.error("Failed to create notification for expense.created", { err }));
  });

  // ── Subscription notifications ──────────────────────────────────────────

  on("subscription.created", (payload) => {
    createNotification(payload.orgId, {
      type: "subscription_created",
      title: "New Subscription",
      message: `A new subscription has been created.`,
      entityType: "subscription",
      entityId: payload.subscriptionId,
    }).catch((err) => logger.error("Failed to create notification for subscription.created", { err }));
  });

  on("subscription.activated", (payload) => {
    createNotification(payload.orgId, {
      type: "subscription_created",
      title: "Subscription Activated",
      message: `A subscription has been activated.`,
      entityType: "subscription",
      entityId: payload.subscriptionId,
    }).catch((err) => logger.error("Failed to create notification for subscription.activated", { err }));
  });

  on("subscription.renewed", (payload) => {
    createNotification(payload.orgId, {
      type: "subscription_renewed",
      title: "Subscription Renewed",
      message: `A subscription has been renewed.`,
      entityType: "subscription",
      entityId: payload.subscriptionId,
    }).catch((err) => logger.error("Failed to create notification for subscription.renewed", { err }));
  });

  on("subscription.cancelled", (payload) => {
    createNotification(payload.orgId, {
      type: "subscription_cancelled",
      title: "Subscription Cancelled",
      message: `A subscription has been cancelled.`,
      entityType: "subscription",
      entityId: payload.subscriptionId,
    }).catch((err) => logger.error("Failed to create notification for subscription.cancelled", { err }));
  });

  on("payment.failed", (payload) => {
    createNotification(payload.orgId, {
      type: "payment_failed",
      title: "Payment Failed",
      message: `Payment attempt #${payload.attemptNumber} failed for an invoice.`,
      entityType: "invoice",
      entityId: payload.invoiceId,
    }).catch((err) => logger.error("Failed to create notification for payment.failed", { err }));
  });

  on("subscription.payment_failed", (payload) => {
    createNotification(payload.orgId, {
      type: "payment_failed",
      title: "Subscription Payment Failed",
      message: `Payment attempt #${payload.attemptNumber} failed for a subscription invoice.`,
      entityType: "invoice",
      entityId: payload.invoiceId,
    }).catch((err) => logger.error("Failed to create notification for subscription.payment_failed", { err }));
  });

  on("subscription.trial_ending", (payload) => {
    createNotification(payload.orgId, {
      type: "trial_ending",
      title: "Trial Ending Soon",
      message: `A subscription trial is ending soon.`,
      entityType: "subscription",
      entityId: payload.subscriptionId,
    }).catch((err) => logger.error("Failed to create notification for subscription.trial_ending", { err }));
  });

  // ── Audit log for all events ─────────────────────────────────────────────
  const AUDIT_EVENTS: BillingEvent[] = [
    "invoice.created", "invoice.sent", "invoice.paid", "invoice.overdue",
    "payment.received",
    "quote.created", "quote.accepted", "quote.declined",
    "client.created",
    "expense.created",
    "subscription.created", "subscription.activated", "subscription.renewed",
    "subscription.upgraded", "subscription.downgraded",
    "subscription.paused", "subscription.resumed",
    "subscription.cancelled", "subscription.expired",
    "payment.failed", "subscription.payment_failed",
    "coupon.redeemed",
  ];

  for (const event of AUDIT_EVENTS) {
    on(event, (payload) => {
      const p = payload as unknown as Record<string, unknown>;
      const orgId = p.orgId as string;

      // Derive entity type and id from event name + payload
      const [entityType] = event.split(".");
      const entityId =
        (p.invoiceId as string) ||
        (p.paymentId as string) ||
        (p.quoteId as string) ||
        (p.clientId as string) ||
        (p.expenseId as string) ||
        (p.subscriptionId as string) ||
        (p.couponId as string) ||
        "";

      getDB()
        .then((db) =>
          db.create("audit_logs", {
            id: uuid(),
            orgId,
            userId: null,
            action: event,
            entityType,
            entityId,
            before: null,
            after: JSON.stringify(p),
            ipAddress: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
        .catch((err) => logger.warn("Audit log write failed", { event, err }));
    });
  }

  logger.info("Event listeners registered");
}
