export interface VATRateSet {
    standard: number;
    reduced: number[];
    superReduced?: number;
    zero: number;
    parking?: number;
}
/**
 * EU VAT rates by country code (ISO 3166-1 alpha-2).
 * Rates are percentages. Source: European Commission, as of 2026.
 */
export declare const EU_VAT_RATES: Record<string, VATRateSet>;
/**
 * UK VAT rates (post-Brexit, standalone).
 */
export declare const UK_VAT_RATES: VATRateSet;
/**
 * All EU country codes for membership checks.
 */
export declare const EU_COUNTRY_CODES: string[];
/**
 * Get the VAT rate for a given country and rate type.
 * For 'reduced', returns the first (lowest) reduced rate.
 * Returns the UK rate when countryCode is 'GB'.
 */
export declare function getVATRate(countryCode: string, rateType: "standard" | "reduced" | "zero"): number;
export interface VATResult {
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
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
export declare function computeVAT(amount: number, rate: number, inclusive: boolean): VATResult;
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
export declare function isReverseChargeApplicable(sellerCountry: string, buyerCountry: string, buyerIsB2B: boolean): boolean;
