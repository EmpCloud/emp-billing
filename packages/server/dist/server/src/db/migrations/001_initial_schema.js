"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 001 — Initial Schema
// Creates all core tables for emp-billing.
// All monetary values stored as BIGINT (smallest unit: paise/cents).
// ============================================================================
async function up(knex) {
    // ── organizations ──────────────────────────────────────────────────────────
    await knex.schema.createTable("organizations", (t) => {
        t.string("id", 36).primary();
        t.string("name", 100).notNullable();
        t.string("legal_name", 100).notNullable();
        t.string("email", 255).notNullable();
        t.string("phone", 30).nullable();
        t.string("website", 255).nullable();
        t.string("logo", 500).nullable();
        // address stored as JSON
        t.json("address").notNullable();
        t.string("tax_id", 50).nullable(); // GSTIN / VAT / EIN
        t.string("pan", 20).nullable();
        t.string("default_currency", 3).notNullable().defaultTo("INR");
        t.string("country", 2).notNullable().defaultTo("IN");
        t.string("state", 100).nullable();
        t.integer("fiscal_year_start").notNullable().defaultTo(4); // month: 1-12
        t.string("invoice_prefix", 20).notNullable().defaultTo("INV");
        t.integer("invoice_next_number").notNullable().defaultTo(1);
        t.string("quote_prefix", 20).notNullable().defaultTo("QTE");
        t.integer("quote_next_number").notNullable().defaultTo(1);
        t.integer("default_payment_terms").notNullable().defaultTo(30); // days
        t.text("default_notes").nullable();
        t.text("default_terms").nullable();
        t.json("brand_colors").nullable(); // { primary, accent }
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
    });
    // ── users ──────────────────────────────────────────────────────────────────
    await knex.schema.createTable("users", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("email", 255).notNullable();
        t.string("password_hash", 255).notNullable();
        t.string("first_name", 50).notNullable();
        t.string("last_name", 50).notNullable();
        t.enum("role", ["owner", "admin", "accountant", "sales", "viewer"]).notNullable().defaultTo("viewer");
        t.boolean("is_active").notNullable().defaultTo(true);
        t.boolean("email_verified").notNullable().defaultTo(false);
        t.string("reset_token", 255).nullable();
        t.dateTime("reset_token_expires").nullable();
        t.dateTime("last_login_at").nullable();
        t.timestamps(true, true);
        t.unique(["email"]);
        t.index(["org_id"]);
    });
    // ── refresh_tokens ─────────────────────────────────────────────────────────
    await knex.schema.createTable("refresh_tokens", (t) => {
        t.string("id", 36).primary();
        t.string("user_id", 36).notNullable().references("id").inTable("users").onDelete("CASCADE");
        t.string("token_hash", 255).notNullable();
        t.dateTime("expires_at").notNullable();
        t.boolean("is_revoked").notNullable().defaultTo(false);
        t.timestamps(true, true);
        t.index(["user_id"]);
        t.index(["token_hash"]);
    });
    // ── clients ────────────────────────────────────────────────────────────────
    await knex.schema.createTable("clients", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("name", 100).notNullable();
        t.string("display_name", 100).notNullable();
        t.string("email", 255).notNullable();
        t.string("phone", 30).nullable();
        t.string("website", 255).nullable();
        t.string("tax_id", 50).nullable();
        t.json("billing_address").nullable();
        t.json("shipping_address").nullable();
        t.string("currency", 3).notNullable().defaultTo("INR");
        t.integer("payment_terms").notNullable().defaultTo(30);
        t.text("notes").nullable();
        t.json("tags").nullable();
        t.bigInteger("outstanding_balance").notNullable().defaultTo(0);
        t.bigInteger("total_billed").notNullable().defaultTo(0);
        t.bigInteger("total_paid").notNullable().defaultTo(0);
        t.boolean("portal_enabled").notNullable().defaultTo(false);
        t.string("portal_email", 255).nullable();
        t.json("custom_fields").nullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.index(["org_id"]);
        t.index(["email"]);
    });
    // ── client_contacts ────────────────────────────────────────────────────────
    await knex.schema.createTable("client_contacts", (t) => {
        t.string("id", 36).primary();
        t.string("client_id", 36).notNullable().references("id").inTable("clients").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("name", 100).notNullable();
        t.string("email", 255).notNullable();
        t.string("phone", 30).nullable();
        t.string("designation", 100).nullable();
        t.boolean("is_primary").notNullable().defaultTo(false);
        t.timestamps(true, true);
        t.index(["client_id"]);
    });
    // ── tax_rates ──────────────────────────────────────────────────────────────
    await knex.schema.createTable("tax_rates", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("name", 100).notNullable();
        t.enum("type", ["gst", "igst", "vat", "sales_tax", "custom"]).notNullable();
        t.decimal("rate", 5, 2).notNullable();
        t.boolean("is_compound").notNullable().defaultTo(false);
        t.json("components").nullable(); // [{name, rate}]
        t.boolean("is_default").notNullable().defaultTo(false);
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.index(["org_id"]);
    });
    // ── products ───────────────────────────────────────────────────────────────
    await knex.schema.createTable("products", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("name", 100).notNullable();
        t.text("description").nullable();
        t.string("sku", 50).nullable();
        t.enum("type", ["goods", "service"]).notNullable().defaultTo("service");
        t.string("unit", 30).nullable();
        t.bigInteger("rate").notNullable().defaultTo(0);
        t.string("tax_rate_id", 36).nullable().references("id").inTable("tax_rates");
        t.string("hsn_code", 10).nullable();
        t.boolean("track_inventory").notNullable().defaultTo(false);
        t.integer("stock_on_hand").nullable();
        t.integer("reorder_level").nullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.index(["org_id"]);
    });
    // ── invoices ───────────────────────────────────────────────────────────────
    await knex.schema.createTable("invoices", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("client_id", 36).notNullable().references("id").inTable("clients");
        t.string("invoice_number", 50).notNullable();
        t.string("reference_number", 50).nullable();
        t.enum("status", ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "void", "written_off"]).notNullable().defaultTo("draft");
        t.date("issue_date").notNullable();
        t.date("due_date").notNullable();
        t.string("currency", 3).notNullable().defaultTo("INR");
        t.decimal("exchange_rate", 10, 6).notNullable().defaultTo(1);
        t.bigInteger("subtotal").notNullable().defaultTo(0);
        t.enum("discount_type", ["percentage", "fixed"]).nullable();
        t.decimal("discount_value", 10, 2).nullable();
        t.bigInteger("discount_amount").notNullable().defaultTo(0);
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.bigInteger("total").notNullable().defaultTo(0);
        t.bigInteger("amount_paid").notNullable().defaultTo(0);
        t.bigInteger("amount_due").notNullable().defaultTo(0);
        t.text("notes").nullable();
        t.text("terms").nullable();
        t.json("attachments").nullable();
        t.json("custom_fields").nullable();
        t.dateTime("sent_at").nullable();
        t.dateTime("viewed_at").nullable();
        t.dateTime("paid_at").nullable();
        t.string("recurring_profile_id", 36).nullable();
        t.string("created_by", 36).notNullable();
        t.timestamps(true, true);
        t.unique(["org_id", "invoice_number"]);
        t.index(["org_id"]);
        t.index(["client_id"]);
        t.index(["status"]);
        t.index(["due_date"]);
    });
    // ── invoice_items ──────────────────────────────────────────────────────────
    await knex.schema.createTable("invoice_items", (t) => {
        t.string("id", 36).primary();
        t.string("invoice_id", 36).notNullable().references("id").inTable("invoices").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("product_id", 36).nullable();
        t.string("name", 200).notNullable();
        t.text("description").nullable();
        t.string("hsn_code", 10).nullable();
        t.decimal("quantity", 10, 3).notNullable().defaultTo(1);
        t.string("unit", 30).nullable();
        t.bigInteger("rate").notNullable().defaultTo(0);
        t.enum("discount_type", ["percentage", "fixed"]).nullable();
        t.decimal("discount_value", 10, 2).nullable();
        t.bigInteger("discount_amount").notNullable().defaultTo(0);
        t.string("tax_rate_id", 36).nullable();
        t.decimal("tax_rate", 5, 2).notNullable().defaultTo(0);
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.json("tax_components").nullable();
        t.bigInteger("amount").notNullable().defaultTo(0);
        t.integer("sort_order").notNullable().defaultTo(0);
        t.index(["invoice_id"]);
    });
    // ── quotes ─────────────────────────────────────────────────────────────────
    await knex.schema.createTable("quotes", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("client_id", 36).notNullable().references("id").inTable("clients");
        t.string("quote_number", 50).notNullable();
        t.enum("status", ["draft", "sent", "viewed", "accepted", "declined", "expired", "converted"]).notNullable().defaultTo("draft");
        t.date("issue_date").notNullable();
        t.date("expiry_date").notNullable();
        t.string("currency", 3).notNullable().defaultTo("INR");
        t.bigInteger("subtotal").notNullable().defaultTo(0);
        t.enum("discount_type", ["percentage", "fixed"]).nullable();
        t.decimal("discount_value", 10, 2).nullable();
        t.bigInteger("discount_amount").notNullable().defaultTo(0);
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.bigInteger("total").notNullable().defaultTo(0);
        t.text("notes").nullable();
        t.text("terms").nullable();
        t.dateTime("accepted_at").nullable();
        t.string("converted_invoice_id", 36).nullable();
        t.integer("version").notNullable().defaultTo(1);
        t.string("created_by", 36).notNullable();
        t.timestamps(true, true);
        t.unique(["org_id", "quote_number"]);
        t.index(["org_id"]);
        t.index(["client_id"]);
    });
    // ── quote_items ────────────────────────────────────────────────────────────
    await knex.schema.createTable("quote_items", (t) => {
        t.string("id", 36).primary();
        t.string("quote_id", 36).notNullable().references("id").inTable("quotes").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("product_id", 36).nullable();
        t.string("name", 200).notNullable();
        t.text("description").nullable();
        t.string("hsn_code", 10).nullable();
        t.decimal("quantity", 10, 3).notNullable().defaultTo(1);
        t.string("unit", 30).nullable();
        t.bigInteger("rate").notNullable().defaultTo(0);
        t.enum("discount_type", ["percentage", "fixed"]).nullable();
        t.decimal("discount_value", 10, 2).nullable();
        t.bigInteger("discount_amount").notNullable().defaultTo(0);
        t.string("tax_rate_id", 36).nullable();
        t.decimal("tax_rate", 5, 2).notNullable().defaultTo(0);
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.json("tax_components").nullable();
        t.bigInteger("amount").notNullable().defaultTo(0);
        t.integer("sort_order").notNullable().defaultTo(0);
        t.index(["quote_id"]);
    });
    // ── payments ───────────────────────────────────────────────────────────────
    await knex.schema.createTable("payments", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("client_id", 36).notNullable().references("id").inTable("clients");
        t.string("payment_number", 50).notNullable();
        t.date("date").notNullable();
        t.bigInteger("amount").notNullable();
        t.enum("method", ["cash", "bank_transfer", "cheque", "upi", "card", "gateway_stripe", "gateway_razorpay", "gateway_paypal", "other"]).notNullable();
        t.string("reference", 100).nullable();
        t.string("gateway_transaction_id", 255).nullable();
        t.text("notes").nullable();
        t.boolean("is_refund").notNullable().defaultTo(false);
        t.bigInteger("refunded_amount").notNullable().defaultTo(0);
        t.string("receipt_url", 500).nullable();
        t.string("created_by", 36).notNullable();
        t.timestamps(true, true);
        t.index(["org_id"]);
        t.index(["client_id"]);
    });
    // ── payment_allocations ────────────────────────────────────────────────────
    await knex.schema.createTable("payment_allocations", (t) => {
        t.string("id", 36).primary();
        t.string("payment_id", 36).notNullable().references("id").inTable("payments").onDelete("CASCADE");
        t.string("invoice_id", 36).notNullable().references("id").inTable("invoices");
        t.string("org_id", 36).notNullable();
        t.bigInteger("amount").notNullable();
        t.timestamps(true, true);
        t.index(["payment_id"]);
        t.index(["invoice_id"]);
    });
    // ── credit_notes ───────────────────────────────────────────────────────────
    await knex.schema.createTable("credit_notes", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("client_id", 36).notNullable().references("id").inTable("clients");
        t.string("credit_note_number", 50).notNullable();
        t.enum("status", ["draft", "open", "applied", "refunded", "void"]).notNullable().defaultTo("open");
        t.date("date").notNullable();
        t.bigInteger("subtotal").notNullable().defaultTo(0);
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.bigInteger("total").notNullable().defaultTo(0);
        t.bigInteger("balance").notNullable().defaultTo(0);
        t.text("reason").nullable();
        t.string("created_by", 36).notNullable();
        t.timestamps(true, true);
        t.index(["org_id"]);
        t.index(["client_id"]);
    });
    // ── credit_note_items ──────────────────────────────────────────────────────
    await knex.schema.createTable("credit_note_items", (t) => {
        t.string("id", 36).primary();
        t.string("credit_note_id", 36).notNullable().references("id").inTable("credit_notes").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("name", 200).notNullable();
        t.text("description").nullable();
        t.decimal("quantity", 10, 3).notNullable().defaultTo(1);
        t.bigInteger("rate").notNullable().defaultTo(0);
        t.bigInteger("discount_amount").notNullable().defaultTo(0);
        t.decimal("tax_rate", 5, 2).notNullable().defaultTo(0);
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.bigInteger("amount").notNullable().defaultTo(0);
        t.integer("sort_order").notNullable().defaultTo(0);
        t.index(["credit_note_id"]);
    });
    // ── expense_categories ─────────────────────────────────────────────────────
    await knex.schema.createTable("expense_categories", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("name", 100).notNullable();
        t.text("description").nullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.index(["org_id"]);
    });
    // ── expenses ───────────────────────────────────────────────────────────────
    await knex.schema.createTable("expenses", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("category_id", 36).notNullable().references("id").inTable("expense_categories");
        t.string("vendor_name", 100).nullable();
        t.date("date").notNullable();
        t.bigInteger("amount").notNullable();
        t.string("currency", 3).notNullable().defaultTo("INR");
        t.bigInteger("tax_amount").notNullable().defaultTo(0);
        t.text("description").notNullable();
        t.string("receipt_url", 500).nullable();
        t.boolean("is_billable").notNullable().defaultTo(false);
        t.string("client_id", 36).nullable();
        t.string("invoice_id", 36).nullable();
        t.enum("status", ["pending", "approved", "rejected", "billed", "paid"]).notNullable().defaultTo("pending");
        t.string("approved_by", 36).nullable();
        t.json("tags").nullable();
        t.string("created_by", 36).notNullable();
        t.timestamps(true, true);
        t.index(["org_id"]);
        t.index(["category_id"]);
        t.index(["client_id"]);
    });
    // ── recurring_profiles ─────────────────────────────────────────────────────
    await knex.schema.createTable("recurring_profiles", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("client_id", 36).notNullable().references("id").inTable("clients");
        t.enum("type", ["invoice", "expense"]).notNullable().defaultTo("invoice");
        t.enum("frequency", ["daily", "weekly", "monthly", "quarterly", "half_yearly", "yearly", "custom"]).notNullable();
        t.integer("custom_days").nullable();
        t.date("start_date").notNullable();
        t.date("end_date").nullable();
        t.integer("max_occurrences").nullable();
        t.integer("occurrence_count").notNullable().defaultTo(0);
        t.date("next_execution_date").notNullable();
        t.enum("status", ["active", "paused", "completed", "cancelled"]).notNullable().defaultTo("active");
        t.boolean("auto_send").notNullable().defaultTo(false);
        t.boolean("auto_charge").notNullable().defaultTo(false);
        t.json("template_data").notNullable();
        t.string("created_by", 36).notNullable();
        t.timestamps(true, true);
        t.index(["org_id"]);
        t.index(["status"]);
        t.index(["next_execution_date"]);
    });
    // ── recurring_executions ───────────────────────────────────────────────────
    await knex.schema.createTable("recurring_executions", (t) => {
        t.string("id", 36).primary();
        t.string("profile_id", 36).notNullable().references("id").inTable("recurring_profiles").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("generated_id", 36).nullable(); // invoice/expense ID
        t.date("execution_date").notNullable();
        t.enum("status", ["success", "failed", "skipped"]).notNullable();
        t.text("error").nullable();
        t.timestamps(true, true);
        t.index(["profile_id"]);
    });
    // ── webhooks ───────────────────────────────────────────────────────────────
    await knex.schema.createTable("webhooks", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("url", 500).notNullable();
        t.json("events").notNullable();
        t.string("secret", 255).notNullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.dateTime("last_delivered_at").nullable();
        t.integer("failure_count").notNullable().defaultTo(0);
        t.timestamps(true, true);
        t.index(["org_id"]);
    });
    // ── webhook_deliveries ─────────────────────────────────────────────────────
    await knex.schema.createTable("webhook_deliveries", (t) => {
        t.string("id", 36).primary();
        t.string("webhook_id", 36).notNullable().references("id").inTable("webhooks").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("event", 100).notNullable();
        t.json("payload").nullable();
        t.integer("response_status").nullable();
        t.text("response_body").nullable();
        t.boolean("success").notNullable().defaultTo(false);
        t.dateTime("delivered_at").nullable();
        t.timestamps(true, true);
        t.index(["webhook_id"]);
    });
    // ── audit_logs ─────────────────────────────────────────────────────────────
    await knex.schema.createTable("audit_logs", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable();
        t.string("user_id", 36).nullable();
        t.string("action", 100).notNullable(); // e.g. "invoice.created"
        t.string("entity_type", 50).notNullable();
        t.string("entity_id", 36).notNullable();
        t.json("before").nullable();
        t.json("after").nullable();
        t.string("ip_address", 45).nullable();
        t.timestamps(true, true);
        t.index(["org_id"]);
        t.index(["entity_type", "entity_id"]);
    });
    // ── client_portal_access ───────────────────────────────────────────────────
    await knex.schema.createTable("client_portal_access", (t) => {
        t.string("id", 36).primary();
        t.string("client_id", 36).notNullable().references("id").inTable("clients").onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("email", 255).notNullable();
        t.string("token_hash", 255).notNullable();
        t.dateTime("expires_at").nullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.index(["client_id"]);
        t.index(["token_hash"]);
    });
}
async function down(knex) {
    const tables = [
        "client_portal_access",
        "audit_logs",
        "webhook_deliveries",
        "webhooks",
        "recurring_executions",
        "recurring_profiles",
        "expenses",
        "expense_categories",
        "credit_note_items",
        "credit_notes",
        "payment_allocations",
        "payments",
        "quote_items",
        "quotes",
        "invoice_items",
        "invoices",
        "products",
        "tax_rates",
        "client_contacts",
        "clients",
        "refresh_tokens",
        "users",
        "organizations",
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
//# sourceMappingURL=001_initial_schema.js.map