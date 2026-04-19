const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const crypto = require('crypto');

// Configuration from verified environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'place_holder_key';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'place_holder_key';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'place_holder_key';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/paystack-webhook`;

// Admin Client (Service Role)
const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// User Client (Anon Key)
const userSupabase = createClient(SUPABASE_URL, ANON_KEY);

async function getOrCreateTestUser() {
    console.log("Looking for test user...");
    // Retrieve users via Admin
    const { data: { users }, error } = await adminSupabase.auth.admin.listUsers();

    // We ideally want a fresh user or one we know the password for.
    // Since we created one with 'Password123!' previously, let's look for 'test_user_' emails.
    const testUser = users.find(u => u.email.startsWith('test_user_'));

    if (testUser) {
        console.log(`Found existing test user: ${testUser.email}`);
        return { id: testUser.id, email: testUser.email, password: 'Password123!' };
    }

    // Create new
    console.log("Creating new test user...");
    const email = `test_user_${Date.now()}@example.com`;
    const password = 'Password123!';

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true
    });

    if (createError) throw new Error(`Failed to create user: ${createError.message}`);
    console.log(`Created test user: ${newUser.user.id}`);
    return { id: newUser.user.id, email: email, password: password };
}

function sendWebhook(payload) {
    const body = JSON.stringify(payload);
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex');

    return new Promise((resolve, reject) => {
        const req = https.request(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-paystack-signature': hash
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
    console.log("Starting Validated Webhook Test...");

    try {
        const user = await getOrCreateTestUser();
        const password = 'Password123!'; // Known password for all test users created by this script

        // Sign In
        console.log(`Signing in as ${user.email}...`);
        const { data: sessionData, error: loginError } = await userSupabase.auth.signInWithPassword({
            email: user.email,
            password: password
        });

        if (loginError) throw new Error(`Login failed: ${loginError.message}`);
        console.log("Logged in successfully.");

        // 1. Create Test Order (Authenticated)
        const testRef = `test_val_${Date.now()}`;
        const expectedNGN = 5000;

        const { data: order, error: orderError } = await userSupabase
            .from('orders')
            .insert({
                user_id: user.id,
                service_type: 'Test Service',
                price_usd: 1.00,
                payment_status: 'pending',
                payment_reference: testRef,
                metadata: {
                    total_paid_ngn: expectedNGN
                }
            })
            .select()
            .single();

        if (orderError) throw new Error(`Order creation failed: ${orderError.message}`);
        console.log(`Created Order: ${order.id} (Expected: ₦${expectedNGN})`);


        // 2. Test Underpayment (e.g. ₦2000)
        console.log("\n--- Testing Underpayment (₦2000) ---");
        const underpayPayload = {
            event: 'charge.success',
            data: {
                reference: testRef,
                amount: 2000 * 100, // 200000 kobo
                metadata: {}
            }
        };

        const res1 = await sendWebhook(underpayPayload);
        console.log(`Webhook Response: ${res1.status} ${res1.body}`);

        // Verify status (Using Admin Client to read)
        await new Promise(r => setTimeout(r, 2000));
        const { data: updatedOrder } = await adminSupabase
            .from('orders')
            .select('*')
            .eq('id', order.id)
            .single();

        console.log(`Order Status: ${updatedOrder.payment_status}`);
        console.log(`Error Meta:`, updatedOrder.metadata?.payment_error);

        if (updatedOrder.payment_status === 'failed' && updatedOrder.metadata?.payment_error) {
            console.log("✅ Underpayment Test PASSED");
        } else {
            console.error("❌ Underpayment check FAILED");
        }


        // 3. Test Full Payment check (New Order)
        console.log("\n--- Testing Full Payment (₦5000) ---");
        const testRef2 = `test_val_ok_${Date.now()}`;

        const { data: order2, error: orderError2 } = await userSupabase
            .from('orders')
            .insert({
                user_id: user.id,
                service_type: 'Test Service',
                price_usd: 1.00,
                payment_status: 'pending',
                payment_reference: testRef2,
                metadata: {
                    total_paid_ngn: expectedNGN
                }
            })
            .select()
            .single();

        if (orderError2) throw new Error(`Order 2 creation failed: ${orderError2.message}`);
        console.log(`Created Order 2: ${order2.id}`);

        const fullPayload = {
            event: 'charge.success',
            data: {
                reference: testRef2,
                amount: 5000 * 100,
                metadata: {}
            }
        };

        const res2 = await sendWebhook(fullPayload);
        console.log(`Webhook Response: ${res2.status} ${res2.body}`);

        await new Promise(r => setTimeout(r, 2000));
        const { data: updatedOrder2 } = await adminSupabase
            .from('orders')
            .select('*')
            .eq('id', order2.id)
            .single();

        console.log(`Order 2 Status: ${updatedOrder2.payment_status}`);

        if (updatedOrder2.payment_status === 'paid') {
            console.log("✅ Full Payment Test PASSED");
        } else {
            console.error("❌ Full Payment check FAILED");
        }

    } catch (err) {
        console.error("Test Failed:", err);
    }
}

runTest();
