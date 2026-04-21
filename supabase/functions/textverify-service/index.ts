import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const TEXTVERIFIED_API_KEY = Deno.env.get("TEXTVERIFIED_API_KEY") || "4mf4LGpBdnckP9rLhqAjdBP4pZr9ojthJh9F1mJ4PeCnBvl3UXiH3iRYXNO6n1";
const TEXTVERIFIED_API_USERNAME = Deno.env.get("TEXTVERIFIED_API_USERNAME") || "samuellucky2424@gmail.com";
const SMSPOOL_API_KEY = Deno.env.get("SMSPOOL_API_KEY") || "hL7noSdy86GcFPFn0xNuAIGrb8dNpkKk";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORDER_TIMEOUT_MS = Number(Deno.env.get("ORDER_TIMEOUT_MS") || "180000");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
};

// ─── TextVerified Auth Helper ───
let tvBearerTokenCache: { token: string; expiresAt: number } | null = null;
async function generateBearerToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && tvBearerTokenCache && Date.now() < tvBearerTokenCache.expiresAt) {
        return tvBearerTokenCache.token;
    }

    const response = await fetch("https://www.textverified.com/api/pub/v2/auth", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": TEXTVERIFIED_API_KEY,
            "X-API-USERNAME": TEXTVERIFIED_API_USERNAME
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("TextVerified Auth Error:", errorText);
        throw new Error("Failed to generate TextVerified Bearer token");
    }

    const data = await response.json();
    const token = data.token; 
    const expiresIn = data.expiresIn || 900; 
    tvBearerTokenCache = { token, expiresAt: Date.now() + (expiresIn * 1000) - 30000 };
    return token;
}

async function getTextVerifiedServiceName(serviceInput: string | number, bearerToken: string): Promise<string> {
    const s = String(serviceInput).toLowerCase().trim();
    try {
        const response = await fetch("https://www.textverified.com/api/pub/v2/services?numberType=mobile&reservationType=verification", {
            headers: { "Authorization": `Bearer ${bearerToken}` }
        });
        const data = await response.json();
        const match = data.find((svc: any) => 
            (svc.description && svc.description.toLowerCase() === s) || 
            (svc.serviceName && svc.serviceName.toLowerCase() === s)
        );
        if (match && match.serviceName) return match.serviceName;
    } catch(e) {
        console.error("TextVerified services map error:", e);
    }
    return s;
}

// ─── Global Cache (In-Memory) for Exchange Rate ───
let rateCache: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000;

