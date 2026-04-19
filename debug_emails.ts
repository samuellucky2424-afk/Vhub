import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_MY_SERVICE_ROLE_KEY);

async function checkEmails() {
    const { data, error } = await supabase.from('temp_emails').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("Recent Emails:", data);

    const { data: transactions } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(5);
    console.log("Recent Transactions:", transactions);
}

checkEmails();
