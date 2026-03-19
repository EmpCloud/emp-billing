import { logger } from "../../utils/logger";
import { getDB } from "../../db/adapters/index";
import { AppError } from "../../utils/AppError";

// ============================================================================
// e-WAY BILL SERVICE (Indian GST)
// Hook / interface layer for e-Way Bill generation via the NIC e-Way Bill portal.
// Required for movement of goods exceeding INR 50,000 in value.
// ============================================================================

// ── Types ───────────────────────────────────────────────────────────────────

export interface EWayBillResult {
  ewayBillNo: string;
  ewayBillDate: string;
  validUpto: string;
}

export interface EWayBillCancelResult {
  success: boolean;
  cancelDate?: string;
}

export interface EWayBillUpdateResult {
  success: boolean;
  updatedDate?: string;
}

export interface TransportDetails {
  transporterId?: string;
  transporterName?: string;
  transportMode: TransportMode;
  transportDocNo?: string;
  transportDocDate?: string;
  vehicleNo?: string;
  vehicleType?: VehicleType;
  distance: number; // in km
}

export type TransportMode =
  | "1" // Road
  | "2" // Rail
  | "3" // Air
  | "4"; // Ship/waterways

export type VehicleType =
  | "R" // Regular
  | "O"; // Over Dimensional Cargo

export type EWayBillCancelReason =
  | "1" // Duplicate
  | "2" // Data entry mistake
  | "3" // Order cancelled
  | "4"; // Others

/** Org-level e-Way Bill configuration stored in settings */
export interface EWayBillConfig {
  enabled: boolean;
  /** e-Way Bill API base URL (NIC production or sandbox) */
  apiBaseUrl: string;
  /** GSP client ID */
  gspClientId: string;
  /** GSP client secret */
  gspClientSecret: string;
  /** Seller GSTIN */
  gstin: string;
  /** Username for e-Way Bill portal */
  username: string;
  /** Password for e-Way Bill portal (encrypted) */
  password: string;
  /** Auto-generate e-Way Bill on invoice creation for goods above threshold */
  autoGenerate: boolean;
  /** Threshold amount in paise (default: 5000000 = INR 50,000) */
  thresholdAmount: number;
}

/** e-Way Bill JSON payload (simplified NIC schema) */
export interface EWayBillPayload {
  supplyType: "O" | "I"; // Outward | Inward
  subSupplyType: string; // 1=Supply, 2=Import, 3=Export, etc.
  docType: "INV" | "BIL" | "BOE" | "CHL" | "OTH";
  docNo: string;
  docDate: string; // dd/mm/yyyy
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromPlace: string;
  fromPincode: number;
  fromStateCode: number;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toPlace: string;
  toPincode: number;
  toStateCode: number;
  totalValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  cessValue: number;
  totInvValue: number;
  transporterId: string;
  transporterName: string;
  transMode: string;
  transDocNo: string;
  transDocDate: string;
  vehicleNo: string;
  vehicleType: string;
  transDistance: number;
  itemList: Array<{
    productName: string;
    productDesc: string;
    hsnCode: string;
    quantity: number;
    qtyUnit: string;
    taxableAmount: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cessRate: number;
  }>;
}

// ── Provider Interface ──────────────────────────────────────────────────────

export interface IEWayBillProvider {
  authenticate(ewayConfig: EWayBillConfig): Promise<string>;
  generateEWayBill(authToken: string, payload: EWayBillPayload, ewayConfig: EWayBillConfig): Promise<EWayBillResult>;
  cancelEWayBill(authToken: string, ewayBillNo: string, reason: EWayBillCancelReason, remark: string, ewayConfig: EWayBillConfig): Promise<EWayBillCancelResult>;
  updateTransporter(authToken: string, ewayBillNo: string, transporterId: string, ewayConfig: EWayBillConfig): Promise<EWayBillUpdateResult>;
  getEWayBill(authToken: string, ewayBillNo: string, ewayConfig: EWayBillConfig): Promise<EWayBillResult | null>;
}