async function getExchangeRate(): Promise<number> {
    const now = Date.now();
    if (rateCache && (now - rateCache.timestamp) < CACHE_DURATION_MS) {
        return rateCache.rate;
    }
    try {
        const EXCHANGE_RATE_API_KEY = Deno.env.get("EXCHANGE_RATE_API_KEY");
        if (!EXCHANGE_RATE_API_KEY) throw new Error("Missing Exchange Rate API Key");

        const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/USD`);
        if (!response.ok) throw new Error("API Request Failed");

        const data = await response.json();
        const rate = data.conversion_rates?.NGN;

        if (!rate || typeof rate !== 'number') throw new Error("Invalid Rate Data");

        rateCache = { rate, timestamp: now };
        return rate;
    } catch (e) {
        console.error("Exchange Rate Fetch Error:", e);
        if (rateCache) return rateCache.rate;
        return 1650;
    }
}

const toMetadataObject = (value: unknown): Record<string, any> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return { ...(value as Record<string, any>) };
};

const toLogArray = (value: unknown): Array<Record<string, any>> => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, any> => !!item && typeof item === 'object');
};

async function requestOrderRefund(order: any, reason: string): Promise<{ success: boolean; message: string }> {
    const orderMetadata = toMetadataObject(order.metadata);

    // Mark lifecycle as refunded first so DB trigger paths and RPC eligibility checks can run.
    await supabase
        .from('orders')
        .update({
            status: 'refunded',
            metadata: {
                ...orderMetadata,
                auto_refund_requested: true,
                auto_refund_reason: reason,
                auto_refund_requested_at: new Date().toISOString()
            }
        })
        .eq('id', order.id);

    const { data: refundResult, error: refundError } = await supabase.rpc('process_order_refund', {
        p_order_id: order.id
    });

    if (refundError) {
        console.error(`[sync] process_order_refund failed for order ${order.id}:`, refundError.message);

        await supabase
            .from('orders')
            .update({
                metadata: {
                    ...orderMetadata,
                    auto_refund_requested: true,
                    auto_refund_reason: reason,
                    auto_refund_requested_at: new Date().toISOString(),
                    auto_refund_error: refundError.message
                }
            })
            .eq('id', order.id);

        return { success: false, message: refundError.message };
    }

    return {
        success: !!refundResult?.success,
        message: refundResult?.message || 'Refund RPC executed'
    };
}

const COUNTDOWN_DURATION = 120000;

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { action } = payload;
        
        // Normalize provider ID
        let provider = 'text_verify';
        if (payload.provider === 'sms_pool' || payload.provider === 'lite' || payload.provider_id === 'sms_pool') {
            provider = 'sms_pool';
        }

        console.log(`[textverify-service] EXECUTING: ${action} | PROVIDER: ${provider}`);

        // ─── ACTION: get_metadata ───
        if (action === 'get_metadata') {
            if (provider === 'sms_pool') {
                try {
                    console.log("[textverify-service] Fetching SMSPool metadata...");
                    const [countriesResp, servicesResp] = await Promise.all([
                        fetch(`https://api.smspool.net/country/retrieve_all?key=${SMSPOOL_API_KEY}`),
                        fetch(`https://api.smspool.net/service/retrieve_all?key=${SMSPOOL_API_KEY}`)
                    ]);
                    
                    if (!countriesResp.ok || !servicesResp.ok) {
                        const cErr = await countriesResp.text();
                        const sErr = await servicesResp.text();
                        console.error(`[SMSPool Metadata Error] Countries: ${countriesResp.status} (${cErr}), Services: ${servicesResp.status} (${sErr})`);
                        throw new Error(`SMSPool API Error: ${countriesResp.status}`);
                    }

                    const countriesData = await countriesResp.json();
                    const servicesData = await servicesResp.json();

                    if (!Array.isArray(countriesData) || !Array.isArray(servicesData)) {
                        console.error("[SMSPool Metadata Error] Response is not an array", { countriesData, servicesData });
                        throw new Error("Invalid response from SMSPool");
                    }

                    const countries = countriesData.map((c: any) => ({
                        ID: c.ID,
                        name: c.name,
                        short_name: c.short_name || 'US'
                    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

                    const services = servicesData.map((s: any) => ({
                        ID: s.ID,
                        name: s.name
                    })).sort((a: any, b: any) => a.name.localeCompare(b.name));

                    console.log(`[textverify-service] Successfully fetched SMSPool metadata. Countries: ${countries.length}, Services: ${services.length}`);
                    return new Response(JSON.stringify({ countries, services, provider: 'sms_pool' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                } catch (err: any) {
                    console.error("[textverify-service] SMSPool Metadata Fatal Error:", err.message);
                    return new Response(JSON.stringify({ error: err.message, provider: 'sms_pool' }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            } else {
                // Default to TextVerified (Pro Service)
                let bearer = await generateBearerToken();
                let servicesResponse = await fetch("https://www.textverified.com/api/pub/v2/services?numberType=mobile&reservationType=verification", {
                    headers: { "Authorization": `Bearer ${bearer}` }
                });

                if (servicesResponse.status === 401) {
                    bearer = await generateBearerToken(true);
                    servicesResponse = await fetch("https://www.textverified.com/api/pub/v2/services?numberType=mobile&reservationType=verification", {
                        headers: { "Authorization": `Bearer ${bearer}` }
                    });
                }

                const areaCodesResponse = await fetch("https://www.textverified.com/api/pub/v2/area-codes", {
                    headers: { "Authorization": `Bearer ${bearer}` }
                });
                
                const servicesData = await servicesResponse.json();
                const areaCodesData = await areaCodesResponse.json();
                
                const rawServices = (Array.isArray(servicesData) ? servicesData : (servicesData.data || []));
                const serviceMap = new Map<string, { ID: string; name: string }>();
                for (const s of rawServices) {
                    const key = s.serviceName;
                    if (!serviceMap.has(key)) {
                        serviceMap.set(key, { ID: s.serviceName, name: s.description || s.serviceName });
                    }
                }
                const services = Array.from(serviceMap.values()).sort((a, b) => a.name.localeCompare(b.name));

                const area_codes = (Array.isArray(areaCodesData) ? areaCodesData : (areaCodesData.data || [])).map((a: any) => ({
                    ID: a.areaCode,           
                    name: `${a.areaCode} (${a.state})`, 
                    short_name: 'US'
                })).sort((a: any, b: any) => a.name.localeCompare(b.name));

                return new Response(JSON.stringify({ countries: area_codes, services, provider: 'text_verify' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
        }

        // ─── ACTION: get_price ───
        if (action === 'get_price') {
            const { country, service, service_name } = payload;
            if (!service && !service_name) return new Response("Missing service", { status: 400, headers: corsHeaders });

            let rawUSD = 0;
            let stockCount = 0;

            if (provider === 'sms_pool') {
                try {
                    console.log(`[get_price] SMSPool Request: country=${country}, service=${service}`);
                    const url = `https://api.smspool.net/request/price?key=${SMSPOOL_API_KEY}&country=${country}&service=${service}`;
                    const response = await fetch(url);
                    
                    const text = await response.text();
                    console.log(`[get_price] SMSPool raw response: ${text.substring(0, 200)}`);

                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        console.error("[get_price] SMSPool returned non-JSON response");
                        return new Response(JSON.stringify({ available: false, message: 'Pricing unavailable for this service and region combination.' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                    }

                    if (data === 0 || data.success === 0 || data.success === false || data.message) {
                        return new Response(JSON.stringify({ 
                            available: false, 
                            message: data.message || 'This service is currently out of stock for the selected region.',
                            stock_available: false
                        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                    }
                    
                    rawUSD = Number(data.price || 0);
                    stockCount = Number(data.success_rate || 0); 
                    
                    if (rawUSD <= 0) {
                        return new Response(JSON.stringify({ available: false, message: 'Pricing error from provider. Try another region.' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
                    }
                } catch (err: any) {
                    console.error("[get_price] SMSPool connection failed:", err.message);
                    return new Response(JSON.stringify({ available: false, message: 'Could not connect to Lite Service provider.' }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            } else {
                console.log(`[get_price] Calling TextVerified for service=${service_name || service}`);
                const bearer = await generateBearerToken();
                const serviceName = await getTextVerifiedServiceName(service_name || service, bearer);
                const isAreaCode = country && country !== 'any' && country !== '1' && !isNaN(Number(country));

                const response = await fetch("https://www.textverified.com/api/pub/v2/pricing/verifications", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ serviceName, areaCode: isAreaCode, carrier: false, numberType: "mobile", capability: "sms" })
                });

                if (!response.ok) {
                    console.error("[get_price] TextVerified error:", response.status);
                    return new Response(JSON.stringify({ available: false, message: 'Price unavailable' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                const data = await response.json();
                rawUSD = data.price || 0;
            }

            const USD_TO_NGN_RATE = await getExchangeRate();
            const markup = provider === 'sms_pool' ? 1.35 : 1.45; // Lower markup for Lite Service
            const sellingUSD = rawUSD * markup;
            const finalNGN = Math.round(sellingUSD * USD_TO_NGN_RATE);

            return new Response(JSON.stringify({
                available: true,
                stock_available: true,
                stock_count: stockCount,
                final_ngn: finalNGN,
                display_ngn: `₦${finalNGN.toLocaleString()}`
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ─── ACTION: purchase_wallet ───
        if (action === 'purchase_wallet') {
            const authHeader = req.headers.get('Authorization');
            const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;
            
            // Check if header is just the anon key
            const isAnonKey = headerToken === Deno.env.get("SUPABASE_ANON_KEY");
            
            const token = (payload.user_token && !isAnonKey) ? payload.user_token : (headerToken || payload.user_token || null);
            
            if (!token) return new Response(JSON.stringify({ success: false, message: "Missing token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

            const { data: { user }, error: authError } = await supabase.auth.getUser(token);
            if (authError || !user) {
                console.error("Auth Error:", authError);
                return new Response(JSON.stringify({ success: false, message: "Authentication failed. Please log in again." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const { service_type, country, service_id, country_id } = payload;
            
            // 1. Calculate Price
            let rawUSD = 0;
            if (provider === 'sms_pool') {
                const pResp = await fetch(`https://api.smspool.net/request/price?key=${SMSPOOL_API_KEY}&country=${country_id || country}&service=${service_id}`);
                const pData = await pResp.json();
                rawUSD = Number(pData.price || 0);
                if (rawUSD <= 0) return new Response(JSON.stringify({ success: false, message: "Lite Service pricing error. Please try again." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } else {
                const bearer = await generateBearerToken();
                const serviceName = await getTextVerifiedServiceName(service_type || service_id, bearer);
                const isAreaCode = country_id && !isNaN(Number(country_id));
                const pResp = await fetch("https://www.textverified.com/api/pub/v2/pricing/verifications", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ serviceName, areaCode: isAreaCode, carrier: false, numberType: "mobile", capability: "sms" })
                });
                const pData = await pResp.json();
                rawUSD = pData.price || 0;
            }

            const USD_TO_NGN_RATE = await getExchangeRate();
            const markup = provider === 'sms_pool' ? 1.35 : 1.45;
            const price_usd = rawUSD * markup;
            const price_ngn = Math.round(price_usd * USD_TO_NGN_RATE);
            const price_kobo = price_ngn * 100;

            const { data: walletInfo } = await supabase.rpc('get_wallet_balance', { p_user_id: user.id });
            const actualBalanceKobo = walletInfo?.balance_kobo || (walletInfo?.balance * 100) || 0;

            if (actualBalanceKobo < price_kobo) {
                return new Response(JSON.stringify({ success: false, message: `Insufficient funds. Need ₦${price_ngn}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            let phoneNumber = "";
            let requestId = "";

            if (provider === 'sms_pool') {
                const buyResp = await fetch(`https://api.smspool.net/purchase/sms?key=${SMSPOOL_API_KEY}&country=${country_id || country}&service=${service_id}`);
                const buyData = await buyResp.json();
                if (buyData.success !== 1 && buyData.success !== true) {
                    return new Response(JSON.stringify({ success: false, message: buyData.message || "SMSPool purchase failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
                phoneNumber = buyData.number;
                requestId = buyData.fast ? buyData.order_id : buyData.fast_id || buyData.order_id;
            } else {
                const bearer = await generateBearerToken();
                const serviceName = await getTextVerifiedServiceName(service_type || service_id, bearer);
                const isAreaCode = country_id && !isNaN(Number(country_id));
                const createResp = await fetch("https://www.textverified.com/api/pub/v2/verifications", {
                    method: 'POST',
                    headers: { "Authorization": `Bearer ${bearer}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ serviceName, capability: "sms", ...(isAreaCode ? { areaCodeSelectOption: [country_id] } : {}) })
                });
                const createData = await createResp.json();
                if (!createData.href) return new Response(JSON.stringify({ success: false, message: "Provider error" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                requestId = createData.href;
                const detailResp = await fetch(requestId, { headers: { "Authorization": `Bearer ${bearer}` } });
                const detailData = await detailResp.json();
                phoneNumber = detailData.number;
            }

            const purchaseRef = `WAL-${crypto.randomUUID()}`;
            const { data: atomicResult, error: atomicError } = await supabase.rpc('atomic_purchase_verification', {
                p_user_id: user.id,
                p_service_type: service_type,
                p_country: country || country_id,
                p_country_id: country_id || country,
                p_service_id: service_id,
                p_price_kobo: price_kobo,
                p_exchange_rate: USD_TO_NGN_RATE,
                p_phone_number: phoneNumber,
                p_smspool_order_id: requestId,
                p_payment_reference: purchaseRef,
                p_metadata: { provider, requestId, source: 'wallet', raw_usd: rawUSD, price_ngn, rate: USD_TO_NGN_RATE }
            });

            if (atomicError || !atomicResult?.success) {
                return new Response(JSON.stringify({ success: false, message: atomicError?.message || "Transaction failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            return new Response(JSON.stringify({ success: true, order_id: atomicResult.order_id, smspool_order_id: requestId, number: phoneNumber }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ─── ACTION: sync_order_status ───
        if (action === 'sync_order_status' || action === 'check_sms' || action === 'poll_sms' || action === 'check_order') {
            const { order_id } = payload;
            const { data: order } = await supabase.from('orders').select('*').eq('id', order_id).single();
            if (!order) return new Response(JSON.stringify({ success: false, message: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            const orderMetadata = toMetadataObject(order.metadata);
            const provider = orderMetadata.provider || 'text_verify';
            const requestId = order.request_id;

            let statusVal = '';
            let smsCode = '';
            let smsBody = '';

            if (provider === 'sms_pool') {
                // Correct endpoint: /sms/check returns {status, sms, full_sms, time_left, expiration}
                const checkResp = await fetch(`https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${requestId}`);
                const checkText = await checkResp.text();
                let checkData: any = {};
                try { checkData = JSON.parse(checkText); } catch { 
                    console.error("[sync] SMSPool /sms/check returned non-JSON:", checkText.slice(0, 200));
                }
                // SMSPool states: 1 = pending, 2 = completed, 3 = expired/cancelled
                const state = Number(checkData.status);
                if (state === 2) {
                    statusVal = 'completed';
                    smsCode = checkData.sms || '';
                    smsBody = checkData.full_sms || smsCode;
                } else if (state === 3 || checkData.expired) {
                    statusVal = 'failed';
                } else {
                    // Check if order has timed out (older than COUNTDOWN_DURATION)
                    const orderAge = Date.now() - new Date(order.created_at).getTime();
                    if (orderAge > COUNTDOWN_DURATION) {
                        console.log(`[sync] Order ${order_id} timed out (${Math.round(orderAge/1000)}s old). Cancelling on SMSPool...`);
                        // Cancel on SMSPool to get their refund
                        try {
                            const cancelResp = await fetch(`https://api.smspool.net/sms/cancel?key=${SMSPOOL_API_KEY}&orderid=${requestId}`);
                            const cancelText = await cancelResp.text();
                            console.log(`[sync] SMSPool cancel response:`, cancelText);
                        } catch (cancelErr: any) {
                            console.error(`[sync] SMSPool cancel error:`, cancelErr.message);
                        }
                        statusVal = 'failed'; // This will trigger refund below
                    } else {
                        statusVal = 'pending';
                    }
                }
            } else {
                const bearer = await generateBearerToken();
                const checkResp = await fetch(requestId, { headers: { "Authorization": `Bearer ${bearer}` } });
                const checkData = await checkResp.json();
                const state = checkData.state;
                if (state === 'verificationPending') statusVal = 'pending';
                else if (state === 'verificationCompleted') {
                    statusVal = 'completed';
                    const verificationId = requestId.split('/').pop();
                    const smsResp = await fetch(`https://www.textverified.com/api/pub/v2/sms?ReservationId=${verificationId}`, { headers: { "Authorization": `Bearer ${bearer}` } });
                    const smsData = await smsResp.json();
                    if (smsData.data?.[0]) {
                        smsCode = smsData.data[0].parsedCode || smsData.data[0].smsCode;
                        smsBody = smsData.data[0].smsBody || smsCode;
                    }
                } else statusVal = 'failed';
            }

            if (statusVal === 'completed' && smsCode) {
                const newMetadata = { ...orderMetadata, sms_code: smsCode, logs: [{ id: Date.now().toString(), message: smsBody, code: smsCode, receivedAt: new Date().toISOString() }, ...toLogArray(orderMetadata.logs)] };
                await supabase.from('orders').update({ status: 'completed', payment_status: 'completed', sms_code: smsCode, metadata: newMetadata }).eq('id', order_id);
                await supabase.from('verifications').update({ otp_code: smsCode, full_sms: smsBody, received_at: new Date().toISOString() }).eq('order_id', order_id);
            } else if (statusVal === 'failed') {
                const refundAttempt = await requestOrderRefund(order, `${provider}_sync_failed_or_expired`);
                if (!refundAttempt.success) {
                    console.warn(`[sync] Refund not completed for order ${order_id}: ${refundAttempt.message}`);
                }
                statusVal = 'refunded';
            }

            return new Response(JSON.stringify({ success: true, order_id, new_status: statusVal, sms: smsCode || null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // ─── ACTION: get_order_countdown ───
        if (action === 'get_order_countdown') {
            const { order_id } = payload;
            const { data: order } = await supabase.from('orders').select('*').eq('id', order_id).single();
            const elapsed = Date.now() - new Date(order.created_at).getTime();
            const remaining = Math.max(0, COUNTDOWN_DURATION - elapsed);
            return new Response(JSON.stringify({ success: true, order_id, status: order.status, countdown: { active: remaining > 0, remaining, percentage: Math.min(Math.round((elapsed / COUNTDOWN_DURATION) * 100), 100) } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
