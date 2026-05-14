-- ============================================================================
-- Cleanup: org 21 (EmpCloud) duplicate billing records
-- ----------------------------------------------------------------------------
-- Cause: two concurrent `subscription.created` webhooks on 2026-05-14 05:05:35
--        raced through findOrCreateClient() before either committed, so each
--        created its own client -> subscription -> invoice. The idempotency
--        check is scoped by client_id, so it never matched.
--
-- Result for EmpCloud org 21 / module emp-payroll (EmpCloud org_subscriptions.id = 72):
--
--   KEEP  (paid lineage)
--     client       9a30d6d0-4d2e-4f9a-806d-378ee745331d
--     subscription <the ACTIVE one>          (e03b77be-... per logs)
--     invoice      INV-2026-0120              -- PAID  (c990695c-..., Stripe, 05:17:41)
--
--   DELETE (unpaid duplicate lineage)
--     client       d2d0e961-7c1b-41e7-896c-e582d88267af
--     subscription 7dfacba5-f7a1-4355-a9a3-80f306cdca65   -- already cancelled
--     invoice      INV-2026-0121              -- unpaid
--
-- This script is written to DERIVE the client ids from the invoices so it
-- cannot delete the wrong lineage even if the log-order pairing was off.
-- Run against the emp_billing database. Review the SELECTs in STEP 0 first.
-- Wrap in a transaction so you can ROLLBACK if STEP 0 looks wrong.
-- ============================================================================

START TRANSACTION;

-- Resolve the two client ids straight from the invoices (no hardcoded pairing).
SET @keep_client := (SELECT client_id FROM invoices WHERE invoice_number = 'INV-2026-0120');
SET @dup_client  := (SELECT client_id FROM invoices WHERE invoice_number = 'INV-2026-0121');
SET @dup_invoice := (SELECT id        FROM invoices WHERE invoice_number = 'INV-2026-0121');
SET @dup_sub     := '7dfacba5-f7a1-4355-a9a3-80f306cdca65';

-- ── STEP 0: INSPECT — run these, eyeball them, only then continue ────────────
-- INV-2026-0120 must be PAID; INV-2026-0121 must be unpaid (amount_paid = 0).
SELECT id, invoice_number, client_id, status, total, amount_paid, amount_due
FROM   invoices
WHERE  client_id IN (@keep_client, @dup_client);

-- The duplicate subscription must be the cancelled one; the kept client's
-- subscription must still be active.
SELECT id, client_id, status, metadata
FROM   subscriptions
WHERE  client_id IN (@keep_client, @dup_client);

-- The duplicate invoice must have NO payments allocated to it.
SELECT * FROM payment_allocations WHERE invoice_id = @dup_invoice;

-- ── STEP 1: delete the duplicate invoice (guarded: never if it was paid) ─────
DELETE FROM invoice_items WHERE invoice_id = @dup_invoice;

DELETE FROM invoices
WHERE  id = @dup_invoice
  AND  amount_paid = 0;          -- hard guard against nuking a paid invoice

-- ── STEP 2: delete the duplicate subscription + its events ──────────────────
DELETE FROM subscription_events WHERE subscription_id = @dup_sub;
DELETE FROM subscriptions       WHERE id = @dup_sub;

-- ── STEP 3: delete the orphaned duplicate client (only if nothing is left) ──
DELETE FROM clients
WHERE  id = @dup_client
  AND  NOT EXISTS (SELECT 1 FROM invoices      WHERE client_id = @dup_client)
  AND  NOT EXISTS (SELECT 1 FROM subscriptions WHERE client_id = @dup_client)
  AND  NOT EXISTS (SELECT 1 FROM payments      WHERE client_id = @dup_client);

-- ── STEP 4: fix the surviving client's email ────────────────────────────────
-- It was provisioned with the synthetic fallback (org-21@empcloud.internal)
-- because EmpCloud's emitter never sent a real address. Set the real one.
-- >>> REPLACE the placeholder with org 21's actual org_admin email <<<
UPDATE clients
SET    email = 'REPLACE_WITH_ORG_21_ADMIN_EMAIL',
       updated_at = NOW()
WHERE  id = @keep_client;

-- ── STEP 5: verify, then COMMIT (or ROLLBACK if anything looks wrong) ───────
SELECT 'remaining invoices'      AS check_name, COUNT(*) AS n FROM invoices      WHERE client_id = @keep_client
UNION ALL
SELECT 'remaining subscriptions', COUNT(*)               FROM subscriptions WHERE client_id = @keep_client
UNION ALL
SELECT 'dup client still exists', COUNT(*)               FROM clients       WHERE id = @dup_client;

-- COMMIT;
-- ROLLBACK;

-- ============================================================================
-- AFTER committing the above, run this against the `empcloud` database to
-- repoint the bridge tables at the surviving billing records.
-- (column names per empcloud-webhook-emitter.ts persistMappings())
-- ============================================================================
-- UPDATE billing_client_mappings
-- SET    billing_client_id = '9a30d6d0-4d2e-4f9a-806d-378ee745331d'
-- WHERE  organization_id = 21;
--
-- UPDATE billing_subscription_mappings
-- SET    billing_subscription_id = (SELECT id FROM emp_billing.subscriptions
--                                   WHERE client_id = '9a30d6d0-4d2e-4f9a-806d-378ee745331d'
--                                   LIMIT 1)
-- WHERE  organization_id = 21 AND cloud_subscription_id = 72;
