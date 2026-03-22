// ============================================================================
// BILLING CONSTANTS
// ============================================================================

export const PAYMENT_TERMS = [
  { label: "Due on receipt", days: 0 },
  { label: "Net 7", days: 7 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
  { label: "Net 60", days: 60 },
  { label: "Net 90", days: 90 },
] as const;

// ============================================================================
// CURRENCY DEFINITIONS
// Comprehensive list covering major world currencies.
// `decimals: 0` marks zero-decimal currencies (JPY, KRW, VND, etc.)
// ============================================================================

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Locale used for number formatting (BCP 47). Defaults to "en-US". */
  locale?: string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  // ── Major currencies ────────────────────────────────────────────────────
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2, locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", decimals: 2, locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", decimals: 2, locale: "en-GB" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", decimals: 0, locale: "ja-JP" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan", decimals: 2, locale: "zh-CN" },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", decimals: 2, locale: "de-CH" },

  // ── Asia-Pacific ────────────────────────────────────────────────────────
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee", decimals: 2, locale: "en-IN" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2, locale: "en-AU" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", decimals: 2, locale: "en-SG" },
  HKD: { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", decimals: 2 },
  NZD: { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", decimals: 2 },
  KRW: { code: "KRW", symbol: "₩", name: "South Korean Won", decimals: 0, locale: "ko-KR" },
  TWD: { code: "TWD", symbol: "NT$", name: "New Taiwan Dollar", decimals: 2 },
  THB: { code: "THB", symbol: "฿", name: "Thai Baht", decimals: 2 },
  PHP: { code: "PHP", symbol: "₱", name: "Philippine Peso", decimals: 2 },
  IDR: { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", decimals: 2 },
  MYR: { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", decimals: 2 },
  VND: { code: "VND", symbol: "₫", name: "Vietnamese Dong", decimals: 0, locale: "vi-VN" },
  BDT: { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", decimals: 2 },
  PKR: { code: "PKR", symbol: "₨", name: "Pakistani Rupee", decimals: 2 },
  LKR: { code: "LKR", symbol: "Rs", name: "Sri Lankan Rupee", decimals: 2 },
  NPR: { code: "NPR", symbol: "₨", name: "Nepalese Rupee", decimals: 2 },
  MMK: { code: "MMK", symbol: "K", name: "Myanmar Kyat", decimals: 2 },

  // ── Americas ────────────────────────────────────────────────────────────
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", decimals: 2, locale: "en-CA" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real", decimals: 2, locale: "pt-BR" },
  MXN: { code: "MXN", symbol: "MX$", name: "Mexican Peso", decimals: 2, locale: "es-MX" },
  ARS: { code: "ARS", symbol: "AR$", name: "Argentine Peso", decimals: 2 },
  CLP: { code: "CLP", symbol: "CL$", name: "Chilean Peso", decimals: 0 },
  COP: { code: "COP", symbol: "CO$", name: "Colombian Peso", decimals: 2 },
  PEN: { code: "PEN", symbol: "S/", name: "Peruvian Sol", decimals: 2 },
  UYU: { code: "UYU", symbol: "$U", name: "Uruguayan Peso", decimals: 2 },

  // ── Middle East & Africa ────────────────────────────────────────────────
  AED: { code: "AED", symbol: "د.إ", name: "UAE Dirham", decimals: 2 },
  SAR: { code: "SAR", symbol: "﷼", name: "Saudi Riyal", decimals: 2 },
  QAR: { code: "QAR", symbol: "﷼", name: "Qatari Riyal", decimals: 2 },
  KWD: { code: "KWD", symbol: "د.ك", name: "Kuwaiti Dinar", decimals: 3 },
  BHD: { code: "BHD", symbol: "BD", name: "Bahraini Dinar", decimals: 3 },
  OMR: { code: "OMR", symbol: "﷼", name: "Omani Rial", decimals: 3 },
  ILS: { code: "ILS", symbol: "₪", name: "Israeli New Shekel", decimals: 2 },
  TRY: { code: "TRY", symbol: "₺", name: "Turkish Lira", decimals: 2 },
  EGP: { code: "EGP", symbol: "E£", name: "Egyptian Pound", decimals: 2 },
  ZAR: { code: "ZAR", symbol: "R", name: "South African Rand", decimals: 2, locale: "en-ZA" },
  NGN: { code: "NGN", symbol: "₦", name: "Nigerian Naira", decimals: 2 },
  KES: { code: "KES", symbol: "KSh", name: "Kenyan Shilling", decimals: 2 },
  GHS: { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi", decimals: 2 },
  MAD: { code: "MAD", symbol: "MAD", name: "Moroccan Dirham", decimals: 2 },
  TZS: { code: "TZS", symbol: "TSh", name: "Tanzanian Shilling", decimals: 2 },
  UGX: { code: "UGX", symbol: "USh", name: "Ugandan Shilling", decimals: 0 },

  // ── Europe (non-EUR) ────────────────────────────────────────────────────
  SEK: { code: "SEK", symbol: "kr", name: "Swedish Krona", decimals: 2, locale: "sv-SE" },
  NOK: { code: "NOK", symbol: "kr", name: "Norwegian Krone", decimals: 2, locale: "nb-NO" },
  DKK: { code: "DKK", symbol: "kr", name: "Danish Krone", decimals: 2, locale: "da-DK" },
  PLN: { code: "PLN", symbol: "zł", name: "Polish Zloty", decimals: 2, locale: "pl-PL" },
  CZK: { code: "CZK", symbol: "Kč", name: "Czech Koruna", decimals: 2, locale: "cs-CZ" },
  HUF: { code: "HUF", symbol: "Ft", name: "Hungarian Forint", decimals: 2, locale: "hu-HU" },
  RON: { code: "RON", symbol: "lei", name: "Romanian Leu", decimals: 2 },
  BGN: { code: "BGN", symbol: "лв", name: "Bulgarian Lev", decimals: 2 },
  HRK: { code: "HRK", symbol: "kn", name: "Croatian Kuna", decimals: 2 },
  RUB: { code: "RUB", symbol: "₽", name: "Russian Ruble", decimals: 2, locale: "ru-RU" },
  UAH: { code: "UAH", symbol: "₴", name: "Ukrainian Hryvnia", decimals: 2 },
  ISK: { code: "ISK", symbol: "kr", name: "Icelandic Krona", decimals: 0 },
  RSD: { code: "RSD", symbol: "din.", name: "Serbian Dinar", decimals: 2 },
};

// ── Zero-decimal currency set (for quick lookups) ──────────────────────────
export const ZERO_DECIMAL_CURRENCIES = new Set(
  Object.values(CURRENCIES)
    .filter((c) => c.decimals === 0)
    .map((c) => c.code),
);

// ── Three-decimal currencies ───────────────────────────────────────────────
export const THREE_DECIMAL_CURRENCIES = new Set(
  Object.values(CURRENCIES)
    .filter((c) => c.decimals === 3)
    .map((c) => c.code),
);

// ============================================================================
// MONEY FORMATTING & CONVERSION UTILITIES
// ============================================================================

/**
 * Format an amount stored in the smallest currency unit to a display string
 * with the correct symbol, decimal places, and grouping for the currency.
 *
 * Examples:
 *   formatMoney(150000, "USD")  → "$1,500.00"
 *   formatMoney(150000, "INR")  → "₹1,500.00"  (uses en-IN grouping 1,500.00)
 *   formatMoney(1500, "JPY")   → "¥1,500"      (zero-decimal)
 *   formatMoney(1500000, "KWD")→ "د.ك1,500.000" (three-decimal)
 */
export function formatMoney(amountInSmallestUnit: number, currencyCode: string): string {
  const currency = CURRENCIES[currencyCode.toUpperCase()] ?? {
    code: currencyCode.toUpperCase(),
    symbol: currencyCode.toUpperCase(),
    name: currencyCode,
    decimals: 2,
  };

  const divisor = Math.pow(10, currency.decimals);
  const value = amountInSmallestUnit / divisor;
  const locale = currency.locale ?? "en-US";

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  });

  return `${currency.symbol}${formatted}`;
}

/**
 * Convert a human-readable amount to the smallest currency unit.
 * e.g., toSmallestUnit(15.99, "USD") → 1599
 *        toSmallestUnit(1500, "JPY")  → 1500
 */
export function toSmallestUnit(amount: number, currencyCode: string): number {
  const currency = CURRENCIES[currencyCode.toUpperCase()] ?? { decimals: 2 };
  return Math.round(amount * Math.pow(10, currency.decimals));
}

/**
 * Convert smallest-unit amount back to a human-readable number.
 * e.g., fromSmallestUnit(1599, "USD") → 15.99
 *        fromSmallestUnit(1500, "JPY") → 1500
 */
export function fromSmallestUnit(amountInSmallestUnit: number, currencyCode: string): number {
  const currency = CURRENCIES[currencyCode.toUpperCase()] ?? { decimals: 2 };
  return amountInSmallestUnit / Math.pow(10, currency.decimals);
}

/**
 * Get the number of decimal places for a currency.
 */
export function getCurrencyDecimals(currencyCode: string): number {
  return CURRENCIES[currencyCode.toUpperCase()]?.decimals ?? 2;
}

/**
 * Check if a currency code is a known zero-decimal currency.
 */
export function isZeroDecimalCurrency(currencyCode: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase());
}
