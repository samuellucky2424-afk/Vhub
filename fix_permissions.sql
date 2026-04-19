
-- Grant full permissions to service_role to ensure webhooks can read/write orders
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.orders TO postgres;
GRANT ALL ON public.orders TO authenticated;

-- Ensure sequence permissions if any (for ID generation if serial, though UUID is used)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
