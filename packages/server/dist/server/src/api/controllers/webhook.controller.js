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
exports.listWebhooks = listWebhooks;
exports.createWebhook = createWebhook;
exports.updateWebhook = updateWebhook;
exports.deleteWebhook = deleteWebhook;
exports.testWebhook = testWebhook;
exports.getDeliveries = getDeliveries;
exports.retryDelivery = retryDelivery;
const webhookService = __importStar(require("../../services/webhook/webhook.service"));
async function listWebhooks(req, res) {
    const webhooks = await webhookService.listWebhooks(req.user.orgId);
    res.json({ success: true, data: webhooks });
}
async function createWebhook(req, res) {
    const webhook = await webhookService.createWebhook(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: webhook });
}
async function updateWebhook(req, res) {
    const webhook = await webhookService.updateWebhook(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: webhook });
}
async function deleteWebhook(req, res) {
    await webhookService.deleteWebhook(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
async function testWebhook(req, res) {
    const result = await webhookService.testWebhook(req.user.orgId, req.params.id);
    res.json({ success: true, data: result });
}
async function getDeliveries(req, res) {
    const deliveries = await webhookService.getDeliveries(req.user.orgId, req.params.id);
    res.json({ success: true, data: deliveries });
}
async function retryDelivery(req, res) {
    const result = await webhookService.retryDelivery(req.user.orgId, req.params.id, req.params.deliveryId);
    res.json({ success: true, data: result });
}
//# sourceMappingURL=webhook.controller.js.map