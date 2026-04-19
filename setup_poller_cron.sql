-- ============================================================
-- ADD PG_CRON SCHEDULE FOR TEMP EMAIL POLLER
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Enable pg_crop extension (requires postgres privileges or run from dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the schedule to run every 1 minute
-- Replace MSBTHXBMPWSKIALIZGAA with your actual project ref ID
SELECT cron.schedule(
    'tempmail-poller-job',
    '* * * * *', -- Every minute
    $$
    SELECT net.http_post(
        url := 'https://msbthxbmpwskializgaa.supabase.co/functions/v1/tempmail-gmail-poller',
        headers := '{"Content-Type": "application/json", "X-CRON-SECRET": "tempmail-cron-2024"}'::jsonb,
        body := '{"limit": 10}'::jsonb
    );
    $$
);

/*
If you need to unschedule it later, run:
SELECT cron.unschedule('tempmail-poller-job');
*/
