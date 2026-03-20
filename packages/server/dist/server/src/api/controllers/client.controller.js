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
exports.listClients = listClients;
exports.getClient = getClient;
exports.createClient = createClient;
exports.updateClient = updateClient;
exports.deleteClient = deleteClient;
exports.listContacts = listContacts;
exports.addContact = addContact;
exports.getClientStatement = getClientStatement;
exports.getClientBalance = getClientBalance;
exports.updatePaymentMethod = updatePaymentMethod;
exports.removePaymentMethod = removePaymentMethod;
const clientService = __importStar(require("../../services/client/client.service"));
async function listClients(req, res) {
    const { page = "1", limit = "20", search, tags, isActive } = req.query;
    const result = await clientService.listClients(req.user.orgId, {
        search,
        tags,
        isActive: isActive !== undefined ? isActive === "true" : undefined,
        page: parseInt(page),
        limit: parseInt(limit),
    });
    res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
}
async function getClient(req, res) {
    const client = await clientService.getClient(req.user.orgId, req.params.id);
    res.json({ success: true, data: client });
}
async function createClient(req, res) {
    const client = await clientService.createClient(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: client });
}
async function updateClient(req, res) {
    const client = await clientService.updateClient(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: client });
}
async function deleteClient(req, res) {
    await clientService.deleteClient(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function listContacts(req, res) {
    const contacts = await clientService.listContacts(req.user.orgId, req.params.id);
    res.json({ success: true, data: contacts });
}
async function addContact(req, res) {
    const contact = await clientService.addContact(req.user.orgId, req.params.id, req.body);
    res.status(201).json({ success: true, data: contact });
}
async function getClientStatement(req, res) {
    const { from, to } = req.query;
    const statement = await clientService.getClientStatement(req.user.orgId, req.params.id, new Date(from || new Date(new Date().getFullYear(), 0, 1)), new Date(to || new Date()));
    res.json({ success: true, data: statement });
}
async function getClientBalance(req, res) {
    const balance = await clientService.getClientBalance(req.user.orgId, req.params.id);
    res.json({ success: true, data: balance });
}
async function updatePaymentMethod(req, res) {
    const client = await clientService.updatePaymentMethod(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: client });
}
async function removePaymentMethod(req, res) {
    const client = await clientService.removePaymentMethod(req.user.orgId, req.params.id);
    res.json({ success: true, data: client });
}
//# sourceMappingURL=client.controller.js.map