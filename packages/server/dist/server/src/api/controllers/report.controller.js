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
exports.getDashboardStats = getDashboardStats;
exports.getRevenueReport = getRevenueReport;
exports.getReceivablesReport = getReceivablesReport;
exports.getAgingReport = getAgingReport;
exports.getExpenseReport = getExpenseReport;
exports.getProfitLossReport = getProfitLossReport;
exports.getTaxReport = getTaxReport;
exports.getTopClients = getTopClients;
exports.exportRevenueReport = exportRevenueReport;
exports.exportReceivablesReport = exportReceivablesReport;
exports.exportExpenseReport = exportExpenseReport;
exports.exportTaxReport = exportTaxReport;
const reportService = __importStar(require("../../services/report/report.service"));
// ── CSV helpers ──────────────────────────────────────────────────────────────
function escapeCsvField(value) {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
function toCsv(headers, rows) {
    const lines = [headers.map(escapeCsvField).join(",")];
    for (const row of rows) {
        lines.push(row.map(escapeCsvField).join(","));
    }
    return lines.join("\n");
}
function sendCsv(res, filename, csv) {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
}
async function getDashboardStats(req, res) {
    const result = await reportService.getDashboardStats(req.user.orgId);
    res.json({ success: true, data: result.data });
}
async function getRevenueReport(req, res) {
    const q = req.query;
    const from = new Date(q.from);
    const to = new Date(q.to);
    const result = await reportService.getRevenueReport(req.user.orgId, from, to);
    res.json({ success: true, data: result.data });
}
async function getReceivablesReport(req, res) {
    const result = await reportService.getReceivablesReport(req.user.orgId);
    res.json({ success: true, data: result.data });
}
async function getAgingReport(req, res) {
    const result = await reportService.getAgingReport(req.user.orgId);
    res.json({ success: true, data: result.data });
}
async function getExpenseReport(req, res) {
    const q = req.query;
    const from = new Date(q.from);
    const to = new Date(q.to);
    const result = await reportService.getExpenseReport(req.user.orgId, from, to);
    res.json({ success: true, data: result.data });
}
async function getProfitLossReport(req, res) {
    const q = req.query;
    const from = new Date(q.from);
    const to = new Date(q.to);
    const result = await reportService.getProfitLossReport(req.user.orgId, from, to);
    res.json({ success: true, data: result.data });
}
async function getTaxReport(req, res) {
    const q = req.query;
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    const result = await reportService.getTaxReport(req.user.orgId, from, to);
    res.json({ success: true, data: result.data });
}
async function getTopClients(req, res) {
    const q = req.query;
    const from = new Date(q.from);
    const to = new Date(q.to);
    const limit = q.limit ? parseInt(q.limit, 10) : 10;
    const result = await reportService.getTopClients(req.user.orgId, from, to, limit);
    res.json({ success: true, data: result.data });
}
// ── CSV Export endpoints ────────────────────────────────────────────────────
async function exportRevenueReport(req, res) {
    const q = req.query;
    const from = new Date(q.from);
    const to = new Date(q.to);
    const result = await reportService.getRevenueReport(req.user.orgId, from, to);
    const headers = ["Month", "Revenue (paise)"];
    const rows = result.data.map((r) => [r.month, r.revenue]);
    sendCsv(res, "revenue-report.csv", toCsv(headers, rows));
}
async function exportReceivablesReport(req, res) {
    const result = await reportService.getReceivablesReport(req.user.orgId);
    const headers = ["Client ID", "Client Name", "Total Outstanding (paise)", "Invoice Count"];
    const rows = result.data.map((r) => [r.clientId, r.clientName, r.totalOutstanding, r.invoiceCount]);
    sendCsv(res, "receivables-report.csv", toCsv(headers, rows));
}
async function exportExpenseReport(req, res) {
    const q = req.query;
    const from = new Date(q.from);
    const to = new Date(q.to);
    const result = await reportService.getExpenseReport(req.user.orgId, from, to);
    const headers = ["Category ID", "Category Name", "Total (paise)", "Count"];
    const rows = result.data.map((r) => [r.categoryId, r.categoryName, r.total, r.count]);
    sendCsv(res, "expense-report.csv", toCsv(headers, rows));
}
async function exportTaxReport(req, res) {
    const q = req.query;
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    const result = await reportService.getTaxReport(req.user.orgId, from, to);
    const headers = ["Tax Rate Name", "Type", "Rate (%)", "Taxable Amount (paise)", "CGST (paise)", "SGST (paise)", "IGST (paise)", "Total Tax (paise)", "Invoice Count"];
    const rows = result.data.map((r) => [
        r.taxRateName, r.taxRateType, r.rate, r.taxableAmount, r.cgst, r.sgst, r.igst, r.totalTax, r.invoiceCount,
    ]);
    sendCsv(res, "tax-report.csv", toCsv(headers, rows));
}
//# sourceMappingURL=report.controller.js.map