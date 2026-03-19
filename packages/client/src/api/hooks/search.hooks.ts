import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../client";
import type { GlobalSearchResults } from "@emp-billing/shared";

const SEARCH_KEY = "global-search";

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: [SEARCH_KEY, query],
    queryFn: () => apiGet<GlobalSearchResults>("/search", { q: query }),
    enabled: query.trim().length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });
}
