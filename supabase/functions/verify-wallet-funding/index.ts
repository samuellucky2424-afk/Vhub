import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
    getFlutterwaveErrorMessage,
    isFlutterwavePaymentSuccessful,
    MINIMUM_WALLET_FUNDING_NGN,
} from "../../../src/lib/payments/flutterwave.js";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const authHeader = req.headers.get("Authorization");

        if (!authHeader) {
            return new Response(JSON.stringify({ error: "No authorization header" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Invalid token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const { tx_ref, transaction_id } = await req.json();

        if (!transaction_id) {
            return new Response(JSON.stringify({ success: false, pending: true, message: "Waiting for Flutterwave transaction confirmation." }), {
                status: 202,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const verifiedTransaction = await verifyTransaction(String(transaction_id));
        const verifiedTxRef = String(verifiedTransaction.tx_ref || "");
        const verifiedUserId = String(verifiedTransaction.meta?.user_id || "");
        const verifiedCurrency = String(verifiedTransaction.currency || "").toUpperCase();
        const verifiedAmount = Number(verifiedTransaction.amount || 0);

        if (verifiedUserId && verifiedUserId !== user.id) {
            return new Response(JSON.stringify({ error: "Transaction does not belong to the authenticated user." }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!verifiedTxRef.startsWith(`fund_${user.id}_`)) {
            return new Response(JSON.stringify({ error: "Transaction is not a wallet funding payment." }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (tx_ref && verifiedTxRef && verifiedTxRef !== tx_ref) {
            return new Response(JSON.stringify({ error: "Transaction reference mismatch." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!isFlutterwavePaymentSuccessful(verifiedTransaction.status)) {
            return new Response(JSON.stringify({
                success: false,
                pending: true,
                status: verifiedTransaction.status,
                message: getFlutterwaveErrorMessage(verifiedTransaction, 202),
            }), {
                status: 202,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (verifiedCurrency !== "NGN" || !Number.isFinite(verifiedAmount) || verifiedAmount < MINIMUM_WALLET_FUNDING_NGN) {
            return new Response(JSON.stringify({ error: "Invalid wallet funding amount or currency." }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const amountKobo = Math.round(verifiedAmount * 100);
        const { error: creditError } = await supabase.rpc("credit_wallet", {
            p_user_id: user.id,
            p_amount: amountKobo,
            p_reference: verifiedTxRef || tx_ref,
            p_metadata: {
                gateway: "flutterwave",
                verification_source: "callback",
                transaction_id: verifiedTransaction.id,
                tx_ref: verifiedTransaction.tx_ref,
                status: verifiedTransaction.status,
                payment_type: verifiedTransaction.payment_type,
                processor_response: verifiedTransaction.processor_response,
            },
        });

        if (creditError && !creditError.message?.includes("Transaction already processed")) {
            throw creditError;
        }

        return new Response(JSON.stringify({
            success: true,
            status: verifiedTransaction.status,
            tx_ref: verifiedTxRef || tx_ref,
            transaction_id: verifiedTransaction.id,
            amount: verifiedTransaction.amount,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("[verify-wallet-funding] Error:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
