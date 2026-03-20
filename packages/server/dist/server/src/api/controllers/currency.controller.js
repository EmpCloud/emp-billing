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
exports.getExchangeRates = getExchangeRates;
exports.convertAmount = convertAmount;
exports.getSupportedCurrencies = getSupportedCurrencies;
const exchangeService = __importStar(require("../../services/currency/exchange-rate.service"));
async function getExchangeRates(req, res) {
    const base = req.query.base || "USD";
    const rates = await exchangeService.getExchangeRates(base);
    res.json({ success: true, data: { base, rates } });
}
async function convertAmount(req, res) {
    const { amount, from, to } = req.body;
    const result = await exchangeService.convertAmount(Number(amount), from, to);
    res.json({ success: true, data: { amount, from, to, result } });
}
async function getSupportedCurrencies(req, res) {
    const currencies = await exchangeService.getSupportedCurrencies();
    res.json({ success: true, data: currencies });
}
//# sourceMappingURL=currency.controller.js.map