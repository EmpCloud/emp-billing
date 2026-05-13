import type { Knex } from "knex";

// ============================================================================
// MIGRATION 018 — Extend notifications.type ENUM
//
// The original 004_notifications.ts enum only covered invoice / quote / payment
// events. Subscription-lifecycle events (created, renewed, cancelled),
// payment_failed, and trial_ending have been emitted by the events listener
// for months but every notification insert was silently truncating to '' and
// erroring `WARN_DATA_TRUNCATED` on prod, so the in-app notification center
// never showed those rows. Widen the enum to match the NotificationType union
// in notification.service.ts.
// ============================================================================

const ALL_VALUES = [
  "invoice_created",
  "invoice_sent",
  "invoice_paid",
  "invoice_overdue",
  "payment_received",
  "quote_accepted",
  "quote_expired",
  "expense_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_cancelled",
  "payment_failed",
  "trial_ending",
];

function enumList(values: string[]): string {
  return values.map((v) => `'${v}'`).join(",");
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM(${enumList(ALL_VALUES)}) NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  const ORIGINAL = ALL_VALUES.slice(0, 8);
  await knex.raw(
    `ALTER TABLE notifications MODIFY COLUMN type ENUM(${enumList(ORIGINAL)}) NOT NULL`,
  );
}
