CREATE OR REPLACE FUNCTION trigger_auto_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NEW.status = 'refunded' AND NEW.payment_status != 'refunded' THEN
    v_result := process_order_refund(NEW.id);
    RAISE NOTICE 'Auto-refund result for order %: %', NEW.id, v_result;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_refund ON public.orders;
CREATE TRIGGER trg_auto_refund
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded')
  EXECUTE FUNCTION trigger_auto_refund();
