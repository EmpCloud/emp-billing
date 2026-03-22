import type { Knex } from "knex";

// ============================================================================
// MIGRATION 016 — Usage Billing
// Adds billed flag and invoice_id to usage_records for metered usage invoicing.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_records", (t) => {
    t.boolean("billed").notNullable().defaultTo(false).after("period_end");
    t.string("invoice_id", 36)
      .nullable()
      .references("id")
      .inTable("invoices")
      .onDelete("SET NULL")
      .after("billed");
    t.index(["org_id", "client_id", "billed", "period_start", "period_end"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_records", (t) => {
    t.dropIndex(["org_id", "client_id", "billed", "period_start", "period_end"]);
    t.dropColumn("invoice_id");
    t.dropColumn("billed");
  });
}
