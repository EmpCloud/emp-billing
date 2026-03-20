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
exports.listPlans = listPlans;
exports.getPlan = getPlan;
exports.createPlan = createPlan;
exports.updatePlan = updatePlan;
exports.deletePlan = deletePlan;
exports.listSubscriptions = listSubscriptions;
exports.getSubscription = getSubscription;
exports.createSubscription = createSubscription;
exports.changePlan = changePlan;
exports.cancelSubscription = cancelSubscription;
exports.pauseSubscription = pauseSubscription;
exports.resumeSubscription = resumeSubscription;
exports.getSubscriptionEvents = getSubscriptionEvents;
const subscriptionService = __importStar(require("../../services/subscription/subscription.service"));
// ============================================================================
// PLAN CONTROLLERS
// ============================================================================
async function listPlans(req, res) {
    const plans = await subscriptionService.listPlans(req.user.orgId);
    res.json({ success: true, data: plans });
}
async function getPlan(req, res) {
    const plan = await subscriptionService.getPlan(req.user.orgId, req.params.id);
    res.json({ success: true, data: plan });
}
async function createPlan(req, res) {
    const plan = await subscriptionService.createPlan(req.user.orgId, req.body);
    res.status(201).json({ success: true, data: plan });
}
async function updatePlan(req, res) {
    const plan = await subscriptionService.updatePlan(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: plan });
}
async function deletePlan(req, res) {
    await subscriptionService.deletePlan(req.user.orgId, req.params.id);
    res.json({ success: true, data: null });
}
// ============================================================================
// SUBSCRIPTION CONTROLLERS
// ============================================================================
async function listSubscriptions(req, res) {
    const query = req.query;
    const opts = {
        page: parseInt(query.page || "1"),
        limit: parseInt(query.limit || "20"),
        sortOrder: "desc",
        status: query.status,
        clientId: query.clientId,
    };
    const result = await subscriptionService.listSubscriptions(req.user.orgId, opts);
    res.json({
        success: true,
        data: result.data,
        meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
}
async function getSubscription(req, res) {
    const subscription = await subscriptionService.getSubscription(req.user.orgId, req.params.id);
    res.json({ success: true, data: subscription });
}
async function createSubscription(req, res) {
    const subscription = await subscriptionService.createSubscription(req.user.orgId, req.user.id, req.body);
    res.status(201).json({ success: true, data: subscription });
}
async function changePlan(req, res) {
    const subscription = await subscriptionService.changePlan(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: subscription });
}
async function cancelSubscription(req, res) {
    const subscription = await subscriptionService.cancelSubscription(req.user.orgId, req.params.id, req.body);
    res.json({ success: true, data: subscription });
}
async function pauseSubscription(req, res) {
    const subscription = await subscriptionService.pauseSubscription(req.user.orgId, req.params.id);
    res.json({ success: true, data: subscription });
}
async function resumeSubscription(req, res) {
    const subscription = await subscriptionService.resumeSubscription(req.user.orgId, req.params.id);
    res.json({ success: true, data: subscription });
}
async function getSubscriptionEvents(req, res) {
    const events = await subscriptionService.getSubscriptionEvents(req.user.orgId, req.params.id);
    res.json({ success: true, data: events });
}
//# sourceMappingURL=subscription.controller.js.map