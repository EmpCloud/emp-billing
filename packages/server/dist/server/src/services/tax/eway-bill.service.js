"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NICEWayBillProvider = void 0;
exports.getEWayBillProvider = getEWayBillProvider;
exports.setEWayBillProvider = setEWayBillProvider;
exports.getEWayBillConfig = getEWayBillConfig;
exports.onInvoiceCreated = onInvoiceCreated;
exports.onInvoiceCancelled = onInvoiceCancelled;
exports.generateEWayBill = generateEWayBill;
exports.cancelEWayBill = cancelEWayBill;
exports.updateTransporter = updateTransporter;
const logger_1 = require("../../utils/logger");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
// ── NIC e-Way Bill Provider ─────────────────────────────────────────────────
class NICEWayBillProvider {
    async authenticate(cfg) {
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
            logger_1.logger.error("e-Way Bill authentication failed", { status: response.status, body: errorBody });
            throw new AppError_1.AppError(502, "EWAY_AUTH_FAILED", "Failed to authenticate with e-Way Bill portal");
        }
        const result = (await response.json());
        if (!result.authtoken) {
            throw new AppError_1.AppError(502, "EWAY_AUTH_FAILED", "e-Way Bill portal returned invalid auth response");
        }
        logger_1.logger.info("e-Way Bill authentication successful");
        return result.authtoken;
    }
    async generateEWayBill(authToken, payload, cfg) {
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
            logger_1.logger.error("e-Way Bill generation failed", { status: response.status, body: errorBody });
            throw new AppError_1.AppError(502, "EWAY_GENERATE_FAILED", "Failed to generate e-Way Bill");
        }
        const result = (await response.json());
        if (result.status !== 1 || !result.data?.ewayBillNo) {
            const errorMsg = result.error ? `${result.error.errorCodes}: ${result.error.errorMessages}` : "Unknown error";
            throw new AppError_1.AppError(502, "EWAY_GENERATE_FAILED", `e-Way Bill generation failed: ${errorMsg}`);
        }
        logger_1.logger.info("e-Way Bill generated", { ewayBillNo: result.data.ewayBillNo });
        return {
            ewayBillNo: result.data.ewayBillNo,
            ewayBillDate: result.data.ewayBillDate,
            validUpto: result.data.validUpto,
        };
    }
    async cancelEWayBill(authToken, ewayBillNo, reason, remark, cfg) {
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
            logger_1.logger.error("e-Way Bill cancellation failed", { status: response.status, body: errorBody, ewayBillNo });
            throw new AppError_1.AppError(502, "EWAY_CANCEL_FAILED", "Failed to cancel e-Way Bill");
        }
        const result = (await response.json());
        if (result.status !== 1) {
            const errorMsg = result.error ? `${result.error.errorCodes}: ${result.error.errorMessages}` : "Unknown error";
            throw new AppError_1.AppError(502, "EWAY_CANCEL_FAILED", `e-Way Bill cancellation failed: ${errorMsg}`);
        }
        logger_1.logger.info("e-Way Bill cancelled", { ewayBillNo, cancelDate: result.data.cancelDate });
        return {
            success: true,
            cancelDate: result.data.cancelDate,
        };
    }
    async updateTransporter(authToken, ewayBillNo, transporterId, cfg) {
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
            logger_1.logger.error("e-Way Bill transporter update failed", { status: response.status, body: errorBody, ewayBillNo });
            throw new AppError_1.AppError(502, "EWAY_UPDATE_FAILED", "Failed to update transporter on e-Way Bill");
        }
        const result = (await response.json());
        if (result.status !== 1) {
            const errorMsg = result.error ? `${result.error.errorCodes}: ${result.error.errorMessages}` : "Unknown error";
            throw new AppError_1.AppError(502, "EWAY_UPDATE_FAILED", `e-Way Bill transporter update failed: ${errorMsg}`);
        }
        logger_1.logger.info("e-Way Bill transporter updated", { ewayBillNo, transporterId });
        return {
            success: true,
            updatedDate: result.data.updatedDate,
        };
    }
    async getEWayBill(authToken, ewayBillNo, cfg) {
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
            logger_1.logger.warn("e-Way Bill fetch failed", { status: response.status, ewayBillNo });
            return null;
        }
        const result = (await response.json());
        if (result.status !== 1 || !result.data)
            return null;
        return {
            ewayBillNo: result.data.ewayBillNo,
            ewayBillDate: result.data.ewayBillDate,
            validUpto: result.data.validUpto,
        };
    }
}
exports.NICEWayBillProvider = NICEWayBillProvider;
// ── Provider singleton ──────────────────────────────────────────────────────
let ewayBillProvider = null;
function getEWayBillProvider() {
    if (!ewayBillProvider) {
        ewayBillProvider = new NICEWayBillProvider();
    }
    return ewayBillProvider;
}
function setEWayBillProvider(provider) {
    ewayBillProvider = provider;
}
// ── Org config loader ───────────────────────────────────────────────────────
async function getEWayBillConfig(orgId) {
    const db = await (0, index_1.getDB)();
    const settings = await db.findOne("settings", { org_id: orgId, key: "eway_bill" });
    if (!settings)
        return null;
    const raw = settings;
    const value = typeof raw.value === "string" ? JSON.parse(raw.value) : raw.value;
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
async function onInvoiceCreated(orgId, invoiceId, transportDetails) {
    const ewayConfig = await getEWayBillConfig(orgId);
    if (!ewayConfig || !ewayConfig.enabled || !ewayConfig.autoGenerate) {
        logger_1.logger.debug("e-Way Bill not enabled or auto-generate off, skipping", { orgId, invoiceId });
        return null;
    }
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("eWayBill.onInvoiceCreated: invoice not found", { orgId, invoiceId });
        return null;
    }
    const inv = invoice;
    const totalAmount = Number(inv.total ?? inv.total_amount ?? 0);
    // Check threshold
    if (totalAmount < ewayConfig.thresholdAmount) {
        logger_1.logger.debug("e-Way Bill: invoice amount below threshold, skipping", {
            orgId,
            invoiceId,
            totalAmount,
            threshold: ewayConfig.thresholdAmount,
        });
        return null;
    }
    if (!transportDetails) {
        logger_1.logger.debug("e-Way Bill: no transport details provided, skipping auto-generation", { orgId, invoiceId });
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
        logger_1.logger.info("e-Way Bill stored on invoice", { orgId, invoiceId, ewayBillNo: result.ewayBillNo });
        return result;
    }
    catch (err) {
        logger_1.logger.error("e-Way Bill generation failed for invoice", { orgId, invoiceId, err });
        throw err;
    }
}
/**
 * Hook: Cancel e-Way Bill when an invoice is voided.
 */
