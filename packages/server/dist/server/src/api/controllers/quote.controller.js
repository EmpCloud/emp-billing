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
exports.listQuotes = listQuotes;
exports.getQuote = getQuote;
exports.createQuote = createQuote;
exports.updateQuote = updateQuote;
exports.deleteQuote = deleteQuote;
exports.sendQuote = sendQuote;
exports.convertToInvoice = convertToInvoice;
exports.acceptQuote = acceptQuote;
exports.declineQuote = declineQuote;
exports.getQuotePdf = getQuotePdf;
const quoteService = __importStar(require("../../services/quote/quote.service"));
async function listQuotes(req, res) {
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
    };
    const result = await quoteService.listQuotes(req.user.orgId, opts);
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}
async function getQuote(req, res) {
    const quote = await quoteService.getQuote(req.user.orgId, req.params.id);
    res.json({ success: true, data: quote });
}
async function createQuote(req, res) {
    const quote = await quoteService.createQuote(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: quote });
}
async function updateQuote(req, res) {
    const quote = await quoteService.updateQuote(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: quote });
}
async function deleteQuote(req, res) {
    await quoteService.deleteQuote(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function sendQuote(req, res) {
    const quote = await quoteService.sendQuote(req.user.orgId, req.params.id);
    res.json({ success: true, data: quote });
}
async function convertToInvoice(req, res) {
    const result = await quoteService.convertToInvoice(req.user.orgId, req.params.id, req.user.id);
    res.status(201).json({ success: true, data: result });
}
async function acceptQuote(req, res) {
    const quote = await quoteService.acceptQuote(req.user.orgId, req.params.id);
    res.json({ success: true, data: quote });
}
async function declineQuote(req, res) {
    const quote = await quoteService.declineQuote(req.user.orgId, req.params.id);
    res.json({ success: true, data: quote });
}
async function getQuotePdf(req, res) {
    const pdfBuffer = await quoteService.getQuotePdf(req.user.orgId, req.params.id);
    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="quote-${req.params.id}.pdf"`,
        "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
}
//# sourceMappingURL=quote.controller.js.map