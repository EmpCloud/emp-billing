export interface StateTaxEntry {
    name: string;
    rate: number;
}
/**
 * US state-level sales tax rates (percentage).
 * Rates reflect general state base rates as of 2026.
 * States with 0 rate have no statewide sales tax (OR, MT, NH, DE, AK).
 *
 * Note: Actual effective rates may be higher due to county/city/district
 * surcharges — use computeSalesTax with optional local rates for accuracy.
 */
export declare const US_STATE_TAX_RATES: Record<string, StateTaxEntry>;
/**
 * States with no statewide sales tax.
 */
export declare const NO_SALES_TAX_STATES: readonly ["AK", "DE", "MT", "NH", "OR"];
/**
 * Get the state-level sales tax rate for a US state.
 *
 * @param stateCode - Two-letter US state code (e.g. "CA", "TX").
 * @returns The state sales tax rate as a percentage.
 */
export declare function getStateTaxRate(stateCode: string): number;
export interface SalesTaxResult {
    taxAmount: number;
    totalAmount: number;
    effectiveRate: number;
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
export declare function computeSalesTax(amount: number, stateCode: string, countyRate?: number, cityRate?: number): SalesTaxResult;
