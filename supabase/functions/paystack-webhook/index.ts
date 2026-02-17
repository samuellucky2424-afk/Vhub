
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// --- CONFIG ---
const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// --- Supabase Client ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --- HELPER: Verify HMAC SHA-512 Signature ---
async function verifySignature(body: string, signature: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(PAYSTACK_SECRET_KEY),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"]
  );
  const sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
}

// --- SERVE FUNCTION ---
serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) return new Response("No signature provided", { status: 401 });

    const body = await req.text();
    const verified = await verifySignature(body, signature);
    if (!verified) {
      console.error("[WEBHOOK] Signature verification failed");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);
    console.log("[WEBHOOK] Event received:", JSON.stringify(event, null, 2));

    // Only wallet funding events
    const ref = event.data?.reference;
    const metadata = event.data?.metadata || {};
    
    // Check if it's a wallet funding event either by metadata type or reference prefix
    const isWalletFunding = (metadata.type === "wallet_funding") || (ref && ref.startsWith("fund_"));
    
    if (!isWalletFunding) {
      console.log("[WEBHOOK] Not a wallet funding event, ignoring");
      return new Response("OK", { status: 200 });
    }

    const userId = metadata.user_id;
    if (!userId) {
      console.error("[WEBHOOK] Missing user_id in metadata for wallet funding");
      return new Response("OK", { status: 200 });
    }

    const amountNGN = (event.data.amount || 0) / 100; // convert kobo to NGN
    console.log(`[WALLET FUNDING] Processing ${ref} for user ${userId} +₦${amountNGN}`);

    // Call credit_wallet RPC
    const { data: creditResult, error: creditError } = await supabase.rpc("credit_wallet", {
      p_user_id: userId,
      p_amount: amountNGN,
      p_reference: ref
    });

    if (creditError) {
      if (creditError.message?.includes("Transaction already processed")) {
        console.log(`[WALLET FUNDING] Duplicate transaction detected: ${ref}`);
      } else {
        console.error("[WALLET FUNDING] RPC Error:", creditError);
      }
      return new Response("OK", { status: 200 });
    }

    console.log(`[WALLET FUNDING] Wallet credited successfully: ${JSON.stringify(creditResult)}`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("[WEBHOOK ERROR]", err);
    return new Response("OK", { status: 200 });
  }
});
