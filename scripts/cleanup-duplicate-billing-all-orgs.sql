-- ============================================================================
-- Phase 1 cleanup — duplicate billing records across ALL EmpCloud orgs
-- ----------------------------------------------------------------------------
-- Cause: concurrent / retried subscription.created webhooks raced through
-- findOrCreateClient + the idempotency check before either committed, so one
-- EmpCloud subscribe produced multiple client -> subscription -> invoice
-- lineages. Fixed going forward by PR #37 (migration 019 unique indexes) —
-- but migration 019's ADD UNIQUE INDEX FAILS until these existing duplicates
-- are removed. Run this first.
--
-- What it does, in order:
--   1. Consolidate clients   — one keeper client per EmpCloud org; re-point
--                              every invoice / subscription / payment to it,
--                              then delete the duplicate client rows.
--   2. Delete dup invoices   — per group (same notes + total), keep the winner
--                              (paid > most-paid > oldest); delete the rest.
--   3. Delete dup subscriptions — per (org_id, empcloud_subscription_id), keep
--                              the winner (active > oldest); delete the rest.
--
-- SAFETY: only invoices with amount_paid = 0 are auto-deleted. A duplicate
-- that carries a real payment (e.g. org 21 INV-2026-0122, ₹5.22 PayPal) is
-- LEFT IN PLACE and surfaced in STEP 4 for a manual decision (refund /
-- re-allocate / write-off). The script never deletes a paid/part-paid invoice.
--
-- Run on the emp_billing database. Review each STEP's SELECT before the writes
-- under it. Everything is one transaction — COMMIT or ROLLBACK at the end.
-- ============================================================================

START TRANSACTION;

-- ── STEP 0: INSPECT — duplicate invoices, subscriptions, and clients ───────
-- 0a. duplicate invoice groups + chosen keeper
WITH ranked AS (
  SELECT i.id, i.invoice_number, i.notes, i.total, i.status, i.amount_paid, i.created_at,
    JSON_UNQUOTE(JSON_EXTRACT(c.custom_fields,'$.empcloud_org_id')) AS emp_org,
    ROW_NUMBER() OVER (PARTITION BY i.notes, i.total
      ORDER BY (i.status='paid') DESC, i.amount_paid DESC, i.created_at ASC) AS rn,
    COUNT(*)     OVER (PARTITION BY i.notes, i.total) AS group_size
  FROM invoices i JOIN clients c ON c.id = i.client_id
  WHERE i.notes LIKE 'Prepaid first-period invoice%'
)
SELECT emp_org, invoice_number, status, amount_paid, created_at,
       CASE WHEN rn=1 THEN 'KEEP'
            WHEN amount_paid=0 THEN 'delete (safe)'
            ELSE 'MANUAL — has payment' END AS action
FROM ranked WHERE group_size > 1 ORDER BY emp_org, notes, rn;

-- 0b. duplicate clients per EmpCloud org
SELECT JSON_UNQUOTE(JSON_EXTRACT(custom_fields,'$.empcloud_org_id')) AS emp_org,
       COUNT(*) AS dup_clients, GROUP_CONCAT(id ORDER BY created_at) AS client_ids
FROM clients WHERE JSON_EXTRACT(custom_fields,'$.empcloud_org_id') IS NOT NULL
GROUP BY emp_org HAVING COUNT(*) > 1;

-- 0c. duplicate subscription lineages
SELECT org_id, JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.empcloud_subscription_id')) AS emp_sub,
       COUNT(*) AS dup_subs, GROUP_CONCAT(id ORDER BY created_at) AS sub_ids,
       GROUP_CONCAT(status ORDER BY created_at) AS statuses
FROM subscriptions WHERE JSON_EXTRACT(metadata,'$.empcloud_subscription_id') IS NOT NULL
GROUP BY org_id, emp_sub HAVING COUNT(*) > 1;

-- ── STEP 1: consolidate clients — one keeper per EmpCloud org ──────────────
-- keeper = oldest client row for that empcloud_org_id.
DROP TEMPORARY TABLE IF EXISTS _client_remap;
CREATE TEMPORARY TABLE _client_remap AS
SELECT c.id AS old_id, k.keeper_id
FROM clients c
JOIN (
  SELECT emp_org, id AS keeper_id FROM (
    SELECT id, JSON_UNQUOTE(JSON_EXTRACT(custom_fields,'$.empcloud_org_id')) AS emp_org,
      ROW_NUMBER() OVER (
        PARTITION BY JSON_UNQUOTE(JSON_EXTRACT(custom_fields,'$.empcloud_org_id'))
        ORDER BY created_at ASC) AS rn
    FROM clients WHERE JSON_EXTRACT(custom_fields,'$.empcloud_org_id') IS NOT NULL
  ) r WHERE r.rn = 1
) k ON k.emp_org = JSON_UNQUOTE(JSON_EXTRACT(c.custom_fields,'$.empcloud_org_id'))
WHERE c.id <> k.keeper_id;

SELECT COUNT(*) AS duplicate_clients_to_remove FROM _client_remap;

