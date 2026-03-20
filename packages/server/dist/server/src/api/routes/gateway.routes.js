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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatewayRoutes = void 0;
const express_1 = require("express");
const express_2 = __importDefault(require("express"));
const error_middleware_1 = require("../middleware/error.middleware");
const onlinePaymentService = __importStar(require("../../services/payment/online-payment.service"));
const router = (0, express_1.Router)();
exports.gatewayRoutes = router;
// Stripe webhook -- needs raw body for signature verification
router.post("/stripe", express_2.default.raw({ type: "application/json" }), (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const result = await onlinePaymentService.handleGatewayWebhook("stripe", req.headers, req.body, req.body // raw buffer when express.raw is used
    );
    res.json(result);
}));
// Razorpay webhook
router.post("/razorpay", (0, error_middleware_1.asyncHandler)(async (req, res) => {
    const rawBody = Buffer.from(JSON.stringify(req.body));
    const result = await onlinePaymentService.handleGatewayWebhook("razorpay", req.headers, req.body, rawBody);
    res.json(result);
}));
//# sourceMappingURL=gateway.routes.js.map