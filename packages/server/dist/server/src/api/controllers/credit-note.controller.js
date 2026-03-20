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
exports.listCreditNotes = listCreditNotes;
exports.getCreditNote = getCreditNote;
exports.createCreditNote = createCreditNote;
exports.applyCreditNote = applyCreditNote;
exports.voidCreditNote = voidCreditNote;
exports.deleteCreditNote = deleteCreditNote;
exports.getCreditNotePdf = getCreditNotePdf;
const creditNoteService = __importStar(require("../../services/credit-note/credit-note.service"));
async function listCreditNotes(req, res) {
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        sortOrder: query.sortOrder || "desc",
        clientId: query.clientId,
        status: query.status,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        search: query.search,
    };
    const result = await creditNoteService.listCreditNotes(req.user.orgId, opts);
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}
async function getCreditNote(req, res) {
    const creditNote = await creditNoteService.getCreditNote(req.user.orgId, req.params.id);
    res.json({ success: true, data: creditNote });
}
async function createCreditNote(req, res) {
    const creditNote = await creditNoteService.createCreditNote(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: creditNote });
}
async function applyCreditNote(req, res) {
    const creditNote = await creditNoteService.applyCreditNote(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: creditNote });
}
async function voidCreditNote(req, res) {
    const creditNote = await creditNoteService.voidCreditNote(req.user.orgId, req.params.id);
    res.json({ success: true, data: creditNote });
}
async function deleteCreditNote(req, res) {
    await creditNoteService.deleteCreditNote(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function getCreditNotePdf(req, res) {
    const pdfBuffer = await creditNoteService.getCreditNotePdf(req.user.orgId, req.params.id);
    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="credit-note-${req.params.id}.pdf"`,
        "Content-Length": pdfBuffer.length,
    });
    res.send(pdfBuffer);
}
//# sourceMappingURL=credit-note.controller.js.map