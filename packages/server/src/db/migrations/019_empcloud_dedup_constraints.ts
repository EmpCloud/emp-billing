import type { Knex } from "knex";

// ============================================================================
// MIGRATION 019 — EmpCloud dedup constraints
// ----------------------------------------------------------------------------
// Two concurrent `subscription.created` webhooks from EmpCloud (a Cloudflare
// retry, or an admin double-click) could race through findOrCreateClient and
// the idempotency check before either committed — each then created its own
// client -> subscription -> invoice, so one EmpCloud subscribe produced two
// billing invoices.
//
// These STORED generated columns + unique indexes make the race-loser's
// INSERT fail with ER_DUP_ENTRY, which the webhook handler now catches and
// treats as an idempotent hit. The columns are nullable: only EmpCloud-
// provisioned rows carry these ids, and MySQL unique indexes permit multiple
// NULLs, so ordinary billing clients/subscriptions are unaffected.
//
// PRE-REQUISITE: any pre-existing duplicates (e.g. org 21's INV-2026-0120 /
// 0121 lineage) MUST be cleaned up before this migration runs — ADD UNIQUE
// INDEX fails on existing dupes. See scripts/cleanup-org-21-duplicate-
// billing.sql. That failure is intentional: it blocks the deploy until the
// data is consistent.
// ============================================================================

export async function up(knex: Knex): Promise<void> {
  // clients.empcloud_org_id — extracted from custom_fields JSON.
  await knex.raw(
    `ALTER TABLE clients
       ADD COLUMN empcloud_org_id INT
         GENERATED ALWAYS AS (CAST(JSON_EXTRACT(custom_fields, '$.empcloud_org_id') AS UNSIGNED)) STORED`,
  );
  await knex.raw(
    `ALTER TABLE clients
       ADD UNIQUE INDEX uq_clients_empcloud_org (org_id, empcloud_org_id)`,
  );

  // subscriptions.empcloud_subscription_id — extracted from metadata JSON.
  await knex.raw(
    `ALTER TABLE subscriptions
       ADD COLUMN empcloud_subscription_id BIGINT
         GENERATED ALWAYS AS (CAST(JSON_EXTRACT(metadata, '$.empcloud_subscription_id') AS UNSIGNED)) STORED`,
  );
  await knex.raw(
    `ALTER TABLE subscriptions
       ADD UNIQUE INDEX uq_subscriptions_empcloud_sub (org_id, empcloud_subscription_id)`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE subscriptions DROP INDEX uq_subscriptions_empcloud_sub`);
  await knex.raw(`ALTER TABLE subscriptions DROP COLUMN empcloud_subscription_id`);
  await knex.raw(`ALTER TABLE clients DROP INDEX uq_clients_empcloud_org`);
  await knex.raw(`ALTER TABLE clients DROP COLUMN empcloud_org_id`);
}
