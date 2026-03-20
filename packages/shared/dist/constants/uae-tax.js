"use strict";
// ============================================================================
// UAE TAX CONSTANTS (VAT + Excise + Corporate Tax)
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.UAE_EMIRATES = exports.UAE_CORPORATE_TAX_RATE_LARGE_MNC = exports.UAE_CORPORATE_TAX_RATE = exports.UAE_CORPORATE_TAX_THRESHOLD = exports.UAE_EXCISE_TAX_RATES = exports.UAE_EXEMPT_CATEGORIES = exports.UAE_ZERO_RATED_CATEGORIES = exports.UAEVATCategory = exports.UAE_VAT_RATE = void 0;
exports.isValidTRN = isValidTRN;
exports.formatTRN = formatTRN;
exports.computeUAEVAT = computeUAEVAT;
exports.computeExciseTax = computeExciseTax;
exports.computeCorporateTax = computeCorporateTax;
exports.isUAEReverseChargeApplicable = isUAEReverseChargeApplicable;
// ---------------------------------------------------------------------------
// UAE VAT (introduced Jan 2018)
// Standard rate: 5%  |  Zero-rated  |  Exempt
// ---------------------------------------------------------------------------
exports.UAE_VAT_RATE = 5; // %
var UAEVATCategory;
(function (UAEVATCategory) {
    UAEVATCategory["STANDARD"] = "standard";
    UAEVATCategory["ZERO_RATED"] = "zero_rated";
    UAEVATCategory["EXEMPT"] = "exempt";
})(UAEVATCategory || (exports.UAEVATCategory = UAEVATCategory = {}));
/**
 * Goods / services that are zero-rated in the UAE (VAT at 0%).
 * Zero-rated means VAT-registered businesses can still reclaim input tax.
 */
exports.UAE_ZERO_RATED_CATEGORIES = [
    "international_transport",
    "export_goods",
    "export_services",
    "first_supply_residential_property",
    "education_services",
    "healthcare_services",
    "crude_oil",
    "natural_gas",
    "investment_precious_metals", // first supply
];
/**
 * Goods / services that are VAT-exempt in the UAE.
 * Exempt means no VAT is charged and input tax is NOT reclaimable.
 */
exports.UAE_EXEMPT_CATEGORIES = [
    "local_passenger_transport",
    "bare_land",
    "subsequent_supply_residential_property",
    "certain_financial_services",
    "life_insurance",
];
exports.UAE_EXCISE_TAX_RATES = [
    { category: "tobacco_products", rate: 100 },
    { category: "electronic_smoking_devices", rate: 100 },
    { category: "liquids_for_electronic_smoking", rate: 100 },
    { category: "energy_drinks", rate: 100 },
    { category: "carbonated_drinks", rate: 50 },
    { category: "sweetened_drinks", rate: 50 },
];
// ---------------------------------------------------------------------------
// UAE Corporate Tax (introduced Jun 2023)
// ---------------------------------------------------------------------------
/** Taxable income threshold — first AED 375,000 is at 0%. */
exports.UAE_CORPORATE_TAX_THRESHOLD = 375_000_00; // in fils (smallest unit)
/** Standard corporate tax rate for income above the threshold. */
exports.UAE_CORPORATE_TAX_RATE = 9; // %
/** Large multinationals (Pillar Two) — minimum effective rate. */
exports.UAE_CORPORATE_TAX_RATE_LARGE_MNC = 15; // %
// ---------------------------------------------------------------------------
// UAE Emirates
// ---------------------------------------------------------------------------
exports.UAE_EMIRATES = {
    AUH: "Abu Dhabi",
    DXB: "Dubai",
    SHJ: "Sharjah",
    AJM: "Ajman",
    UAQ: "Umm Al Quwain",
    RAK: "Ras Al Khaimah",
    FUJ: "Fujairah",
};
// ---------------------------------------------------------------------------
// Tax Registration Number (TRN) validation
// ---------------------------------------------------------------------------
/**
 * UAE Tax Registration Number is a 15-digit number.
 * Format: 100XXXXXXXXXXXX (starts with 100).
 */
