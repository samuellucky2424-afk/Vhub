# Cloudflare TempMail Poller Worker

This worker runs a Durable Object loop that calls your Supabase Edge Function `tempmail-gmail-poller` every ~5 seconds.

## Why
Supabase Edge Functions are request/response only (not always-on). This worker provides the always-on polling loop without impacting your existing SMS OTP flow.

## Setup

### 1) Deploy Supabase Edge Function
Deploy the functions:
- `tempmail-gmail-poller`
- `tempmail-service`

Also deploy the DB migration for `temp_email_orders`.

### 2) Set Supabase secret
Set this secret for the `tempmail-gmail-poller` function:
- `TEMPMAIL_CRON_SECRET`

This function now requires header `X-CRON-SECRET` to run.

### 3) Configure Cloudflare Worker
Edit `wrangler.toml` and set:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then set the secret:
- `wrangler secret put SUPABASE_CRON_SECRET`

Use the same value as `TEMPMAIL_CRON_SECRET` in Supabase.

### 4) Deploy worker
From this directory:
- `npm create cloudflare@latest` is NOT required; this repo already includes the worker source.
- Install wrangler globally or use `npx wrangler`.

Deploy:
- `npx wrangler deploy`

### 5) Start the poll loop
Call the admin endpoint with the secret:

- `POST https://<your-worker>/.` is not used.

Use:
- `POST https://<your-worker-domain>/admin/start`
  - header: `X-CRON-SECRET: <same secret>`

Check status:
- `GET https://<your-worker-domain>/admin/status`
  - header: `X-CRON-SECRET: <same secret>`

Stop:
- `POST https://<your-worker-domain>/admin/stop`
  - header: `X-CRON-SECRET: <same secret>`

## Notes
- Poll interval is controlled by `POLL_INTERVAL_MS` in `wrangler.toml` (default `5000`).
- This loop marks processed Gmail messages as read (removes `UNREAD`).