// ── NIC e-Way Bill Provider ─────────────────────────────────────────────────

export class NICEWayBillProvider implements IEWayBillProvider {
  async authenticate(cfg: EWayBillConfig): Promise<string> {
    const url = `${cfg.apiBaseUrl}/ewayapi/Authenticate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: cfg.gspClientId,
        client_secret: cfg.gspClientSecret,
        gstin: cfg.gstin,
      },
      body: JSON.stringify({
        action: "ACCESSTOKEN",
        username: cfg.username,
        password: cfg.password,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("e-Way Bill authentication failed", { status: response.status, body: errorBody });
      throw new AppError(502, "EWAY_AUTH_FAILED", "Failed to authenticate with e-Way Bill portal");
    }

    const result = (await response.json()) as { status: number; authtoken: string; sek: string };
    if (!result.authtoken) {
      throw new AppError(502, "EWAY_AUTH_FAILED", "e-Way Bill portal returned invalid auth response");
    }

    logger.info("e-Way Bill authentication successful");
    return result.authtoken;
  }

  async generateEWayBill(
    authToken: string,
    payload: EWayBillPayload,
    cfg: EWayBillConfig,
  ): Promise<EWayBillResult> {
    const url = `${cfg.apiBaseUrl}/ewayapi/Generate`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: cfg.gspClientId,
        client_secret: cfg.gspClientSecret,
        gstin: cfg.gstin,
        authtoken: authToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("e-Way Bill generation failed", { status: response.status, body: errorBody });
      throw new AppError(502, "EWAY_GENERATE_FAILED", "Failed to generate e-Way Bill");
    }

    const result = (await response.json()) as {
      status: number;
      data: {
        ewayBillNo: string;
        ewayBillDate: string;
        validUpto: string;
      };
      error?: { errorCodes: string; errorMessages: string };
    };

    if (result.status !== 1 || !result.data?.ewayBillNo) {
      const errorMsg = result.error ? `${result.error.errorCodes}: ${result.error.errorMessages}` : "Unknown error";
      throw new AppError(502, "EWAY_GENERATE_FAILED", `e-Way Bill generation failed: ${errorMsg}`);
    }

    logger.info("e-Way Bill generated", { ewayBillNo: result.data.ewayBillNo });

    return {
      ewayBillNo: result.data.ewayBillNo,
      ewayBillDate: result.data.ewayBillDate,
      validUpto: result.data.validUpto,
    };
  }

  async cancelEWayBill(
    authToken: string,
    ewayBillNo: string,
    reason: EWayBillCancelReason,
    remark: string,
    cfg: EWayBillConfig,
  ): Promise<EWayBillCancelResult> {
    const url = `${cfg.apiBaseUrl}/ewayapi/Cancel`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: cfg.gspClientId,
        client_secret: cfg.gspClientSecret,
        gstin: cfg.gstin,
        authtoken: authToken,
      },
      body: JSON.stringify({
        ewbNo: ewayBillNo,
        cancelRsnCode: reason,
        cancelRmrk: remark,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("e-Way Bill cancellation failed", { status: response.status, body: errorBody, ewayBillNo });
      throw new AppError(502, "EWAY_CANCEL_FAILED", "Failed to cancel e-Way Bill");
    }

    const result = (await response.json()) as {
      status: number;
      data: { cancelDate: string };
      error?: { errorCodes: string; errorMessages: string };
    };

    if (result.status !== 1) {
      const errorMsg = result.error ? `${result.error.errorCodes}: ${result.error.errorMessages}` : "Unknown error";
      throw new AppError(502, "EWAY_CANCEL_FAILED", `e-Way Bill cancellation failed: ${errorMsg}`);
    }

    logger.info("e-Way Bill cancelled", { ewayBillNo, cancelDate: result.data.cancelDate });

    return {
      success: true,
      cancelDate: result.data.cancelDate,
    };
  }

  async updateTransporter(
    authToken: string,
    ewayBillNo: string,
    transporterId: string,
    cfg: EWayBillConfig,
  ): Promise<EWayBillUpdateResult> {
    const url = `${cfg.apiBaseUrl}/ewayapi/UpdateTransporter`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: cfg.gspClientId,
        client_secret: cfg.gspClientSecret,
        gstin: cfg.gstin,
        authtoken: authToken,
      },
      body: JSON.stringify({
        ewbNo: ewayBillNo,
        transporterId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("e-Way Bill transporter update failed", { status: response.status, body: errorBody, ewayBillNo });
      throw new AppError(502, "EWAY_UPDATE_FAILED", "Failed to update transporter on e-Way Bill");
    }

    const result = (await response.json()) as {
      status: number;
      data: { updatedDate: string };
      error?: { errorCodes: string; errorMessages: string };
    };

    if (result.status !== 1) {
      const errorMsg = result.error ? `${result.error.errorCodes}: ${result.error.errorMessages}` : "Unknown error";
      throw new AppError(502, "EWAY_UPDATE_FAILED", `e-Way Bill transporter update failed: ${errorMsg}`);
    }

    logger.info("e-Way Bill transporter updated", { ewayBillNo, transporterId });

    return {
      success: true,
      updatedDate: result.data.updatedDate,
    };
  }

  async getEWayBill(authToken: string, ewayBillNo: string, cfg: EWayBillConfig): Promise<EWayBillResult | null> {
    const url = `${cfg.apiBaseUrl}/ewayapi/GetEwayBill?ewbNo=${ewayBillNo}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        client_id: cfg.gspClientId,
        client_secret: cfg.gspClientSecret,
        gstin: cfg.gstin,
        authtoken: authToken,
      },
    });

    if (!response.ok) {
      logger.warn("e-Way Bill fetch failed", { status: response.status, ewayBillNo });
      return null;
    }

    const result = (await response.json()) as {
      status: number;
      data: {
        ewayBillNo: string;
        ewayBillDate: string;
        validUpto: string;
      };
    };

    if (result.status !== 1 || !result.data) return null;

    return {
      ewayBillNo: result.data.ewayBillNo,
      ewayBillDate: result.data.ewayBillDate,
      validUpto: result.data.validUpto,
    };
  }
}

