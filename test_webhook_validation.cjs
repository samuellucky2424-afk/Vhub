const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const crypto = require('crypto');

// Configuration from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'place_holder_key';
const FLUTTERWAVE_WEBHOOK_SECRET_HASH = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || 'place_holder_hash';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/flutterwave-webhook`;
const TEST_TRANSACTION_ID = process.env.FLUTTERWAVE_TEST_TRANSACTION_ID;
const TEST_TX_REF = process.env.FLUTTERWAVE_TEST_TX_REF;
const TEST_USER_ID = process.env.FLUTTERWAVE_TEST_USER_ID;
const TEST_AMOUNT = Number(process.env.FLUTTERWAVE_TEST_AMOUNT || '5000');

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

function sendWebhook(payload) {
    const body = JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', FLUTTERWAVE_WEBHOOK_SECRET_HASH).update(body).digest('hex');

    return new Promise((resolve, reject) => {
        const req = https.request(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'flutterwave-signature': hash
            }
        }, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body: responseBody });
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function runTest() {
    console.log("Starting Flutterwave webhook validation test...");

    try {
        if (!TEST_TRANSACTION_ID || !TEST_TX_REF || !TEST_USER_ID) {
            throw new Error(
                'Set FLUTTERWAVE_TEST_TRANSACTION_ID, FLUTTERWAVE_TEST_TX_REF, and FLUTTERWAVE_TEST_USER_ID before running this script.',
            );
        }

        const { data: walletBefore } = await adminSupabase
            .from('wallets')
            .select('balance')
            .eq('user_id', TEST_USER_ID)
            .maybeSingle();

        const initialBalance = walletBefore?.balance || 0;
        console.log(`Initial wallet balance: ${initialBalance}`);

        const payload = {
            event: 'charge.completed',
            data: {
                id: Number(TEST_TRANSACTION_ID),
                tx_ref: TEST_TX_REF,
                status: 'successful',
                amount: TEST_AMOUNT,
                currency: 'NGN',
                meta: {
                    type: 'wallet_funding',
                    user_id: TEST_USER_ID,
                }
            }
        };

        const res = await sendWebhook(payload);
        console.log(`Webhook Response: ${res.status} ${res.body}`);

        await new Promise(r => setTimeout(r, 2000));
        const { data: walletAfter } = await adminSupabase
            .from('wallets')
            .select('balance')
            .eq('user_id', TEST_USER_ID)
            .maybeSingle();
        const { data: transactions } = await adminSupabase
            .from('wallet_transactions')
            .select('reference, amount, status')
            .eq('reference', TEST_TX_REF);

        console.log(`Updated wallet balance: ${walletAfter?.balance}`);
        console.log('Matching wallet transactions:', transactions);

        if (Array.isArray(transactions) && transactions.length >= 1) {
            console.log('✅ Flutterwave webhook test PASSED');
        } else {
            console.error('❌ Flutterwave webhook test FAILED');
        }
    } catch (err) {
        console.error("Test Failed:", err);
    }
}

runTest();
