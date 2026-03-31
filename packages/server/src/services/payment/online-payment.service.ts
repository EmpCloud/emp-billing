import { v4 as uuid } from "uuid";
import { getDB } from "../../db/adapters/index";
import { NotFoundError, BadRequestError } from "../../utils/AppError";
import { InvoiceStatus, PaymentMethod } from "@emp-billing/shared";
import { getGateway, listGateways } from "./gateways/index";
import { emit } from "../../events/index";
import type { Invoice, Client } from "@emp-billing/shared";
import type { WebhookResult } from "./gateways/IPaymentGateway";
import { logger } from "../../utils/logger";
import { config } from "../../config/index";

// ============================================================================
// ONLINE PAYMENT SERVICE
// Handles gateway-based payments: create order, verify, and webhooks.
// ============================================================================

// ── List available gateways ─────────────────────────────────────────────────

export function listAvailableGateways(): Array<{ name: string; displayName: string }> {
  return listGateways().map((gw) => ({
    name: gw.name,
    displayName: gw.displayName,
  }));
}

// ── Create payment order ────────────────────────────────────────────────────

export async function createPaymentOrder(
  orgId: string,
  invoiceId: string,
  gatewayName: string
) {
  const db = await getDB();

  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  if (
    [InvoiceStatus.VOID, InvoiceStatus.WRITTEN_OFF, InvoiceStatus.PAID].includes(
      invoice.status
    )
  ) {
    throw BadRequestError(
      `Cannot create payment for invoice with status '${invoice.status}'.`
    );
  }

  if (invoice.amountDue <= 0) {
    throw BadRequestError("Invoice has no outstanding balance.");
  }

  const client = await db.findById<Client>("clients", invoice.clientId, orgId);
  if (!client) throw NotFoundError("Client");

  const gateway = getGateway(gatewayName);

  // Build portal base URL — CORS_ORIGIN may be comma-separated, pick the first HTTPS origin
  const origins = String(config.corsOrigin || "").split(",").map((s) => s.trim());
  const baseOrigin = origins.find((o) => o.startsWith("https://")) || origins[0] || "";
  const portalBaseUrl = `${baseOrigin}/portal`;
  const successUrl = process.env.STRIPE_SUCCESS_URL || `${portalBaseUrl}/invoices?payment=success`;
  const cancelUrl = process.env.STRIPE_CANCEL_URL || `${portalBaseUrl}/invoices?payment=cancelled`;

  const result = await gateway.createOrder({
    amount: invoice.amountDue,
    currency: invoice.currency,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientEmail: client.email,
    clientName: client.name,
    description: `Payment for invoice ${invoice.invoiceNumber}`,
    metadata: {
      orgId,
      invoiceId: invoice.id,
      clientId: client.id,
      successUrl,
      cancelUrl,
      portalBaseUrl,
    },
  });

  return result;
}

// ── Verify payment ──────────────────────────────────────────────────────────

export async function verifyPayment(
  orgId: string,
  invoiceId: string,
  gatewayName: string,
  payload: {
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature?: string;
  }
) {
  const db = await getDB();
  const gateway = getGateway(gatewayName);

  const verification = await gateway.verifyPayment({
    gatewayOrderId: payload.gatewayOrderId,
    gatewayPaymentId: payload.gatewayPaymentId,
    gatewaySignature: payload.gatewaySignature,
  });

  if (!verification.verified || verification.status !== "success") {
    throw BadRequestError("Payment verification failed.");
  }

  // Record the payment
  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice) throw NotFoundError("Invoice");

  const paymentMethod =
    gatewayName === "stripe"
      ? PaymentMethod.GATEWAY_STRIPE
      : gatewayName === "razorpay"
        ? PaymentMethod.GATEWAY_RAZORPAY
        : gatewayName === "paypal"
          ? PaymentMethod.GATEWAY_PAYPAL
          : PaymentMethod.OTHER;

  const payment = await recordGatewayPayment(
    db,
    orgId,
    invoice,
    verification.amount,
    paymentMethod,
    verification.gatewayTransactionId
  );

  return payment;
}