// ── Provider singleton ──────────────────────────────────────────────────────

let ewayBillProvider: IEWayBillProvider | null = null;

export function getEWayBillProvider(): IEWayBillProvider {
  if (!ewayBillProvider) {
    ewayBillProvider = new NICEWayBillProvider();
  }
  return ewayBillProvider;
}

export function setEWayBillProvider(provider: IEWayBillProvider): void {
  ewayBillProvider = provider;
}

// ── Org config loader ───────────────────────────────────────────────────────

export async function getEWayBillConfig(orgId: string): Promise<EWayBillConfig | null> {
  const db = await getDB();
  const settings = await db.findOne("settings", { org_id: orgId, key: "eway_bill" });
  if (!settings) return null;

  const raw = settings as Record<string, unknown>;
  const value = typeof raw.value === "string" ? JSON.parse(raw.value) as Record<string, unknown> : raw.value as Record<string, unknown>;

  return {
    enabled: value.enabled === true,
    apiBaseUrl: String(value.apiBaseUrl ?? "https://gsp.adaequare.com"),
    gspClientId: String(value.gspClientId ?? ""),
    gspClientSecret: String(value.gspClientSecret ?? ""),
    gstin: String(value.gstin ?? ""),
    username: String(value.username ?? ""),
    password: String(value.password ?? ""),
    autoGenerate: value.autoGenerate === true,
    thresholdAmount: Number(value.thresholdAmount ?? 5000000), // INR 50,000 in paise
  };
}

