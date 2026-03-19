interface ExchangeRateResponse {
  result: string;
  rates: Record<string, number>;
}

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

const cache = new Map<string, RateCache>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function getExchangeRates(base: string = "USD"): Promise<Record<string, number>> {
  const upper = base.toUpperCase();
  const cached = cache.get(upper);

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.rates;
  }

  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${upper}`);
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
    const data = (await res.json()) as ExchangeRateResponse;

    if (data.result === "success" && data.rates) {
      const entry: RateCache = { rates: data.rates, fetchedAt: Date.now() };
      cache.set(upper, entry);
      return data.rates;
    }
    throw new Error("Invalid API response");
  } catch (err) {
    // Return stale cache if available
    if (cached) return cached.rates;
    throw err;
  }
}

export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) return amount;

  const rates = await getExchangeRates(fromCurrency.toUpperCase());
  const rate = rates[toCurrency.toUpperCase()];
  if (!rate) throw new Error(`No exchange rate found for ${toCurrency}`);

  return Math.round(amount * rate);
}

export async function getSupportedCurrencies(): Promise<string[]> {
  const rates = await getExchangeRates("USD");
  return Object.keys(rates).sort();
}

export function clearCache(): void {
  cache.clear();
}
