
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
        const firstEquals = line.indexOf("=");
        if (firstEquals !== -1) {
            const key = line.substring(0, firstEquals).trim();
            const value = line.substring(firstEquals + 1).trim();
            if (key && value) {
                process.env[key] = value;
            }
        }
    });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

// We need to call the function via HTTP, not just locally, to test the full flow including signature verification if we were external,
// but since we can't easily generate a valid Paystack signature without their private key (which we have in env actually).
// Let's generate a valid signature!

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
if (!PAYSTACK_SECRET_KEY) {
    console.error("Missing PAYSTACK_SECRET_KEY");
    process.exit(1);
}

// Pick a pending order to simulate payment for
// Let's use the most recent one
const ORDER_ID_TO_TEST = '3b153346-f2fc-4ec8-9c1b-3eca70ccecd0';
const ORDER_REFERENCE = 'order_1770651201409_dw1v48';
const AMOUNT_PAID_KOBO = 37600; // 376 NGN * 100

const payload = {
    event: "charge.success",
    data: {
        reference: ORDER_REFERENCE,
        amount: AMOUNT_PAID_KOBO,
        metadata: {}
    }
};

const body = JSON.stringify(payload);

// Calculate Signature
import crypto from 'crypto';
const signature = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');

console.log(`Simulating Webhook for Ref: ${ORDER_REFERENCE}`);
console.log(`Signature: ${signature}`);

// Call the function
// Note: Edge Functions are hosted on Supabase. We can call the local dev server if running, or the deployed one.
// The user is running 'npm run dev', which usually corresponds to frontend. 
// If they haven't started supabase functions locally, we might need to target the deployed URL if configured, 
// OR we just use the debug script to call the logic directly if strictly necessary. 
// BUT the prompt says "Supabase URL" is likely remote.
// Let's try to hit the remote function URL if we can find it, or assume standard path.
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/paystack-webhook`;

console.log(`Target: ${FUNCTION_URL}`);

fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-paystack-signature': signature
    },
    body: body
})
    .then(async res => {
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);
    })
    .catch(err => {
        console.error("Fetch error:", err);
    });
