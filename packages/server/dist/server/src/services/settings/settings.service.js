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
exports.getOrgSettings = getOrgSettings;
exports.updateOrgSettings = updateOrgSettings;
exports.updateBranding = updateBranding;
exports.getNumberingConfig = getNumberingConfig;
exports.updateNumberingConfig = updateNumberingConfig;
exports.getEmailTemplates = getEmailTemplates;
exports.updateEmailTemplate = updateEmailTemplate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
// ============================================================================
// SETTINGS SERVICE
// ============================================================================
// ── Get Org Settings ────────────────────────────────────────────────────────
async function getOrgSettings(orgId) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    return org;
}
// ── Update Org Settings ─────────────────────────────────────────────────────
async function updateOrgSettings(orgId, input) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.name !== undefined)
        updateData.name = input.name;
    if (input.legalName !== undefined)
        updateData.legalName = input.legalName;
    if (input.email !== undefined)
        updateData.email = input.email;
    if (input.phone !== undefined)
        updateData.phone = input.phone;
    if (input.website !== undefined)
        updateData.website = input.website;
    if (input.address !== undefined)
        updateData.address = JSON.stringify(input.address);
    if (input.taxId !== undefined)
        updateData.taxId = input.taxId;
    if (input.pan !== undefined)
        updateData.pan = input.pan;
    if (input.defaultCurrency !== undefined)
        updateData.defaultCurrency = input.defaultCurrency;
    if (input.country !== undefined)
        updateData.country = input.country;
    if (input.fiscalYearStart !== undefined)
        updateData.fiscalYearStart = input.fiscalYearStart;
    if (input.invoicePrefix !== undefined)
        updateData.invoicePrefix = input.invoicePrefix;
    if (input.quotePrefix !== undefined)
        updateData.quotePrefix = input.quotePrefix;
    if (input.defaultPaymentTerms !== undefined)
        updateData.defaultPaymentTerms = input.defaultPaymentTerms;
    if (input.defaultNotes !== undefined)
        updateData.defaultNotes = input.defaultNotes;
    if (input.defaultTerms !== undefined)
        updateData.defaultTerms = input.defaultTerms;
    if (input.timezone !== undefined)
        updateData.timezone = input.timezone;
    return db.update("organizations", orgId, updateData);
}
// ── Update Branding ─────────────────────────────────────────────────────────
async function updateBranding(orgId, input) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.logo !== undefined)
        updateData.logo = input.logo;
    if (input.brandColors !== undefined)
        updateData.brandColors = JSON.stringify(input.brandColors);
    return db.update("organizations", orgId, updateData);
}
// ── Get Numbering Config ────────────────────────────────────────────────────
async function getNumberingConfig(orgId) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    return {
        data: {
            invoicePrefix: org.invoicePrefix,
            invoiceNextNumber: org.invoiceNextNumber,
            quotePrefix: org.quotePrefix,
            quoteNextNumber: org.quoteNextNumber,
        },
    };
}
// ── Update Numbering Config ─────────────────────────────────────────────────
async function updateNumberingConfig(orgId, input) {
    const db = await (0, index_1.getDB)();
    const org = await db.findById("organizations", orgId);
    if (!org)
        throw (0, AppError_1.NotFoundError)("Organization");
    const now = new Date();
    const updateData = { updatedAt: now };
    if (input.invoicePrefix !== undefined)
        updateData.invoicePrefix = input.invoicePrefix;
    if (input.invoiceNextNumber !== undefined)
        updateData.invoiceNextNumber = input.invoiceNextNumber;
    if (input.quotePrefix !== undefined)
        updateData.quotePrefix = input.quotePrefix;
    if (input.quoteNextNumber !== undefined)
        updateData.quoteNextNumber = input.quoteNextNumber;
    return db.update("organizations", orgId, updateData);
}
// ── Email Templates ────────────────────────────────────────────────────────
const TEMPLATES_DIR = path.resolve(__dirname, "../../templates");
/** Allowed email template basenames (without extension). */
const ALLOWED_TEMPLATES = [
    "email-invoice",
    "email-payment-receipt",
    "email-payment-reminder",
    "email-quote",
];
/**
 * Read subject from a JSON sidecar file next to the .hbs template.
 * Falls back to a default derived from the template name.
 */
function readSubject(templateName) {
    const sidecarPath = path.join(TEMPLATES_DIR, `${templateName}.meta.json`);
    try {
        const raw = fs.readFileSync(sidecarPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (typeof parsed.subject === "string")
            return parsed.subject;
    }
    catch {
        // Sidecar doesn't exist or is invalid — use default
    }
    const defaults = {
        "email-invoice": "New Invoice from {{org.name}}",
        "email-payment-receipt": "Payment Receipt from {{org.name}}",
        "email-payment-reminder": "Payment Reminder - {{invoice.invoiceNumber}}",
        "email-quote": "New Quote from {{org.name}}",
    };
    return defaults[templateName] ?? templateName;
}
function writeSubject(templateName, subject) {
    const sidecarPath = path.join(TEMPLATES_DIR, `${templateName}.meta.json`);
    fs.writeFileSync(sidecarPath, JSON.stringify({ subject }, null, 2), "utf-8");
}
async function getEmailTemplates() {
    const templates = [];
    for (const name of ALLOWED_TEMPLATES) {
        const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
        if (!fs.existsSync(filePath))
            continue;
        const body = fs.readFileSync(filePath, "utf-8");
        const subject = readSubject(name);
        templates.push({ name, subject, body });
    }
    return templates;
}
async function updateEmailTemplate(name, input) {
    if (!ALLOWED_TEMPLATES.includes(name)) {
        throw (0, AppError_1.BadRequestError)(`Unknown email template: ${name}`);
    }
    const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
    if (!fs.existsSync(filePath)) {
        throw (0, AppError_1.NotFoundError)("Email template");
    }
    if (input.body !== undefined) {
        fs.writeFileSync(filePath, input.body, "utf-8");
    }
    if (input.subject !== undefined) {
        writeSubject(name, input.subject);
    }
    const body = fs.readFileSync(filePath, "utf-8");
    const subject = readSubject(name);
    return { name, subject, body };
}
//# sourceMappingURL=settings.service.js.map