// ── Hook functions ──────────────────────────────────────────────────────────

/**
 * Hook: Generate e-Way Bill when an invoice is created for goods shipment.
 * Only triggers when:
 *  - e-Way Bill is enabled for the org
 *  - Invoice total exceeds threshold (default INR 50,000)
 *  - Transport details are provided
 */
export async function onInvoiceCreated(
  orgId: string,
  invoiceId: string,
  transportDetails?: TransportDetails,
): Promise<EWayBillResult | null> {
  const ewayConfig = await getEWayBillConfig(orgId);
  if (!ewayConfig || !ewayConfig.enabled || !ewayConfig.autoGenerate) {
    logger.debug("e-Way Bill not enabled or auto-generate off, skipping", { orgId, invoiceId });
    return null;
  }

  const db = await getDB();
  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("eWayBill.onInvoiceCreated: invoice not found", { orgId, invoiceId });
    return null;
  }

  const inv = invoice as Record<string, unknown>;
  const totalAmount = Number(inv.total ?? inv.total_amount ?? 0);

  // Check threshold
  if (totalAmount < ewayConfig.thresholdAmount) {
    logger.debug("e-Way Bill: invoice amount below threshold, skipping", {
      orgId,
      invoiceId,
      totalAmount,
      threshold: ewayConfig.thresholdAmount,
    });
    return null;
  }

  if (!transportDetails) {
    logger.debug("e-Way Bill: no transport details provided, skipping auto-generation", { orgId, invoiceId });
    return null;
  }

  try {
    const payload = await buildEWayBillPayload(orgId, invoice, transportDetails);
    const provider = getEWayBillProvider();
    const authToken = await provider.authenticate(ewayConfig);
    const result = await provider.generateEWayBill(authToken, payload, ewayConfig);

    // Store e-Way Bill data on the invoice
    await db.update("invoices", invoiceId, {
      eway_bill_no: result.ewayBillNo,
      eway_bill_date: result.ewayBillDate,
      eway_bill_valid_upto: result.validUpto,
      updated_at: new Date(),
    }, orgId);

    logger.info("e-Way Bill stored on invoice", { orgId, invoiceId, ewayBillNo: result.ewayBillNo });
    return result;
  } catch (err) {
    logger.error("e-Way Bill generation failed for invoice", { orgId, invoiceId, err });
    throw err;
  }
}

/**
 * Hook: Cancel e-Way Bill when an invoice is voided.
 */
export async function onInvoiceCancelled(
  orgId: string,
  invoiceId: string,
  reason: EWayBillCancelReason = "3",
  remark = "Invoice cancelled",
): Promise<EWayBillCancelResult | null> {
  const ewayConfig = await getEWayBillConfig(orgId);
  if (!ewayConfig || !ewayConfig.enabled) return null;

  const db = await getDB();
  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    logger.warn("eWayBill.onInvoiceCancelled: invoice not found", { orgId, invoiceId });
    return null;
  }

  const inv = invoice as Record<string, unknown>;
  const ewayBillNo = inv.eway_bill_no as string | undefined;
  if (!ewayBillNo) {
    logger.debug("eWayBill.onInvoiceCancelled: no e-Way Bill on invoice", { orgId, invoiceId });
    return null;
  }

  try {
    const provider = getEWayBillProvider();
    const authToken = await provider.authenticate(ewayConfig);
    const result = await provider.cancelEWayBill(authToken, ewayBillNo, reason, remark, ewayConfig);

    await db.update("invoices", invoiceId, {
      eway_bill_cancelled: true,
      eway_bill_cancel_date: result.cancelDate ?? new Date().toISOString(),
      updated_at: new Date(),
    }, orgId);

    logger.info("e-Way Bill cancelled for invoice", { orgId, invoiceId, ewayBillNo });
    return result;
  } catch (err) {
    logger.error("e-Way Bill cancellation failed", { orgId, invoiceId, ewayBillNo, err });
    throw err;
  }
}

