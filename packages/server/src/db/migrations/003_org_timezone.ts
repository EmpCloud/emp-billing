import type { Knex } from "knex";

// ============================================================================
// MIGRATION 003 — Organization Timezone
// Adds a `timezone` column to organizations table.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organizations", (t) => {
    t.string("timezone", 50).notNullable().defaultTo("UTC");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("organizations", (t) => {
    t.dropColumn("timezone");
  });
}
