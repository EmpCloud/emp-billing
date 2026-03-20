"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 010 — Pricing Models & Coupons
// Adds advanced pricing (tiered, volume, per-seat, metered) to products,
// usage tracking for metered billing, and coupon/promo code support.
// ============================================================================
async function up(knex) {
    // ── Add pricing columns to products ──────────────────────────────────────
    await knex.schema.alterTable("products", (t) => {
        t.enum("pricing_model", ["flat", "tiered", "volume", "per_seat", "metered"])
            .notNullable()
            .defaultTo("flat")
            .after("rate");
        t.json("pricing_tiers").nullable().after("pricing_model");
    });
    // ── usage_records ────────────────────────────────────────────────────────
    await knex.schema.createTable("usage_records", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36)
            .notNullable()
            .references("id")
            .inTable("organizations")
            .onDelete("CASCADE");
        t.string("subscription_id", 36).nullable();
        t.string("product_id", 36)
            .notNullable()
            .references("id")
            .inTable("products");
        t.string("client_id", 36)
            .notNullable()
            .references("id")
            .inTable("clients");
        t.decimal("quantity", 10, 2).notNullable();
        t.string("description", 255).nullable();
        t.dateTime("recorded_at").notNullable();
        t.date("period_start").notNullable();
        t.date("period_end").notNullable();
        t.dateTime("created_at").notNullable();
        t.index(["org_id", "product_id", "client_id", "period_start"]);
    });
    // ── coupons ──────────────────────────────────────────────────────────────
    await knex.schema.createTable("coupons", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36)
            .notNullable()
            .references("id")
            .inTable("organizations")
            .onDelete("CASCADE");
        t.string("code", 50).notNullable();
        t.string("name", 100).notNullable();
        t.enum("type", ["percentage", "fixed_amount"]).notNullable();
        t.bigInteger("value").notNullable(); // percentage 0-100, or fixed in paise
        t.string("currency", 3).nullable(); // only for fixed_amount
        t.enum("applies_to", ["invoice", "subscription", "product"])
            .notNullable()
            .defaultTo("invoice");
        t.string("product_id", 36).nullable().references("id").inTable("products");
        t.integer("max_redemptions").nullable(); // null = unlimited
        t.integer("times_redeemed").notNullable().defaultTo(0);
        t.bigInteger("min_amount").notNullable().defaultTo(0);
        t.date("valid_from").notNullable();
        t.date("valid_until").nullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.string("created_by", 36)
            .notNullable()
            .references("id")
            .inTable("users");
        t.timestamps(true, true);
        t.unique(["org_id", "code"]);
    });
    // ── coupon_redemptions ──────────────────────────────────────────────────
    await knex.schema.createTable("coupon_redemptions", (t) => {
        t.string("id", 36).primary();
        t.string("coupon_id", 36)
            .notNullable()
            .references("id")
            .inTable("coupons")
            .onDelete("CASCADE");
        t.string("org_id", 36).notNullable();
        t.string("client_id", 36)
            .notNullable()
            .references("id")
            .inTable("clients");
        t.string("invoice_id", 36).nullable().references("id").inTable("invoices");
        t.string("subscription_id", 36).nullable();
        t.bigInteger("discount_amount").notNullable();
        t.dateTime("redeemed_at").notNullable();
        t.index(["coupon_id", "client_id"]);
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists("coupon_redemptions");
    await knex.schema.dropTableIfExists("coupons");
    await knex.schema.dropTableIfExists("usage_records");
    await knex.schema.alterTable("products", (t) => {
        t.dropColumn("pricing_tiers");
        t.dropColumn("pricing_model");
    });
}
//# sourceMappingURL=010_pricing_models.js.map