// ── Public API functions ────────────────────────────────────────────────────

/**
 * Manually generate e-Way Bill for an invoice.
 */
export async function generateEWayBill(
  orgId: string,
  invoiceId: string,
  transportDetails: TransportDetails,
): Promise<EWayBillResult> {
  const ewayConfig = await getEWayBillConfig(orgId);
  if (!ewayConfig || !ewayConfig.enabled) {
    throw new AppError(400, "EWAY_NOT_ENABLED", "e-Way Bill is not enabled for this organization");
  }

  const db = await getDB();
  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    throw new AppError(404, "NOT_FOUND", "Invoice not found");
  }

  const inv = invoice as Record<string, unknown>;
  if (inv.eway_bill_no) {
    throw new AppError(409, "CONFLICT", "Invoice already has an e-Way Bill generated");
  }

  const payload = await buildEWayBillPayload(orgId, invoice, transportDetails);
  const provider = getEWayBillProvider();
  const authToken = await provider.authenticate(ewayConfig);
  const result = await provider.generateEWayBill(authToken, payload, ewayConfig);

  await db.update("invoices", invoiceId, {
    eway_bill_no: result.ewayBillNo,
    eway_bill_date: result.ewayBillDate,
    eway_bill_valid_upto: result.validUpto,
    updated_at: new Date(),
  }, orgId);

  return result;
}

/**
 * Cancel an existing e-Way Bill.
 */
export async function cancelEWayBill(
  orgId: string,
  invoiceId: string,
  reason: EWayBillCancelReason,
  remark: string,
): Promise<EWayBillCancelResult> {
  const result = await onInvoiceCancelled(orgId, invoiceId, reason, remark);
  if (!result) {
    throw new AppError(400, "EWAY_CANCEL_FAILED", "Could not cancel e-Way Bill — not enabled or invoice has no e-Way Bill");
  }
  return result;
}

/**
 * Update transporter on an existing e-Way Bill.
 */
export async function updateTransporter(
  orgId: string,
  invoiceId: string,
  transporterId: string,
): Promise<EWayBillUpdateResult> {
  const ewayConfig = await getEWayBillConfig(orgId);
  if (!ewayConfig || !ewayConfig.enabled) {
    throw new AppError(400, "EWAY_NOT_ENABLED", "e-Way Bill is not enabled for this organization");
  }

  const db = await getDB();
  const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
  if (!invoice) {
    throw new AppError(404, "NOT_FOUND", "Invoice not found");
  }

  const inv = invoice as Record<string, unknown>;
  const ewayBillNo = inv.eway_bill_no as string | undefined;
  if (!ewayBillNo) {
    throw new AppError(400, "BAD_REQUEST", "Invoice does not have an e-Way Bill");
  }

  const provider = getEWayBillProvider();
  const authToken = await provider.authenticate(ewayConfig);
  const result = await provider.updateTransporter(authToken, ewayBillNo, transporterId, ewayConfig);

  logger.info("e-Way Bill transporter updated", { orgId, invoiceId, ewayBillNo, transporterId });
  return result;
}

// ── Payload builder ─────────────────────────────────────────────────────────

