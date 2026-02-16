import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EXCHANGE_RATE_API_KEY = Deno.env.get("EXCHANGE_RATE_API_KEY");

// Cache Interface
interface RateCache {
    rate: number;
    timestamp: number;
}

// Global Cache (In-Memory)
let rateCache: RateCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Fetch Exchange Rate Function
async function getExchangeRate(): Promise<number> {
    const now = Date.now();

    // Check Cache
    if (rateCache && (now - rateCache.timestamp) < CACHE_DURATION_MS) {
        return rateCache.rate;
    }

    // Fetch from API
    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`);

        if (!response.ok) {
            throw new Error("API Request Failed");
        }

        const data = await response.json();
        const rate = data.conversion_rates?.NGN;

        if (!rate || typeof rate !== 'number') {
            throw new Error("Invalid Rate Data");
        }

        // Update Cache
        rateCache = {
            rate: rate,
            timestamp: now
        };

        return rate;

    } catch (error) {
        // Fallback to last cached rate if available
        if (rateCache) {
            return rateCache.rate;
        }
        // Final Safe Fallback (Logic dictates we must return something or fail, falling back to a safe default if absolutely no cache exists is better than crashing, but the prompt says 'fallback to last cached rate'. If no cache, we might need to fail or use a reasonable standard. I'll throw error to be safe as per "If API fails, fallback to last cached rate" logic typically implies if *re-fetch* fails. If *first* fetch fails, we have no rate.)
        throw new Error("Failed to fetch exchange rate and no cache available");
    }
}

serve(async (req) => {
    // CORS Headers
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const usdParam = url.searchParams.get('usd');

        if (!usdParam) {
            return new Response(JSON.stringify({ error: "Missing 'usd' parameter" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        const original_usd = parseFloat(usdParam);
        if (isNaN(original_usd)) {
            return new Response(JSON.stringify({ error: "Invalid 'usd' parameter" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 1. Get Exchange Rate (Cached or Live)
        const rate = await getExchangeRate();

        // 2. Calculate Final Price
        // Formula: final_usd = original_usd * 1.45
        const final_usd = original_usd * 1.45;

        // Formula: final_ngn = final_usd * rate (Rounded to nearest whole number)
        const final_ngn = Math.round(final_usd * rate);

        // 3. Return Response (Under 200ms if cached)
        return new Response(JSON.stringify({
            original_usd,
            final_usd: parseFloat(final_usd.toFixed(3)), // Rounded for clean JSON output
            exchange_rate: rate,
            final_ngn
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

    } catch (err) {
        // No console logging allowed
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
});
