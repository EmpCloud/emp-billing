import type { Knex } from "knex";

// ============================================================================
// MIGRATION 018 — Webhook Deliveries Missing Columns
// Adds request_body, duration_ms, and error columns that the webhook service
// writes but were missing from the initial schema.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("webhook_deliveries", (t) => {
    t.text("request_body").nullable();
    t.integer("duration_ms").nullable();
    t.text("error").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("webhook_deliveries", (t) => {
    t.dropColumn("request_body");
    t.dropColumn("duration_ms");
    t.dropColumn("error");
  });
}
