import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TEMPMAIL_DOMAIN = Deno.env.get("TEMPMAIL_DOMAIN") || "lumox.sbs";
const TEMPMAIL_PRICE_KOBO = Number(Deno.env.get("TEMPMAIL_PRICE_KOBO") || "5000");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    },
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randomString(len: number) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization");
        const token = authHeader ? authHeader.replace("Bearer ", "") : null;

        if (!token) {
            return new Response(JSON.stringify({ success: false, message: "Missing authentication token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return new Response(JSON.stringify({ success: false, message: "Invalid or expired user token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const email = `${randomString(10)}@${TEMPMAIL_DOMAIN}`;
        console.log(`[TEMPMAIL] Generated email ${email} for user ${user.id}`);

        // Deduct balance
        const reference = `TMP-${crypto.randomUUID()}`;
        const { data: debitResult, error: debitError } = await supabase.rpc("deduct_wallet", {
            p_user_id: user.id,
            p_amount_kobo: TEMPMAIL_PRICE_KOBO,
            p_reference: reference,
            p_metadata: { source: "tempmail", email },
        });

        if (debitError) {
            return new Response(JSON.stringify({ success: false, message: debitError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!debitResult?.success) {
            return new Response(JSON.stringify({ success: false, message: "Insufficient wallet balance." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Create order
        const { data: inserted, error: insertError } = await supabase
            .from("temp_email_orders")
            .insert({
                user_id: user.id,
                email,
                order_status: "waiting"
            })
            .select("id,email,order_status,otp_code,email_body,service,created_at,updated_at")
            .single();

        if (insertError) {
            return new Response(JSON.stringify({ success: false, message: insertError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ success: true, email: inserted }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