// ── Handle gateway webhook ──────────────────────────────────────────────────

export async function handleGatewayWebhook(
  gatewayName: string,
  headers: Record<string, string>,
  body: unknown,
  rawBody: Buffer
): Promise<{ acknowledged: true }> {
  const gateway = getGateway(gatewayName);

  let result: WebhookResult;
  try {
    result = await gateway.handleWebhook({ headers, body, rawBody });
  } catch (err) {
    logger.error(`Webhook processing failed for ${gatewayName}`, { err });
    throw BadRequestError("Webhook signature verification failed.");
  }

  logger.info(`Webhook received: ${gatewayName} event=${result.event} status=${result.status}`, {
    gatewayTransactionId: result.gatewayTransactionId,
    gatewayOrderId: result.gatewayOrderId,
    amount: result.amount,
    currency: result.currency,
  });

  if (result.status === "success" && result.metadata?.invoiceId && result.metadata?.orgId) {
    const orgId = result.metadata.orgId as string;
    const invoiceId = result.metadata.invoiceId as string;

    try {
      const db = await getDB();
      const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);

      if (invoice && invoice.amountDue > 0) {
        const paymentMethod =
          gatewayName === "stripe"
            ? PaymentMethod.GATEWAY_STRIPE
            : gatewayName === "razorpay"
              ? PaymentMethod.GATEWAY_RAZORPAY
              : PaymentMethod.OTHER;

        await recordGatewayPayment(
          db,
          orgId,
          invoice,
          result.amount,
          paymentMethod,
          result.gatewayTransactionId
        );

        logger.info(`Webhook payment recorded for invoice ${invoice.invoiceNumber}`, {
          invoiceId,
          amount: result.amount,
        });
      }
    } catch (err) {
      logger.error("Failed to process webhook payment", { err, gatewayName, invoiceId });
    }
  } else if (result.status === "failed") {
    logger.warn(`Payment failed via ${gatewayName} webhook`, {
      event: result.event,
      gatewayTransactionId: result.gatewayTransactionId,
    });
  }

  return { acknowledged: true };
}

// ── Charge subscription renewal ─────────────────────────────────────────────

export async function chargeSubscriptionRenewal(
  orgId: string,
  invoiceId: string,
  clientId: string
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  const db = await getDB();

  // Look up the client's saved payment method
  const client = await db.findById<Client>("clients", clientId, orgId);
  if (!client) {
    return { success: false, error: "Client not found" };
  }

  if (!client.paymentGateway || !client.paymentMethodId) {
    return { success: false, error: "No saved payment method" };
  }

  // Look up the invoice to get amount and currency
  const invoice = await db.findById<Invoice>("invoices", invoiceId, orgId);
  if (!invoice) {
    return { success: false, error: "Invoice not found" };
  }

  if (invoice.amountDue <= 0) {
    return { success: false, error: "Invoice has no outstanding balance" };
  }

  // Get the gateway and charge
  let gateway;
  try {
    gateway = getGateway(client.paymentGateway);
  } catch {
    return { success: false, error: `Payment gateway "${client.paymentGateway}" is not configured` };
  }

  const chargeResult = await gateway.chargeCustomer({
    paymentMethodId: client.paymentMethodId,
    amount: invoice.amountDue,
    currency: invoice.currency,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    description: `Subscription renewal - ${invoice.invoiceNumber}`,
    metadata: {
      orgId,
      invoiceId: invoice.id,
      clientId: client.id,
    },
  });

  if (!chargeResult.success) {
    logger.warn("Subscription renewal charge failed", {
      invoiceId,
      clientId,
      gateway: client.paymentGateway,
      error: chargeResult.error,
    });
    return { success: false, error: chargeResult.error };
  }

  // Record the payment using existing pattern
  const paymentMethod =
    client.paymentGateway === "stripe"
      ? PaymentMethod.GATEWAY_STRIPE
      : client.paymentGateway === "razorpay"
        ? PaymentMethod.GATEWAY_RAZORPAY
        : PaymentMethod.OTHER;

  const payment = await recordGatewayPayment(
    db,
    orgId,
    invoice,
    chargeResult.amount,
    paymentMethod,
    chargeResult.gatewayTransactionId
  ) as { id: string };

  logger.info("Subscription renewal charge succeeded", {
    invoiceId,
    clientId,
    paymentId: payment.id,
    amount: chargeResult.amount,
    gateway: client.paymentGateway,
  });

  return { success: true, paymentId: payment.id };
}

