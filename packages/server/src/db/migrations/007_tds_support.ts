import type { Knex } from "knex";

// ============================================================================
// MIGRATION 007 — TDS / Withholding Tax Support
// Adds TDS columns to invoices table. TDS is deducted by the client at source,
// so it does not reduce the invoice total — it adjusts the net receivable.
// All monetary values in paise/cents (BIGINT).
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("invoices", (t) => {
    t.decimal("tds_rate", 5, 2).nullable().after("amount_due");
    t.bigInteger("tds_amount").notNullable().defaultTo(0).after("tds_rate");
    t.string("tds_section", 20).nullable().after("tds_amount");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("invoices", (t) => {
    t.dropColumn("tds_rate");
    t.dropColumn("tds_amount");
    t.dropColumn("tds_section");
  });
}
