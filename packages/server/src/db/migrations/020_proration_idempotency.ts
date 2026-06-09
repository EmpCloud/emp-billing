import type { Knex } from "knex";

// ============================================================================
// MIGRATION 020 — Idempotency keys for EmpCloud-driven proration documents
//
// When emp-billing receives a duplicate `subscription.updated` webhook (a
// Cloudflare retry, an admin double-click, or a network blip + replay), the
// proration block in empcloud-webhook.routes.ts used to issue a SECOND
// invoice / credit_note for the same change. Customer would see two
// "Mid-cycle proration" invoices for one upgrade, and emp-billing's
// receivables would be wrong by the duplicate amount.
//
// Fix: every proration document gets a deterministic idempotency key
// derived from (subscription_id, period_start, old_state, new_state) --
// SHA-256 of those values. Unique index on the column makes the
// race-loser's INSERT fail with ER_DUP_ENTRY, which the handler catches
// and treats as a benign "we already did this" hit.
//
// NULL is allowed because non-EmpCloud documents (regular SaaS invoices)
// don't carry these keys. MySQL unique indexes permit multiple NULLs, so
// ordinary clients are unaffected.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn("invoices", "empcloud_idempotency_key"))) {
    await knex.schema.alterTable("invoices", (t) => {
      t.string("empcloud_idempotency_key", 64).nullable();
    });
    await knex.raw(
      "CREATE UNIQUE INDEX invoices_empcloud_idempotency_key_unique ON invoices (empcloud_idempotency_key)",
    );
  }
  if (!(await knex.schema.hasColumn("credit_notes", "empcloud_idempotency_key"))) {
    await knex.schema.alterTable("credit_notes", (t) => {
      t.string("empcloud_idempotency_key", 64).nullable();
    });
    await knex.raw(
      "CREATE UNIQUE INDEX credit_notes_empcloud_idempotency_key_unique ON credit_notes (empcloud_idempotency_key)",
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn("invoices", "empcloud_idempotency_key")) {
    await knex.raw(
      "DROP INDEX invoices_empcloud_idempotency_key_unique ON invoices",
    ).catch(() => {});
    await knex.schema.alterTable("invoices", (t) => {
      t.dropColumn("empcloud_idempotency_key");
    });
  }
  if (await knex.schema.hasColumn("credit_notes", "empcloud_idempotency_key")) {
    await knex.raw(
      "DROP INDEX credit_notes_empcloud_idempotency_key_unique ON credit_notes",
    ).catch(() => {});
    await knex.schema.alterTable("credit_notes", (t) => {
      t.dropColumn("empcloud_idempotency_key");
    });
  }
}
