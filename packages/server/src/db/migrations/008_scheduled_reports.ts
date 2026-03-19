import type { Knex } from "knex";

// ============================================================================
// MIGRATION 008 — Scheduled Reports
// Adds scheduled_reports table for daily/weekly/monthly email report digests.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("scheduled_reports", (t) => {
    t.string("id", 36).primary();
    t.string("org_id", 36)
      .notNullable()
      .references("id")
      .inTable("organizations")
      .onDelete("CASCADE");
    t.enum("report_type", [
      "revenue",
      "receivables",
      "expenses",
      "tax",
      "profit_loss",
    ]).notNullable();
    t.enum("frequency", ["daily", "weekly", "monthly"]).notNullable();
    t.string("recipient_email", 255).notNullable();
    t.boolean("is_active").notNullable().defaultTo(true);
    t.dateTime("last_sent_at").nullable();
    t.dateTime("next_send_at").notNullable();
    t.string("created_by", 36)
      .notNullable()
      .references("id")
      .inTable("users");
    t.timestamps(true, true);

    // Composite index for efficient due-report lookups
    t.index(["is_active", "next_send_at"]);
    t.index(["org_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("scheduled_reports");
}
