import fs from "fs";
import path from "path";
import crypto from "crypto";

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
if (!SUPABASE_URL) {
    console.error("Missing SUPABASE_URL");
    process.exit(1);
}

const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
const TEST_TRANSACTION_ID = process.env.FLUTTERWAVE_TEST_TRANSACTION_ID;
const TEST_TX_REF = process.env.FLUTTERWAVE_TEST_TX_REF;
const TEST_USER_ID = process.env.FLUTTERWAVE_TEST_USER_ID;
const TEST_AMOUNT = Number(process.env.FLUTTERWAVE_TEST_AMOUNT || "5000");

if (!FLUTTERWAVE_WEBHOOK_SECRET_HASH || !TEST_TRANSACTION_ID || !TEST_TX_REF || !TEST_USER_ID) {
    console.error("Missing FLUTTERWAVE_WEBHOOK_SECRET_HASH or required FLUTTERWAVE_TEST_* variables");
    process.exit(1);
}

const payload = {
    event: "charge.completed",
    data: {
        id: Number(TEST_TRANSACTION_ID),
        tx_ref: TEST_TX_REF,
        status: "successful",
        amount: TEST_AMOUNT,
        currency: "NGN",
        meta: {
            type: "wallet_funding",
            user_id: TEST_USER_ID,
        },
    },
};

const body = JSON.stringify(payload);
const signature = crypto.createHmac("sha256", FLUTTERWAVE_WEBHOOK_SECRET_HASH)
    .update(body)
    .digest("hex");

console.log(`Simulating Flutterwave webhook for ref: ${TEST_TX_REF}`);
console.log(`Signature: ${signature}`);

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/flutterwave-webhook`;

console.log(`Target: ${FUNCTION_URL}`);

fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'flutterwave-signature': signature
    },
    body
})
    .then(async res => {
        console.log(`Status: ${res.status}`);
        const text = await res.text();
        console.log(`Response: ${text}`);
    })
    .catch(err => {
        console.error("Fetch error:", err);
    });
