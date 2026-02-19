-- =============================================================
-- refund_failed_verification — Auto-refund for stuck debits
--
-- Finds debit transactions that have NO matching verification row
-- (i.e. money was deducted but verification insert failed).
-- Refunds the wallet and marks orders as refunded.
--
-- Idempotent: safe to run multiple times.
-- Run this in Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION refund_failed_verification(
  p_user_id uuid DEFAULT NULL  -- NULL = process ALL users, specific UUID = single user
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
  v_refund_count int := 0;
  v_skip_count int := 0;
  v_results jsonb[] := ARRAY[]::jsonb[];
BEGIN
  -- Find debit transactions with no matching verification
  FOR v_rec IN
    SELECT
      wt.id AS tx_id,
      wt.user_id,
      wt.amount_kobo,
      wt.reference AS payment_ref,
      wt.created_at AS tx_created_at,
      o.id AS order_id,
      o.payment_status,
      o.status AS order_status
    FROM public.wallet_transactions wt
    LEFT JOIN public.orders o ON o.payment_reference = wt.reference
    LEFT JOIN public.verifications v ON v.order_id = o.id
    WHERE wt.type = 'debit'
      AND wt.status = 'completed'
      AND v.id IS NULL              -- No verification row exists
      AND o.id IS NOT NULL          -- But an order DOES exist
      AND o.payment_status NOT IN ('refunded', 'cancelled')
      AND (p_user_id IS NULL OR wt.user_id = p_user_id)
    ORDER BY wt.created_at ASC
    FOR UPDATE OF wt SKIP LOCKED
  LOOP
    -- Double-refund guard: check if refund tx already exists
    IF EXISTS (
      SELECT 1 FROM public.wallet_transactions
      WHERE reference = 'REFUND-' || v_rec.payment_ref
        AND type = 'refund'
        AND user_id = v_rec.user_id
    ) THEN
      -- Already refunded — just fix order status if needed
      IF v_rec.payment_status != 'refunded' THEN
        UPDATE public.orders
        SET payment_status = 'refunded', status = 'expired'
        WHERE id = v_rec.order_id;
      END IF;
      v_skip_count := v_skip_count + 1;
      CONTINUE;
    END IF;

    -- Credit wallet
    UPDATE public.wallets
    SET balance_kobo = balance_kobo + ABS(v_rec.amount_kobo),
        updated_at = now()
    WHERE user_id = v_rec.user_id;

    -- Log refund transaction
    INSERT INTO public.wallet_transactions (
      user_id, amount_kobo, currency, type, reference, status
    ) VALUES (
      v_rec.user_id,
      ABS(v_rec.amount_kobo),
      'NGN',
      'refund',
      'REFUND-' || v_rec.payment_ref,
      'completed'
    );

    -- Mark order as refunded
    UPDATE public.orders
    SET payment_status = 'refunded',
        status = 'expired',
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'auto_refund', true,
          'auto_refund_reason', 'no_verification_row',
          'auto_refund_amount', ABS(v_rec.amount_kobo),
          'auto_refund_at', now()::text
        )
    WHERE id = v_rec.order_id;

    -- Log to failure_logs if table exists
    BEGIN
      INSERT INTO public.failure_logs (user_id, action, error_message, context, resolved, resolved_at)
      VALUES (
        v_rec.user_id,
        'refund_failed_verification',
        'Debit without verification row — auto-refunded',
        jsonb_build_object(
          'order_id', v_rec.order_id,
          'payment_ref', v_rec.payment_ref,
          'refund_amount', ABS(v_rec.amount_kobo),
          'original_tx_id', v_rec.tx_id
        ),
        true,
        now()
      );
    EXCEPTION WHEN undefined_table THEN
      -- failure_logs table doesn't exist yet, skip
      NULL;
    END;

    v_results := v_results || jsonb_build_object(
      'order_id', v_rec.order_id,
      'user_id', v_rec.user_id,
      'refund_amount', ABS(v_rec.amount_kobo),
      'payment_ref', v_rec.payment_ref
    );

    v_refund_count := v_refund_count + 1;
    RAISE NOTICE 'Auto-refunded: order=%, user=%, amount=%',
      v_rec.order_id, v_rec.user_id, ABS(v_rec.amount_kobo);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_count', v_refund_count,
    'skipped_already_refunded', v_skip_count,
    'details', to_jsonb(v_results)
  );
END;
$$;

-- Verify
SELECT 'refund_failed_verification function created successfully' AS result;
