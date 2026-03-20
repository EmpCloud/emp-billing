"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NICEInvoiceProvider = void 0;
exports.getEInvoiceProvider = getEInvoiceProvider;
exports.setEInvoiceProvider = setEInvoiceProvider;
exports.getEInvoiceConfig = getEInvoiceConfig;
exports.onInvoiceCreated = onInvoiceCreated;
exports.onInvoiceCancelled = onInvoiceCancelled;
exports.generateIRN = generateIRN;
exports.cancelIRN = cancelIRN;
const logger_1 = require("../../utils/logger");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
// ── NIC IRP Provider (production hook) ──────────────────────────────────────
class NICEInvoiceProvider {
    async authenticate(cfg) {
        const url = `${cfg.apiBaseUrl}/eivital/v1.04/auth`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                client_id: cfg.gspClientId,
                client_secret: cfg.gspClientSecret,
                gstin: cfg.gstin,
            },
            body: JSON.stringify({
                UserName: cfg.username,
                Password: cfg.password,
                ForceRefreshAccessToken: false,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            logger_1.logger.error("e-Invoice authentication failed", { status: response.status, body: errorBody });
            throw new AppError_1.AppError(502, "EINVOICE_AUTH_FAILED", "Failed to authenticate with e-Invoice portal");
        }
        const result = (await response.json());
        if (result.Status !== 1 || !result.Data?.AuthToken) {
            throw new AppError_1.AppError(502, "EINVOICE_AUTH_FAILED", "e-Invoice portal returned invalid auth response");
        }
        logger_1.logger.info("e-Invoice authentication successful", { expiry: result.Data.TokenExpiry });
        return result.Data.AuthToken;
    }
    async generateIRN(authToken, payload, cfg) {
        const url = `${cfg.apiBaseUrl}/eicore/v1.03/Invoice`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                client_id: cfg.gspClientId,
                client_secret: cfg.gspClientSecret,
                gstin: cfg.gstin,
                AuthToken: authToken,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            logger_1.logger.error("e-Invoice IRN generation failed", { status: response.status, body: errorBody });
            throw new AppError_1.AppError(502, "EINVOICE_GENERATE_FAILED", "Failed to generate IRN from e-Invoice portal");
        }
        const result = (await response.json());
        if (result.Status !== 1 || !result.Data?.Irn) {
            const errors = result.ErrorDetails?.map((e) => `${e.ErrorCode}: ${e.ErrorMessage}`).join("; ") ?? "Unknown error";
            throw new AppError_1.AppError(502, "EINVOICE_GENERATE_FAILED", `e-Invoice generation failed: ${errors}`);
        }
        logger_1.logger.info("e-Invoice IRN generated", { irn: result.Data.Irn, ackNo: result.Data.AckNo });
        return {
            irn: result.Data.Irn,
            signedInvoice: result.Data.SignedInvoice,
            qrCode: result.Data.SignedQRCode,
            ackNumber: result.Data.AckNo,
            ackDate: result.Data.AckDt,
        };
    }
    async cancelIRN(authToken, irn, reason, remark, cfg) {
        const url = `${cfg.apiBaseUrl}/eicore/v1.03/Invoice/Cancel`;
        const response = await fetch(url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                client_id: cfg.gspClientId,
                client_secret: cfg.gspClientSecret,
                gstin: cfg.gstin,
                AuthToken: authToken,
            },
            body: JSON.stringify({
                Irn: irn,
                CnlRsn: reason,
                CnlRem: remark,
            }),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            logger_1.logger.error("e-Invoice IRN cancellation failed", { status: response.status, body: errorBody, irn });
            throw new AppError_1.AppError(502, "EINVOICE_CANCEL_FAILED", "Failed to cancel IRN on e-Invoice portal");
        }
        const result = (await response.json());
        if (result.Status !== 1) {
            const errors = result.ErrorDetails?.map((e) => `${e.ErrorCode}: ${e.ErrorMessage}`).join("; ") ?? "Unknown error";
            throw new AppError_1.AppError(502, "EINVOICE_CANCEL_FAILED", `e-Invoice cancellation failed: ${errors}`);
        }
        logger_1.logger.info("e-Invoice IRN cancelled", { irn, cancelDate: result.Data.CancelDate });
        return {
            success: true,
            cancelDate: result.Data.CancelDate,
        };
    }
    async getIRNDetails(authToken, irn, cfg) {
        const url = `${cfg.apiBaseUrl}/eicore/v1.03/Invoice/irn/${irn}`;
        const response = await fetch(url, {
            method: "GET",
            headers: {
                client_id: cfg.gspClientId,
                client_secret: cfg.gspClientSecret,
                gstin: cfg.gstin,
                AuthToken: authToken,
            },
        });
        if (!response.ok) {
            logger_1.logger.warn("e-Invoice IRN details fetch failed", { status: response.status, irn });
            return null;
        }
        const result = (await response.json());
        if (result.Status !== 1 || !result.Data)
            return null;
        return {
            irn: result.Data.Irn,
            signedInvoice: result.Data.SignedInvoice,
            qrCode: result.Data.SignedQRCode,
            ackNumber: result.Data.AckNo,
            ackDate: result.Data.AckDt,
        };
    }
}
exports.NICEInvoiceProvider = NICEInvoiceProvider;
// ── Provider singleton ──────────────────────────────────────────────────────
let einvoiceProvider = null;
function getEInvoiceProvider() {
    if (!einvoiceProvider) {
        einvoiceProvider = new NICEInvoiceProvider();
    }
    return einvoiceProvider;
}
function setEInvoiceProvider(provider) {
    einvoiceProvider = provider;
}
// ── Org config loader ───────────────────────────────────────────────────────
async function getEInvoiceConfig(orgId) {
    const db = await (0, index_1.getDB)();
    const settings = await db.findOne("settings", { org_id: orgId, key: "einvoice" });
    if (!settings)
        return null;
    const raw = settings;
    const value = typeof raw.value === "string" ? JSON.parse(raw.value) : raw.value;
    return {
        enabled: value.enabled === true,
        apiBaseUrl: String(value.apiBaseUrl ?? "https://einv-apisandbox.nic.in"),
        gspClientId: String(value.gspClientId ?? ""),
        gspClientSecret: String(value.gspClientSecret ?? ""),
        gstin: String(value.gstin ?? ""),
        username: String(value.username ?? ""),
        password: String(value.password ?? ""),
        autoGenerate: value.autoGenerate === true,
        turnoverThreshold: Number(value.turnoverThreshold ?? 0),
    };
}
// ── Hook functions (called from invoice lifecycle) ──────────────────────────
/**
 * Hook: Generate IRN when an invoice is created or finalized.
 * Called from invoice service events. Stores IRN data on the invoice record.
 */
