"use strict";
// ============================================================================
// US SALES TAX CONSTANTS
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_SALES_TAX_STATES = exports.US_STATE_TAX_RATES = void 0;
exports.getStateTaxRate = getStateTaxRate;
exports.computeSalesTax = computeSalesTax;
/**
 * US state-level sales tax rates (percentage).
 * Rates reflect general state base rates as of 2026.
 * States with 0 rate have no statewide sales tax (OR, MT, NH, DE, AK).
 *
 * Note: Actual effective rates may be higher due to county/city/district
 * surcharges — use computeSalesTax with optional local rates for accuracy.
 */
exports.US_STATE_TAX_RATES = {
    AL: { name: "Alabama", rate: 4 },
    AK: { name: "Alaska", rate: 0 },
    AZ: { name: "Arizona", rate: 5.6 },
    AR: { name: "Arkansas", rate: 6.5 },
    CA: { name: "California", rate: 7.25 },
    CO: { name: "Colorado", rate: 2.9 },
    CT: { name: "Connecticut", rate: 6.35 },
    DE: { name: "Delaware", rate: 0 },
    FL: { name: "Florida", rate: 6 },
    GA: { name: "Georgia", rate: 4 },
    HI: { name: "Hawaii", rate: 4 },
    ID: { name: "Idaho", rate: 6 },
    IL: { name: "Illinois", rate: 6.25 },
    IN: { name: "Indiana", rate: 7 },
    IA: { name: "Iowa", rate: 6 },
    KS: { name: "Kansas", rate: 6.5 },
    KY: { name: "Kentucky", rate: 6 },
    LA: { name: "Louisiana", rate: 4.45 },
    ME: { name: "Maine", rate: 5.5 },
    MD: { name: "Maryland", rate: 6 },
    MA: { name: "Massachusetts", rate: 6.25 },
    MI: { name: "Michigan", rate: 6 },
    MN: { name: "Minnesota", rate: 6.875 },
    MS: { name: "Mississippi", rate: 7 },
    MO: { name: "Missouri", rate: 4.225 },
    MT: { name: "Montana", rate: 0 },
    NE: { name: "Nebraska", rate: 5.5 },
    NV: { name: "Nevada", rate: 6.85 },
    NH: { name: "New Hampshire", rate: 0 },
    NJ: { name: "New Jersey", rate: 6.625 },
    NM: { name: "New Mexico", rate: 5.125 },
    NY: { name: "New York", rate: 4 },
    NC: { name: "North Carolina", rate: 4.75 },
    ND: { name: "North Dakota", rate: 5 },
    OH: { name: "Ohio", rate: 5.75 },
    OK: { name: "Oklahoma", rate: 4.5 },
    OR: { name: "Oregon", rate: 0 },
    PA: { name: "Pennsylvania", rate: 6 },
    RI: { name: "Rhode Island", rate: 7 },
    SC: { name: "South Carolina", rate: 6 },
    SD: { name: "South Dakota", rate: 4.5 },
    TN: { name: "Tennessee", rate: 7 },
    TX: { name: "Texas", rate: 6.25 },
    UT: { name: "Utah", rate: 6.1 },
    VT: { name: "Vermont", rate: 6 },
    VA: { name: "Virginia", rate: 5.3 },
    WA: { name: "Washington", rate: 6.5 },
    WV: { name: "West Virginia", rate: 6 },
    WI: { name: "Wisconsin", rate: 5 },
    WY: { name: "Wyoming", rate: 4 },
    DC: { name: "District of Columbia", rate: 6 },
};
/**
 * States with no statewide sales tax.
 */
exports.NO_SALES_TAX_STATES = ["AK", "DE", "MT", "NH", "OR"];
/**
 * Get the state-level sales tax rate for a US state.
 *
 * @param stateCode - Two-letter US state code (e.g. "CA", "TX").
 * @returns The state sales tax rate as a percentage.
 */
function getStateTaxRate(stateCode) {
    const upper = stateCode.toUpperCase();
    const entry = exports.US_STATE_TAX_RATES[upper];
    if (!entry) {
        throw new Error(`Unknown US state code: ${stateCode}`);
    }
    return entry.rate;
}
/**
 * Compute US sales tax for a given amount.
 * All monetary values are integers in the smallest currency unit (cents).
 *
 * The effective rate is the sum of state + county + city rates.
 *
 * @param amount     - The taxable amount in cents (before tax).
 * @param stateCode  - Two-letter US state code.
 * @param countyRate - Optional county sales tax rate as a percentage (e.g. 1.5).
 * @param cityRate   - Optional city sales tax rate as a percentage (e.g. 0.75).
 */
function computeSalesTax(amount, stateCode, countyRate, cityRate) {
    const stateRate = getStateTaxRate(stateCode);
    const county = countyRate ?? 0;
    const city = cityRate ?? 0;
    const effectiveRate = stateRate + county + city;
    const taxAmount = Math.round(amount * effectiveRate / 100);
    return {
        taxAmount,
        totalAmount: amount + taxAmount,
        effectiveRate,
    };
}
//# sourceMappingURL=sales-tax.js.map