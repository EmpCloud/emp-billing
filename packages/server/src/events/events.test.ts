import { describe, it, expect, vi, beforeEach } from "vitest";
import { emit, on, emitter } from "./index";
import type { InvoiceEventPayload, PaymentReceivedPayload } from "./index";

describe("events system", () => {
  beforeEach(() => {
    emitter.removeAllListeners();
  });

  describe("emit + on", () => {
    it("emits and receives invoice.created event", () => {
      const handler = vi.fn();
      on("invoice.created", handler);

      const payload: InvoiceEventPayload = {
        orgId: "org-1",
        invoiceId: "inv-1",
        invoice: { invoiceNumber: "INV-001" },
      };

      emit("invoice.created", payload);

      expect(handler).toHaveBeenCalledWith(payload);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("emits payment.received event", () => {
      const handler = vi.fn();
      on("payment.received", handler);

      const payload: PaymentReceivedPayload = {
        orgId: "org-1",
        paymentId: "pay-1",
        payment: { amount: 10000 },
        invoiceId: "inv-1",
      };

      emit("payment.received", payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("multiple handlers receive the same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      on("quote.accepted", handler1);
      on("quote.accepted", handler2);

      emit("quote.accepted", {
        orgId: "org-1",
        quoteId: "qt-1",
        quote: {},
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("does not cross-fire between different events", () => {
      const invoiceHandler = vi.fn();
      const paymentHandler = vi.fn();
      on("invoice.created", invoiceHandler);
      on("payment.received", paymentHandler);

      emit("invoice.created", {
        orgId: "org-1",
        invoiceId: "inv-1",
        invoice: {},
      });

      expect(invoiceHandler).toHaveBeenCalledTimes(1);
      expect(paymentHandler).not.toHaveBeenCalled();
    });

    it("handles subscription events", () => {
      const handler = vi.fn();
      on("subscription.created", handler);

      emit("subscription.created", {
        orgId: "org-1",
        subscriptionId: "sub-1",
        subscription: {},
      });

      expect(handler).toHaveBeenCalled();
    });

    it("handles coupon.redeemed event", () => {
      const handler = vi.fn();
      on("coupon.redeemed", handler);

      emit("coupon.redeemed", {
        orgId: "org-1",
        couponId: "cpn-1",
        clientId: "cli-1",
        invoiceId: "inv-1",
        discountAmount: 1000,
      });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        couponId: "cpn-1",
        discountAmount: 1000,
      }));
    });
  });
});
