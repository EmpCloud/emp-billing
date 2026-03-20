"use strict";
// ============================================================================
// VAT CONSTANTS (UK / EU)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.EU_COUNTRY_CODES = exports.UK_VAT_RATES = exports.EU_VAT_RATES = void 0;
exports.getVATRate = getVATRate;
exports.computeVAT = computeVAT;
exports.isReverseChargeApplicable = isReverseChargeApplicable;
/**
 * EU VAT rates by country code (ISO 3166-1 alpha-2).
 * Rates are percentages. Source: European Commission, as of 2026.
 */
exports.EU_VAT_RATES = {
    AT: { standard: 20, reduced: [10, 13], zero: 0 },
    BE: { standard: 21, reduced: [6, 12], zero: 0, parking: 12 },
    BG: { standard: 20, reduced: [9], zero: 0 },
    HR: { standard: 25, reduced: [5, 13], zero: 0 },
    CY: { standard: 19, reduced: [5, 9], zero: 0 },
    CZ: { standard: 21, reduced: [12, 15], zero: 0 },
    DK: { standard: 25, reduced: [], zero: 0 },
    EE: { standard: 22, reduced: [9], zero: 0 },
    FI: { standard: 25.5, reduced: [10, 14], zero: 0 },
    FR: { standard: 20, reduced: [5.5, 10], superReduced: 2.1, zero: 0 },
    DE: { standard: 19, reduced: [7], zero: 0 },
    GR: { standard: 24, reduced: [6, 13], zero: 0 },
    HU: { standard: 27, reduced: [5, 18], zero: 0 },
    IE: { standard: 23, reduced: [9, 13.5], superReduced: 4.8, zero: 0, parking: 13.5 },
    IT: { standard: 22, reduced: [5, 10], superReduced: 4, zero: 0 },
    LV: { standard: 21, reduced: [5, 12], zero: 0 },
    LT: { standard: 21, reduced: [5, 9], zero: 0 },
    LU: { standard: 17, reduced: [8], superReduced: 3, zero: 0, parking: 14 },
    MT: { standard: 18, reduced: [5, 7], zero: 0 },
    NL: { standard: 21, reduced: [9], zero: 0 },
    PL: { standard: 23, reduced: [5, 8], zero: 0 },
    PT: { standard: 23, reduced: [6, 13], zero: 0, parking: 13 },
    RO: { standard: 19, reduced: [5, 9], zero: 0 },
    SK: { standard: 23, reduced: [5, 10], zero: 0 },
    SI: { standard: 22, reduced: [5, 9.5], zero: 0 },
    ES: { standard: 21, reduced: [10], superReduced: 4, zero: 0 },
    SE: { standard: 25, reduced: [6, 12], zero: 0 },
};
/**
 * UK VAT rates (post-Brexit, standalone).
 */
exports.UK_VAT_RATES = {
    standard: 20,
    reduced: [5],
    zero: 0,
};
/**
 * All EU country codes for membership checks.
 */
exports.EU_COUNTRY_CODES = Object.keys(exports.EU_VAT_RATES);
/**
 * Get the VAT rate for a given country and rate type.
 * For 'reduced', returns the first (lowest) reduced rate.
 * Returns the UK rate when countryCode is 'GB'.
 */
function getVATRate(countryCode, rateType) {
    const upper = countryCode.toUpperCase();
    const rateSet = upper === "GB" ? exports.UK_VAT_RATES : exports.EU_VAT_RATES[upper];
    if (!rateSet) {
        throw new Error(`Unknown VAT country code: ${countryCode}`);
    }
    switch (rateType) {
        case "standard":
            return rateSet.standard;
        case "reduced":
            if (rateSet.reduced.length === 0) {
                throw new Error(`No reduced VAT rate available for ${upper}`);
            }
            return rateSet.reduced[0];
        case "zero":
            return rateSet.zero;
    }
}
/**
 * Compute VAT for a given amount.
 * All monetary values are integers in the smallest currency unit (pence/cents).
 *
 * @param amount   - If inclusive=false, this is the net amount (before VAT).
 *                   If inclusive=true, this is the gross amount (VAT-included).
 * @param rate     - VAT rate as a percentage (e.g. 20 for 20%).
 * @param inclusive - Whether the supplied amount already includes VAT.
 */
function computeVAT(amount, rate, inclusive) {
    if (inclusive) {
        // amount is gross (VAT-inclusive)
        const netAmount = Math.round(amount / (1 + rate / 100));
        const vatAmount = amount - netAmount;
        return { netAmount, vatAmount, grossAmount: amount };
    }
    // amount is net (VAT-exclusive)
    const vatAmount = Math.round(amount * rate / 100);
    return { netAmount: amount, vatAmount, grossAmount: amount + vatAmount };
}
/**
 * Determine whether the reverse charge mechanism applies.
 *
 * Reverse charge applies when:
 * - Seller and buyer are in different countries, AND
 * - The buyer is a registered business (B2B transaction)
 *
 * When reverse charge applies, the seller does not charge VAT;
 * the buyer self-assesses VAT in their own country.
 */
function isReverseChargeApplicable(sellerCountry, buyerCountry, buyerIsB2B) {
    const seller = sellerCountry.toUpperCase();
    const buyer = buyerCountry.toUpperCase();
    if (seller === buyer) {
        return false;
    }
    if (!buyerIsB2B) {
        return false;
    }
    // Cross-border B2B within EU, or between EU and UK
    const euAndUk = [...exports.EU_COUNTRY_CODES, "GB"];
    const sellerInScope = euAndUk.includes(seller);
    const buyerInScope = euAndUk.includes(buyer);
    return sellerInScope && buyerInScope;
}
//# sourceMappingURL=vat.js.map