async function onInvoiceCancelled(orgId, invoiceId, reason = "3", remark = "Invoice cancelled") {
    const ewayConfig = await getEWayBillConfig(orgId);
    if (!ewayConfig || !ewayConfig.enabled)
        return null;
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("eWayBill.onInvoiceCancelled: invoice not found", { orgId, invoiceId });
        return null;
    }
    const inv = invoice;
    const ewayBillNo = inv.eway_bill_no;
    if (!ewayBillNo) {
        logger_1.logger.debug("eWayBill.onInvoiceCancelled: no e-Way Bill on invoice", { orgId, invoiceId });
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
        logger_1.logger.info("e-Way Bill cancelled for invoice", { orgId, invoiceId, ewayBillNo });
        return result;
    }
    catch (err) {
        logger_1.logger.error("e-Way Bill cancellation failed", { orgId, invoiceId, ewayBillNo, err });
        throw err;
    }
}
// ── Public API functions ────────────────────────────────────────────────────
/**
 * Manually generate e-Way Bill for an invoice.
 */
async function generateEWayBill(orgId, invoiceId, transportDetails) {
    const ewayConfig = await getEWayBillConfig(orgId);
    if (!ewayConfig || !ewayConfig.enabled) {
        throw new AppError_1.AppError(400, "EWAY_NOT_ENABLED", "e-Way Bill is not enabled for this organization");
    }
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        throw new AppError_1.AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const inv = invoice;
    if (inv.eway_bill_no) {
        throw new AppError_1.AppError(409, "CONFLICT", "Invoice already has an e-Way Bill generated");
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
async function cancelEWayBill(orgId, invoiceId, reason, remark) {
    const result = await onInvoiceCancelled(orgId, invoiceId, reason, remark);
    if (!result) {
        throw new AppError_1.AppError(400, "EWAY_CANCEL_FAILED", "Could not cancel e-Way Bill — not enabled or invoice has no e-Way Bill");
    }
    return result;
}
/**
 * Update transporter on an existing e-Way Bill.
 */
async function updateTransporter(orgId, invoiceId, transporterId) {
    const ewayConfig = await getEWayBillConfig(orgId);
    if (!ewayConfig || !ewayConfig.enabled) {
        throw new AppError_1.AppError(400, "EWAY_NOT_ENABLED", "e-Way Bill is not enabled for this organization");
    }
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        throw new AppError_1.AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const inv = invoice;
    const ewayBillNo = inv.eway_bill_no;
    if (!ewayBillNo) {
        throw new AppError_1.AppError(400, "BAD_REQUEST", "Invoice does not have an e-Way Bill");
    }
    const provider = getEWayBillProvider();
    const authToken = await provider.authenticate(ewayConfig);
    const result = await provider.updateTransporter(authToken, ewayBillNo, transporterId, ewayConfig);
    logger_1.logger.info("e-Way Bill transporter updated", { orgId, invoiceId, ewayBillNo, transporterId });
    return result;
}
// ── Payload builder ─────────────────────────────────────────────────────────
async function buildEWayBillPayload(orgId, invoice, transportDetails) {
    const db = await (0, index_1.getDB)();
    const inv = invoice;
    const org = await db.findOne("organizations", { id: orgId });
    if (!org)
        throw new AppError_1.AppError(404, "NOT_FOUND", "Organization not found");
    const orgData = org;
    const clientId = inv.clientId ?? inv.client_id;
    const client = clientId ? await db.findOne("clients", { id: clientId, org_id: orgId }) : null;
    if (!client)
        throw new AppError_1.AppError(400, "BAD_REQUEST", "Client not found for e-Way Bill generation");
    const clientData = client;
    const items = await db.findMany("invoice_items", {
        where: { invoice_id: inv.id },
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
//# sourceMappingURL=eway-bill.service.js.map