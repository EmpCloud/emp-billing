import { getDB } from "../../db/adapters/index";

// ============================================================================
// GLOBAL SEARCH SERVICE
// Searches across multiple entity types and returns top 5 results per category.
// ============================================================================

export interface SearchResult {
  id: string;
  type: "client" | "invoice" | "quote" | "expense" | "product" | "vendor";
  title: string;
  subtitle: string;
}

export interface SearchResults {
  clients: SearchResult[];
  invoices: SearchResult[];
  quotes: SearchResult[];
  expenses: SearchResult[];
  products: SearchResult[];
  vendors: SearchResult[];
}

const MAX_PER_CATEGORY = 5;

export async function globalSearch(orgId: string, query: string): Promise<SearchResults> {
  if (!query || query.trim().length === 0) {
    return { clients: [], invoices: [], quotes: [], expenses: [], products: [], vendors: [] };
  }

  const q = query.trim().toLowerCase();
  const db = await getDB();

  // Run all searches in parallel
  const [clients, invoices, quotes, expenses, products, vendors] = await Promise.all([
    searchClients(db, orgId, q),
    searchInvoices(db, orgId, q),
    searchQuotes(db, orgId, q),
    searchExpenses(db, orgId, q),
    searchProducts(db, orgId, q),
    searchVendors(db, orgId, q),
  ]);

  return { clients, invoices, quotes, expenses, products, vendors };
}

async function searchClients(db: Awaited<ReturnType<typeof getDB>>, orgId: string, q: string): Promise<SearchResult[]> {
  const all = await db.findMany<Record<string, unknown>>("clients", {
    where: { org_id: orgId },
    columns: ["id", "name", "email", "display_name"],
    limit: 100,
  });

  return all
    .filter(
      (c) =>
        (c.name as string).toLowerCase().includes(q) ||
        (c.email as string).toLowerCase().includes(q) ||
        ((c.display_name as string) || "").toLowerCase().includes(q)
    )
    .slice(0, MAX_PER_CATEGORY)
    .map((c) => ({
      id: c.id as string,
      type: "client" as const,
      title: c.name as string,
      subtitle: c.email as string,
    }));
}

async function searchInvoices(db: Awaited<ReturnType<typeof getDB>>, orgId: string, q: string): Promise<SearchResult[]> {
  const all = await db.findMany<Record<string, unknown>>("invoices", {
    where: { org_id: orgId },
    columns: ["id", "invoice_number", "status", "total", "currency"],
    limit: 100,
  });

  return all
    .filter((i) => (i.invoice_number as string).toLowerCase().includes(q))
    .slice(0, MAX_PER_CATEGORY)
    .map((i) => ({
      id: i.id as string,
      type: "invoice" as const,
      title: i.invoice_number as string,
      subtitle: `${i.status} - ${i.currency} ${Number(i.total) / 100}`,
    }));
}

async function searchQuotes(db: Awaited<ReturnType<typeof getDB>>, orgId: string, q: string): Promise<SearchResult[]> {
  const all = await db.findMany<Record<string, unknown>>("quotes", {
    where: { org_id: orgId },
    columns: ["id", "quote_number", "status", "total", "currency"],
    limit: 100,
  });

  return all
    .filter((qu) => (qu.quote_number as string).toLowerCase().includes(q))
    .slice(0, MAX_PER_CATEGORY)
    .map((qu) => ({
      id: qu.id as string,
      type: "quote" as const,
      title: qu.quote_number as string,
      subtitle: `${qu.status} - ${qu.currency} ${Number(qu.total) / 100}`,
    }));
}

async function searchExpenses(db: Awaited<ReturnType<typeof getDB>>, orgId: string, q: string): Promise<SearchResult[]> {
  const all = await db.findMany<Record<string, unknown>>("expenses", {
    where: { org_id: orgId },
    columns: ["id", "description", "amount", "currency", "status"],
    limit: 100,
  });

  return all
    .filter((e) => (e.description as string).toLowerCase().includes(q))
    .slice(0, MAX_PER_CATEGORY)
    .map((e) => ({
      id: e.id as string,
      type: "expense" as const,
      title: (e.description as string).slice(0, 60),
      subtitle: `${e.status} - ${e.currency} ${Number(e.amount) / 100}`,
    }));
}

async function searchProducts(db: Awaited<ReturnType<typeof getDB>>, orgId: string, q: string): Promise<SearchResult[]> {
  const all = await db.findMany<Record<string, unknown>>("products", {
    where: { org_id: orgId },
    columns: ["id", "name", "sku", "type", "rate"],
    limit: 100,
  });

  return all
    .filter(
      (p) =>
        (p.name as string).toLowerCase().includes(q) ||
        ((p.sku as string) || "").toLowerCase().includes(q)
    )
    .slice(0, MAX_PER_CATEGORY)
    .map((p) => ({
      id: p.id as string,
      type: "product" as const,
      title: p.name as string,
      subtitle: p.sku ? `SKU: ${p.sku}` : (p.type as string),
    }));
}

async function searchVendors(db: Awaited<ReturnType<typeof getDB>>, orgId: string, q: string): Promise<SearchResult[]> {
  const all = await db.findMany<Record<string, unknown>>("vendors", {
    where: { org_id: orgId },
    columns: ["id", "name", "email", "company"],
    limit: 100,
  });

  return all
    .filter(
      (v) =>
        (v.name as string).toLowerCase().includes(q) ||
        ((v.email as string) || "").toLowerCase().includes(q) ||
        ((v.company as string) || "").toLowerCase().includes(q)
    )
    .slice(0, MAX_PER_CATEGORY)
    .map((v) => ({
      id: v.id as string,
      type: "vendor" as const,
      title: v.name as string,
      subtitle: (v.company as string) || (v.email as string) || "",
    }));
}
