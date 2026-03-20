export declare const UAE_VAT_RATE = 5;
export declare enum UAEVATCategory {
    STANDARD = "standard",
    ZERO_RATED = "zero_rated",
    EXEMPT = "exempt"
}
/**
 * Goods / services that are zero-rated in the UAE (VAT at 0%).
 * Zero-rated means VAT-registered businesses can still reclaim input tax.
 */
export declare const UAE_ZERO_RATED_CATEGORIES: readonly ["international_transport", "export_goods", "export_services", "first_supply_residential_property", "education_services", "healthcare_services", "crude_oil", "natural_gas", "investment_precious_metals"];
/**
 * Goods / services that are VAT-exempt in the UAE.
 * Exempt means no VAT is charged and input tax is NOT reclaimable.
 */
export declare const UAE_EXEMPT_CATEGORIES: readonly ["local_passenger_transport", "bare_land", "subsequent_supply_residential_property", "certain_financial_services", "life_insurance"];
export interface ExciseTaxItem {
    category: string;
    rate: number;
}
export declare const UAE_EXCISE_TAX_RATES: ExciseTaxItem[];
/** Taxable income threshold — first AED 375,000 is at 0%. */
export declare const UAE_CORPORATE_TAX_THRESHOLD = 37500000;
/** Standard corporate tax rate for income above the threshold. */
export declare const UAE_CORPORATE_TAX_RATE = 9;
/** Large multinationals (Pillar Two) — minimum effective rate. */
export declare const UAE_CORPORATE_TAX_RATE_LARGE_MNC = 15;
export declare const UAE_EMIRATES: Record<string, string>;
/**
 * UAE Tax Registration Number is a 15-digit number.
 * Format: 100XXXXXXXXXXXX (starts with 100).
 */
export declare function isValidTRN(trn: string): boolean;
/**
 * Format a TRN with standard grouping: XXX-XXXX-XXXXXXX-X
 */
export declare function formatTRN(trn: string): string;
export interface UAEVATResult {
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    vatCategory: UAEVATCategory;
    vatRate: number;
}
/**
 * Compute UAE VAT for a given amount.
 * All monetary values are integers in the smallest currency unit (fils = 1/100 AED).
 *
 * @param amount    - Net amount (before VAT) if inclusive=false,
 *                    gross amount (VAT-included) if inclusive=true.
 * @param category  - VAT category: standard (5%), zero_rated (0%), or exempt (0%).
 * @param inclusive - Whether the supplied amount already includes VAT.
 */
export declare function computeUAEVAT(amount: number, category?: UAEVATCategory, inclusive?: boolean): UAEVATResult;
export interface ExciseTaxResult {
    netAmount: number;
    exciseAmount: number;
    totalAmount: number;
    exciseRate: number;
}
/**
 * Compute UAE Excise Tax for a given amount and product category.
 *
 * @param amount   - Pre-excise amount in smallest currency unit (fils).
 * @param category - Product category (e.g. "tobacco_products", "energy_drinks").
 */
export declare function computeExciseTax(amount: number, category: string): ExciseTaxResult;
export interface CorporateTaxResult {
    taxableIncome: number;
    taxAmount: number;
    effectiveRate: number;
}
/**
 * Compute UAE Corporate Tax on taxable income.
 * Income up to AED 375,000 (37,500,000 fils) is taxed at 0%.
 * Income above that is taxed at 9%.
 *
 * @param taxableIncome - Annual taxable income in fils (smallest unit).
 * @param isLargeMNC    - If true, applies 15% minimum rate (Pillar Two).
 */
export declare function computeCorporateTax(taxableIncome: number, isLargeMNC?: boolean): CorporateTaxResult;
/**
 * In the UAE, reverse charge applies when:
 * - Importing services from outside the UAE
 * - The recipient is VAT-registered in the UAE
 * The buyer must self-account for VAT on their return.
 */
export declare function isUAEReverseChargeApplicable(supplierCountry: string, isServiceImport: boolean): boolean;
