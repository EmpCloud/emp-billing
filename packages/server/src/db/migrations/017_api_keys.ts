import type { Knex } from "knex";

// ============================================================================
// MIGRATION 017 — API Keys
// Adds api_keys table for server-to-server authentication without JWT tokens.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("api_keys", (t) => {
    t.string("id", 36).primary();
    t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    t.string("name", 100).notNullable();
    t.string("key_hash", 64).notNullable().unique();
    t.string("key_prefix", 12).notNullable();
    t.json("scopes").nullable().defaultTo(null);
    t.dateTime("last_used_at").nullable().defaultTo(null);
    t.dateTime("expires_at").nullable().defaultTo(null);
    t.boolean("is_active").notNullable().defaultTo(true);
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.dateTime("updated_at").notNullable().defaultTo(knex.fn.now());

    t.index(["org_id"]);
    t.index(["key_hash"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("api_keys");
}
