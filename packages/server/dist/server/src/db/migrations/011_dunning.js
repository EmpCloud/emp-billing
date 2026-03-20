"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
// ============================================================================
// MIGRATION 011 — Dunning Management
// Adds tables for failed payment retry (dunning) configuration and tracking.
// ============================================================================
async function up(knex) {
    // ── dunning_configs ──────────────────────────────────────────────────────
    await knex.schema.createTable("dunning_configs", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.integer("max_retries").notNullable().defaultTo(4);
        t.json("retry_schedule").notNullable(); // array of days, e.g. [1, 3, 5, 7]
        t.integer("grace_period_days").notNullable().defaultTo(3);
        t.boolean("cancel_after_all_retries").notNullable().defaultTo(true);
        t.boolean("send_reminder_emails").notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.unique(["org_id"]);
    });
    // ── dunning_attempts ─────────────────────────────────────────────────────
    await knex.schema.createTable("dunning_attempts", (t) => {
        t.string("id", 36).primary();
        t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
        t.string("invoice_id", 36).notNullable().references("id").inTable("invoices");
        t.string("subscription_id", 36).nullable().references("id").inTable("subscriptions");
        t.integer("attempt_number").notNullable();
        t.enum("status", ["pending", "success", "failed", "skipped"]).notNullable().defaultTo("pending");
        t.text("payment_error").nullable();
        t.dateTime("next_retry_at").nullable();
        t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
        t.index(["org_id", "invoice_id"]);
        t.index(["status", "next_retry_at"]);
    });
}
async function down(knex) {
    await knex.schema.dropTableIfExists("dunning_attempts");
    await knex.schema.dropTableIfExists("dunning_configs");
}
//# sourceMappingURL=011_dunning.js.map