async function onInvoiceCreated(orgId, invoiceId) {
    const einvoiceConfig = await getEInvoiceConfig(orgId);
    if (!einvoiceConfig || !einvoiceConfig.enabled || !einvoiceConfig.autoGenerate) {
        logger_1.logger.debug("e-Invoice not enabled or auto-generate off, skipping", { orgId, invoiceId });
        return null;
    }
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("onInvoiceCreated: invoice not found", { orgId, invoiceId });
        return null;
    }
    try {
        const payload = await buildEInvoicePayload(orgId, invoice);
        const provider = getEInvoiceProvider();
        const authToken = await provider.authenticate(einvoiceConfig);
        const result = await provider.generateIRN(authToken, payload, einvoiceConfig);
        // Store IRN data on the invoice
        await db.update("invoices", invoiceId, {
            einvoice_irn: result.irn,
            einvoice_ack_number: result.ackNumber,
            einvoice_ack_date: result.ackDate,
            einvoice_qr_code: result.qrCode,
            einvoice_signed: result.signedInvoice,
            updated_at: new Date(),
        }, orgId);
        logger_1.logger.info("e-Invoice IRN stored on invoice", { orgId, invoiceId, irn: result.irn });
        return result;
    }
    catch (err) {
        logger_1.logger.error("e-Invoice generation failed for invoice", { orgId, invoiceId, err });
        throw err;
    }
}
/**
 * Hook: Cancel IRN when an invoice is voided or cancelled.
 */