// ── Internal helper: record gateway payment ─────────────────────────────────

async function recordGatewayPayment(
  db: Awaited<ReturnType<typeof getDB>>,
  orgId: string,
  invoice: Invoice,
  amount: number,
  method: PaymentMethod,
  gatewayTransactionId: string
) {
  // Prevent double-payment: if a payment with this gateway transaction ID already
  // exists (e.g. webhook arrived before verify, or vice-versa), return the existing record.
  if (gatewayTransactionId) {
    const [existingRows] = await db.raw<any>(
      `SELECT * FROM payments WHERE gateway_transaction_id = ? AND org_id = ? LIMIT 1`,
      [gatewayTransactionId, orgId],
    );
    if (existingRows && existingRows.length > 0) {
      logger.info(`Duplicate payment skipped for gateway txn ${gatewayTransactionId}`);
      return existingRows[0];
    }
  }

  const now = new Date();
  const paymentId = uuid();

  // Generate payment number
  const count = await db.count("payments", { org_id: orgId });
  const year = now.getFullYear();
  const paymentNumber = `PAY-${year}-${String(count + 1).padStart(4, "0")}`;

  // Create payment record
  const payment = await db.create("payments", {
    id: paymentId,
    orgId,
    clientId: invoice.clientId,
    paymentNumber,
    date: now,
    amount,
    method,
    reference: null,
    gatewayTransactionId,
    notes: `Online payment via ${method}`,
    isRefund: false,
    refundedAmount: 0,
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
  });

  // Create payment allocation
  await db.create("payment_allocations", {
    id: uuid(),
    paymentId,
    invoiceId: invoice.id,
    orgId,
    amount,
    createdAt: now,
    updatedAt: now,
  });

  // Update invoice
  const newAmountPaid = invoice.amountPaid + amount;
  const newAmountDue = Math.max(0, invoice.total - newAmountPaid);
  const newStatus =
    newAmountDue === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

  await db.update(
    "invoices",
    invoice.id,
    {
      amountPaid: newAmountPaid,
      amountDue: newAmountDue,
      status: newStatus,
      paidAt: newStatus === InvoiceStatus.PAID ? now : null,
      updatedAt: now,
    },
    orgId
  );

  // Update client balances
  await db.increment("clients", invoice.clientId, "total_paid", amount);
  await db.increment("clients", invoice.clientId, "outstanding_balance", -amount);
  await db.update("clients", invoice.clientId, { updatedAt: now }, orgId);

  // Emit payment.received event
  emit("payment.received", {
    orgId,
    paymentId,
    payment: payment as unknown as Record<string, unknown>,
    invoiceId: invoice.id,
  });

  // Emit invoice.paid if invoice is now fully paid
  if (newStatus === InvoiceStatus.PAID) {
    const paidInvoice = await db.findById<Invoice>("invoices", invoice.id, orgId);
    if (paidInvoice) {
      emit("invoice.paid", {
        orgId,
        invoiceId: invoice.id,
        invoice: paidInvoice as unknown as Record<string, unknown>,
      });
    }
  }

  return payment;
}
