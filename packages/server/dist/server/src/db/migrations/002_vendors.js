"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 002 — Vendors
// Creates vendors table and adds vendor_id FK to expenses.
// ============================================================================
async function up(knex) {
    // ── vendors ───────────────────────────────────────────────────────────────
    await knex.schema.createTable("vendors", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("name", 100).notNullable();
        t.string("email", 255).nullable();
        t.string("phone", 30).nullable();
        t.string("company", 100).nullable();
        t.string("address_line1", 255).nullable();
        t.string("address_line2", 255).nullable();
        t.string("city", 100).nullable();
        t.string("state", 100).nullable();
        t.string("postal_code", 20).nullable();
        t.string("country", 100).nullable();
        t.string("tax_id", 50).nullable(); // GST / VAT number
        t.text("notes").nullable();
        t.boolean("is_active").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.index(["org_id"]);
    });
    // ── add vendor_id to expenses ─────────────────────────────────────────────
    await knex.schema.alterTable("expenses", (t) => {
        t.string("vendor_id", 36).nullable().references("id").inTable("vendors");
    });
}
async function down(knex) {
    await knex.schema.alterTable("expenses", (t) => {
        t.dropForeign(["vendor_id"]);
        t.dropColumn("vendor_id");
    });
    await knex.schema.dropTableIfExists("vendors");
}
//# sourceMappingURL=002_vendors.js.map