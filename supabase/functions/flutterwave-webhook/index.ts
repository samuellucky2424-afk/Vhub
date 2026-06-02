import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
    getFlutterwaveErrorMessage,
    isFlutterwavePaymentSuccessful,
} from "../../../src/lib/payments/flutterwave.js";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY");
const FLUTTERWAVE_WEBHOOK_SECRET_HASH = Deno.env.get("FLUTTERWAVE_WEBHOOK_SECRET_HASH");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("MY_SERVICE_ROLE_KEY");

function toHex(bytes: Uint8Array) {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function toBase64(bytes: Uint8Array) {
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}

async function signPayload(payload: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(FLUTTERWAVE_WEBHOOK_SECRET_HASH || ""),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const bytes = new Uint8Array(signature);
    return {
        base64: toBase64(bytes),
        hex: toHex(bytes),
    };
}

async function verifyWebhookSignature(body: string, providedSignature: string) {
    if (!FLUTTERWAVE_WEBHOOK_SECRET_HASH || !providedSignature) {
        return false;
    }

    if (providedSignature === FLUTTERWAVE_WEBHOOK_SECRET_HASH) {
        return true;
    }

    const expectedSignature = await signPayload(body);
    return [expectedSignature.base64, expectedSignature.hex].some(
        (signature) => signature.toLowerCase() === providedSignature.toLowerCase(),
    );
}

async function verifyTransaction(transactionId: string) {
    const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
        headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
        },
    });

    const payload = await response.json();

    if (!response.ok || payload?.status !== "success") {
        throw new Error(getFlutterwaveErrorMessage(payload, response.status));
    }

    return payload.data;
}

serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FLUTTERWAVE_SECRET_KEY) {
            console.error("[flutterwave-webhook] Missing environment variables.");
            return new Response("OK", { status: 200 });
        }

        const signature = req.headers.get("flutterwave-signature") || req.headers.get("verif-hash") || "";
        const body = await req.text();
        const isVerified = await verifyWebhookSignature(body, signature);

        if (!isVerified) {
            console.error("[flutterwave-webhook] Invalid signature.");
            return new Response("OK", { status: 200 });
        }

        const payload = JSON.parse(body);
        const data = payload?.data || {};
        const transactionId = String(data.id || "");
        const txRef = String(data.tx_ref || "");
        const meta = data.meta || {};

        if (!transactionId || !txRef) {
            console.error("[flutterwave-webhook] Missing transaction identifiers.");
            return new Response("OK", { status: 200 });
        }

        const isWalletFunding = meta.type === "wallet_funding" || txRef.startsWith("fund_");
        if (!isWalletFunding) {
            return new Response("OK", { status: 200 });
        }

        const verifiedTransaction = await verifyTransaction(transactionId);
        if (!isFlutterwavePaymentSuccessful(verifiedTransaction.status)) {
            console.log(`[flutterwave-webhook] Ignoring non-successful transaction ${txRef}: ${verifiedTransaction.status}`);
            return new Response("OK", { status: 200 });
        }

        const userId = String(verifiedTransaction.meta?.user_id || meta.user_id || "");
        if (!userId) {
            console.error("[flutterwave-webhook] Missing user_id in transaction metadata.", txRef);
            return new Response("OK", { status: 200 });
        }

        const amountKobo = Math.round(Number(verifiedTransaction.amount || 0) * 100);
        if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
            console.error("[flutterwave-webhook] Invalid transaction amount.", verifiedTransaction.amount);
            return new Response("OK", { status: 200 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { error: creditError } = await supabase.rpc("credit_wallet", {
            p_user_id: userId,
            p_amount: amountKobo,
            p_reference: txRef,
            p_metadata: {
                gateway: "flutterwave",
                transaction_id: verifiedTransaction.id,
                tx_ref: verifiedTransaction.tx_ref,
                status: verifiedTransaction.status,
                payment_type: verifiedTransaction.payment_type,
                processor_response: verifiedTransaction.processor_response,
                customer: verifiedTransaction.customer || null,
            },
        });

        if (creditError && !creditError.message?.includes("Transaction already processed")) {
            console.error("[flutterwave-webhook] Failed to credit wallet:", creditError);
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("[flutterwave-webhook] Unexpected error:", error);
        return new Response("OK", { status: 200 });
    }
});