function isValidTRN(trn) {
    const cleaned = trn.replace(/[\s-]/g, "");
    return /^100\d{12}$/.test(cleaned);
}
/**
 * Format a TRN with standard grouping: XXX-XXXX-XXXXXXX-X
 */
function formatTRN(trn) {
    const cleaned = trn.replace(/[\s-]/g, "");
    if (!isValidTRN(cleaned)) {
        throw new Error(`Invalid UAE TRN: ${trn}`);
    }
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 14)}-${cleaned.slice(14)}`;
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
function computeUAEVAT(amount, category = UAEVATCategory.STANDARD, inclusive = false) {
    const rate = category === UAEVATCategory.STANDARD ? exports.UAE_VAT_RATE : 0;
    if (rate === 0) {
        return {
            netAmount: amount,
            vatAmount: 0,
            grossAmount: amount,
            vatCategory: category,
            vatRate: 0,
        };
    }
    if (inclusive) {
        const netAmount = Math.round(amount / (1 + rate / 100));
        const vatAmount = amount - netAmount;
        return { netAmount, vatAmount, grossAmount: amount, vatCategory: category, vatRate: rate };
    }
    const vatAmount = Math.round((amount * rate) / 100);
    return {
        netAmount: amount,
        vatAmount,
        grossAmount: amount + vatAmount,
        vatCategory: category,
        vatRate: rate,
    };
}
/**
 * Compute UAE Excise Tax for a given amount and product category.
 *
 * @param amount   - Pre-excise amount in smallest currency unit (fils).
 * @param category - Product category (e.g. "tobacco_products", "energy_drinks").
 */
function computeExciseTax(amount, category) {
    const item = exports.UAE_EXCISE_TAX_RATES.find((e) => e.category === category);
    const rate = item ? item.rate : 0;
    const exciseAmount = Math.round((amount * rate) / 100);
    return {
        netAmount: amount,
        exciseAmount,
        totalAmount: amount + exciseAmount,
        exciseRate: rate,
    };
}
/**
 * Compute UAE Corporate Tax on taxable income.
 * Income up to AED 375,000 (37,500,000 fils) is taxed at 0%.
 * Income above that is taxed at 9%.
 *
 * @param taxableIncome - Annual taxable income in fils (smallest unit).
 * @param isLargeMNC    - If true, applies 15% minimum rate (Pillar Two).
 */
function computeCorporateTax(taxableIncome, isLargeMNC = false) {
    if (taxableIncome <= 0) {
        return { taxableIncome: 0, taxAmount: 0, effectiveRate: 0 };
    }
    if (isLargeMNC) {
        const taxAmount = Math.round((taxableIncome * exports.UAE_CORPORATE_TAX_RATE_LARGE_MNC) / 100);
        return { taxableIncome, taxAmount, effectiveRate: exports.UAE_CORPORATE_TAX_RATE_LARGE_MNC };
    }
    if (taxableIncome <= exports.UAE_CORPORATE_TAX_THRESHOLD) {
        return { taxableIncome, taxAmount: 0, effectiveRate: 0 };
    }
    const taxableAboveThreshold = taxableIncome - exports.UAE_CORPORATE_TAX_THRESHOLD;
    const taxAmount = Math.round((taxableAboveThreshold * exports.UAE_CORPORATE_TAX_RATE) / 100);
    const effectiveRate = Math.round((taxAmount / taxableIncome) * 10000) / 100; // 2 decimal %
    return { taxableIncome, taxAmount, effectiveRate };
}
// ---------------------------------------------------------------------------
// Reverse Charge for UAE
// ---------------------------------------------------------------------------
/**
 * In the UAE, reverse charge applies when:
 * - Importing services from outside the UAE
 * - The recipient is VAT-registered in the UAE
 * The buyer must self-account for VAT on their return.
 */
function isUAEReverseChargeApplicable(supplierCountry, isServiceImport) {
    return supplierCountry.toUpperCase() !== "AE" && isServiceImport;
}
//# sourceMappingURL=uae-tax.js.map