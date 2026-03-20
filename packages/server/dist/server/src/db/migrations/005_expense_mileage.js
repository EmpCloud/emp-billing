"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 005 — Expense Mileage Tracking
// Adds distance and mileage_rate columns to the expenses table.
// distance: decimal (10,2) for km/miles
// mileage_rate: integer (bigint) in paise/cents like other monetary amounts
// ============================================================================
async function up(knex) {
    await knex.schema.alterTable("expenses", (t) => {
        t.decimal("distance", 10, 2).nullable();
        t.bigInteger("mileage_rate").nullable();
    });
}
async function down(knex) {
    await knex.schema.alterTable("expenses", (t) => {
        t.dropColumn("distance");
        t.dropColumn("mileage_rate");
    });
}
//# sourceMappingURL=005_expense_mileage.js.map