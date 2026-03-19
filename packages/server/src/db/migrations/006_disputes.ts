import type { Knex } from "knex";

// ============================================================================
// MIGRATION 006 — Disputes
// Adds the disputes table for client portal dispute system.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("disputes", (t) => {
    t.string("id", 36).primary();
    t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    t.string("client_id", 36).notNullable().references("id").inTable("clients").onDelete("CASCADE");
    t.string("invoice_id", 36).nullable().references("id").inTable("invoices");
    t.text("reason").notNullable();
    t.enum("status", ["open", "under_review", "resolved", "closed"]).notNullable().defaultTo("open");
    t.text("resolution").nullable();
    t.text("admin_notes").nullable();
    t.json("attachments").nullable(); // [{name, url}]
    t.string("resolved_by", 36).nullable().references("id").inTable("users");
    t.dateTime("resolved_at").nullable();
    t.timestamps(true, true);

    t.index(["org_id", "client_id"]);
    t.index(["org_id", "status"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("disputes");
}