async function buildEWayBillPayload(
  orgId: string,
  invoice: unknown,
  transportDetails: TransportDetails,
): Promise<EWayBillPayload> {
  const db = await getDB();
  const inv = invoice as Record<string, unknown>;

  const org = await db.findOne("organizations", { id: orgId });
  if (!org) throw new AppError(404, "NOT_FOUND", "Organization not found");
  const orgData = org as Record<string, unknown>;

  const clientId = inv.clientId ?? inv.client_id;
  const client = clientId ? await db.findOne("clients", { id: clientId as string, org_id: orgId }) : null;
  if (!client) throw new AppError(400, "BAD_REQUEST", "Client not found for e-Way Bill generation");
  const clientData = client as Record<string, unknown>;

  const items = await db.findMany<Record<string, unknown>>("invoice_items", {
    where: { invoice_id: inv.id as string },
  });

  const invoiceDate = new Date(String(inv.invoiceDate ?? inv.invoice_date ?? inv.created_at));
  const formattedDate = `${String(invoiceDate.getDate()).padStart(2, "0")}/${String(invoiceDate.getMonth() + 1).padStart(2, "0")}/${invoiceDate.getFullYear()}`;

  const sellerStateCode = Number(orgData.state_code ?? orgData.stateCode ?? 0);
  const buyerStateCode = Number(clientData.state_code ?? clientData.stateCode ?? 0);
  const isInterState = sellerStateCode !== buyerStateCode;

  const itemList = items.map((item) => {
    const qty = Number(item.quantity ?? 1);
    const unitPrice = Number(item.rate ?? item.unit_price ?? 0) / 100;
    const taxableAmount = qty * unitPrice;
    const gstRate = Number(item.tax_rate ?? item.gst_rate ?? 18);

    return {
      productName: String(item.name ?? item.description ?? ""),
      productDesc: String(item.description ?? ""),
      hsnCode: String(item.hsn_code ?? item.sac_code ?? ""),
      quantity: qty,
      qtyUnit: String(item.unit ?? "NOS"),
      taxableAmount,
      cgstRate: isInterState ? 0 : gstRate / 2,
      sgstRate: isInterState ? 0 : gstRate / 2,
      igstRate: isInterState ? gstRate : 0,
      cessRate: Number(item.cess_rate ?? 0),
    };
  });

  const totalValue = itemList.reduce((sum, i) => sum + i.taxableAmount, 0);
  const cgstValue = itemList.reduce((sum, i) => sum + i.taxableAmount * (i.cgstRate / 100), 0);
  const sgstValue = itemList.reduce((sum, i) => sum + i.taxableAmount * (i.sgstRate / 100), 0);
  const igstValue = itemList.reduce((sum, i) => sum + i.taxableAmount * (i.igstRate / 100), 0);
  const cessValue = itemList.reduce((sum, i) => sum + i.taxableAmount * (i.cessRate / 100), 0);

  return {
    supplyType: "O",
    subSupplyType: "1", // Supply
    docType: "INV",
    docNo: String(inv.invoiceNumber ?? inv.invoice_number ?? ""),
    docDate: formattedDate,
    fromGstin: String(orgData.gstin ?? ""),
    fromTrdName: String(orgData.legal_name ?? orgData.name ?? ""),
    fromAddr1: String(orgData.address ?? orgData.address1 ?? ""),
    fromPlace: String(orgData.city ?? ""),
    fromPincode: Number(orgData.pincode ?? orgData.zip ?? 0),
    fromStateCode: sellerStateCode,
    toGstin: String(clientData.gstin ?? ""),
    toTrdName: String(clientData.legal_name ?? clientData.company_name ?? clientData.name ?? ""),
    toAddr1: String(clientData.billing_address ?? clientData.address ?? ""),
    toPlace: String(clientData.city ?? ""),
    toPincode: Number(clientData.pincode ?? clientData.zip ?? 0),
    toStateCode: buyerStateCode,
    totalValue,
    cgstValue,
    sgstValue,
    igstValue,
    cessValue,
    totInvValue: totalValue + cgstValue + sgstValue + igstValue + cessValue,
    transporterId: transportDetails.transporterId ?? "",
    transporterName: transportDetails.transporterName ?? "",
    transMode: transportDetails.transportMode,
    transDocNo: transportDetails.transportDocNo ?? "",
    transDocDate: transportDetails.transportDocDate ?? "",
    vehicleNo: transportDetails.vehicleNo ?? "",
    vehicleType: transportDetails.vehicleType ?? "R",
    transDistance: transportDetails.distance,
    itemList,
  };
}
