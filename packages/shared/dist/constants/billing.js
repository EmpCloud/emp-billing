"use strict";
// ============================================================================
// BILLING CONSTANTS
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCIES = exports.PAYMENT_TERMS = void 0;
exports.formatMoney = formatMoney;
exports.toSmallestUnit = toSmallestUnit;
exports.fromSmallestUnit = fromSmallestUnit;
exports.PAYMENT_TERMS = [
    { label: "Due on receipt", days: 0 },
    { label: "Net 7", days: 7 },
    { label: "Net 15", days: 15 },
    { label: "Net 30", days: 30 },
    { label: "Net 45", days: 45 },
    { label: "Net 60", days: 60 },
    { label: "Net 90", days: 90 },
];
exports.CURRENCIES = {
    INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2 },
    USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
    GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2 },
    EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2 },
    AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
    AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
    CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2 },
    SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2 },
    JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0 },
    CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimals: 2 },
};
function formatMoney(amountInSmallestUnit, currencyCode) {
    const currency = exports.CURRENCIES[currencyCode] || exports.CURRENCIES.INR;
    const value = amountInSmallestUnit / Math.pow(10, currency.decimals);
    return `${currency.symbol}${value.toLocaleString("en-IN", {
        minimumFractionDigits: currency.decimals,
        maximumFractionDigits: currency.decimals,
    })}`;
}
function toSmallestUnit(amount, currencyCode) {
    const currency = exports.CURRENCIES[currencyCode] || exports.CURRENCIES.INR;
    return Math.round(amount * Math.pow(10, currency.decimals));
}
function fromSmallestUnit(amountInSmallestUnit, currencyCode) {
    const currency = exports.CURRENCIES[currencyCode] || exports.CURRENCIES.INR;
    return amountInSmallestUnit / Math.pow(10, currency.decimals);
}
//# sourceMappingURL=billing.js.map