"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSearch = globalSearch;
const index_1 = require("../../db/adapters/index");
const MAX_PER_CATEGORY = 5;
async function globalSearch(orgId, query) {
    if (!query || query.trim().length === 0) {
        return { clients: [], invoices: [], quotes: [], expenses: [], products: [], vendors: [] };
    }
    const q = query.trim().toLowerCase();
    const db = await (0, index_1.getDB)();
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
async function searchClients(db, orgId, q) {
    const all = await db.findMany("clients", {
        where: { org_id: orgId },
        columns: ["id", "name", "email", "display_name"],
        limit: 100,
    });
    return all
        .filter((c) => c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.display_name || "").toLowerCase().includes(q))
        .slice(0, MAX_PER_CATEGORY)
        .map((c) => ({
        id: c.id,
        type: "client",
        title: c.name,
        subtitle: c.email,
    }));
}
async function searchInvoices(db, orgId, q) {
    const all = await db.findMany("invoices", {
        where: { org_id: orgId },
        columns: ["id", "invoice_number", "status", "total", "currency"],
        limit: 100,
    });
    return all
        .filter((i) => i.invoice_number.toLowerCase().includes(q))
        .slice(0, MAX_PER_CATEGORY)
        .map((i) => ({
        id: i.id,
        type: "invoice",
        title: i.invoice_number,
        subtitle: `${i.status} - ${i.currency} ${Number(i.total) / 100}`,
    }));
}
async function searchQuotes(db, orgId, q) {
    const all = await db.findMany("quotes", {
        where: { org_id: orgId },
        columns: ["id", "quote_number", "status", "total", "currency"],
        limit: 100,
    });
    return all
        .filter((qu) => qu.quote_number.toLowerCase().includes(q))
        .slice(0, MAX_PER_CATEGORY)
        .map((qu) => ({
        id: qu.id,
        type: "quote",
        title: qu.quote_number,
        subtitle: `${qu.status} - ${qu.currency} ${Number(qu.total) / 100}`,
    }));
}
async function searchExpenses(db, orgId, q) {
    const all = await db.findMany("expenses", {
        where: { org_id: orgId },
        columns: ["id", "description", "amount", "currency", "status"],
        limit: 100,
    });
    return all
        .filter((e) => e.description.toLowerCase().includes(q))
        .slice(0, MAX_PER_CATEGORY)
        .map((e) => ({
        id: e.id,
        type: "expense",
        title: e.description.slice(0, 60),
        subtitle: `${e.status} - ${e.currency} ${Number(e.amount) / 100}`,
    }));
}
async function searchProducts(db, orgId, q) {
    const all = await db.findMany("products", {
        where: { org_id: orgId },
        columns: ["id", "name", "sku", "type", "rate"],
        limit: 100,
    });
    return all
        .filter((p) => p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q))
        .slice(0, MAX_PER_CATEGORY)
        .map((p) => ({
        id: p.id,
        type: "product",
        title: p.name,
        subtitle: p.sku ? `SKU: ${p.sku}` : p.type,
    }));
}
async function searchVendors(db, orgId, q) {
    const all = await db.findMany("vendors", {
        where: { org_id: orgId },
        columns: ["id", "name", "email", "company"],
        limit: 100,
    });
    return all
        .filter((v) => v.name.toLowerCase().includes(q) ||
        (v.email || "").toLowerCase().includes(q) ||
        (v.company || "").toLowerCase().includes(q))
        .slice(0, MAX_PER_CATEGORY)
        .map((v) => ({
        id: v.id,
        type: "vendor",
        title: v.name,
        subtitle: v.company || v.email || "",
    }));
}
//# sourceMappingURL=search.service.js.map