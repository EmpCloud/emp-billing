"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seed = seed;
const uuid_1 = require("uuid");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dayjs_1 = __importDefault(require("dayjs"));
// ============================================================================
// SEED — Demo data for development / testing
// ============================================================================
async function seed(knex) {
    // Wipe in reverse FK order
    await knex("audit_logs").del();
    await knex("client_portal_access").del();
    await knex("webhook_deliveries").del();
    await knex("webhooks").del();
    await knex("recurring_executions").del();
    await knex("recurring_profiles").del();
    await knex("expenses").del();
    await knex("expense_categories").del();
    await knex("credit_note_items").del();
    await knex("credit_notes").del();
    await knex("payment_allocations").del();
    await knex("payments").del();
    await knex("quote_items").del();
    await knex("quotes").del();
    await knex("invoice_items").del();
    await knex("invoices").del();
    await knex("products").del();
    await knex("tax_rates").del();
    await knex("client_contacts").del();
    await knex("clients").del();
    await knex("refresh_tokens").del();
    await knex("users").del();
    await knex("organizations").del();
    const orgId = (0, uuid_1.v4)();
    const userId = (0, uuid_1.v4)();
    const now = new Date();
    // ── org ────────────────────────────────────────────────────────────────────
    await knex("organizations").insert({
        id: orgId,
        name: "Acme Corp",
        legal_name: "Acme Corporation Pvt Ltd",
        email: "billing@acme.com",
        phone: "+91 98765 43210",
        address: JSON.stringify({
            line1: "123 MG Road",
            city: "Bengaluru",
            state: "Karnataka",
            postalCode: "560001",
            country: "IN",
        }),
        tax_id: "29AADCA2945B1ZE",
        default_currency: "INR",
        country: "IN",
        invoice_prefix: "INV",
        invoice_next_number: 1,
        quote_prefix: "QTE",
        quote_next_number: 1,
        default_payment_terms: 30,
        is_active: true,
        created_at: now,
        updated_at: now,
    });
    // ── owner user ─────────────────────────────────────────────────────────────
    const passwordHash = await bcryptjs_1.default.hash("Admin@123", 12);
    await knex("users").insert({
        id: userId,
        org_id: orgId,
        email: "admin@acme.com",
        password_hash: passwordHash,
        first_name: "Arjun",
        last_name: "Sharma",
        role: "owner",
        is_active: true,
        email_verified: true,
        created_at: now,
        updated_at: now,
    });
    // ── tax rates ──────────────────────────────────────────────────────────────
    const gst18Id = (0, uuid_1.v4)();
    const gst5Id = (0, uuid_1.v4)();
    await knex("tax_rates").insert([
        {
            id: gst18Id,
            org_id: orgId,
            name: "GST 18%",
            type: "gst",
            rate: 18,
            is_compound: false,
            components: JSON.stringify([{ name: "CGST", rate: 9 }, { name: "SGST", rate: 9 }]),
            is_default: true,
            is_active: true,
            created_at: now,
            updated_at: now,
        },
        {
            id: gst5Id,
            org_id: orgId,
            name: "GST 5%",
            type: "gst",
            rate: 5,
            is_compound: false,
            components: JSON.stringify([{ name: "CGST", rate: 2.5 }, { name: "SGST", rate: 2.5 }]),
            is_default: false,
            is_active: true,
            created_at: now,
            updated_at: now,
        },
    ]);
    // ── products ───────────────────────────────────────────────────────────────
    await knex("products").insert([
        {
            id: (0, uuid_1.v4)(),
            org_id: orgId,
            name: "Web Development",
            description: "Custom web application development",
            type: "service",
            unit: "hour",
            rate: 500000, // ₹5000/hr in paise
            tax_rate_id: gst18Id,
            is_active: true,
            created_at: now,
            updated_at: now,
        },
        {
            id: (0, uuid_1.v4)(),
            org_id: orgId,
            name: "UI/UX Design",
            description: "User interface and experience design",
            type: "service",
            unit: "hour",
            rate: 300000, // ₹3000/hr
            tax_rate_id: gst18Id,
            is_active: true,
            created_at: now,
            updated_at: now,
        },
    ]);
    // ── clients ────────────────────────────────────────────────────────────────
    const clientId = (0, uuid_1.v4)();
    await knex("clients").insert({
        id: clientId,
        org_id: orgId,
        name: "Tata Technologies",
        display_name: "Tata Technologies Ltd",
        email: "accounts@tatatech.com",
        phone: "+91 99000 12345",
        tax_id: "27AABCT3518Q1ZE",
        billing_address: JSON.stringify({
            line1: "Tata Centre, 43 Jawaharlal Nehru Road",
            city: "Mumbai",
            state: "Maharashtra",
            postalCode: "400001",
            country: "IN",
        }),
        currency: "INR",
        payment_terms: 30,
        tags: JSON.stringify(["enterprise", "technology"]),
        outstanding_balance: 0,
        total_billed: 0,
        total_paid: 0,
        portal_enabled: false,
        is_active: true,
        created_at: now,
        updated_at: now,
    });
    // ── expense categories ─────────────────────────────────────────────────────
    const travelCatId = (0, uuid_1.v4)();
    const softwareCatId = (0, uuid_1.v4)();
    const officeCatId = (0, uuid_1.v4)();
    const mealsCatId = (0, uuid_1.v4)();
    await knex("expense_categories").insert([
        { id: travelCatId, org_id: orgId, name: "Travel", is_active: true, created_at: now, updated_at: now },
        { id: softwareCatId, org_id: orgId, name: "Software & Subscriptions", is_active: true, created_at: now, updated_at: now },
        { id: officeCatId, org_id: orgId, name: "Office Supplies", is_active: true, created_at: now, updated_at: now },
        { id: mealsCatId, org_id: orgId, name: "Meals & Entertainment", is_active: true, created_at: now, updated_at: now },
    ]);
    // ── additional clients ──────────────────────────────────────────────────────
    const client2Id = (0, uuid_1.v4)();
    const client3Id = (0, uuid_1.v4)();
    const client4Id = (0, uuid_1.v4)();
    await knex("clients").insert([
        {
            id: client2Id, org_id: orgId, name: "Infosys", display_name: "Infosys Ltd",
            email: "ap@infosys.com", phone: "+91 80 2852 0261",
            tax_id: "29AABCI0582B1ZG",
            billing_address: JSON.stringify({ line1: "Electronic City", city: "Bengaluru", state: "Karnataka", postalCode: "560100", country: "IN" }),
            currency: "INR", payment_terms: 45,
            tags: JSON.stringify(["enterprise", "IT"]),
            outstanding_balance: 0, total_billed: 0, total_paid: 0,
            portal_enabled: false, is_active: true, created_at: now, updated_at: now,
        },
        {
            id: client3Id, org_id: orgId, name: "Freshworks", display_name: "Freshworks Inc",
            email: "accounts@freshworks.com", phone: "+91 44 6665 5500",
            tax_id: "33AADCF2960E1ZB",
            billing_address: JSON.stringify({ line1: "Global Infocity", city: "Chennai", state: "Tamil Nadu", postalCode: "600096", country: "IN" }),
            currency: "INR", payment_terms: 30,
            tags: JSON.stringify(["startup", "SaaS"]),
            outstanding_balance: 0, total_billed: 0, total_paid: 0,
            portal_enabled: false, is_active: true, created_at: now, updated_at: now,
        },
        {
            id: client4Id, org_id: orgId, name: "Zoho Corp", display_name: "Zoho Corporation Pvt Ltd",
            email: "invoices@zohocorp.com", phone: "+91 44 7181 7070",
            tax_id: "33AAECZ6880N1ZA",
            billing_address: JSON.stringify({ line1: "Estancia IT Park", city: "Chennai", state: "Tamil Nadu", postalCode: "600119", country: "IN" }),
            currency: "INR", payment_terms: 15,
            tags: JSON.stringify(["enterprise", "SaaS"]),
            outstanding_balance: 0, total_billed: 0, total_paid: 0,
            portal_enabled: false, is_active: true, created_at: now, updated_at: now,
        },
    ]);
    // ── sample invoices ─────────────────────────────────────────────────────────
    const invoice1Id = (0, uuid_1.v4)(); // PAID — Tata Technologies
    const invoice2Id = (0, uuid_1.v4)(); // SENT — Infosys
    const invoice3Id = (0, uuid_1.v4)(); // OVERDUE — Freshworks
    // Invoice 1: PAID — issued 60 days ago, due 30 days ago, paid 25 days ago
    const inv1Issue = (0, dayjs_1.default)().subtract(60, "day").format("YYYY-MM-DD");
    const inv1Due = (0, dayjs_1.default)().subtract(30, "day").format("YYYY-MM-DD");
    const inv1PaidAt = (0, dayjs_1.default)().subtract(25, "day").toDate();
    // Line items for invoice 1: 40 hrs Web Dev + 20 hrs UI/UX
    // Web Dev: 40 * 500000 = 20000000 paise (₹2,00,000)
    // UI/UX:  20 * 300000 = 6000000 paise (₹60,000)
    // Subtotal: 26000000 paise (₹2,60,000)
    // Tax (18%): 4680000 paise (₹46,800)
    // Total: 30680000 paise (₹3,06,800)
    const inv1Subtotal = 26000000;
    const inv1Tax = 4680000;
    const inv1Total = 30680000;
    await knex("invoices").insert({
        id: invoice1Id, org_id: orgId, client_id: clientId,
        invoice_number: "INV-0001", status: "paid",
        issue_date: inv1Issue, due_date: inv1Due,
        currency: "INR", exchange_rate: 1,
        subtotal: inv1Subtotal, tax_amount: inv1Tax,
        total: inv1Total, amount_paid: inv1Total, amount_due: 0,
        notes: "Thank you for your business!",
        terms: "Payment due within 30 days.",
        sent_at: (0, dayjs_1.default)(inv1Issue).toDate(),
        paid_at: inv1PaidAt,
        created_by: userId, created_at: now, updated_at: now,
    });
    await knex("invoice_items").insert([
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice1Id, org_id: orgId,
            name: "Web Development", description: "Custom web application development",
            quantity: 40, unit: "hour", rate: 500000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 3600000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 1800000 }, { name: "SGST", rate: 9, amount: 1800000 }]),
            amount: 20000000, discount_amount: 0, sort_order: 0,
        },
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice1Id, org_id: orgId,
            name: "UI/UX Design", description: "User interface and experience design",
            quantity: 20, unit: "hour", rate: 300000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 1080000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 540000 }, { name: "SGST", rate: 9, amount: 540000 }]),
            amount: 6000000, discount_amount: 0, sort_order: 1,
        },
    ]);
    // Invoice 2: SENT — Infosys, issued 10 days ago, due in 35 days
    const inv2Issue = (0, dayjs_1.default)().subtract(10, "day").format("YYYY-MM-DD");
    const inv2Due = (0, dayjs_1.default)().add(35, "day").format("YYYY-MM-DD");
    // Line items: 80 hrs Web Dev + 30 hrs UI/UX + 10 hrs consulting at ₹7,500/hr
    // Web Dev: 80 * 500000 = 40000000 (₹4,00,000)
    // UI/UX:  30 * 300000 = 9000000 (₹90,000)
    // Consulting: 10 * 750000 = 7500000 (₹75,000)
    // Subtotal: 56500000 (₹5,65,000)
    // Tax (18%): 10170000 (₹1,01,700)
    // Total: 66670000 (₹6,66,700)
    const inv2Subtotal = 56500000;
    const inv2Tax = 10170000;
    const inv2Total = 66670000;
    await knex("invoices").insert({
        id: invoice2Id, org_id: orgId, client_id: client2Id,
        invoice_number: "INV-0002", status: "sent",
        issue_date: inv2Issue, due_date: inv2Due,
        currency: "INR", exchange_rate: 1,
        subtotal: inv2Subtotal, tax_amount: inv2Tax,
        total: inv2Total, amount_paid: 0, amount_due: inv2Total,
        notes: "Please remit payment within the due date.",
        terms: "Payment due within 45 days.",
        sent_at: (0, dayjs_1.default)(inv2Issue).toDate(),
        created_by: userId, created_at: now, updated_at: now,
    });
    await knex("invoice_items").insert([
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice2Id, org_id: orgId,
            name: "Web Development", description: "Enterprise portal development",
            quantity: 80, unit: "hour", rate: 500000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 7200000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 3600000 }, { name: "SGST", rate: 9, amount: 3600000 }]),
            amount: 40000000, discount_amount: 0, sort_order: 0,
        },
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice2Id, org_id: orgId,
            name: "UI/UX Design", description: "Dashboard and reporting UI design",
            quantity: 30, unit: "hour", rate: 300000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 1620000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 810000 }, { name: "SGST", rate: 9, amount: 810000 }]),
            amount: 9000000, discount_amount: 0, sort_order: 1,
        },
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice2Id, org_id: orgId,
            name: "Technical Consulting", description: "Architecture review and consulting",
            quantity: 10, unit: "hour", rate: 750000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 1350000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 675000 }, { name: "SGST", rate: 9, amount: 675000 }]),
            amount: 7500000, discount_amount: 0, sort_order: 2,
        },
    ]);
    // Invoice 3: OVERDUE — Freshworks, issued 50 days ago, due 20 days ago
    const inv3Issue = (0, dayjs_1.default)().subtract(50, "day").format("YYYY-MM-DD");
    const inv3Due = (0, dayjs_1.default)().subtract(20, "day").format("YYYY-MM-DD");
    // Line items: 25 hrs Web Dev + 15 hrs UI/UX
    // Web Dev: 25 * 500000 = 12500000 (₹1,25,000)
    // UI/UX:  15 * 300000 = 4500000 (₹45,000)
    // Subtotal: 17000000 (₹1,70,000)
    // Tax (18%): 3060000 (₹30,600)
    // Total: 20060000 (₹2,00,600)
    const inv3Subtotal = 17000000;
    const inv3Tax = 3060000;
    const inv3Total = 20060000;
    await knex("invoices").insert({
        id: invoice3Id, org_id: orgId, client_id: client3Id,
        invoice_number: "INV-0003", status: "overdue",
        issue_date: inv3Issue, due_date: inv3Due,
        currency: "INR", exchange_rate: 1,
        subtotal: inv3Subtotal, tax_amount: inv3Tax,
        total: inv3Total, amount_paid: 0, amount_due: inv3Total,
        notes: "Payment is overdue. Please remit immediately.",
        terms: "Payment due within 30 days.",
        sent_at: (0, dayjs_1.default)(inv3Issue).toDate(),
        created_by: userId, created_at: now, updated_at: now,
    });
    await knex("invoice_items").insert([
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice3Id, org_id: orgId,
            name: "Web Development", description: "SaaS platform feature development",
            quantity: 25, unit: "hour", rate: 500000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 2250000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 1125000 }, { name: "SGST", rate: 9, amount: 1125000 }]),
            amount: 12500000, discount_amount: 0, sort_order: 0,
        },
        {
            id: (0, uuid_1.v4)(), invoice_id: invoice3Id, org_id: orgId,
            name: "UI/UX Design", description: "Customer onboarding flow design",
            quantity: 15, unit: "hour", rate: 300000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 810000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 405000 }, { name: "SGST", rate: 9, amount: 405000 }]),
            amount: 4500000, discount_amount: 0, sort_order: 1,
        },
    ]);
    // ── sample payments (for PAID invoice 1) ────────────────────────────────────
    const payment1Id = (0, uuid_1.v4)();
    const payment2Id = (0, uuid_1.v4)();
    // Two partial payments that sum to the full invoice total
    // Payment 1: ₹2,00,000 (20000000 paise) via bank transfer
    // Payment 2: ₹1,06,800 (10680000 paise) via UPI
    await knex("payments").insert([
        {
            id: payment1Id, org_id: orgId, client_id: clientId,
            payment_number: "PAY-0001",
            date: (0, dayjs_1.default)().subtract(28, "day").format("YYYY-MM-DD"),
            amount: 20000000, method: "bank_transfer",
            reference: "NEFT-REF-20260219-001",
            notes: "Partial payment for INV-0001",
            is_refund: false, refunded_amount: 0,
            created_by: userId, created_at: now, updated_at: now,
        },
        {
            id: payment2Id, org_id: orgId, client_id: clientId,
            payment_number: "PAY-0002",
            date: (0, dayjs_1.default)().subtract(25, "day").format("YYYY-MM-DD"),
            amount: 10680000, method: "upi",
            reference: "UPI-REF-20260222-042",
            notes: "Final payment for INV-0001",
            is_refund: false, refunded_amount: 0,
            created_by: userId, created_at: now, updated_at: now,
        },
    ]);
    // Link payments to invoice 1
    await knex("payment_allocations").insert([
        {
            id: (0, uuid_1.v4)(), payment_id: payment1Id, invoice_id: invoice1Id,
            org_id: orgId, amount: 20000000, created_at: now, updated_at: now,
        },
        {
            id: (0, uuid_1.v4)(), payment_id: payment2Id, invoice_id: invoice1Id,
            org_id: orgId, amount: 10680000, created_at: now, updated_at: now,
        },
    ]);
    // ── sample quote (SENT — Zoho Corp) ─────────────────────────────────────────
    const quote1Id = (0, uuid_1.v4)();
    const qte1Issue = (0, dayjs_1.default)().subtract(3, "day").format("YYYY-MM-DD");
    const qte1Expiry = (0, dayjs_1.default)().add(27, "day").format("YYYY-MM-DD");
    // Line items: 60 hrs Web Dev + 40 hrs UI/UX
    // Web Dev: 60 * 500000 = 30000000 (₹3,00,000)
    // UI/UX:  40 * 300000 = 12000000 (₹1,20,000)
    // Subtotal: 42000000 (₹4,20,000)
    // Tax (18%): 7560000 (₹75,600)
    // Total: 49560000 (₹4,95,600)
    const qte1Subtotal = 42000000;
    const qte1Tax = 7560000;
    const qte1Total = 49560000;
    await knex("quotes").insert({
        id: quote1Id, org_id: orgId, client_id: client4Id,
        quote_number: "QTE-0001", status: "sent",
        issue_date: qte1Issue, expiry_date: qte1Expiry,
        currency: "INR",
        subtotal: qte1Subtotal, tax_amount: qte1Tax,
        total: qte1Total,
        notes: "This quote is valid for 30 days from the date of issue.",
        terms: "50% advance on acceptance, balance on completion.",
        version: 1,
        created_by: userId, created_at: now, updated_at: now,
    });
    await knex("quote_items").insert([
        {
            id: (0, uuid_1.v4)(), quote_id: quote1Id, org_id: orgId,
            name: "Web Development", description: "CRM module development for Zoho integration",
            quantity: 60, unit: "hour", rate: 500000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 5400000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 2700000 }, { name: "SGST", rate: 9, amount: 2700000 }]),
            amount: 30000000, discount_amount: 0, sort_order: 0,
        },
        {
            id: (0, uuid_1.v4)(), quote_id: quote1Id, org_id: orgId,
            name: "UI/UX Design", description: "CRM dashboard and workflow UI design",
            quantity: 40, unit: "hour", rate: 300000,
            tax_rate_id: gst18Id, tax_rate: 18,
            tax_amount: 2160000,
            tax_components: JSON.stringify([{ name: "CGST", rate: 9, amount: 1080000 }, { name: "SGST", rate: 9, amount: 1080000 }]),
            amount: 12000000, discount_amount: 0, sort_order: 1,
        },
    ]);
    // ── sample expenses ─────────────────────────────────────────────────────────
    await knex("expenses").insert([
        {
            id: (0, uuid_1.v4)(), org_id: orgId,
            category_id: travelCatId,
            vendor_name: "MakeMyTrip",
            date: (0, dayjs_1.default)().subtract(15, "day").format("YYYY-MM-DD"),
            amount: 1250000, // ₹12,500
            currency: "INR",
            tax_amount: 225000, // 18% GST = ₹2,250
            description: "Flight tickets to Chennai for Freshworks onsite meeting",
            is_billable: true, client_id: client3Id,
            status: "approved",
            approved_by: userId,
            tags: JSON.stringify(["travel", "client-meeting"]),
            created_by: userId, created_at: now, updated_at: now,
        },
        {
            id: (0, uuid_1.v4)(), org_id: orgId,
            category_id: softwareCatId,
            vendor_name: "Figma Inc",
            date: (0, dayjs_1.default)().subtract(7, "day").format("YYYY-MM-DD"),
            amount: 95000, // ₹950
            currency: "INR",
            tax_amount: 17100, // 18% GST = ₹171
            description: "Figma Professional plan - monthly subscription",
            is_billable: false, client_id: null,
            status: "paid",
            approved_by: userId,
            tags: JSON.stringify(["software", "design"]),
            created_by: userId, created_at: now, updated_at: now,
        },
        {
            id: (0, uuid_1.v4)(), org_id: orgId,
            category_id: mealsCatId,
            vendor_name: "Taj Hotels",
            date: (0, dayjs_1.default)().subtract(5, "day").format("YYYY-MM-DD"),
            amount: 450000, // ₹4,500
            currency: "INR",
            tax_amount: 81000, // 18% GST = ₹810
            description: "Client lunch meeting with Infosys team",
            is_billable: true, client_id: client2Id,
            status: "pending",
            tags: JSON.stringify(["meals", "client-meeting"]),
            created_by: userId, created_at: now, updated_at: now,
        },
    ]);
}
//# sourceMappingURL=001_demo_data.js.map