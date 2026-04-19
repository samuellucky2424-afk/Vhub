import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TEMPMAIL_DOMAIN = Deno.env.get("TEMPMAIL_DOMAIN") || "lumox.sbs";
const TEMPMAIL_PRICE_KOBO = Number(Deno.env.get("TEMPMAIL_PRICE_KOBO") || "130000");
const TEMPMAIL_EXPIRY_MINUTES = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const FIRST_NAMES = [
  "Joshua", "Emma", "David", "Sarah", "Michael", "Grace", "Daniel", "Faith", "Samuel", "Joy",
  "Peter", "Mary", "John", "Blessing", "James", "Mercy", "Andrew", "Ruth", "Victor", "Hope",
  "Paul", "Esther", "Benjamin", "Hannah", "Joseph", "Rebecca", "Isaac", "Rachel", "Nathan", "Anna",
  "Aaron", "Sophia", "Adam", "Olivia", "Caleb", "Lily", "Ethan", "Chloe", "Luke", "Ella",
  "Mark", "Zara", "Leo", "Mia", "Alex", "Iris", "Max", "Ruby", "Ryan", "Luna",
];

// Generate email like Joshua4837@lumox.sbs
function generateEmailLocal(): string {
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const digits = Math.floor(1000 + Math.random() * 9000); // 4-digit
  return `${name}${digits}@${TEMPMAIL_DOMAIN}`;
}

