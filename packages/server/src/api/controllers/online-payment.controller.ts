import type { Request, Response } from "express";
import * as onlinePaymentService from "../../services/payment/online-payment.service";

export async function listGateways(_req: Request, res: Response): Promise<void> {
  const gateways = onlinePaymentService.listAvailableGateways();
  res.json({ success: true, data: gateways });
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const { invoiceId, gateway } = req.body;
  // orgId comes from portal auth or regular user auth
  const orgId = req.portalClient?.orgId || req.user?.orgId;
  const result = await onlinePaymentService.createPaymentOrder(
    orgId!,
    invoiceId,
    gateway
  );
  res.json({ success: true, data: result });
}

export async function verifyPayment(req: Request, res: Response): Promise<void> {
  const orgId = req.portalClient?.orgId || req.user?.orgId;
  const {
    invoiceId,
    gateway,
    gatewayOrderId,
    gatewayPaymentId,
    gatewaySignature,
  } = req.body;
  const result = await onlinePaymentService.verifyPayment(orgId!, invoiceId, gateway, {
    gatewayOrderId,
    gatewayPaymentId,
    gatewaySignature,
  });
  res.json({ success: true, data: result });
}
