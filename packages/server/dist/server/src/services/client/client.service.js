"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listClients = listClients;
exports.getClient = getClient;
exports.createClient = createClient;
exports.updateClient = updateClient;
exports.deleteClient = deleteClient;
exports.addContact = addContact;
exports.listContacts = listContacts;
exports.getClientStatement = getClientStatement;
exports.getClientBalance = getClientBalance;
exports.updatePaymentMethod = updatePaymentMethod;
exports.removePaymentMethod = removePaymentMethod;
const uuid_1 = require("uuid");
const index_1 = require("../../db/adapters/index");
const AppError_1 = require("../../utils/AppError");
const shared_1 = require("@emp-billing/shared");
// ============================================================================
// CLIENT SERVICE
// ============================================================================
async function listClients(orgId, opts) {
    const db = await (0, index_1.getDB)();
    const where = { org_id: orgId };
    if (opts.isActive !== undefined)
        where.is_active = opts.isActive;
    const result = await db.findPaginated("clients", {
        where,
        page: opts.page,
        limit: opts.limit,
        orderBy: [{ column: "name", direction: "asc" }],
    });
    let data = result.data;
    if (opts.search) {
        const q = opts.search.toLowerCase();
        data = data.filter((c) => c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.displayName.toLowerCase().includes(q));
    }
    if (opts.tags) {
        const filterTags = opts.tags.split(",").map((t) => t.trim().toLowerCase());
        data = data.filter((c) => {
            const clientTags = Array.isArray(c.tags) ? c.tags : [];
            return filterTags.some((t) => clientTags.includes(t));
        });
    }
    return { ...result, data };
}
async function getClient(orgId, id) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", id, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    const contacts = await db.findMany("client_contacts", {
        where: { client_id: id },
        orderBy: [{ column: "is_primary", direction: "desc" }],
    });
    return { ...client, contacts };
}
async function createClient(orgId, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findOne("clients", { org_id: orgId, email: input.email });
    if (existing)
        throw (0, AppError_1.ConflictError)(`A client with email '${input.email}' already exists`);
    const clientId = (0, uuid_1.v4)();
    const now = new Date();
    const { contacts, ...clientData } = input;
    await db.create("clients", {
        id: clientId,
        orgId,
        ...clientData,
        billingAddress: clientData.billingAddress ? JSON.stringify(clientData.billingAddress) : null,
        shippingAddress: clientData.shippingAddress ? JSON.stringify(clientData.shippingAddress) : null,
        tags: JSON.stringify(clientData.tags ?? []),
        customFields: clientData.customFields ? JSON.stringify(clientData.customFields) : null,
        outstandingBalance: 0,
        totalBilled: 0,
        totalPaid: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });
    // Create contacts
    if (contacts?.length) {
        await db.createMany("client_contacts", contacts.map((c) => ({
            id: (0, uuid_1.v4)(),
            clientId,
            orgId,
            ...c,
            createdAt: now,
            updatedAt: now,
        })));
    }
    return getClient(orgId, clientId);
}
async function updateClient(orgId, id, input) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("clients", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Client");
    if (input.email && input.email !== existing.email) {
        const conflict = await db.findOne("clients", { org_id: orgId, email: input.email });
        if (conflict)
            throw (0, AppError_1.ConflictError)(`A client with email '${input.email}' already exists`);
    }
    const { contacts, ...clientData } = input;
    const updateData = { ...clientData, updatedAt: new Date() };
    if (clientData.billingAddress)
        updateData.billingAddress = JSON.stringify(clientData.billingAddress);
    if (clientData.shippingAddress)
        updateData.shippingAddress = JSON.stringify(clientData.shippingAddress);
    if (clientData.tags)
        updateData.tags = JSON.stringify(clientData.tags);
    if (clientData.customFields)
        updateData.customFields = JSON.stringify(clientData.customFields);
    await db.update("clients", id, updateData, orgId);
    return getClient(orgId, id);
}
async function deleteClient(orgId, id) {
    const db = await (0, index_1.getDB)();
    const existing = await db.findById("clients", id, orgId);
    if (!existing)
        throw (0, AppError_1.NotFoundError)("Client");
    await db.softDelete("clients", id, orgId);
}
// ── Contacts ─────────────────────────────────────────────────────────────────
async function addContact(orgId, clientId, input) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // If new contact is primary, demote others
    if (input.isPrimary) {
        await db.updateMany("client_contacts", { client_id: clientId }, { is_primary: false, updated_at: new Date() });
    }
    const now = new Date();
    const { id: _inputId, ...contactData } = input;
    return db.create("client_contacts", {
        id: (0, uuid_1.v4)(),
        clientId,
        orgId,
        ...contactData,
        createdAt: now,
        updatedAt: now,
    });
}
async function listContacts(orgId, clientId) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    return db.findMany("client_contacts", {
        where: { client_id: clientId },
        orderBy: [{ column: "is_primary", direction: "desc" }],
    });
}
async function getClientStatement(orgId, clientId, from, to) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    // Invoices
    const invoices = await db.findMany("invoices", {
        where: { org_id: orgId, client_id: clientId },
        orderBy: [{ column: "issue_date", direction: "asc" }],
    });
    // Payments
    const payments = await db.findMany("payments", {
        where: { org_id: orgId, client_id: clientId },
        orderBy: [{ column: "date", direction: "asc" }],
    });
    const entries = [];
    let balance = 0;
    // Merge and sort
    const allEvents = [
        ...invoices
            .filter((i) => new Date(i.issueDate) >= from && new Date(i.issueDate) <= to)
            .map((i) => ({ type: "invoice", date: new Date(i.issueDate), data: i })),
        ...payments
            .filter((p) => new Date(p.date) >= from && new Date(p.date) <= to)
            .map((p) => ({ type: "payment", date: new Date(p.date), data: p })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const event of allEvents) {
        if (event.type === "invoice") {
            const inv = event.data;
            const amount = inv.total;
            balance += amount;
            entries.push({
                date: event.date,
                type: "invoice",
                number: inv.invoiceNumber,
                description: `Invoice ${inv.invoiceNumber}`,
                debit: amount,
                credit: 0,
                balance,
            });
        }
        else {
            const pay = event.data;
            const amount = pay.amount;
            balance -= amount;
            entries.push({
                date: event.date,
                type: "payment",
                number: pay.paymentNumber,
                description: `Payment ${pay.paymentNumber}`,
                debit: 0,
                credit: amount,
                balance,
            });
        }
    }
    return {
        client,
        entries,
        openingBalance: 0,
        closingBalance: balance,
        currency: client.currency,
    };
}
// ── Balance ─────────────────────────────────────────────────────────────────
async function getClientBalance(orgId, clientId) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    return {
        clientId,
        outstandingBalance: client.outstandingBalance,
        totalBilled: client.totalBilled,
        totalPaid: client.totalPaid,
        currency: client.currency,
        formatted: {
            outstandingBalance: (0, shared_1.formatMoney)(client.outstandingBalance, client.currency),
            totalBilled: (0, shared_1.formatMoney)(client.totalBilled, client.currency),
            totalPaid: (0, shared_1.formatMoney)(client.totalPaid, client.currency),
        },
    };
}
// ── Payment Method ───────────────────────────────────────────────────────────
async function updatePaymentMethod(orgId, clientId, data) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    await db.update("clients", clientId, {
        paymentGateway: data.paymentGateway,
        paymentMethodId: data.paymentMethodId,
        paymentMethodLast4: data.last4,
        paymentMethodBrand: data.brand,
        updatedAt: new Date(),
    }, orgId);
    return (await db.findById("clients", clientId, orgId));
}
async function removePaymentMethod(orgId, clientId) {
    const db = await (0, index_1.getDB)();
    const client = await db.findById("clients", clientId, orgId);
    if (!client)
        throw (0, AppError_1.NotFoundError)("Client");
    await db.update("clients", clientId, {
        paymentGateway: null,
        paymentMethodId: null,
        paymentMethodLast4: null,
        paymentMethodBrand: null,
        updatedAt: new Date(),
    }, orgId);
    return (await db.findById("clients", clientId, orgId));
}
//# sourceMappingURL=client.service.js.map