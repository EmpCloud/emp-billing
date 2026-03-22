import { v4 as uuid } from "uuid";
import dayjs from "dayjs";
import { getDB } from "../../db/adapters/index";
import { NotFoundError } from "../../utils/AppError";
import {
  DunningAttemptStatus,
  InvoiceStatus,
  PaymentMethod,
  SubscriptionStatus,
} from "@emp-billing/shared";
import type { DunningConfig, DunningAttempt } from "@emp-billing/shared";
import { emailQueue } from "../../jobs/queue";
import { logger } from "../../utils/logger";
import { getGateway } from "../payment/gateways/index";
import { emit } from "../../events/index";

// ============================================================================
// DUNNING SERVICE
// Manages failed-payment retry logic (dunning).
// ============================================================================

// Default config used when org has not configured dunning
const DEFAULT_CONFIG: Omit<DunningConfig, "id" | "orgId" | "createdAt" | "updatedAt"> = {
  maxRetries: 4,
  retrySchedule: [1, 3, 5, 7],
  gracePeriodDays: 3,
  cancelAfterAllRetries: true,
  sendReminderEmails: true,
};

// ── Get Config ──────────────────────────────────────────────────────────────

export async function getDunningConfig(orgId: string): Promise<DunningConfig> {
  const db = await getDB();
  const rows = await db.findMany<DunningConfig>("dunning_configs", {
    where: { org_id: orgId },
  });
  if (rows.length > 0) {
    const row = rows[0];
    // Parse retry_schedule if stored as string
    if (typeof row.retrySchedule === "string") {
      row.retrySchedule = JSON.parse(row.retrySchedule as unknown as string);
    }
    return row;
  }
  // Return defaults with synthetic id
  return {
    id: "",
    orgId,
    ...DEFAULT_CONFIG,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ── Update Config ───────────────────────────────────────────────────────────

export async function updateDunningConfig(
  orgId: string,
  data: Partial<Pick<DunningConfig, "maxRetries" | "retrySchedule" | "gracePeriodDays" | "cancelAfterAllRetries" | "sendReminderEmails">>
): Promise<DunningConfig> {
  const db = await getDB();
  const now = new Date();

  // Check existing
  const existing = await db.findMany<DunningConfig>("dunning_configs", {
    where: { org_id: orgId },
  });

  if (existing.length > 0) {
    // Update
    await db.update("dunning_configs", existing[0].id, {
      maxRetries: data.maxRetries,
      retrySchedule: JSON.stringify(data.retrySchedule),
      gracePeriodDays: data.gracePeriodDays,
      cancelAfterAllRetries: data.cancelAfterAllRetries,
      sendReminderEmails: data.sendReminderEmails,
      updatedAt: now,
    }, orgId);
    return getDunningConfig(orgId);
  }

  // Create
  const id = uuid();
  await db.create("dunning_configs", {
    id,
    orgId,
    maxRetries: data.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    retrySchedule: JSON.stringify(data.retrySchedule ?? DEFAULT_CONFIG.retrySchedule),
    gracePeriodDays: data.gracePeriodDays ?? DEFAULT_CONFIG.gracePeriodDays,
    cancelAfterAllRetries: data.cancelAfterAllRetries ?? DEFAULT_CONFIG.cancelAfterAllRetries,
    sendReminderEmails: data.sendReminderEmails ?? DEFAULT_CONFIG.sendReminderEmails,
    createdAt: now,
    updatedAt: now,
  });
  return getDunningConfig(orgId);
}

// ── Create Dunning Attempt ──────────────────────────────────────────────────

export async function createDunningAttempt(
  orgId: string,
  invoiceId: string,
  subscriptionId?: string
): Promise<DunningAttempt> {
  const db = await getDB();
  const config = await getDunningConfig(orgId);

  const id = uuid();
  const now = new Date();

  // First retry is scheduled after grace period + first retry schedule day
  const firstRetryDay = config.retrySchedule[0] ?? 1;
  const nextRetryAt = dayjs(now).add(firstRetryDay, "day").toDate();

  const attempt = await db.create<DunningAttempt>("dunning_attempts", {
    id,
    orgId,
    invoiceId,
    subscriptionId: subscriptionId ?? null,
    attemptNumber: 1,
    status: DunningAttemptStatus.PENDING,
    paymentError: null,
    nextRetryAt,
    createdAt: now,
  });

  return attempt;
}

// ── List Dunning Attempts ───────────────────────────────────────────────────

interface ListDunningParams {
  page?: number;
  limit?: number;
  status?: DunningAttemptStatus;
  invoiceId?: string;
}

export async function listDunningAttempts(orgId: string, params: ListDunningParams) {
  const db = await getDB();
  const where: Record<string, unknown> = { org_id: orgId };
  if (params.status) where.status = params.status;
  if (params.invoiceId) where.invoice_id = params.invoiceId;

  const result = await db.findPaginated<DunningAttempt>("dunning_attempts", {
    where,
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    orderBy: [{ column: "created_at", direction: "desc" }],
  });

  return result;
}

// ── Process Dunning Attempt ─────────────────────────────────────────────────

export async function processDunningAttempt(attemptId: string, orgId?: string): Promise<void> {
  const db = await getDB();

  const attempt = await db.findById<DunningAttempt>("dunning_attempts", attemptId, orgId);
  if (!attempt) throw NotFoundError("Dunning attempt");
  if (orgId && attempt.orgId !== orgId) throw NotFoundError("Dunning attempt");

  const config = await getDunningConfig(attempt.orgId);
  const now = new Date();

  // Look up the invoice to check current status
  const invoice = await db.findById<{
    id: string;
    orgId: string;
    clientId: string;
    invoiceNumber: string;
    status: string;
    amountDue: number;
    amountPaid: number;
    total: number;
    currency: string;
  }>("invoices", attempt.invoiceId, attempt.orgId);

  if (!invoice) {
    // Invoice deleted — skip
    await db.update("dunning_attempts", attemptId, {
      status: DunningAttemptStatus.SKIPPED,
      paymentError: "Invoice not found",
    }, attempt.orgId);
    return;
  }

  // If invoice is already paid, mark success
  if (invoice.status === InvoiceStatus.PAID) {
    await db.update("dunning_attempts", attemptId, {
      status: DunningAttemptStatus.SUCCESS,
      nextRetryAt: null,
    }, attempt.orgId);
    return;
  }

  // Look up the client's saved payment method
  const client = await db.findById<{
    id: string;
    email: string;
    name: string;
    paymentGateway?: string;
    paymentMethodId?: string;
  }>("clients", invoice.clientId, attempt.orgId);

  let chargeSuccess = false;
  let chargeError = "No saved payment method";
  let gatewayTransactionId: string | undefined;

  if (client?.paymentGateway && client?.paymentMethodId) {
    try {
      const gateway = getGateway(client.paymentGateway);
      const chargeResult = await gateway.chargeCustomer({
        paymentMethodId: client.paymentMethodId,
        amount: invoice.amountDue,
        currency: invoice.currency || "INR",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        description: `Dunning retry #${attempt.attemptNumber} for invoice ${invoice.invoiceNumber}`,
        metadata: { orgId: attempt.orgId, invoiceId: invoice.id },
      });
      chargeSuccess = chargeResult.success;
      gatewayTransactionId = chargeResult.gatewayTransactionId;
      if (!chargeSuccess) {
        chargeError = chargeResult.error || "Payment declined";
      }
    } catch (err) {
      chargeError = err instanceof Error ? err.message : "Payment processing error";
    }
  } else {
    chargeError = "No saved payment method on file";
  }

  if (chargeSuccess) {
    // Mark attempt as success
    await db.update("dunning_attempts", attemptId, {
      status: DunningAttemptStatus.SUCCESS,
      nextRetryAt: null,
    }, attempt.orgId);

    // Determine the payment method enum from the gateway name
    const paymentMethod = client?.paymentGateway === "stripe"
      ? PaymentMethod.GATEWAY_STRIPE
      : client?.paymentGateway === "razorpay"
        ? PaymentMethod.GATEWAY_RAZORPAY
        : PaymentMethod.OTHER;

    // Record the payment (same pattern as recordGatewayPayment in online-payment.service)
    const paymentId = uuid();
    const paymentCount = await db.count("payments", { org_id: attempt.orgId });
    const year = now.getFullYear();
    const paymentNumber = `PAY-${year}-${String(paymentCount + 1).padStart(4, "0")}`;

    await db.create("payments", {
      id: paymentId,
      orgId: attempt.orgId,
      clientId: invoice.clientId,
      paymentNumber,
      date: now,
      amount: invoice.amountDue,
      method: paymentMethod,
      reference: null,
      gatewayTransactionId: gatewayTransactionId || null,
      notes: `Dunning retry #${attempt.attemptNumber} via ${client?.paymentGateway || "gateway"}`,
      isRefund: false,
      refundedAmount: 0,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    });

    // Create payment allocation linking payment to invoice
    await db.create("payment_allocations", {
      id: uuid(),
      paymentId,
      invoiceId: invoice.id,
      orgId: attempt.orgId,
      amount: invoice.amountDue,
      createdAt: now,
      updatedAt: now,
    });

    // Update invoice balances
    const newAmountPaid = invoice.amountPaid + invoice.amountDue;
    const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newAmountDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

    await db.update("invoices", attempt.invoiceId, {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newStatus,
      paidAt: newStatus === InvoiceStatus.PAID ? now : null,
      updatedAt: now,
    }, attempt.orgId);

    // Update client balances
    await db.increment("clients", invoice.clientId, "total_paid", invoice.amountDue);
    await db.increment("clients", invoice.clientId, "outstanding_balance", -invoice.amountDue);
    await db.update("clients", invoice.clientId, { updatedAt: now }, attempt.orgId);

    logger.info("Dunning attempt succeeded", {
      attemptId,
      invoiceId: attempt.invoiceId,
      paymentId,
      paymentNumber,
      amount: invoice.amountDue,
    });
  } else {
    // Check if more retries available
    const hasMoreRetries = attempt.attemptNumber < config.maxRetries;

    if (hasMoreRetries) {
      // Calculate next retry date based on retry_schedule
      const nextRetryIndex = attempt.attemptNumber; // 0-indexed schedule, current attempt is 1-indexed
      const retryDays = config.retrySchedule[nextRetryIndex] ?? config.retrySchedule[config.retrySchedule.length - 1] ?? 7;
      const nextRetryAt = dayjs(now).add(retryDays, "day").toDate();

      // Update current attempt as failed
      await db.update("dunning_attempts", attemptId, {
        status: DunningAttemptStatus.FAILED,
        paymentError: chargeError,
        nextRetryAt: null,
      }, attempt.orgId);

      // Create next attempt
      const nextAttemptId = uuid();
      await db.create("dunning_attempts", {
        id: nextAttemptId,
        orgId: attempt.orgId,
        invoiceId: attempt.invoiceId,
        subscriptionId: attempt.subscriptionId ?? null,
        attemptNumber: attempt.attemptNumber + 1,
        status: DunningAttemptStatus.PENDING,
        paymentError: null,
        nextRetryAt,
        createdAt: now,
      });

      emit("payment.failed", {
        orgId: attempt.orgId,
        invoiceId: attempt.invoiceId,
        subscriptionId: attempt.subscriptionId ?? undefined,
        error: chargeError,
        attemptNumber: attempt.attemptNumber,
      });

      logger.info("Dunning attempt failed, next retry scheduled", {
        attemptId,
        nextAttemptId,
        nextRetryAt,
      });
    } else {
      // No retries left
      await db.update("dunning_attempts", attemptId, {
        status: DunningAttemptStatus.FAILED,
        paymentError: chargeError,
        nextRetryAt: null,
      }, attempt.orgId);

      // Cancel subscription if configured
      if (config.cancelAfterAllRetries && attempt.subscriptionId) {
        await db.update("subscriptions", attempt.subscriptionId, {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
          cancelReason: "Payment failed after all dunning retries",
          updatedAt: now,
        }, attempt.orgId);

        // Record a payment_failed subscription event
        await db.create("subscription_events", {
          id: uuid(),
          subscriptionId: attempt.subscriptionId,
          orgId: attempt.orgId,
          eventType: "payment_failed",
          metadata: JSON.stringify({
            invoiceId: attempt.invoiceId,
            attemptNumber: attempt.attemptNumber,
          }),
          createdAt: now,
        });

        logger.info("Subscription cancelled after all dunning retries", {
          subscriptionId: attempt.subscriptionId,
          invoiceId: attempt.invoiceId,
        });
      }

      // Send final notice email
      if (config.sendReminderEmails) {
        const clientForEmail = await db.findById<{ id: string; email: string }>(
          "clients",
          invoice.clientId,
          attempt.orgId,
        );
        if (clientForEmail?.email) {
          await emailQueue.add(
            "send-email",
            {
              type: "dunning-final-notice",
              orgId: attempt.orgId,
              invoiceId: attempt.invoiceId,
              clientEmail: clientForEmail.email,
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
            },
          );
        }
      }

      emit("payment.failed", {
        orgId: attempt.orgId,
        invoiceId: attempt.invoiceId,
        subscriptionId: attempt.subscriptionId ?? undefined,
        error: chargeError,
        attemptNumber: attempt.attemptNumber,
      });

      logger.info("Dunning exhausted all retries", {
        attemptId,
        invoiceId: attempt.invoiceId,
      });
    }

    // Send reminder email for each failure
    if (config.sendReminderEmails) {
      const reminderClient = await db.findById<{ id: string; email: string }>(
        "clients",
        invoice.clientId,
        attempt.orgId,
      );
      if (reminderClient?.email) {
        await emailQueue.add(
          "send-email",
          {
            type: "dunning-retry-failed",
            orgId: attempt.orgId,
            invoiceId: attempt.invoiceId,
            clientEmail: reminderClient.email,
            attemptNumber: attempt.attemptNumber,
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          },
        );
      }
    }
  }
}

// ── Get Dunning Summary ─────────────────────────────────────────────────────

export async function getDunningSummary(orgId: string) {
  const db = await getDB();

  // Total pending retries
  const [pendingRow] = await db.raw<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM dunning_attempts WHERE org_id = ? AND status = ?`,
    [orgId, DunningAttemptStatus.PENDING],
  );
  const totalPending = Number(pendingRow?.count ?? 0);

  // Failed this month
  const monthStart = dayjs().startOf("month").format("YYYY-MM-DD HH:mm:ss");
  const [failedRow] = await db.raw<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM dunning_attempts WHERE org_id = ? AND status = ? AND created_at >= ?`,
    [orgId, DunningAttemptStatus.FAILED, monthStart],
  );
  const failedThisMonth = Number(failedRow?.count ?? 0);

  // Recovered amount (invoices with successful dunning attempts)
  const [recoveredRow] = await db.raw<{ total: number }[]>(
    `SELECT COALESCE(SUM(i.total), 0) as total
     FROM dunning_attempts da
     JOIN invoices i ON i.id = da.invoice_id
     WHERE da.org_id = ? AND da.status = ?`,
    [orgId, DunningAttemptStatus.SUCCESS],
  );
  const recoveredAmount = Number(recoveredRow?.total ?? 0);

  return {
    totalPending,
    failedThisMonth,
    recoveredAmount,
  };
}
