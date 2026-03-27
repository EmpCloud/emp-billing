import type { Knex } from "knex";

// ============================================================================
// MIGRATION 016 — Usage Billing
// Adds billed flag and invoice_id to usage_records for metered usage invoicing.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  const hasBilled = await knex.schema.hasColumn("usage_records", "billed");
  const hasInvoiceId = await knex.schema.hasColumn("usage_records", "invoice_id");

  await knex.schema.alterTable("usage_records", (t) => {
    if (!hasBilled) t.boolean("billed").notNullable().defaultTo(false).after("period_end");
    if (!hasInvoiceId)
      t.string("invoice_id", 36)
        .nullable()
        .references("id")
        .inTable("invoices")
        .onDelete("SET NULL")
        .after("billed");
  });

  // Add index only if it doesn't exist yet
  const hasIndex = await knex.raw(`
    SELECT COUNT(*) as cnt FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'usage_records'
      AND INDEX_NAME = 'ix_usage_org_client_billed_period'
  `);
  if (hasIndex[0][0].cnt === 0) {
    await knex.schema.alterTable("usage_records", (t) => {
      t.index(["org_id", "client_id", "billed", "period_start", "period_end"], "ix_usage_org_client_billed_period");
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("usage_records", (t) => {
    t.dropIndex(["org_id", "client_id", "billed", "period_start", "period_end"], "ix_usage_org_client_billed_period");
    t.dropColumn("invoice_id");
    t.dropColumn("billed");
  });
}
