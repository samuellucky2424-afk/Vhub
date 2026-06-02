import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("MY_SERVICE_ROLE_KEY");
const CPX_APP_ID = Deno.env.get("CPX_APP_ID") || "";
const CPX_POSTBACK_SECRET = Deno.env.get("CPX_POSTBACK_SECRET") || "";
const CPX_REWARD_KOBO_PER_UNIT = Number(Deno.env.get("CPX_REWARD_KOBO_PER_UNIT") || "100");
const CPX_USD_TO_NGN_RATE = Number(Deno.env.get("CPX_USD_TO_NGN_RATE") || "0");
const EXCHANGE_RATE_API_KEY = Deno.env.get("EXCHANGE_RATE_API_KEY") || "";
const CPX_ENABLE_REVERSALS = Deno.env.get("CPX_ENABLE_REVERSALS") === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cpx-secret",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const completionStatuses = new Set(["", "1", "approved", "complete", "completed", "credited", "success", "valid"]);
const reversalStatuses = new Set(["2", "chargeback", "rejected", "reversed", "declined", "cancelled", "canceled", "invalid", "devalidated"]);

function response(body: string, status = 200) {
  return new Response(body, { status, headers: corsHeaders });
}

function firstParam(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value !== null && value !== "") return value.trim();
  }

  return "";
}

