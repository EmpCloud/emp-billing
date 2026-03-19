import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Users, FileText, Receipt, TrendingUp, ShoppingBag, Building2 } from "lucide-react";
import { useGlobalSearch } from "@/api/hooks/search.hooks";
import type { GlobalSearchResult } from "@emp-billing/shared";

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: typeof Users; route: (id: string) => string }
> = {
  clients:  { label: "Clients",  icon: Users,     route: (id) => `/clients/${id}` },
  invoices: { label: "Invoices", icon: FileText,   route: (id) => `/invoices/${id}` },
  quotes:   { label: "Quotes",   icon: Receipt,    route: (id) => `/quotes/${id}` },
  expenses: { label: "Expenses", icon: TrendingUp, route: (id) => `/expenses/${id}` },
  products: { label: "Products", icon: ShoppingBag, route: (id) => `/products/${id}` },
  vendors:  { label: "Vendors",  icon: Building2,  route: (id) => `/vendors/${id}` },
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Debounce the query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useGlobalSearch(debouncedQuery);
  const results = data?.data;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (result: GlobalSearchResult) => {
      const config = CATEGORY_CONFIG[result.type + "s"] || CATEGORY_CONFIG[result.type];
      if (config) {
        navigate(config.route(result.id));
      }
      setIsOpen(false);
      setQuery("");
    },
    [navigate]
  );

  // Determine if there are any results
  const hasResults =
    results &&
    Object.values(results).some((arr: GlobalSearchResult[]) => arr.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search..."
          className="w-56 pl-8 pr-8 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {!debouncedQuery.trim() && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Type to search...
            </div>
          )}

          {debouncedQuery.trim() && isLoading && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Searching...
            </div>
          )}

          {debouncedQuery.trim() && !isLoading && !hasResults && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No results found
            </div>
          )}

          {debouncedQuery.trim() && !isLoading && hasResults && results && (
            <div className="py-1">
              {(Object.keys(CATEGORY_CONFIG) as Array<keyof typeof CATEGORY_CONFIG>).map(
                (category) => {
                  const items = results[category as keyof typeof results] as GlobalSearchResult[];
                  if (!items || items.length === 0) return null;
                  const config = CATEGORY_CONFIG[category];
                  const Icon = config.icon;
                  return (
                    <div key={category}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                        {config.label}
                      </div>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {item.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {item.subtitle}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
