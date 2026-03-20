"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 007 — TDS / Withholding Tax Support
// Adds TDS columns to invoices table. TDS is deducted by the client at source,
// so it does not reduce the invoice total — it adjusts the net receivable.
// All monetary values in paise/cents (BIGINT).
// ============================================================================
async function up(knex) {
    await knex.schema.alterTable("invoices", (t) => {
        t.decimal("tds_rate", 5, 2).nullable().after("amount_due");
        t.bigInteger("tds_amount").notNullable().defaultTo(0).after("tds_rate");
        t.string("tds_section", 20).nullable().after("tds_amount");
    });
}
async function down(knex) {
    await knex.schema.alterTable("invoices", (t) => {
        t.dropColumn("tds_rate");
        t.dropColumn("tds_amount");
        t.dropColumn("tds_section");
    });
}
//# sourceMappingURL=007_tds_support.js.map