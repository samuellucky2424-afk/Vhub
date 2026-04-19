require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_MY_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmails() {
    const { data: emails, error: emailErr } = await supabase
        .from('temp_emails')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent Emails:", emails || emailErr);

    const { data: transactions, error: transErr } = await supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("Recent Transactions:", transactions || transErr);
}

checkEmails();