-- re-point every child of a duplicate client onto the keeper
UPDATE invoices        x JOIN _client_remap m ON x.client_id = m.old_id SET x.client_id = m.keeper_id;
UPDATE subscriptions   x JOIN _client_remap m ON x.client_id = m.old_id SET x.client_id = m.keeper_id;
UPDATE payments        x JOIN _client_remap m ON x.client_id = m.old_id SET x.client_id = m.keeper_id;
UPDATE client_contacts x JOIN _client_remap m ON x.client_id = m.old_id SET x.client_id = m.keeper_id;
-- now the duplicate client rows have nothing pointing at them — delete them
DELETE c FROM clients c JOIN _client_remap m ON c.id = m.old_id;

-- ── STEP 2: delete the SAFE duplicate invoices (not keeper, amount_paid = 0) ─
DROP TEMPORARY TABLE IF EXISTS _dup_invoices;
CREATE TEMPORARY TABLE _dup_invoices AS
SELECT id FROM (
  SELECT i.id, i.amount_paid,
    ROW_NUMBER() OVER (PARTITION BY i.notes, i.total
      ORDER BY (i.status='paid') DESC, i.amount_paid DESC, i.created_at ASC) AS rn,
    COUNT(*)     OVER (PARTITION BY i.notes, i.total) AS group_size
  FROM invoices i WHERE i.notes LIKE 'Prepaid first-period invoice%'
) r WHERE r.group_size > 1 AND r.rn > 1 AND r.amount_paid = 0;

SELECT COUNT(*) AS safe_invoices_to_delete FROM _dup_invoices;

DELETE FROM invoice_items       WHERE invoice_id IN (SELECT id FROM _dup_invoices);
DELETE FROM payment_allocations WHERE invoice_id IN (SELECT id FROM _dup_invoices);  -- expect 0
DELETE FROM invoices WHERE id IN (SELECT id FROM _dup_invoices) AND amount_paid = 0; -- guard

-- ── STEP 3: delete the duplicate subscriptions (not keeper) + their events ──
DROP TEMPORARY TABLE IF EXISTS _dup_subs;
CREATE TEMPORARY TABLE _dup_subs AS
SELECT id FROM (
  SELECT s.id,
    ROW_NUMBER() OVER (
      PARTITION BY s.org_id, JSON_UNQUOTE(JSON_EXTRACT(s.metadata,'$.empcloud_subscription_id'))
      ORDER BY (s.status='active') DESC, s.created_at ASC) AS rn,
    COUNT(*) OVER (
      PARTITION BY s.org_id, JSON_UNQUOTE(JSON_EXTRACT(s.metadata,'$.empcloud_subscription_id'))) AS group_size
  FROM subscriptions s WHERE JSON_EXTRACT(s.metadata,'$.empcloud_subscription_id') IS NOT NULL
) r WHERE r.group_size > 1 AND r.rn > 1;

SELECT COUNT(*) AS subscriptions_to_delete FROM _dup_subs;

DELETE FROM subscription_events WHERE subscription_id IN (SELECT id FROM _dup_subs);
DELETE FROM subscriptions       WHERE id IN (SELECT id FROM _dup_subs);

-- ── STEP 4: MANUAL — duplicate invoices that still carry a payment ─────────
-- NOT deleted by this script. Decide per row: refund the stray payment,
-- re-allocate it, or write it off, then delete the invoice by hand.
-- Known case: org 21 INV-2026-0122 (₹5.22 PayPal, txn 3E930608YM042732Y).
WITH ranked AS (
  SELECT i.id, i.invoice_number, i.status, i.amount_paid, i.notes, i.total,
    ROW_NUMBER() OVER (PARTITION BY i.notes, i.total
      ORDER BY (i.status='paid') DESC, i.amount_paid DESC, i.created_at ASC) AS rn,
    COUNT(*)     OVER (PARTITION BY i.notes, i.total) AS group_size
  FROM invoices i WHERE i.notes LIKE 'Prepaid first-period invoice%'
)
SELECT r.invoice_number, r.status, r.amount_paid,
       pa.payment_id, p.gateway_transaction_id, p.amount AS payment_amount
FROM ranked r
LEFT JOIN payment_allocations pa ON pa.invoice_id = r.id
LEFT JOIN payments p ON p.id = pa.payment_id
WHERE r.group_size > 1 AND r.rn > 1 AND r.amount_paid > 0;

-- ── STEP 5: VERIFY migration 019 will pass — BOTH must return ZERO rows ────
SELECT JSON_UNQUOTE(JSON_EXTRACT(custom_fields,'$.empcloud_org_id')) AS emp_org, COUNT(*) AS dup_clients
FROM clients WHERE JSON_EXTRACT(custom_fields,'$.empcloud_org_id') IS NOT NULL
GROUP BY emp_org HAVING COUNT(*) > 1;

SELECT org_id, JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.empcloud_subscription_id')) AS emp_sub, COUNT(*) AS dup_subs
FROM subscriptions WHERE JSON_EXTRACT(metadata,'$.empcloud_subscription_id') IS NOT NULL
GROUP BY org_id, emp_sub HAVING COUNT(*) > 1;

-- ── Finish ─────────────────────────────────────────────────────────────────
-- STEP 5 both zero + STEP 0 looked right ->  COMMIT;
-- anything off                          ->  ROLLBACK;
--
-- After COMMIT: repoint the EmpCloud bridge tables (run on the `empcloud` db)
-- for every org whose surviving client/subscription id changed —
-- billing_client_mappings.billing_client_id and
-- billing_subscription_mappings.billing_subscription_id. See
-- cleanup-org-21-duplicate-billing.sql for the UPDATE pattern.
