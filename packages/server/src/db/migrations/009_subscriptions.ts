import type { Knex } from "knex";

// ============================================================================
// MIGRATION 009 — Subscriptions & Plans
// Adds tables for SaaS subscription/plan management.
// All monetary values stored as BIGINT (smallest unit: paise/cents).
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  // ── plans ─────────────────────────────────────────────────────────────────
  await knex.schema.createTable("plans", (t) => {
    t.string("id", 36).primary();
    t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    t.string("name", 100).notNullable();
    t.text("description").nullable();
    t.enum("billing_interval", ["monthly", "quarterly", "semi_annual", "annual", "custom"]).notNullable();
    t.integer("billing_interval_days").nullable(); // for custom interval
    t.integer("trial_period_days").notNullable().defaultTo(0);
    t.bigInteger("price").notNullable(); // in paise/cents
    t.bigInteger("setup_fee").notNullable().defaultTo(0);
    t.string("currency", 3).notNullable().defaultTo("INR");
    t.json("features").nullable(); // array of feature strings
    t.boolean("is_active").notNullable().defaultTo(true);
    t.integer("sort_order").notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(["org_id"]);
  });

  // ── subscriptions ─────────────────────────────────────────────────────────
  await knex.schema.createTable("subscriptions", (t) => {
    t.string("id", 36).primary();
    t.string("org_id", 36).notNullable().references("id").inTable("organizations").onDelete("CASCADE");
    t.string("client_id", 36).notNullable().references("id").inTable("clients");
    t.string("plan_id", 36).notNullable().references("id").inTable("plans");
    t.enum("status", ["trialing", "active", "paused", "past_due", "cancelled", "expired"]).notNullable();
    t.dateTime("current_period_start").nullable();
    t.dateTime("current_period_end").nullable();
    t.dateTime("trial_start").nullable();
    t.dateTime("trial_end").nullable();
    t.dateTime("cancelled_at").nullable();
    t.text("cancel_reason").nullable();
    t.dateTime("pause_start").nullable();
    t.dateTime("resume_date").nullable();
    t.date("next_billing_date").notNullable();
    t.integer("quantity").notNullable().defaultTo(1); // for per-seat
    t.json("metadata").nullable();
    t.boolean("auto_renew").notNullable().defaultTo(true);
    t.string("created_by", 36).notNullable().references("id").inTable("users");
    t.timestamps(true, true);
    t.index(["org_id", "client_id"]);
    t.index(["org_id", "status"]);
    t.index(["next_billing_date", "status"]);
  });

  // ── subscription_events ───────────────────────────────────────────────────
  await knex.schema.createTable("subscription_events", (t) => {
    t.string("id", 36).primary();
    t.string("subscription_id", 36).notNullable().references("id").inTable("subscriptions").onDelete("CASCADE");
    t.string("org_id", 36).notNullable();
    t.enum("event_type", [
      "created", "activated", "trial_started", "trial_ended",
      "renewed", "upgraded", "downgraded", "paused",
      "resumed", "cancelled", "expired", "payment_failed",
    ]).notNullable();
    t.string("old_plan_id", 36).nullable();
    t.string("new_plan_id", 36).nullable();
    t.json("metadata").nullable();
    t.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
    t.index(["subscription_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("subscription_events");
  await knex.schema.dropTableIfExists("subscriptions");
  await knex.schema.dropTableIfExists("plans");
}