async function onInvoiceCancelled(orgId, invoiceId, reason = "3", remark = "Invoice cancelled") {
    const einvoiceConfig = await getEInvoiceConfig(orgId);
    if (!einvoiceConfig || !einvoiceConfig.enabled) {
        return null;
    }
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        logger_1.logger.warn("onInvoiceCancelled: invoice not found", { orgId, invoiceId });
        return null;
    }
    const inv = invoice;
    const irn = inv.einvoice_irn;
    if (!irn) {
        logger_1.logger.debug("onInvoiceCancelled: no IRN on invoice, nothing to cancel", { orgId, invoiceId });
        return null;
    }
    try {
        const provider = getEInvoiceProvider();
        const authToken = await provider.authenticate(einvoiceConfig);
        const result = await provider.cancelIRN(authToken, irn, reason, remark, einvoiceConfig);
        // Update invoice record
        await db.update("invoices", invoiceId, {
            einvoice_cancelled: true,
            einvoice_cancel_date: result.cancelDate ?? new Date().toISOString(),
            updated_at: new Date(),
        }, orgId);
        logger_1.logger.info("e-Invoice IRN cancelled for invoice", { orgId, invoiceId, irn });
        return result;
    }
    catch (err) {
        logger_1.logger.error("e-Invoice cancellation failed for invoice", { orgId, invoiceId, irn, err });
        throw err;
    }
}
/**
 * Manually generate IRN for an existing invoice (non-auto-generate orgs).
 */
async function generateIRN(orgId, invoiceId) {
    const einvoiceConfig = await getEInvoiceConfig(orgId);
    if (!einvoiceConfig || !einvoiceConfig.enabled) {
        throw new AppError_1.AppError(400, "EINVOICE_NOT_ENABLED", "e-Invoice is not enabled for this organization");
    }
    const db = await (0, index_1.getDB)();
    const invoice = await db.findOne("invoices", { id: invoiceId, org_id: orgId });
    if (!invoice) {
        throw new AppError_1.AppError(404, "NOT_FOUND", "Invoice not found");
    }
    const inv = invoice;
    if (inv.einvoice_irn) {
        throw new AppError_1.AppError(409, "CONFLICT", "Invoice already has an IRN generated");
    }
    const payload = await buildEInvoicePayload(orgId, invoice);
    const provider = getEInvoiceProvider();
    const authToken = await provider.authenticate(einvoiceConfig);
    const result = await provider.generateIRN(authToken, payload, einvoiceConfig);
    await db.update("invoices", invoiceId, {
        einvoice_irn: result.irn,
        einvoice_ack_number: result.ackNumber,
        einvoice_ack_date: result.ackDate,
        einvoice_qr_code: result.qrCode,
        einvoice_signed: result.signedInvoice,
        updated_at: new Date(),
    }, orgId);
    return result;
}
/**
 * Manually cancel IRN for an invoice.
 */
