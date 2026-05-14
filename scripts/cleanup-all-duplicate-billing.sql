-- ============================================================================
-- Cleanup: ALL EmpCloud duplicate billing records
-- ----------------------------------------------------------------------------
-- Cause: concurrent / retried `subscription.created` webhooks from EmpCloud
-- raced through findOrCreateClient + the idempotency check before either
-- committed, so each created its own client -> subscription -> invoice. One
-- EmpCloud subscribe produced 2..N billing invoices. Confirmed on orgs 18
-- (13x!), 19, 21, 22, and one legacy client with no empcloud_org_id.
--
-- Root cause is fixed in PR #37 / migration 019 — but that migration's UNIQUE
-- indexes cannot be added until these pre-existing duplicates are gone. Run
-- this script FIRST, then deploy + migrate.
--
-- Strategy — deterministic, set-based, no hardcoded ids:
--   * Duplicate invoices  (grouped by `notes` = org+module): keep the row with
--       the most amount_paid, tie-break oldest created_at; delete the rest.
--   * Duplicate subscriptions (grouped by org_id + empcloud_subscription_id):
--       keep active over cancelled, tie-break oldest; delete the rest.
--   * Clients: delete any EmpCloud-provisioned client left with zero invoices,
--       zero subscriptions and zero payments.
--
-- NOTE: this is sandbox/test data — loser payments (incl. the ₹5.22 PayPal
-- capture on INV-2026-0122) are deleted along with their invoices. For real
-- money you would re-allocate the payment to the surviving invoice instead.
--
-- HOW TO RUN: execute inside the transaction below. Review every STEP 0 and
-- VERIFY select. COMMIT only when the numbers look right; ROLLBACK otherwise.
-- Supersedes scripts/cleanup-org-21-duplicate-billing.sql.
-- ============================================================================

START TRANSACTION;

-- ── Build the loser sets ────────────────────────────────────────────────────

-- Loser invoices: every duplicate-group row that is NOT the winner.
-- winner = most amount_paid, then oldest.
CREATE TEMPORARY TABLE _loser_invoices AS
SELECT invoice_id, client_id, invoice_number, notes, status, amount_paid
FROM (
  SELECT i.id AS invoice_id, i.client_id, i.invoice_number, i.notes,
         i.status, i.amount_paid,
         ROW_NUMBER() OVER (PARTITION BY i.notes
                            ORDER BY i.amount_paid DESC, i.created_at ASC) AS rn,
         COUNT(*)     OVER (PARTITION BY i.notes) AS grp
  FROM invoices i
  WHERE i.notes LIKE 'Prepaid first-period invoice%'
) x
WHERE x.grp > 1 AND x.rn > 1;

-- Loser payments: payments allocated to a loser invoice.
CREATE TEMPORARY TABLE _loser_payments AS
SELECT DISTINCT pa.payment_id
FROM payment_allocations pa
JOIN _loser_invoices li ON li.invoice_id = pa.invoice_id;

-- Loser subscriptions: every duplicate empcloud_subscription_id row that is
-- NOT the winner. winner = active > trialing > past_due > paused > expired >
-- cancelled, then oldest.
CREATE TEMPORARY TABLE _loser_subs AS
SELECT subscription_id
FROM (
  SELECT s.id AS subscription_id,
         ROW_NUMBER() OVER (
           PARTITION BY s.org_id,
                        JSON_UNQUOTE(JSON_EXTRACT(s.metadata,'$.empcloud_subscription_id'))
           ORDER BY FIELD(s.status,'active','trialing','past_due','paused','expired','cancelled'),
                    s.created_at ASC) AS rn,
         COUNT(*) OVER (
           PARTITION BY s.org_id,
                        JSON_UNQUOTE(JSON_EXTRACT(s.metadata,'$.empcloud_subscription_id'))
         ) AS grp
  FROM subscriptions s
  WHERE JSON_EXTRACT(s.metadata,'$.empcloud_subscription_id') IS NOT NULL
) x
WHERE x.grp > 1 AND x.rn > 1;

-- ── STEP 0: INSPECT — review all of this BEFORE running the deletes ─────────

SELECT 'loser invoices'      AS what, COUNT(*) AS n FROM _loser_invoices
UNION ALL SELECT 'loser payments',      COUNT(*) FROM _loser_payments
UNION ALL SELECT 'loser subscriptions', COUNT(*) FROM _loser_subs;

-- exactly which invoices will be deleted (eyeball the org/module spread):
SELECT * FROM _loser_invoices ORDER BY notes, invoice_number;