function numberParam(params: URLSearchParams, names: string[]) {
  const rawValue = firstParam(params, names);
  if (!rawValue) return null;

  const value = Number(rawValue.replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

async function readParams(req: Request) {
  const params = new URL(req.url).searchParams;

  if (req.method !== "POST") {
    return params;
  }

  const contentType = req.headers.get("content-type") || "";
  const body = await req.text();
  if (!body) {
    return params;
  }

  if (contentType.includes("application/json")) {
    const parsedBody = JSON.parse(body);
    Object.entries(parsedBody || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.set(key, String(value));
    });
    return params;
  }

  const bodyParams = new URLSearchParams(body);
  bodyParams.forEach((value, key) => params.set(key, value));
  return params;
}

function getAmountKobo(params: URLSearchParams) {
  const directKobo = numberParam(params, ["amount_kobo", "reward_kobo", "credits_kobo"]);
  if (directKobo !== null) {
    return Math.round(Math.abs(directKobo));
  }

  const rewardUnits = numberParam(params, ["amount_local", "amount", "reward", "rewards", "payout", "user_payout", "credits"]);
  if (rewardUnits === null) {
    return null;
  }

  return Math.round(Math.abs(rewardUnits) * CPX_REWARD_KOBO_PER_UNIT);
}

async function getUsdToNgnRate() {
  if (Number.isFinite(CPX_USD_TO_NGN_RATE) && CPX_USD_TO_NGN_RATE > 0) {
    return CPX_USD_TO_NGN_RATE;
  }

  if (!EXCHANGE_RATE_API_KEY) {
    return 0;
  }

  const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`);
  if (!response.ok) {
    return 0;
  }

  const payload = await response.json();
  const rate = Number(payload?.conversion_rates?.NGN || 0);
  return Number.isFinite(rate) ? rate : 0;
}

async function getRewardAmountKobo(params: URLSearchParams) {
  const localAmountKobo = getAmountKobo(params);
  if (localAmountKobo !== null) {
    return {
      amountKobo: localAmountKobo,
      source: "amount_local",
      exchangeRate: null,
    };
  }

  const amountUsd = numberParam(params, ["amount_usd", "payout_usd", "usd"]);
  if (amountUsd === null) {
    return {
      amountKobo: 0,
      source: "missing",
      exchangeRate: null,
    };
  }

  const exchangeRate = await getUsdToNgnRate();
  if (!exchangeRate) {
    return {
      amountKobo: 0,
      source: "amount_usd",
      exchangeRate: null,
    };
  }

  return {
    amountKobo: Math.round(Math.abs(amountUsd) * exchangeRate * 100),
    source: "amount_usd",
    exchangeRate,
  };
}

function getRawPayload(params: URLSearchParams) {
  const payload: Record<string, string> = {};
  params.forEach((value, key) => {
    payload[key] = value;
  });
  return payload;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return response("ok");
  }

  if (!["GET", "POST"].includes(req.method)) {
    return response("Method not allowed", 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[cpx-postback] Missing Supabase environment variables.");
      return response("OK");
    }

    const params = await readParams(req);
    const providedSecret = firstParam(params, ["secret", "password", "token", "postback_secret"]) || req.headers.get("x-cpx-secret") || "";

    if (CPX_POSTBACK_SECRET && providedSecret !== CPX_POSTBACK_SECRET) {
      console.error("[cpx-postback] Invalid postback secret.");
      return response("Forbidden", 403);
    }

    const appId = firstParam(params, ["app_id", "appid"]);
    if (CPX_APP_ID && appId && appId !== CPX_APP_ID) {
      console.error("[cpx-postback] App ID mismatch.", { appId });
      return response("OK");
    }

    const userId = firstParam(params, ["user_id", "userid", "ext_user_id", "subid", "subid_1"]);
    const transactionId = firstParam(params, ["trans_id", "transaction_id", "txn_id", "tx_id", "tid", "conversion_id", "lead_id"]);
    const status = firstParam(params, ["status", "event", "type"]).toLowerCase();
    const { amountKobo, source: amountSource, exchangeRate } = await getRewardAmountKobo(params);

    if (!uuidPattern.test(userId)) {
      console.error("[cpx-postback] Missing or invalid user ID.", { userId });
      return response("Invalid user", 400);
    }

    if (!transactionId) {
      console.error("[cpx-postback] Missing transaction ID.");
      return response("Missing transaction", 400);
    }

    if (!amountKobo || amountKobo <= 0) {
      console.error("[cpx-postback] Missing or invalid reward amount.", getRawPayload(params));
      return response("Invalid amount", 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const metadata = {
      provider: "cpx-research",
      status,
      transaction_id: transactionId,
      amount_kobo: amountKobo,
      amount_source: amountSource,
      amount_local: firstParam(params, ["amount_local", "amount", "reward", "rewards", "payout"]),
      amount_usd: firstParam(params, ["amount_usd", "payout_usd", "usd"]),
      exchange_rate_ngn_per_usd: exchangeRate,
      offer_id: firstParam(params, ["offer_id", "offerid", "survey_id", "project_id"]),
      raw: getRawPayload(params),
    };

    if (reversalStatuses.has(status)) {
      if (!CPX_ENABLE_REVERSALS) {
        console.log("[cpx-postback] Reversal received but not enabled.", metadata);
        return response("OK");
      }

      const { error } = await supabase.rpc("deduct_wallet", {
        p_user_id: userId,
        p_amount_kobo: amountKobo,
        p_reference: `cpx_reversal_${transactionId}`,
        p_metadata: metadata,
      });

      if (error && !error.message?.includes("Already processed")) {
        console.error("[cpx-postback] Failed to reverse CPX reward:", error);
      }

      return response("OK");
    }

    if (!completionStatuses.has(status)) {
      console.log("[cpx-postback] Ignoring non-completion status.", metadata);
      return response("OK");
    }

    const { error } = await supabase.rpc("credit_wallet", {
      p_user_id: userId,
      p_amount: amountKobo,
      p_reference: `cpx_${transactionId}`,
      p_metadata: metadata,
    });

    if (error && !error.message?.includes("Transaction already processed")) {
      console.error("[cpx-postback] Failed to credit CPX reward:", error);
      return response("Credit failed", 500);
    }

    return response("OK");
  } catch (error) {
    console.error("[cpx-postback] Unexpected error:", error);
    return response("OK");
  }
});
