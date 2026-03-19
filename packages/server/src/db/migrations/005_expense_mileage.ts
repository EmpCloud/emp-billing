import type { Knex } from "knex";

// ============================================================================
// MIGRATION 005 — Expense Mileage Tracking
// Adds distance and mileage_rate columns to the expenses table.
// distance: decimal (10,2) for km/miles
// mileage_rate: integer (bigint) in paise/cents like other monetary amounts
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("expenses", (t) => {
    t.decimal("distance", 10, 2).nullable();
    t.bigInteger("mileage_rate").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("expenses", (t) => {
    t.dropColumn("distance");
    t.dropColumn("mileage_rate");
  });
}