-- GUARD 1: no loser invoice may be 'paid'. MUST return 0 rows.
SELECT * FROM _loser_invoices WHERE status = 'paid';

-- GUARD 2: no loser payment may also be allocated to a SURVIVING invoice
-- (a split payment). MUST return 0 rows — if not, STOP and handle by hand.
SELECT pa.payment_id, pa.invoice_id
FROM payment_allocations pa
WHERE pa.payment_id IN (SELECT payment_id FROM _loser_payments)
  AND pa.invoice_id NOT IN (SELECT invoice_id FROM _loser_invoices);

-- ── STEP 1: delete loser invoices (allocations first — FK has no cascade) ───
DELETE pa FROM payment_allocations pa
  JOIN _loser_invoices li ON li.invoice_id = pa.invoice_id;
DELETE FROM invoice_items WHERE invoice_id IN (SELECT invoice_id FROM _loser_invoices);
DELETE FROM invoices
  WHERE id IN (SELECT invoice_id FROM _loser_invoices)
    AND status <> 'paid';                       -- hard guard, never nuke a paid invoice

-- ── STEP 2: delete loser payments (now fully unallocated) ───────────────────
DELETE FROM payments WHERE id IN (SELECT payment_id FROM _loser_payments);

-- ── STEP 3: delete loser subscriptions (+ subscription_events) ──────────────
DELETE FROM subscription_events WHERE subscription_id IN (SELECT subscription_id FROM _loser_subs);
DELETE FROM subscriptions       WHERE id              IN (SELECT subscription_id FROM _loser_subs);

-- ── STEP 4: delete orphaned EmpCloud-provisioned clients ────────────────────
-- Only clients with NOTHING left attached, and only ones that were clearly
-- auto-provisioned for EmpCloud (custom_fields id, "empcloud" tag, or the
-- synthetic email) — never a real standalone billing client.
DELETE FROM clients
WHERE id NOT IN (SELECT DISTINCT client_id FROM invoices)
  AND id NOT IN (SELECT DISTINCT client_id FROM subscriptions)
  AND id NOT IN (SELECT DISTINCT client_id FROM payments)
  AND (
        JSON_EXTRACT(custom_fields, '$.empcloud_org_id') IS NOT NULL
     OR JSON_CONTAINS(tags, '"empcloud"')
     OR email LIKE 'org-%@empcloud.internal'
  );

-- ── VERIFY: both of these must now return 0 rows ────────────────────────────
SELECT i.notes, COUNT(*) AS still_dup
FROM invoices i
WHERE i.notes LIKE 'Prepaid first-period invoice%'
GROUP BY i.notes HAVING COUNT(*) > 1;

SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.empcloud_subscription_id')) AS emp_sub,
       COUNT(*) AS still_dup
FROM subscriptions
WHERE JSON_EXTRACT(metadata,'$.empcloud_subscription_id') IS NOT NULL
GROUP BY emp_sub HAVING COUNT(*) > 1;

DROP TEMPORARY TABLE _loser_invoices, _loser_payments, _loser_subs;

-- ============================================================================
-- OPTIONAL — currency-corrupted standalone invoice (NOT a duplicate)
-- ----------------------------------------------------------------------------
-- INV-2026-0124: PayPal captured the USD-converted amount but it was recorded
-- as ₹10.44 against a ₹1,000 invoice. (INV-2026-0122 had the same corruption
-- but it is a DUPLICATE — already deleted above — so it needs no fix.)
-- Only run this if the PayPal capture 6CV99730A2925131D genuinely succeeded.
-- ============================================================================
-- UPDATE payments            SET amount = 100000 WHERE id = 'e00b63e3-f6c2-40f1-80fe-417ed4ac0328';
-- UPDATE payment_allocations SET amount = 100000 WHERE payment_id = 'e00b63e3-f6c2-40f1-80fe-417ed4ac0328';
-- UPDATE invoices SET amount_paid = 100000, amount_due = 0, status = 'paid', paid_at = NOW(), updated_at = NOW()
--   WHERE invoice_number = 'INV-2026-0124';
-- UPDATE clients SET total_paid = total_paid + 98956, outstanding_balance = outstanding_balance - 98956, updated_at = NOW()
--   WHERE id = (SELECT client_id FROM invoices WHERE invoice_number = 'INV-2026-0124');

-- ── Finish ──────────────────────────────────────────────────────────────────
-- COMMIT;
-- ROLLBACK;
