-- Grant table-level permissions to authenticated users for temp_email_orders
-- This fixes the 403 "permission denied for table temp_email_orders" error
-- RLS policies already exist from the migration, but the base GRANT was missing.

GRANT SELECT, INSERT, UPDATE ON public.temp_email_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.temp_email_orders TO anon;

-- Also enable realtime for the table so subscriptions work
ALTER publication supabase_realtime ADD TABLE public.temp_email_orders;
