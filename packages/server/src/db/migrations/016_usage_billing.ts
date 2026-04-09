import type { Knex } from "knex";

// ============================================================================
// MIGRATION 016 — Usage Billing
// Adds billed flag and invoice_id to usage_records for metered usage invoicing.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  const hasBilled = await knex.schema.hasColumn("usage_records", "billed");
  const hasInvoiceId = await knex.schema.hasColumn("usage_records", "invoice_id");

  await knex.schema.alterTable("usage_records", (t) => {
    if (!hasBilled) {
      t.boolean("billed").notNullable().defaultTo(false).after("period_end");
    }
    if (!hasInvoiceId) {
      t.string("invoice_id", 36)
        .nullable()
        .references("id")
        .inTable("invoices")
        .onDelete("SET NULL")
        .after("billed");
    }
  });

  // Add index only if it doesn't exist
  const [rows] = await knex.raw(
    `SELECT COUNT(*) as cnt FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = 'usage_records' AND index_name = 'idx_usage_billing'`
  );
  if ((rows as any[])[0].cnt === 0) {
    await knex.schema.alterTable("usage_records", (t) => {
      t.index(["org_id", "client_id", "billed", "period_start", "period_end"], "idx_usage_billing");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_records", (t) => {
    t.dropIndex(["org_id", "client_id", "billed", "period_start", "period_end"], "idx_usage_billing");
    t.dropColumn("invoice_id");
    t.dropColumn("billed");
  });
}
