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
const settingsService = __importStar(require("../../services/settings/settings.service"));
async function getOrgSettings(req, res) {
    const org = await settingsService.getOrgSettings(req.user.orgId);
    res.json({ success: true, data: org });
}
async function updateOrgSettings(req, res) {
    const org = await settingsService.updateOrgSettings(req.user.orgId, req.body);
    res.json({ success: true, data: org });
}
async function updateBranding(req, res) {
    const org = await settingsService.updateBranding(req.user.orgId, req.body);
    res.json({ success: true, data: org });
}
async function getNumberingConfig(req, res) {
    const result = await settingsService.getNumberingConfig(req.user.orgId);
    res.json({ success: true, data: result.data });
}
async function updateNumberingConfig(req, res) {
    const org = await settingsService.updateNumberingConfig(req.user.orgId, req.body);
    res.json({ success: true, data: org });
}
async function getEmailTemplates(req, res) {
    const templates = await settingsService.getEmailTemplates();
    res.json({ success: true, data: templates });
}
async function updateEmailTemplate(req, res) {
    const { name } = req.params;
    const template = await settingsService.updateEmailTemplate(name, req.body);
    res.json({ success: true, data: template });
}
//# sourceMappingURL=settings.controller.js.map