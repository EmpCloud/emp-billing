// ============================================================================
// UAE TAX CONSTANTS (VAT + Excise + Corporate Tax)
// ============================================================================

// ---------------------------------------------------------------------------
// UAE VAT (introduced Jan 2018)
// Standard rate: 5%  |  Zero-rated  |  Exempt
// ---------------------------------------------------------------------------

export const UAE_VAT_RATE = 5; // %

export enum UAEVATCategory {
  STANDARD = "standard",
  ZERO_RATED = "zero_rated",
  EXEMPT = "exempt",
}

/**
 * Goods / services that are zero-rated in the UAE (VAT at 0%).
 * Zero-rated means VAT-registered businesses can still reclaim input tax.
 */
export const UAE_ZERO_RATED_CATEGORIES = [
  "international_transport",
  "export_goods",
  "export_services",
  "first_supply_residential_property",
  "education_services",
  "healthcare_services",
  "crude_oil",
  "natural_gas",
  "investment_precious_metals", // first supply
] as const;

/**
 * Goods / services that are VAT-exempt in the UAE.
 * Exempt means no VAT is charged and input tax is NOT reclaimable.
 */
export const UAE_EXEMPT_CATEGORIES = [
  "local_passenger_transport",
  "bare_land",
  "subsequent_supply_residential_property",
  "certain_financial_services",
  "life_insurance",
] as const;

// ---------------------------------------------------------------------------
// UAE Excise Tax
// ---------------------------------------------------------------------------

export interface ExciseTaxItem {
  category: string;
  rate: number; // percentage
}

export const UAE_EXCISE_TAX_RATES: ExciseTaxItem[] = [
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
export const UAE_CORPORATE_TAX_THRESHOLD = 375_000_00; // in fils (smallest unit)

/** Standard corporate tax rate for income above the threshold. */
export const UAE_CORPORATE_TAX_RATE = 9; // %

/** Large multinationals (Pillar Two) — minimum effective rate. */
export const UAE_CORPORATE_TAX_RATE_LARGE_MNC = 15; // %

// ---------------------------------------------------------------------------
// UAE Emirates
// ---------------------------------------------------------------------------

export const UAE_EMIRATES: Record<string, string> = {
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
export function isValidTRN(trn: string): boolean {
  const cleaned = trn.replace(/[\s-]/g, "");
  return /^100\d{12}$/.test(cleaned);
}

/**
 * Format a TRN with standard grouping: XXX-XXXX-XXXXXXX-X
 */
export function formatTRN(trn: string): string {
  const cleaned = trn.replace(/[\s-]/g, "");
  if (!isValidTRN(cleaned)) {
    throw new Error(`Invalid UAE TRN: ${trn}`);
  }
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 14)}-${cleaned.slice(14)}`;
}

// ---------------------------------------------------------------------------
// VAT Computation
// ---------------------------------------------------------------------------

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
export function computeUAEVAT(
  amount: number,
  category: UAEVATCategory = UAEVATCategory.STANDARD,
  inclusive: boolean = false
): UAEVATResult {
  const rate = category === UAEVATCategory.STANDARD ? UAE_VAT_RATE : 0;

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

// ---------------------------------------------------------------------------
// Excise Tax Computation
// ---------------------------------------------------------------------------

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
export function computeExciseTax(amount: number, category: string): ExciseTaxResult {
  const item = UAE_EXCISE_TAX_RATES.find((e) => e.category === category);
  const rate = item ? item.rate : 0;
  const exciseAmount = Math.round((amount * rate) / 100);

  return {
    netAmount: amount,
    exciseAmount,
    totalAmount: amount + exciseAmount,
    exciseRate: rate,
  };
}

// ---------------------------------------------------------------------------
// Corporate Tax Computation
// ---------------------------------------------------------------------------

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
export function computeCorporateTax(
  taxableIncome: number,
  isLargeMNC: boolean = false
): CorporateTaxResult {
  if (taxableIncome <= 0) {
    return { taxableIncome: 0, taxAmount: 0, effectiveRate: 0 };
  }

  if (isLargeMNC) {
    const taxAmount = Math.round((taxableIncome * UAE_CORPORATE_TAX_RATE_LARGE_MNC) / 100);
    return { taxableIncome, taxAmount, effectiveRate: UAE_CORPORATE_TAX_RATE_LARGE_MNC };
  }

  if (taxableIncome <= UAE_CORPORATE_TAX_THRESHOLD) {
    return { taxableIncome, taxAmount: 0, effectiveRate: 0 };
  }

  const taxableAboveThreshold = taxableIncome - UAE_CORPORATE_TAX_THRESHOLD;
  const taxAmount = Math.round((taxableAboveThreshold * UAE_CORPORATE_TAX_RATE) / 100);
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
export function isUAEReverseChargeApplicable(
  supplierCountry: string,
  isServiceImport: boolean
): boolean {
  return supplierCountry.toUpperCase() !== "AE" && isServiceImport;
}
