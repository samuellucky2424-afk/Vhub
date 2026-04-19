const SUPABASE_URL = "https://msbthxbmpwskializgaa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg";

const TEMPMAIL_PRICE_KOBO = 130000;

async function run() {
    // Find ALL expired emails that don't have a corresponding refund
    const emailUrl = `${SUPABASE_URL}/rest/v1/temp_emails?select=id,email_address,user_id&status=eq.expired&order=created_at.desc`;
    const emailRes = await fetch(emailUrl, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const expiredEmails = await emailRes.json();

    // Get all existing refund transactions
    const txUrl = `${SUPABASE_URL}/rest/v1/wallet_transactions?select=reference&reference=like.REFUND-TMP*`;
    const txRes = await fetch(txUrl, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const existingRefunds = await txRes.json();
    const refundedIds = new Set(existingRefunds.map(t => t.reference.replace('REFUND-TMP-MANUAL-', '')));

    console.log(`Found ${expiredEmails.length} expired emails, ${refundedIds.size} already refunded`);

    // Refund any that are missing
    for (const email of expiredEmails) {
        if (refundedIds.has(email.id)) {
            console.log(`  Already refunded: ${email.email_address}`);
            continue;
        }

        const ref = `REFUND-TMP-MANUAL-${email.id}`;
        console.log(`  Refunding: ${email.email_address} ...`);

        const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/credit_wallet`;
        const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                p_user_id: email.user_id,
                p_amount: TEMPMAIL_PRICE_KOBO,
                p_reference: ref,
                p_metadata: { source: "tempmail_refund_manual", email: email.email_address }
            })
        });
        const data = await res.json();
        console.log(`    Result:`, data);
    }

    // Final balance
    const walletUrl = `${SUPABASE_URL}/rest/v1/wallets?select=*&user_id=eq.ff3edbab-9090-405e-b4eb-019e471663ed`;
    const walletRes = await fetch(walletUrl, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    const wallet = await walletRes.json();
    console.log(`\nFinal Balance: ₦${(wallet[0]?.balance_kobo / 100).toFixed(2)}`);
}

run();
