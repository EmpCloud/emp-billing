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
exports.listProfiles = listProfiles;
exports.getProfile = getProfile;
exports.createProfile = createProfile;
exports.updateProfile = updateProfile;
exports.deleteProfile = deleteProfile;
exports.pauseProfile = pauseProfile;
exports.resumeProfile = resumeProfile;
exports.getExecutions = getExecutions;
const recurringService = __importStar(require("../../services/recurring/recurring.service"));
async function listProfiles(req, res) {
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        status: query.status,
        clientId: query.clientId,
    };
    const result = await recurringService.listProfiles(req.user.orgId, opts);
    res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
}
async function getProfile(req, res) {
    const profile = await recurringService.getProfile(req.user.orgId, req.params.id);
    res.json({ success: true, data: profile });
}
async function createProfile(req, res) {
    const profile = await recurringService.createProfile(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: profile });
}
async function updateProfile(req, res) {
    const profile = await recurringService.updateProfile(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: profile });
}
async function deleteProfile(req, res) {
    await recurringService.deleteProfile(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function pauseProfile(req, res) {
    const profile = await recurringService.pauseProfile(req.user.orgId, req.params.id);
    res.json({ success: true, data: profile });
}
async function resumeProfile(req, res) {
    const profile = await recurringService.resumeProfile(req.user.orgId, req.params.id);
    res.json({ success: true, data: profile });
}
async function getExecutions(req, res) {
    const executions = await recurringService.getExecutions(req.user.orgId, req.params.id);
    res.json({ success: true, data: executions });
}
//# sourceMappingURL=recurring.controller.js.map