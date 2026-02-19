-- =============================================================
-- FIX: Verification Status Logic
--
-- Problem: All verifications rows remain status='pending_payment'
-- even when data clearly indicates a more advanced state.
--
-- This script:
--   1. Ensures the status column exists with correct values
--   2. Backfills existing rows with correct status
--   3. Creates a BEFORE UPDATE trigger that auto-transitions status
--   4. Creates a BEFORE INSERT trigger that sets correct initial status
--
-- Safe: idempotent, no data deletion, no schema breakage.
-- Run this in Supabase SQL Editor.
-- =============================================================


-- ─── Step 1: Ensure status column exists ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'verifications'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.verifications 
      ADD COLUMN status text DEFAULT 'pending_payment';
  END IF;
END $$;


-- ─── Step 2: Backfill existing rows with correct status ─────────

-- Priority order matters: most advanced state wins.
-- We go from least advanced to most advanced so the last UPDATE
-- wins for rows matching multiple conditions.

-- 2a. If paystack_reference exists but no smspool_order_id → paid
UPDATE public.verifications
SET status = 'paid'
WHERE paystack_reference IS NOT NULL
  AND (smspool_order_id IS NULL)
  AND status = 'pending_payment';

-- 2b. If smspool_order_id exists but OTP not yet received → number_assigned
UPDATE public.verifications
SET status = 'number_assigned'
WHERE smspool_order_id IS NOT NULL
  AND (otp_code IS NULL OR otp_code = 'PENDING')
  AND status IN ('pending_payment', 'paid');

-- 2c. If real OTP code received → completed
UPDATE public.verifications
SET status = 'completed'
WHERE otp_code IS NOT NULL
  AND otp_code != 'PENDING'
  AND otp_code != ''
  AND status IN ('pending_payment', 'paid', 'number_assigned');


-- ─── Step 3: Create trigger function ────────────────────────────
CREATE OR REPLACE FUNCTION auto_update_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Most advanced state wins (check from most → least advanced)

  -- If otp_code changes from NULL/'PENDING' to a real code → completed
  IF NEW.otp_code IS NOT NULL 
     AND NEW.otp_code != 'PENDING' 
     AND NEW.otp_code != '' THEN
    NEW.status := 'completed';
    RETURN NEW;
  END IF;

  -- If smspool_order_id becomes NOT NULL → number_assigned
  IF NEW.smspool_order_id IS NOT NULL 
     AND (NEW.otp_code IS NULL OR NEW.otp_code = 'PENDING' OR NEW.otp_code = '') THEN
    NEW.status := 'number_assigned';
    RETURN NEW;
  END IF;

  -- If paystack_reference becomes NOT NULL → paid
  IF NEW.paystack_reference IS NOT NULL 
     AND NEW.smspool_order_id IS NULL THEN
    NEW.status := 'paid';
    RETURN NEW;
  END IF;

  -- No transition matched — keep existing status
  RETURN NEW;
END;
$$;


-- ─── Step 4: Create BEFORE UPDATE trigger ───────────────────────
DROP TRIGGER IF EXISTS trg_auto_verification_status_update ON public.verifications;
CREATE TRIGGER trg_auto_verification_status_update
  BEFORE UPDATE ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_verification_status();


-- ─── Step 5: Create BEFORE INSERT trigger ───────────────────────
-- So that even on INSERT, the correct initial status is set
DROP TRIGGER IF EXISTS trg_auto_verification_status_insert ON public.verifications;
CREATE TRIGGER trg_auto_verification_status_insert
  BEFORE INSERT ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_verification_status();


-- ─── Step 6: Verify ─────────────────────────────────────────────
SELECT 'Verification status fix applied successfully' AS result;

-- Show status distribution after fix
SELECT status, COUNT(*) AS count
FROM public.verifications
GROUP BY status
ORDER BY count DESC;

-- Confirm triggers exist
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname LIKE 'trg_auto_verification_status%';

-- Confirm function exists
SELECT proname 
FROM pg_proc
WHERE proname = 'auto_update_verification_status'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
