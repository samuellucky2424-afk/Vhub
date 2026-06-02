import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
    FLUTTERWAVE_PAYMENT_METHODS,
    MINIMUM_WALLET_FUNDING_NGN,
    buildFlutterwaveFundingPayload,
    getFlutterwaveErrorMessage,
} from "../../../src/lib/payments/flutterwave.js";

const FLUTTERWAVE_SECRET_KEY = Deno.env.get("FLUTTERWAVE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FLUTTERWAVE_REDIRECT_URL = Deno.env.get("FLUTTERWAVE_REDIRECT_URL");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getRedirectUrl(req: Request) {
    if (FLUTTERWAVE_REDIRECT_URL) {
        return FLUTTERWAVE_REDIRECT_URL;
    }

    const origin = req.headers.get("origin");
    if (!origin) {
        throw new Error("Missing redirect URL configuration. Set FLUTTERWAVE_REDIRECT_URL.");
    }

    return `${origin}/#/wallet/success`;
}

serve(async (req) => {
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

        const {
            amount,
            payment_method = FLUTTERWAVE_PAYMENT_METHODS.auto,
        } = await req.json();
        const parsedAmount = Number(amount);

        if (!Number.isFinite(parsedAmount) || parsedAmount < MINIMUM_WALLET_FUNDING_NGN) {
            return new Response(JSON.stringify({ error: `Invalid amount. Minimum is ${MINIMUM_WALLET_FUNDING_NGN} NGN.` }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const reference = `fund_${user.id}_${Date.now()}`;
        const redirectUrl = getRedirectUrl(req);
        const flutterwaveResponse = await fetch("https://api.flutterwave.com/v3/payments", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(buildFlutterwaveFundingPayload({
                amount: parsedAmount,
                redirectUrl,
                paymentMethod: payment_method,
                reference,
                user: {
                    id: user.id,
                    email: user.email || "",
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || "Vhub customer",
                },
            })),
        });

        const flutterwaveData = await flutterwaveResponse.json();

        if (!flutterwaveResponse.ok || flutterwaveData?.status !== "success") {
            throw new Error(getFlutterwaveErrorMessage(flutterwaveData, flutterwaveResponse.status));
        }

        return new Response(
            JSON.stringify({
                success: true,
                reference,
                payment_method,
                payment_link: flutterwaveData.data?.link,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (error) {
        console.error("[initialize-wallet-funding] Error:", error);
        return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