// Generate a unique email, checking DB for duplicates (up to 10 retries)
async function generateUniqueEmail(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const email = generateEmailLocal();

    // Check if this email already exists in temp_emails
    const { data: existing } = await supabase
      .from("temp_emails")
      .select("id")
      .eq("email_address", email)
      .maybeSingle();

    if (!existing) {
      console.log(`[TEMPMAIL] Generated unique email: ${email} (attempt ${attempt + 1})`);
      return email;
    }

    console.log(`[TEMPMAIL] Collision on ${email}, retrying...`);
  }

  // Fallback: use name + timestamp to guarantee uniqueness
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const fallback = `${name}${Date.now().toString(36)}@${TEMPMAIL_DOMAIN}`;
  console.log(`[TEMPMAIL] Using fallback email: ${fallback}`);
  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, message: "Method not allowed" }, 405);

  try {
    const payload = await req.json();
    const { action } = payload;

    // --- Authenticate user ---
    const authHeader = req.headers.get("Authorization");
    const headerToken = authHeader ? authHeader.replace("Bearer ", "") : null;
    const token = payload.user_token || headerToken;

    if (!token) {
      return jsonResponse({ success: false, message: "Missing authentication token" }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("[TEMPMAIL] Auth failed:", authError?.message);
      return jsonResponse({ success: false, message: "Invalid or expired user token" }, 401);
    }

    console.log(`[TEMPMAIL] Authenticated user: ${user.id}, action: ${action}`);

    // ─── LIST: Fetch user's temp emails with messages ───
    if (action === "list_tempmails") {
      const { data: emails, error: listErr } = await supabase
        .from("temp_emails")
        .select(`
          id, email_address, status, created_at, expires_at,
          temp_email_messages ( id, sender, subject, body, received_at )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (listErr) {
        console.error("[TEMPMAIL] List error:", listErr.message);
        return jsonResponse({ success: false, message: listErr.message }, 500);
      }

      // Also fetch legacy orders for backwards compatibility
      const { data: orders } = await supabase
        .from("temp_email_orders")
        .select("id,email,order_status,otp_code,email_body,created_at,updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      return jsonResponse({ success: true, emails: emails || [], orders: orders || [] });
    }

    // ─── PURCHASE: Buy a new temp email ───
    if (action !== "purchase_tempmail") {
      return jsonResponse({ success: false, message: `Invalid action: ${action}` }, 400);
    }

    // Capture requested service
    const requestedService = payload.service || "Default";

    // 1. Generate unique email
    const emailAddress = await generateUniqueEmail();
    console.log(`[TEMPMAIL] Email generated: ${emailAddress} for user ${user.id}, Service: ${requestedService}`);

    // 2. Check wallet balance
    if (TEMPMAIL_PRICE_KOBO > 0) {
      const { data: walletInfo, error: walletErr } = await supabase.rpc("get_wallet_balance", {
        p_user_id: user.id,
      });

      if (walletErr || !walletInfo?.found) {
        console.error("[TEMPMAIL] Wallet error:", walletErr?.message);
        return jsonResponse({ success: false, message: "Wallet not found. Please fund your wallet first." }, 400);
      }

      let actualBalanceKobo = 0;
      if (walletInfo.balance_kobo != null && Number(walletInfo.balance_kobo) > 0) {
        actualBalanceKobo = Number(walletInfo.balance_kobo);
      } else if (walletInfo.balance != null && Number(walletInfo.balance) > 0) {
        actualBalanceKobo = Math.round(Number(walletInfo.balance) * 100);
      }

      console.log(`[TEMPMAIL] Balance: ${actualBalanceKobo} kobo, Required: ${TEMPMAIL_PRICE_KOBO} kobo`);

      if (actualBalanceKobo < TEMPMAIL_PRICE_KOBO) {
        const have = (actualBalanceKobo / 100).toFixed(2);
        const need = (TEMPMAIL_PRICE_KOBO / 100).toFixed(2);
        return jsonResponse({ success: false, message: `Insufficient funds. Need ₦${need}, have ₦${have}` }, 400);
      }

      // 3. Deduct wallet
      const newBalance = actualBalanceKobo - TEMPMAIL_PRICE_KOBO;
      const { error: deductErr } = await supabase
        .from("wallets")
        .update({ balance_kobo: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (deductErr) {
        console.error("[TEMPMAIL] Wallet deduction failed:", deductErr.message);
        return jsonResponse({ success: false, message: `Wallet deduction failed: ${deductErr.message}` }, 500);
      }

      // 4. Record transaction
      const reference = `TMP-${crypto.randomUUID()}`;
      const { error: txnErr } = await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "debit",
        amount_kobo: -TEMPMAIL_PRICE_KOBO,
        currency: "NGN",
        reference,
        status: "completed",
      });

      if (txnErr) {
        console.warn("[TEMPMAIL] Transaction log failed (non-critical):", txnErr.message);
      }

      console.log(`[TEMPMAIL] Deducted ${TEMPMAIL_PRICE_KOBO} kobo. New balance: ${newBalance}`);
    }

    // 5. Insert into temp_emails table
    const expiresAt = new Date(Date.now() + TEMPMAIL_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const { data: emailRecord, error: emailInsertErr } = await supabase
      .from("temp_emails")
      .insert({
        user_id: user.id,
        email_address: emailAddress.toLowerCase(),
        status: "active",
        expires_at: expiresAt,
        service: requestedService,
      })
      .select("id, email_address, status, created_at, expires_at, service")
      .single();

    if (emailInsertErr) {
      console.error("[TEMPMAIL] temp_emails insert failed:", emailInsertErr.message);
      return jsonResponse({ success: false, message: `Failed to save email: ${emailInsertErr.message}` }, 500);
    }

    console.log(`[TEMPMAIL] Saved to temp_emails: ${emailRecord.id}`);

    // 6. Also insert into temp_email_orders for backwards compatibility
    const { data: orderRecord, error: orderInsertErr } = await supabase
      .from("temp_email_orders")
      .insert({
        user_id: user.id,
        email: emailAddress,
        order_status: "waiting",
        otp_code: null,
        email_body: null,
      })
      .select("id, email, order_status, otp_code, email_body, created_at, updated_at")
      .single();

    if (orderInsertErr) {
      console.warn("[TEMPMAIL] temp_email_orders insert failed (non-critical):", orderInsertErr.message);
    }

    console.log(`[TEMPMAIL] Purchase complete. Email: ${emailAddress}, User: ${user.id}`);

    return jsonResponse({
      success: true,
      email: emailRecord,
      order: orderRecord || null,
    });
  } catch (err) {
    console.error("[TEMPMAIL] Unhandled error:", err.message);
    return jsonResponse({ success: false, message: err.message }, 500);
  }
});
