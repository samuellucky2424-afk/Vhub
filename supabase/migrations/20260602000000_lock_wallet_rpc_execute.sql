-- Wallet balance mutations must be executed only by trusted server code.
-- Supabase Edge Functions use the service_role key; browser clients must not
-- be able to call these SECURITY DEFINER functions directly.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'atomic_purchase_verification',
        'credit_user_wallet',
        'credit_wallet',
        'deduct_wallet',
        'get_wallet_balance',
        'process_order_refund',
        'process_purchase'
      ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn.signature);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn.signature);
  END LOOP;
END $$;
