import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// --- ENVIRONMENT VARIABLES ---
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("MY_SERVICE_ROLE_KEY");

// --- HELPER: Verify HMAC SHA-512 Signature ---
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!PAYSTACK_SECRET_KEY) {
    console.error("[WEBHOOK ERROR] PAYSTACK_SECRET_KEY is not set.");
    return false;
  }
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(PAYSTACK_SECRET_KEY),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["verify"]
    );
    // Convert hex string to Uint8Array safely
    const match = signature.match(/.{1,2}/g);
    if (!match) return false;

    const sigBytes = new Uint8Array(match.map((b) => parseInt(b, 16)));
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
  } catch (error) {
    console.error("[WEBHOOK ERROR] Error during signature verification:", error);
    return false;
  }
}

// --- SERVE FUNCTION ---
serve(async (req: Request) => {
  // 1. Only allow POST requests (return 405 for Invalid Method)
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // 2. Validate environment variables safely
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[WEBHOOK ERROR] Missing Supabase environment variables.");
      return new Response("OK", { status: 200 }); // Always 200 to prevent retries
    }

    // 3. Extract and validate signature header
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      console.error("[WEBHOOK ERROR] Missing x-paystack-signature header.");
      return new Response("OK", { status: 200 }); // Always 200 to prevent retries
    }

    // 4. Read raw body for verification
    const body = await req.text();
    const isVerified = await verifySignature(body, signature);

    if (!isVerified) {
      console.error("[WEBHOOK ERROR] Invalid signature provided.");
      return new Response("OK", { status: 200 }); // Always 200 to prevent retries
    }

    // 5. Parse webhook payload safely
    let eventPayload;
    try {
      eventPayload = JSON.parse(body);
    } catch (parseError) {
      console.error("[WEBHOOK ERROR] Failed to parse JSON body:", parseError);
      return new Response("OK", { status: 200 });
    }

    const { event, data } = eventPayload;
    console.log(`[WEBHOOK] Received event: ${event}`);

    // 6. Only process 'charge.success' events
    if (event !== "charge.success") {
      console.log(`[WEBHOOK] Ignoring non-charge.success event: ${event}`);
      return new Response("OK", { status: 200 });
    }

    if (!data) {
      console.error("[WEBHOOK ERROR] No data payload in charge.success event.");
      return new Response("OK", { status: 200 });
    }

    // 7. Extract metadata safely with null checks
    const ref = data.reference;
    const metadata = data.metadata || {};

    // Determine if it's a wallet funding event via type or reference prefix
    const isWalletFunding = metadata.type === "wallet_funding" || (ref && typeof ref === "string" && ref.startsWith("fund_"));

    if (!isWalletFunding) {
      console.log(`[WEBHOOK] Ignoring non-wallet-funding charge: ${ref}`);
      return new Response("OK", { status: 200 });
    }

    const userId = metadata.user_id;
    if (!userId) {
      console.error("[WEBHOOK ERROR] Missing user_id in metadata for wallet funding. Ref:", ref);
      return new Response("OK", { status: 200 });
    }

    const amountKobo = data.amount || 0;
    console.log(`[WALLET FUNDING] Processing ref: ${ref} for user: ${userId} amount: ${amountKobo} kobo (₦${amountKobo / 100})`);

    // 8. Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 9. Credit wallet using RPC
    // Relying on RPC logic and unique reference for idempotency
    const { data: creditResult, error: creditError } = await supabase.rpc(
      "credit_wallet",
      {
        p_user_id: userId,
        p_amount: amountKobo,
        p_reference: ref,
        p_metadata: data
      }
    );

    if (creditError) {
      if (creditError.message && creditError.message.includes("Transaction already processed")) {
        console.log(`[WALLET FUNDING] Duplicate transaction safely ignored: ${ref}`);
      } else {
        console.error("[WALLET FUNDING ERROR] RPC Error crediting wallet:", creditError);
      }
    } else {
      console.log(`[WALLET FUNDING] Successfully credited wallet. Result:`, JSON.stringify(creditResult));
    }

    // 10. Always return HTTP 200 to prevent Paystack retries
    return new Response("OK", { status: 200 });

  } catch (err) {
    // 11. Strong error logging but no crashes
    console.error("[WEBHOOK CRITICAL ERROR] Unexpected error processing webhook:", err);
    return new Response("OK", { status: 200 });
  }
});
