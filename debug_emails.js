const SUPABASE_URL = "https://msbthxbmpwskializgaa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg";

async function fetchFromSupabase(table) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc&limit=5`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    return res.json();
}

async function run() {
    const emails = await fetchFromSupabase('temp_emails');
    console.log("Recent Emails:");
    console.log(emails);

    const transactions = await fetchFromSupabase('wallet_transactions');
    console.log("Recent Transactions:");
    console.log(transactions);
}

run();
