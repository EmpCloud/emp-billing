import Redis from "ioredis";
import { config } from "../../config/index";
import { logger } from "../../utils/logger";

// ============================================================================
// EXCHANGE RATE SERVICE
// Fetches rates from open.er-api.com, caches in Redis (1 hour) with
// in-memory fallback when Redis is unavailable.
// ============================================================================

interface ExchangeRateResponse {
  result: string;
  rates: Record<string, number>;
}

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

// ── In-memory cache (fallback when Redis is down) ──────────────────────────
const memoryCache = new Map<string, RateCache>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const REDIS_CACHE_TTL_SECONDS = 3600; // 1 hour
const REDIS_KEY_PREFIX = "exchange_rates:";

// ── Lazy Redis client ──────────────────────────────────────────────────────
let redis: Redis | null = null;
let redisAvailable = true;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redis.on("error", (err) => {
      if (redisAvailable) {
        logger.warn("Exchange-rate Redis connection lost — falling back to in-memory cache", {
          err: err.message,
        });
        redisAvailable = false;
      }
    });

    redis.on("connect", () => {
      redisAvailable = true;
    });

    redis.connect().catch(() => {
      redisAvailable = false;
    });
  }
  return redis;
}

// ── Redis cache helpers ────────────────────────────────────────────────────

async function getFromRedis(base: string): Promise<RateCache | null> {
  if (!redisAvailable) return null;
  try {
    const client = getRedis();
    const raw = await client.get(`${REDIS_KEY_PREFIX}${base}`);
    if (!raw) return null;
    return JSON.parse(raw) as RateCache;
  } catch {
    return null;
  }
}

async function setInRedis(base: string, entry: RateCache): Promise<void> {
  if (!redisAvailable) return;
  try {
    const client = getRedis();
    await client.set(
      `${REDIS_KEY_PREFIX}${base}`,
      JSON.stringify(entry),
      "EX",
      REDIS_CACHE_TTL_SECONDS,
    );
  } catch {
    // Silently fail — in-memory cache is the fallback
  }
}

// ── Core API ───────────────────────────────────────────────────────────────

/**
 * Fetch exchange rates for a base currency.
 * Checks Redis first, then in-memory cache, then hits the external API.
 * Supports 170+ currencies via open.er-api.com free tier.
 */
export async function getExchangeRates(base: string = "USD"): Promise<Record<string, number>> {
  const upper = base.toUpperCase();

  // 1. Try Redis cache
  const redisCached = await getFromRedis(upper);
  if (redisCached && Date.now() - redisCached.fetchedAt < CACHE_TTL_MS) {
    return redisCached.rates;
  }

  // 2. Try in-memory cache
  const memoryCached = memoryCache.get(upper);
  if (memoryCached && Date.now() - memoryCached.fetchedAt < CACHE_TTL_MS) {
    return memoryCached.rates;
  }

  // 3. Fetch from API
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${upper}`);
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
    const data = (await res.json()) as ExchangeRateResponse;

    if (data.result === "success" && data.rates) {
      const entry: RateCache = { rates: data.rates, fetchedAt: Date.now() };
      // Store in both caches
      memoryCache.set(upper, entry);
      await setInRedis(upper, entry);
      return data.rates;
    }
    throw new Error("Invalid API response");
  } catch (err) {
    // Fallback to stale Redis cache
    if (redisCached) return redisCached.rates;
    // Fallback to stale in-memory cache
    if (memoryCached) return memoryCached.rates;
    throw err;
  }
}

/**
 * Convert an amount (in smallest currency unit) from one currency to another.
 * Returns the converted amount in the target currency's smallest unit.
 */
export async function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return amount;

  const rates = await getExchangeRates(from);
  const rate = rates[to];
  if (!rate) throw new Error(`No exchange rate found for ${to}`);

  return Math.round(amount * rate);
}

/**
 * Get the exchange rate between two currencies.
 * Returns a single numeric rate (e.g., 1 USD = 83.12 INR → returns 83.12).
 */
export async function getRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return 1;

  const rates = await getExchangeRates(from);
  const rate = rates[to];
  if (!rate) throw new Error(`No exchange rate found for ${to}`);
  return rate;
}

/**
 * Return all currency codes the API supports.
 */
export async function getSupportedCurrencies(): Promise<string[]> {
  const rates = await getExchangeRates("USD");
  return Object.keys(rates).sort();
}

/**
 * Clear both Redis and in-memory caches (useful for testing).
 */
export async function clearCache(): Promise<void> {
  memoryCache.clear();
  if (redisAvailable) {
    try {
      const client = getRedis();
      const keys = await client.keys(`${REDIS_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // Ignore Redis errors during cache clear
    }
  }
}
