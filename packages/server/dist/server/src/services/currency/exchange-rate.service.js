"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExchangeRates = getExchangeRates;
exports.convertAmount = convertAmount;
exports.getSupportedCurrencies = getSupportedCurrencies;
exports.clearCache = clearCache;
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
async function getExchangeRates(base = "USD") {
    const upper = base.toUpperCase();
    const cached = cache.get(upper);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.rates;
    }
    try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${upper}`);
        if (!res.ok)
            throw new Error(`Exchange rate API returned ${res.status}`);
        const data = (await res.json());
        if (data.result === "success" && data.rates) {
            const entry = { rates: data.rates, fetchedAt: Date.now() };
            cache.set(upper, entry);
            return data.rates;
        }
        throw new Error("Invalid API response");
    }
    catch (err) {
        // Return stale cache if available
        if (cached)
            return cached.rates;
        throw err;
    }
}
async function convertAmount(amount, fromCurrency, toCurrency) {
    if (fromCurrency.toUpperCase() === toCurrency.toUpperCase())
        return amount;
    const rates = await getExchangeRates(fromCurrency.toUpperCase());
    const rate = rates[toCurrency.toUpperCase()];
    if (!rate)
        throw new Error(`No exchange rate found for ${toCurrency}`);
    return Math.round(amount * rate);
}
async function getSupportedCurrencies() {
    const rates = await getExchangeRates("USD");
    return Object.keys(rates).sort();
}
function clearCache() {
    cache.clear();
}
//# sourceMappingURL=exchange-rate.service.js.map