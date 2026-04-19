-- =============================================================
-- auto_refund_stale_orders — Safety net for stuck orders
--
-- Finds orders that are "processing" (payment_status='pending')
-- with no provider_order_id (request_id IS NULL) for > 60 seconds.
-- Refunds wallet and marks order as failed.
--
-- This is a SAFETY NET. With the new provider-first flow, orders
-- should rarely get stuck. But this handles edge cases.
--
-- Can be run manually or via pg_cron:
--   SELECT cron.schedule('refund-stale-orders', '* * * * *', 
--     'SELECT auto_refund_stale_orders()');
--
-- Run this in Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION auto_refund_stale_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_refund_count int := 0;
  v_wallet_id uuid;
  v_current_balance bigint;
BEGIN
  -- Find stale orders:
  -- - payment_status is 'pending' (wallet was deducted but order not finalized)
  -- - request_id IS NULL (SMSPool never confirmed a number)
  -- - created more than 60 seconds ago
  FOR v_order IN
    SELECT id, user_id, price_kobo, payment_reference,
           (metadata->>'wallet_deduction')::bigint AS wallet_deduction
    FROM public.orders
    WHERE payment_status = 'pending'
      AND request_id IS NULL
      AND created_at < NOW() - INTERVAL '60 seconds'
    FOR UPDATE SKIP LOCKED  -- Skip orders being processed by another transaction
  LOOP
    -- Determine refund amount
    DECLARE
      v_refund_amount bigint;
    BEGIN
      v_refund_amount := v_order.wallet_deduction;
      IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
        v_refund_amount := v_order.price_kobo;
      END IF;

      IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
        -- No valid amount to refund, just mark as failed
        UPDATE public.orders
        SET payment_status = 'failed', status = 'expired',
            metadata = metadata || jsonb_build_object('auto_refund', 'no_valid_amount', 'auto_refund_at', now()::text)
        WHERE id = v_order.id;
        CONTINUE;
      END IF;

      -- Check for existing refund (idempotency)
      IF EXISTS (
        SELECT 1 FROM public.wallet_transactions
        WHERE reference = v_order.id::text AND type = 'refund' AND user_id = v_order.user_id
      ) THEN
        -- Already refunded, just fix status
        UPDATE public.orders
        SET payment_status = 'refunded', status = 'expired'
        WHERE id = v_order.id;
        CONTINUE;
      END IF;

      -- Credit wallet
      UPDATE public.wallets
      SET balance_kobo = balance_kobo + v_refund_amount, updated_at = now()
      WHERE user_id = v_order.user_id;

      -- Log refund transaction
      INSERT INTO public.wallet_transactions (
        user_id, amount_kobo, currency, type, reference, status
      ) VALUES (
        v_order.user_id, v_refund_amount, 'NGN', 'refund', v_order.id::text, 'completed'
      );

      -- Mark order as failed
      UPDATE public.orders
      SET payment_status = 'refunded', status = 'expired',
          metadata = metadata || jsonb_build_object(
            'auto_refund', true,
            'auto_refund_amount', v_refund_amount,
            'auto_refund_at', now()::text,
            'auto_refund_reason', 'stale_order_no_provider'
          )
      WHERE id = v_order.id;

      v_refund_count := v_refund_count + 1;
      RAISE NOTICE 'Auto-refunded order % for user % — amount: %', v_order.id, v_order.user_id, v_refund_amount;
    END;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'refunded_count', v_refund_count);
END;
$$;

-- Verify
SELECT 'auto_refund_stale_orders function created successfully' AS result;
