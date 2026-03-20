"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listInvoices = listInvoices;
exports.getInvoice = getInvoice;
exports.createInvoice = createInvoice;
exports.updateInvoice = updateInvoice;
exports.deleteInvoice = deleteInvoice;
exports.sendInvoice = sendInvoice;
exports.duplicateInvoice = duplicateInvoice;
exports.voidInvoice = voidInvoice;
exports.writeOffInvoice = writeOffInvoice;
exports.getInvoicePdf = getInvoicePdf;
exports.getInvoicePayments = getInvoicePayments;
exports.bulkDownloadPdf = bulkDownloadPdf;
const invoiceService = __importStar(require("../../services/invoice/invoice.service"));
async function listInvoices(req, res) {
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        sortOrder: query.sortOrder || "desc",
        status: query.status,
        clientId: query.clientId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        search: query.search,
        overdue: query.overdue === "true",
    };
    const result = await invoiceService.listInvoices(req.user.orgId, opts);
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}
async function getInvoice(req, res) {
    const invoice = await invoiceService.getInvoice(req.user.orgId, req.params.id);
    res.json({ success: true, data: invoice });
}
async function createInvoice(req, res) {
    const { autoSend, ...input } = req.body;
    const invoice = await invoiceService.createInvoice(req.user.orgId, req.user.id, input);
    // If autoSend is true, immediately send the invoice after creation
    if (autoSend === true) {
        const sentInvoice = await invoiceService.sendInvoice(req.user.orgId, invoice.id);
        res.status(201).json({ success: true, data: { ...invoice, ...sentInvoice } });
        return;
    }
    res.status(201).json({ success: true, data: invoice });
}
async function updateInvoice(req, res) {
    const invoice = await invoiceService.updateInvoice(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: invoice });
}
async function deleteInvoice(req, res) {
    await invoiceService.deleteInvoice(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function sendInvoice(req, res) {
    const invoice = await invoiceService.sendInvoice(req.user.orgId, req.params.id);
    res.json({ success: true, data: invoice });
}
async function duplicateInvoice(req, res) {
    const invoice = await invoiceService.duplicateInvoice(req.user.orgId, req.params.id, req.user.id);
    res.status(201).json({ success: true, data: invoice });
}
async function voidInvoice(req, res) {
    const invoice = await invoiceService.voidInvoice(req.user.orgId, req.params.id);
    res.json({ success: true, data: invoice });
}
async function writeOffInvoice(req, res) {
    const invoice = await invoiceService.writeOffInvoice(req.user.orgId, req.params.id);
    res.json({ success: true, data: invoice });
}
async function getInvoicePdf(req, res) {
    const pdfBuffer = await invoiceService.getInvoicePdf(req.user.orgId, req.params.id);
    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${req.params.id}.pdf"`,
        "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
}
async function getInvoicePayments(req, res) {
    const payments = await invoiceService.getInvoicePayments(req.user.orgId, req.params.id);
    res.json({ success: true, data: payments });
}
async function bulkDownloadPdf(req, res) {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({
            success: false,
            error: { code: "INVALID_IDS", message: "ids must be a non-empty array" },
        });
        return;
    }
    if (ids.length > 50) {
        res.status(400).json({
            success: false,
            error: { code: "TOO_MANY_IDS", message: "Maximum 50 invoices per bulk download" },
        });
        return;
    }
    const zipBuffer = await invoiceService.bulkGeneratePdfZip(req.user.orgId, ids);
    res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="invoices-${Date.now()}.zip"`,
        "Content-Length": String(zipBuffer.length),
    });
    res.send(zipBuffer);
}
//# sourceMappingURL=invoice.controller.js.map