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
exports.exportClients = exportClients;
exports.importClients = importClients;
exports.exportProducts = exportProducts;
exports.importProducts = importProducts;
const csvService = __importStar(require("../../services/import-export/csv.service"));
const AppError_1 = require("../../utils/AppError");
// ============================================================================
// IMPORT / EXPORT CONTROLLER
// ============================================================================
// ── Clients ──────────────────────────────────────────────────────────────────
async function exportClients(req, res) {
    const csv = await csvService.exportClientsCSV(req.user.orgId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=clients.csv");
    res.send(csv);
}
async function importClients(req, res) {
    const { csv } = req.body;
    if (!csv)
        throw (0, AppError_1.BadRequestError)("CSV data is required — send { csv: \"...\" }");
    const result = await csvService.importClientsCSV(req.user.orgId, csv);
    res.json({ success: true, data: result });
}
// ── Products ─────────────────────────────────────────────────────────────────
async function exportProducts(req, res) {
    const csv = await csvService.exportProductsCSV(req.user.orgId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=products.csv");
    res.send(csv);
}
async function importProducts(req, res) {
    const { csv } = req.body;
    if (!csv)
        throw (0, AppError_1.BadRequestError)("CSV data is required — send { csv: \"...\" }");
    const result = await csvService.importProductsCSV(req.user.orgId, csv);
    res.json({ success: true, data: result });
}
//# sourceMappingURL=import-export.controller.js.map