async function cancelIRN(orgId, invoiceId, reason, remark) {
    const result = await onInvoiceCancelled(orgId, invoiceId, reason, remark);
    if (!result) {
        throw new AppError_1.AppError(400, "EINVOICE_CANCEL_FAILED", "Could not cancel IRN — e-Invoice may not be enabled or invoice has no IRN");
    }
    return result;
}
// ── Payload builder ─────────────────────────────────────────────────────────
async function buildEInvoicePayload(orgId, invoice) {
    const db = await (0, index_1.getDB)();
    const inv = invoice;
    // Load organization (seller details)
    const org = await db.findOne("organizations", { id: orgId });
    if (!org)
        throw new AppError_1.AppError(404, "NOT_FOUND", "Organization not found");
    const orgData = org;
    // Load client (buyer details)
    const clientId = inv.clientId ?? inv.client_id;
    const client = clientId ? await db.findOne("clients", { id: clientId, org_id: orgId }) : null;
    if (!client)
        throw new AppError_1.AppError(400, "BAD_REQUEST", "Client not found for e-Invoice generation");
    const clientData = client;
    // Load line items
    const items = await db.findMany("invoice_items", {
        where: { invoice_id: inv.id },
    });
    const invoiceDate = new Date(String(inv.invoiceDate ?? inv.invoice_date ?? inv.created_at));
    const formattedDate = `${String(invoiceDate.getDate()).padStart(2, "0")}/${String(invoiceDate.getMonth() + 1).padStart(2, "0")}/${invoiceDate.getFullYear()}`;
    // Determine supply type based on seller/buyer state
    const sellerState = String(orgData.state_code ?? orgData.stateCode ?? "");
    const buyerState = String(clientData.state_code ?? clientData.stateCode ?? "");
    const isInterState = sellerState !== buyerState;
    // Build item list
    const itemList = items.map((item, idx) => {
        const qty = Number(item.quantity ?? 1);
        const unitPrice = Number(item.rate ?? item.unit_price ?? 0) / 100;
        const totAmt = qty * unitPrice;
        const gstRt = Number(item.tax_rate ?? item.gst_rate ?? 18);
        const taxAmt = totAmt * (gstRt / 100);
        return {
            slNo: String(idx + 1),
            prdDesc: String(item.description ?? item.name ?? ""),
            isServc: item.product_type === "service" ? "Y" : "N",
            hsnCd: String(item.hsn_code ?? item.sac_code ?? ""),
            qty,
            unit: String(item.unit ?? "NOS"),
            unitPrice,
            totAmt,
            gstRt,
            igstAmt: isInterState ? taxAmt : 0,
            cgstAmt: isInterState ? 0 : taxAmt / 2,
            sgstAmt: isInterState ? 0 : taxAmt / 2,
            totItemVal: totAmt + taxAmt,
        };
    });
    // Calculate totals
    const assVal = itemList.reduce((sum, i) => sum + i.totAmt, 0);
    const igstVal = itemList.reduce((sum, i) => sum + i.igstAmt, 0);
    const cgstVal = itemList.reduce((sum, i) => sum + i.cgstAmt, 0);
    const sgstVal = itemList.reduce((sum, i) => sum + i.sgstAmt, 0);
    return {
        version: "1.1",
        tranDtls: {
            taxSch: "GST",
            supTyp: "B2B",
            regRev: String(inv.reverse_charge ?? "N") === "Y" ? "Y" : "N",
            igstOnIntra: "N",
        },
        docDtls: {
            typ: "INV",
            no: String(inv.invoiceNumber ?? inv.invoice_number ?? ""),
            dt: formattedDate,
        },
        sellerDtls: {
            gstin: String(orgData.gstin ?? ""),
            lglNm: String(orgData.legal_name ?? orgData.name ?? ""),
            addr1: String(orgData.address ?? orgData.address1 ?? ""),
            loc: String(orgData.city ?? ""),
            pin: Number(orgData.pincode ?? orgData.zip ?? 0),
            stcd: sellerState,
        },
        buyerDtls: {
            gstin: String(clientData.gstin ?? ""),
            lglNm: String(clientData.legal_name ?? clientData.company_name ?? clientData.name ?? ""),
            pos: buyerState,
            addr1: String(clientData.billing_address ?? clientData.address ?? ""),
            loc: String(clientData.city ?? ""),
            pin: Number(clientData.pincode ?? clientData.zip ?? 0),
            stcd: buyerState,
        },
        itemList,
        valDtls: {
            assVal,
            igstVal,
            cgstVal,
            sgstVal,
            totInvVal: assVal + igstVal + cgstVal + sgstVal,
        },
    };
}
//# sourceMappingURL=einvoice.service.js.map