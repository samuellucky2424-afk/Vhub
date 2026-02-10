-- Enable Realtime for the orders table
-- This allows the front-end to listen for changes via Supabase Realtime
alter publication supabase_realtime add table orders;
