import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../client";

const CURRENCY_KEY = "currency";

export function useExchangeRates(base: string = "USD") {
  return useQuery({
    queryKey: [CURRENCY_KEY, "rates", base],
    queryFn: () => apiGet<{ base: string; rates: Record<string, number> }>("/currency/rates", { base }),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useSupportedCurrencies() {
  return useQuery({
    queryKey: [CURRENCY_KEY, "currencies"],
    queryFn: () => apiGet<string[]>("/currency/currencies"),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
