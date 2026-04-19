import { createClient } from '@supabase/supabase-js';

// Access environment variables using Vite's import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: window.localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});
