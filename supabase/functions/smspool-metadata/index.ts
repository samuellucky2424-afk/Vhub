import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SMSPOOL_API_KEY = Deno.env.get("SMSPOOL_API_KEY")!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // We can support GET or POST. Since we don't strictly need a body, GET is fine used as "invoke" without body often behaves like POST in Supabase client if not specified, 
        // but we'll accept any method that reaches here for simplicity or stick to POST if the client sends one.
        // The requirement says "Method: GET (or POST if GET fails)".
        // We will just fetch both lists and return them.

        console.log("Fetching SMSPool metadata...");

        const [countriesResponse, servicesResponse] = await Promise.all([
            fetch(`https://api.smspool.net/country/retrieve_all?key=${SMSPOOL_API_KEY}`),
            fetch(`https://api.smspool.net/service/retrieve_all?key=${SMSPOOL_API_KEY}`)
        ]);

        const countries = await countriesResponse.json();
        const services = await servicesResponse.json();

        const result = {
            countries: Array.isArray(countries) ? countries : [],
            services: Array.isArray(services) ? services : []
        };

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err) {
        console.error("Error fetching metadata:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
