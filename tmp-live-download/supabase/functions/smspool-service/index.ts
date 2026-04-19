import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SMSPOOL_API_KEY = Deno.env.get("SMSPOOL_API_KEY")!;
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
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { action } = payload;

        console.log(`Received request: ${action}`, payload);

        if (action === 'get_countries') {
            const response = await fetch(`https://api.smspool.net/country/retrieve_all?key=${SMSPOOL_API_KEY}`);
            const data = await response.json();
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === 'get_services') {
            const { country } = payload;
            const url = country
                ? `https://api.smspool.net/service/retrieve_all?key=${SMSPOOL_API_KEY}&country=${country}`
                : `https://api.smspool.net/service/retrieve_all?key=${SMSPOOL_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();
            return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Global Cache (In-Memory) for Rate
        let rateCache: { rate: number; timestamp: number } | null = null;
        const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

        async function getExchangeRate(): Promise<number> {
            const now = Date.now();
            if (rateCache && (now - rateCache.timestamp) < CACHE_DURATION_MS) {
                return rateCache.rate;
            }

            // Default safe fallback if API and Cache fail
            // We try to fetch first
            try {
                const EXCHANGE_RATE_API_KEY = Deno.env.get("EXCHANGE_RATE_API_KEY");
                console.log(`[ExchangeRate] Key present: ${!!EXCHANGE_RATE_API_KEY}`);
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
                // Absolute last resort fallback to prevent total service failure if API is down and no cache
                return 1650;
            }
        }

        // Countdown timer and auto-cancel functions
        const COUNTDOWN_DURATION = 120000; // 120 seconds

        async function handleOrderTimeout(orderId: string, smspoolOrderId: string, userId: string): Promise<void> {
            const log = (msg: string) => console.log(`[TIMEOUT] ${msg}`);
            log(`Order ${orderId} timed out after ${COUNTDOWN_DURATION / 1000}s - cancelling and refunding`);

            try {
                // 1. Cancel order on SMSPool
                const cancelUrl = `https://api.smspool.net/sms/cancel?key=${SMSPOOL_API_KEY}&orderid=${smspoolOrderId}`;
                log(`Cancelling SMSPool order: ${smspoolOrderId}`);

                const cancelResponse = await fetch(cancelUrl);
                const cancelData = await cancelResponse.json();
                log(`SMSPool cancel response: ${JSON.stringify(cancelData)}`);

                // 2. Update order status to trigger the auto-refund database trigger
                await supabase.from('orders').update({
                    status: 'refunded',
                    metadata: {
                        timeout_cancelled: true,
                        timeout_at: new Date().toISOString(),
                        smspool_cancelled: cancelData.success || false
                    }
                }).eq('id', orderId);

                log(`Order ${orderId} successfully cancelled and refunded`);

            } catch (error) {
                log(`Error during timeout handling: ${error.message}`);
            }
        }

        async function fastPollOTP(orderId: string, smspoolOrderId: string, userId: string): Promise<any> {
            const log = (msg: string) => console.log(`[FAST_POLL] ${msg}`);
            log(`Starting accelerated polling for order ${orderId} (SMSPool: ${smspoolOrderId})`);

            const startTime = Date.now();
            const maxDuration = COUNTDOWN_DURATION;
            let foundCode: string | null = null;
            let finalStatus: string | null = null;
            let pollCount = 0;

            // Poll every 1 second for 120 seconds
            while (Date.now() - startTime < maxDuration) {
                const elapsed = Date.now() - startTime;
                const pollInterval = 1000;
                pollCount++;

                log(`Poll ${pollCount}: ${Math.round(elapsed / 1000)}s elapsed, ${Math.round((maxDuration - elapsed) / 1000)}s remaining`);

                try {
                    const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${smspoolOrderId}`;
                    const response = await fetch(checkUrl);
                    const data = await response.json();

                    // Check for completed
                    if ((data.status === 3 || data.status === 'completed') && data.sms) {
                        foundCode = data.sms;
                        finalStatus = 'completed';
                        log(`OTP found: ${foundCode}`);
                        break;
                    }

                    // Check for refunded/cancelled
                    if (data.status === 6 || data.status === 2 || data.status === 'refunded') {
                        finalStatus = 'refunded';
                        log(`Order refunded/cancelled on SMSPool`);
                        break;
                    }

                    // Check for failed
                    if (data.status === 5 || data.status === 'failed') {
                        finalStatus = 'failed';
                        log(`Order failed on SMSPool`);
                        break;
                    }

                } catch (err) {
                    log(`Polling error: ${err.message}`);
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            // Handle timeout - no code found
            if (!foundCode && !finalStatus) {
                log(`Timeout reached after ${COUNTDOWN_DURATION / 1000}s - no OTP received`);
                await handleOrderTimeout(orderId, smspoolOrderId, userId);
                return {
                    success: false,
                    timeout: true,
                    message: `Order timed out after ${COUNTDOWN_DURATION / 1000}s - automatically cancelled and refunded`
                };
            }

            // Handle refund
            if (finalStatus === 'refunded') {
                await supabase.from('orders').update({ status: 'refunded' }).eq('id', orderId);
                return {
                    success: false,
                    refunded: true,
                    message: "Order was refunded"
                };
            }

            // Handle failure
            if (finalStatus === 'failed') {
                await supabase.from('orders').update({ status: 'failed' }).eq('id', orderId);
                return {
                    success: false,
                    failed: true,
                    message: "Order failed"
                };
            }

            // Success - OTP found
            if (foundCode) {
                // Update database
                await supabase.from('orders').update({
                    status: 'completed',
                    payment_status: 'completed',
                    sms_code: foundCode,
                    metadata: {
                        smspool_status: 'completed',
                        completed_at: new Date().toISOString()
                    }
                }).eq('id', orderId);

                // Update verifications
                await supabase.from('verifications').update({
                    otp_code: foundCode,
                    received_at: new Date().toISOString()
                }).eq('order_id', orderId);

                return {
                    success: true,
                    otp_code: foundCode,
                    message: "OTP received successfully"
                };
            }

            return {
                success: false,
                message: "Polling ended without result"
            };
        }

        if (action === 'get_price') {
            const { country, service } = payload;
            if (!country || !service) return new Response("Missing country or service", { status: 400, headers: corsHeaders });

            // Fetch raw price from SMSPool
            const response = await fetch(`https://api.smspool.net/request/price?key=${SMSPOOL_API_KEY}&country=${country}&service=${service}`);
            const smspoolData = await response.json();

            if (!smspoolData.price) {
                return new Response(JSON.stringify({ error: "Price not available" }), {
                    status: 404,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // Get dynamic exchange rate
            const USD_TO_NGN_RATE = await getExchangeRate();

            // Calculate pricing
            const rawUSD = parseFloat(smspoolData.price);
            const markup = 1.45;

            // Formula: selling_usd = raw_usd * 1.45
            const sellingUSD = rawUSD * markup;

            // Formula: final_ngn = selling_usd * exchange_rate
            const finalNGN = sellingUSD * USD_TO_NGN_RATE;

            // Round to nearest whole number for NGN
            const roundedNGN = Math.round(finalNGN);

            // Format for display
            const displayNGN = `₦${roundedNGN.toLocaleString()}`;

            const pricingData = {
                final_ngn: roundedNGN,
                display_ngn: displayNGN
            };

            return new Response(JSON.stringify(pricingData), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // --- PROVIDER-FIRST WALLET PURCHASE (Safe Flow) ---
        if (action === 'purchase_wallet') {
            // 1. Authenticate User
            const authHeader = req.headers.get('Authorization');
            const headerToken = authHeader ? authHeader.replace('Bearer ', '') : null;
            const token = payload.user_token || headerToken;

            if (!token) return new Response(JSON.stringify({ success: false, message: "Missing authentication token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

            const { data: { user }, error: authError } = await supabase.auth.getUser(token);

            if (authError || !user) {
                console.error("Auth Error:", authError);
                return new Response(JSON.stringify({ success: false, message: "Invalid or expired user token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const { service_type, country, service_id, country_id } = payload;
            if (!service_type || !country) return new Response(JSON.stringify({ success: false, message: "Missing service or country" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

            console.log(`[Wallet] Authenticated user ID: ${user.id}, email: ${user.email}`);

            // 2. Get live pricing
            const priceResp = await fetch(`https://api.smspool.net/request/price?key=${SMSPOOL_API_KEY}&country=${country_id || country}&service=${service_id || service_type}`);
            const priceData = await priceResp.json();

            if (!priceData.price) return new Response(JSON.stringify({ success: false, message: "Service unavailable or no price" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

            const USD_TO_NGN_RATE = await getExchangeRate();
            const rawUSD = parseFloat(priceData.price);
            const markup = 1.45;
            const price_usd = rawUSD * markup;
            const price_ngn = Math.round(price_usd * USD_TO_NGN_RATE);
            const price_kobo = price_ngn * 100;

            console.log(`[Wallet] DEBUG PRICING: rawUSD=${rawUSD}, markup=${markup}, price_usd=${price_usd}, rate=${USD_TO_NGN_RATE}, price_ngn=${price_ngn}, price_kobo=${price_kobo}`);
            console.log(`[Wallet] User ${user.id} requesting ${service_type}. Cost: ₦${price_ngn} (${price_kobo} kobo)`);

            // 3. Pre-flight balance check via RPC (bypasses RLS via SECURITY DEFINER)
            const { data: walletInfo, error: walletRpcError } = await supabase.rpc('get_wallet_balance', {
                p_user_id: user.id
            });

            console.log(`[Wallet] RPC get_wallet_balance result:`, JSON.stringify(walletInfo), `error:`, JSON.stringify(walletRpcError));

            if (walletRpcError) {
                console.error(`[Wallet] RPC error: ${walletRpcError.message}`, JSON.stringify(walletRpcError));
                return new Response(JSON.stringify({ success: false, message: `Wallet service error: ${walletRpcError.message}`, debug: { code: walletRpcError.code, details: walletRpcError.details, hint: walletRpcError.hint } }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            if (!walletInfo || !walletInfo.found) {
                console.error(`[Wallet] Wallet not found for user ${user.id} even after auto-create`);
                return new Response(JSON.stringify({ success: false, message: `Wallet not found. Please contact support.` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // Read balance — use balance_kobo if available, otherwise convert legacy balance (NGN) to kobo
            let actualBalanceKobo: number = 0;
            if (walletInfo.balance_kobo != null && Number(walletInfo.balance_kobo) > 0) {
                actualBalanceKobo = Number(walletInfo.balance_kobo);
            } else if (walletInfo.balance != null && Number(walletInfo.balance) > 0) {
                actualBalanceKobo = Math.round(Number(walletInfo.balance) * 100);
                console.log(`[Wallet] Using legacy balance: ${walletInfo.balance} NGN = ${actualBalanceKobo} kobo`);
            }

            console.log(`[Wallet] Balance: ${actualBalanceKobo} kobo, Required: ${price_kobo} kobo`);

            if (actualBalanceKobo < price_kobo) {
                return new Response(JSON.stringify({
                    success: false,
                    message: `Insufficient funds. Need ₦${price_ngn}, have ₦${(actualBalanceKobo / 100).toFixed(2)}`
                }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 4. Call SMSPool FIRST — with 15s timeout
            //    Wallet is NOT touched yet. If this fails, user loses nothing.
            let poolData: any;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);

                const poolUrl = `https://api.smspool.net/purchase/sms?key=${SMSPOOL_API_KEY}&country=${country_id}&service=${service_id}`;
                console.log(`[Wallet] Calling SMSPool (30s timeout)...`);

                const poolResp = await fetch(poolUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                poolData = await poolResp.json();
                console.log(`[Wallet] SMSPool response:`, JSON.stringify(poolData));

                if (!(poolData.success === 1 || (poolData.number && !poolData.error))) {
                    // Provider refused — no number available
                    const msg = poolData.message || "SMSPool: No numbers available for this service";
                    console.log(`[Wallet] Provider refused: ${msg}`);
                    return new Response(JSON.stringify({ success: false, message: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
                }
            } catch (providerError: any) {
                // Timeout or network error — wallet NOT touched
                const isTimeout = providerError.name === 'AbortError';
                const msg = isTimeout
                    ? "Provider did not respond within 15 seconds. Please try again."
                    : `Provider error: ${providerError.message}`;
                console.error(`[Wallet] Provider failed (timeout=${isTimeout}):`, providerError.message);
                return new Response(JSON.stringify({ success: false, message: msg }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            // 5. Provider confirmed! Extract number details.
            const phoneNumber = poolData.number || poolData.phonenumber;
            const smsPoolOrderId = poolData.order_id;
            const purchaseRef = `WAL-${crypto.randomUUID()}`;

            console.log(`[Wallet] Provider confirmed number: ${phoneNumber}, SMSPool Order: ${smsPoolOrderId}. Running atomic transaction...`);

            // 6. ATOMIC: deduct wallet + create order + create verification in ONE transaction
            //    If ANY step fails, the entire transaction rolls back — no partial state.
            const { data: atomicResult, error: atomicError } = await supabase.rpc('atomic_purchase_verification', {
                p_user_id: user.id,
                p_service_type: service_type,
                p_country: country,
                p_country_id: country_id || '',
                p_service_id: service_id || '',
                p_price_kobo: price_kobo,
                p_exchange_rate: USD_TO_NGN_RATE,
                p_phone_number: phoneNumber,
                p_smspool_order_id: smsPoolOrderId.toString(),
                p_payment_reference: purchaseRef,
                p_metadata: {
                    ...poolData,
                    countryId: country_id,
                    serviceId: service_id,
                    source: 'wallet',
                    raw_usd: rawUSD,
                    markup_usd: price_usd,
                    price_ngn: price_ngn,
                    rate: USD_TO_NGN_RATE
                }
            });

            if (atomicError || !atomicResult?.success) {
                // Atomic transaction failed — wallet was NOT deducted (auto-rollback)
                // Cancel the SMSPool order so the number isn't wasted
                const errMsg = atomicResult?.message || atomicError?.message || "Transaction failed";
                console.error(`[Wallet] Atomic transaction failed: ${errMsg}. Cancelling SMSPool order ${smsPoolOrderId}...`);

                try {
                    await fetch(`https://api.smspool.net/sms/cancel?key=${SMSPOOL_API_KEY}&orderid=${smsPoolOrderId}`);
                    console.log(`[Wallet] SMSPool order ${smsPoolOrderId} cancelled.`);
                } catch (cancelErr: any) {
                    console.error(`[Wallet] Failed to cancel SMSPool order: ${cancelErr.message}`);
                }

                // Log failure for monitoring
                try {
                    await supabase.rpc('log_failure', {
                        p_user_id: user.id,
                        p_action: 'purchase_wallet',
                        p_error_message: errMsg,
                        p_context: {
                            smspool_order_id: smsPoolOrderId,
                            phone_number: phoneNumber,
                            price_kobo: price_kobo,
                            payment_reference: purchaseRef,
                            atomic_error: atomicError?.message || null
                        }
                    });
                } catch (_logErr) {
                    // Don't fail the response if logging fails
                }

                return new Response(JSON.stringify({ success: false, message: errMsg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }

            const orderId = atomicResult.order_id;
            console.log(`[Wallet] Atomic purchase complete! Order: ${orderId}, Number: ${phoneNumber}, New Balance: ${atomicResult.new_balance}`);

            console.log(`[Wallet] Purchase complete for order ${orderId}. Frontend polling will handle OTP detection and timeout.`);

            return new Response(JSON.stringify({
                success: true,
                order_id: orderId,
                smspool_order_id: smsPoolOrderId.toString(),
                number: phoneNumber,
                message: "Number purchased successfully"
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === 'purchase') {
            // Existing purchase logic
            const { order_id, service_type, user_id } = payload; // or pass country/service explicitly

            // We might need mapping from Paystack webhook which calls this.
            // If this is called from Frontend (not recommended for purchase directly?), proceed.
            // But usually Paystack Webhook calls this.
            // Paystack webhook passes: { order_id, service_type } (from metadata).

            if (!order_id || !service_type) {
                return new Response("Missing order_id or service_type", { status: 400, headers: corsHeaders });
            }

            // We need country too. If it's stored in order metadata, we should fetch it from DB.
            // Fetch order first to get country?
            const { data: order } = await supabase.from('orders').select('metadata, user_id').eq('id', order_id).single();
            const countryId = order?.metadata?.countryId || '1'; // Default US if missing
            const serviceId = order?.metadata?.serviceId || service_type; // Use ID if available

            const smspoolUrl = `https://api.smspool.net/purchase/sms?key=${SMSPOOL_API_KEY}&country=${countryId}&service=${serviceId}`;
            console.log(`Calling SMSPool: ${smspoolUrl}`);

            const response = await fetch(smspoolUrl);
            const data = await response.json();

            if (data.success === 0) {
                throw new Error(data.message || "Failed to purchase number");
            }

            const smsPoolOrderId = data.order_id;
            const phoneNumber = data.phonenumber || data.number;

            console.log("SMSPool Purchase Successful:", { smsPoolOrderId, phoneNumber, fullData: data });

            // Update Order
            const { error: updateError } = await supabase
                .from("orders")
                .update({
                    request_id: smsPoolOrderId.toString(),
                    metadata: {
                        ...order?.metadata,
                        ...data,
                        phonenumber: phoneNumber,
                    }
                }).eq('id', order_id);

        if (action === 'check_sms') {
            const debugLogs: string[] = [];
            const log = (msg: string) => { console.log(msg); debugLogs.push(msg); };

            log("Starting check_sms with debug...");

            // 1. Fetch active orders from SMSPool
            const response = await fetch(`https://api.smspool.net/request/active?key=${SMSPOOL_API_KEY}`);
            const smspoolActiveOrders = await response.json();
            log(`SMSPool Active Orders Count: ${Array.isArray(smspoolActiveOrders) ? smspoolActiveOrders.length : 'Not Array'}`);

            // 2. Fetch locally 'Active' or 'Pending' orders from DB
            const { data: localActiveOrders, error: dbError } = await supabase
                .from('orders')
                .select('*')
                .in('payment_status', ['paid', 'pending'])
                .not('request_id', 'is', null);

            if (dbError) {
                log(`DB Error: ${dbError.message}`);
                return new Response(JSON.stringify({ error: dbError.message, debug: debugLogs }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            log(`Local Active Orders Count: ${localActiveOrders?.length || 0}`);

            const activeOrdersList = Array.isArray(smspoolActiveOrders) ? smspoolActiveOrders : [];
            const activePoolOrderIds = new Set(activeOrdersList.map((o: any) => o.order_id));
            const updates = [];

            // 3. Sync Logic
            for (const localOrder of localActiveOrders || []) {
                const smspoolId = localOrder.request_id;

                if (activePoolOrderIds.has(smspoolId)) {
                    log(`Order ${localOrder.id} (${smspoolId}) found in SMSPool active list.`);
                    const poolOrder = activeOrdersList.find((o: any) => o.order_id === smspoolId);

                    if (poolOrder && poolOrder.sms) {
                        const existingLogs = localOrder.metadata?.logs || [];
                        const code = poolOrder.sms;
                        const alreadyLogged = existingLogs.some((log: any) => log.code === code);

                        if (!alreadyLogged) {
                            const newLog = {
                                id: Date.now().toString(),
                                sender: 'Service',
                                message: `Your code is ${code}`,
                                code: code,
                                receivedAt: new Date().toISOString()
                            };

                            const updatedMetadata = {
                                ...localOrder.metadata,
                                logs: [newLog, ...existingLogs],
                                sms_code: code // Update main code field
                            };

                            // Update DB
                            await supabase
                                .from('orders')
                                .update({ metadata: updatedMetadata, sms_code: code })
                                .eq('id', localOrder.id);

                            // Update Verifications
                            await supabase
                                .from('verifications')
                                .update({
                                    otp_code: code,
                                    full_sms: poolOrder.full_sms || code,
                                    received_at: new Date().toISOString()
                                })
                                .eq('order_id', localOrder.id);

                            updates.push({ order_id: localOrder.id, status: 'Active', code: code });
                            log(`Updated active order ${localOrder.id} with new code: ${code}`);
                        }
                    } else {
                        log(`Order ${localOrder.id} in SMSPool but no SMS yet.`);
                    }
                }
                else {
                    // Start of Throttle Check
                    const lastChecked = localOrder.metadata?.status_checked_at;
                    if (lastChecked) {
                        const secondsSinceCheck = (Date.now() - new Date(lastChecked).getTime()) / 1000;
                        if (secondsSinceCheck < 30) {
                            log(`Order ${localOrder.id} checked ${Math.round(secondsSinceCheck)}s ago. Skipping.`);
                            continue;
                        }
                    }
                    // End of Throttle Check

                    log(`Order ${localOrder.id} (SMSPool: ${smspoolId}) missing from active list. Checking status...`);

                    try {
                        const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${smspoolId}`;
                        const checkResp = await fetch(checkUrl);
                        const checkData = await checkResp.json();
                        log(`checkData for ${smspoolId}: Status=${checkData.status}, SMS=${checkData.sms}`);

                        const statusVal = checkData.status;

                        let newSmsStatus = localOrder.status || localOrder.payment_status;
                        let newMetadata = { ...localOrder.metadata, smspool_status: statusVal, status_checked_at: new Date().toISOString() };
                        let updateNeeded = false;

                        if (statusVal === 2 || statusVal === 6 || statusVal === 'refunded') {
                            newSmsStatus = 'refunded';
                            updateNeeded = true;
                            // DB trigger (trg_auto_refund) will auto-credit wallet when status='refunded'
                            log(`[check_sms] Setting status=refunded for ${localOrder.id} — trigger will handle wallet credit`);
                        } else if (statusVal === 3 || statusVal === 'completed') {
                            newSmsStatus = 'completed';
                            updateNeeded = true;
                            if (checkData.sms && checkData.sms !== localOrder.sms_code) {
                                const code = checkData.sms;
                                const newLog = {
                                    id: Date.now().toString(),
                                    sender: 'Service',
                                    message: `Your code is ${code}`,
                                    code: code,
                                    receivedAt: new Date().toISOString()
                                };
                                newMetadata.logs = [newLog, ...(newMetadata.logs || [])];
                                newMetadata.sms_code = code;
                            }
                        } else if (statusVal === 1 || statusVal === 'pending') {
                            // SMSPool status 1 = pending (waiting for SMS code)
                            log(`Order ${localOrder.id} is pending on SMSPool (waiting for code)`);
                        }

                        if (updateNeeded) {
                            const updatePayload: any = { metadata: newMetadata, status: newSmsStatus };
                            // For completed orders, also update payment_status
                            if (newSmsStatus === 'completed') {
                                updatePayload.payment_status = 'completed';
                            }
                            // NOTE: for refunded, do NOT set payment_status here — the DB trigger does it

                            const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', localOrder.id);

                            if (updateError) {
                                log(`Failed to update order ${localOrder.id}: ${updateError.message}`);
                            } else {
                                // If we have a new SMS code, update verifications
                                if (newMetadata.sms_code && newMetadata.sms_code !== localOrder.sms_code) {
                                    await supabase
                                        .from('verifications')
                                        .update({
                                            otp_code: newMetadata.sms_code,
                                            full_sms: checkData.full_sms || newMetadata.sms_code,
                                            received_at: new Date().toISOString()
                                        })
                                        .eq('order_id', localOrder.id);
                                }

                                updates.push({ order_id: localOrder.id, status: newSmsStatus });
                                log(`Updated order ${localOrder.id} to status=${newSmsStatus}`);
                            }
                        } else {
                            log(`No update needed for ${localOrder.id}. StatusVal: ${statusVal}`);
                        }

                    } catch (err) {
                        log(`Failed to check status for ${localOrder.id}: ${err.message}`);
                    }
                }
            }

            return new Response(JSON.stringify({ success: true, updates, debug: debugLogs }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }


        if (action === 'poll_sms') {
            const { order_id } = payload;
            if (!order_id) return new Response("Missing order_id", { status: 400, headers: corsHeaders });

            const log = (msg: string) => console.log(`[poll_sms] ${msg}`);

            // 1. Get request_id from DB
            const { data: order } = await supabase.from('orders').select('request_id').eq('id', order_id).single();
            if (!order || !order.request_id) {
                return new Response(JSON.stringify({ success: false, message: "Order not found or no request_id" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            const smspoolId = order.request_id;
            let foundCode: string | null = null;
            let finalStatus: string | null = null;
            let fullSmsText: string | null = null;

            // 2. Poll SMSPool (Max 20 attempts ~ 100 seconds)
            for (let i = 0; i < 20; i++) {
                try {
                    log(`Attempt ${i + 1}/20 checking order ${smspoolId}...`);
                    const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${smspoolId}`;
                    const response = await fetch(checkUrl);
                    const data = await response.json();

                    if (data.status === 3 || data.status === 'completed') {
                        if (data.sms) {
                            foundCode = data.sms;
                            fullSmsText = data.full_sms || data.sms; // SMSPool sometimes provides full_sms
                            finalStatus = 'completed';
                            log(`SMS Found: ${foundCode}`);
                            break;
                        }
                    } else if (data.status === 6 || data.status === 'refunded') {
                        finalStatus = 'refunded';
                        log("Order refunded/expired.");
                        break;
                    }

                    // Wait 5 seconds before next attempt
                    await new Promise(resolve => setTimeout(resolve, 5000));

                } catch (err) {
                    log(`Polling error: ${err.message}`);
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            // 3. Update 'verifications' if code found
            if (foundCode) {
                const { error: insertError } = await supabase
                    .from('verifications')
                    .update({
                        otp_code: foundCode,
                        full_sms: fullSmsText || foundCode,
                        received_at: new Date().toISOString()
                    })
                    .eq('order_id', order_id);

                if (insertError) {
                    log(`Error updating verification: ${insertError.message}`);
                    return new Response(JSON.stringify({ success: false, message: "Failed to update verifications", error: insertError }), {
                        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
                    });
                } else {
                    log("Verification saved successfully.");
                }

                // Optional: Update order status to completed if not already
                await supabase.from('orders').update({
                    payment_status: 'completed',
                    sms_code: foundCode,
                    metadata: { ...order.metadata, smspool_status: 'completed' }  // Might need to fetch metadata first but skipping for speed
                }).eq('id', order_id);

                return new Response(JSON.stringify({ success: true, otp_code: foundCode, message: "SMS received and saved" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            if (finalStatus === 'refunded') {
                // Set orders.status = 'refunded' (SMS lifecycle)
                // DB trigger (trg_auto_refund) will auto-credit wallet
                const { error: updateErr } = await supabase.from('orders').update({ status: 'refunded' }).eq('id', order_id);
                if (updateErr) {
                    log(`[poll_sms] Failed to set status=refunded for ${order_id}: ${updateErr.message}`);
                } else {
                    log(`[poll_sms] Set status=refunded for ${order_id} — trigger will handle wallet credit`);
                }
                return new Response(JSON.stringify({ success: false, message: "Order was refunded/expired", refunded: true }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            return new Response(JSON.stringify({ success: false, message: "Polling timed out, no SMS received yet." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ─── NEW: sync_order_status ─── Server-side per-order sync ───
        if (action === 'sync_order_status') {
            const { order_id } = payload;
            if (!order_id) return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

            const log = (msg: string) => console.log(`[sync_order_status] ${msg}`);
            log(`Syncing order ${order_id}...`);

            // 1. Fetch order from Supabase
            const { data: order, error: orderErr } = await supabase
                .from('orders')
                .select('*')
                .eq('id', order_id)
                .single();

            if (orderErr || !order) {
                log(`Order not found: ${orderErr?.message}`);
                return new Response(JSON.stringify({ success: false, message: 'Order not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // 2. Read request_id (SMSPool order ID)
            const requestId = order.request_id;
            if (!requestId) {
                log(`Order ${order_id} has no request_id — cannot check SMSPool`);
                return new Response(JSON.stringify({ success: false, message: 'No SMSPool request_id on this order' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // 3. Call SMSPool API to check status
            const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${requestId}`;
            log(`Calling SMSPool: ${checkUrl}`);
            const checkResp = await fetch(checkUrl);
            const checkData = await checkResp.json();
            log(`SMSPool response: status=${checkData.status}, sms=${checkData.sms || 'none'}`);

            const statusVal = checkData.status;

            // 4. Map SMSPool statuses
            let newSmsStatus = order.status || order.payment_status;
            let newMetadata = { ...order.metadata, smspool_status: statusVal, status_checked_at: new Date().toISOString() };
            let statusChanged = false;
            let refundTriggered = false;

            if (statusVal === 1 || statusVal === 'pending') {
                // SMSPool status 1 = pending (code hasn't arrived yet)
                // Check if order has expired (older than 120 seconds)
                const orderCreatedAt = new Date(order.created_at).getTime();
                const elapsedMs = Date.now() - orderCreatedAt;
                const TIMEOUT_MS = 120000; // 120 seconds

                if (elapsedMs > TIMEOUT_MS) {
                    log(`Order ${order_id} EXPIRED after ${Math.round(elapsedMs / 1000)}s — cancelling on SMSPool and refunding`);

                    // Cancel on SMSPool
                    try {
                        const cancelUrl = `https://api.smspool.net/sms/cancel?key=${SMSPOOL_API_KEY}&orderid=${requestId}`;
                        const cancelResp = await fetch(cancelUrl);
                        const cancelData = await cancelResp.json();
                        log(`SMSPool cancel response: ${JSON.stringify(cancelData)}`);
                    } catch (cancelErr: any) {
                        log(`SMSPool cancel error (non-fatal): ${cancelErr.message}`);
                    }

                    // Set status to 'refunded' — DB trigger (trg_auto_refund) handles wallet credit
                    newSmsStatus = 'refunded';
                    statusChanged = true;
                    refundTriggered = true;
                    newMetadata.timeout_cancelled = true;
                    newMetadata.timeout_at = new Date().toISOString();
                    newMetadata.elapsed_seconds = Math.round(elapsedMs / 1000);
                    log(`Order ${order_id} marked as refunded (timeout). Trigger will handle wallet credit.`);
                } else {
                    log(`Status: pending (waiting for code, ${Math.round((TIMEOUT_MS - elapsedMs) / 1000)}s remaining)`);
                }
            } else if (statusVal === 3 || statusVal === 'completed') {
                // SMSPool status 3 = completed (code arrived)
                newSmsStatus = 'completed';
                statusChanged = true;
                log(`Status mapped: 3 → completed`);

                // Store SMS code if available
                if (checkData.sms) {
                    const code = checkData.sms;
                    newMetadata.sms_code = code;
                    const existingLogs = newMetadata.logs || [];
                    const alreadyLogged = existingLogs.some((l: any) => l.code === code);
                    if (!alreadyLogged) {
                        newMetadata.logs = [{
                            id: Date.now().toString(),
                            sender: 'Service',
                            message: `Your code is ${code}`,
                            code,
                            receivedAt: new Date().toISOString()
                        }, ...existingLogs];
                    }

                    // Update verifications table
                    await supabase
                        .from('verifications')
                        .update({
                            otp_code: code,
                            full_sms: checkData.full_sms || code,
                            received_at: new Date().toISOString()
                        })
                        .eq('order_id', order_id);
                }
            } else if (statusVal === 6 || statusVal === 2 || statusVal === 'refunded') {
                // SMSPool status 6 → refunded (SMS lifecycle)
                newSmsStatus = 'refunded';
                statusChanged = true;
                refundTriggered = true;
                log(`Status mapped: ${statusVal} → refunded (trigger will handle wallet credit)`);
                // DB trigger (trg_auto_refund) will auto-credit wallet when status='refunded'
            }

            // 5. Update Supabase orders table
            if (statusChanged) {
                const updatePayload: any = { status: newSmsStatus, metadata: newMetadata };
                if (newMetadata.sms_code) {
                    updatePayload.sms_code = newMetadata.sms_code;
                }
                // For completed, also set payment_status
                if (newSmsStatus === 'completed') {
                    updatePayload.payment_status = 'completed';
                }
                // NOTE: for refunded, do NOT set payment_status — the DB trigger does it
                const { error: updateErr } = await supabase.from('orders').update(updatePayload).eq('id', order_id);
                if (updateErr) {
                    log(`DB update error: ${updateErr.message}`);
                    return new Response(JSON.stringify({ success: false, message: 'Failed to update order', error: updateErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                }
                log(`Order ${order_id} updated: status=${newSmsStatus}`);
            } else {
                // Still update metadata with latest check timestamp
                await supabase.from('orders').update({ metadata: newMetadata }).eq('id', order_id);
                log(`No status change for order ${order_id}. Current: ${order.status || order.payment_status}`);
            }

            return new Response(JSON.stringify({
                success: true,
                order_id,
                previous_status: order.payment_status,
                new_status: newSmsStatus,
                smspool_status: statusVal,
                sms: checkData.sms || null,
                refund_triggered: refundTriggered,
                status_changed: statusChanged
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'check_order') {
            const { order_id } = payload;
            if (!order_id) return new Response("Missing order_id", { status: 400, headers: corsHeaders });

            // 1. Get request_id from DB
            const { data: order } = await supabase.from('orders').select('request_id, metadata').eq('id', order_id).single();
            if (!order || !order.request_id) {
                return new Response(JSON.stringify({ success: false, message: "Order not found or no request_id" }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // 2. Call SMSPool check endpoint
            const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${order.request_id}`;
            console.log(`Checking SMSPool Order: ${checkUrl}`);

            const response = await fetch(checkUrl);
            const data = await response.json();

            console.log("SMSPool Check Response:", data);

            // 3. Update DB based on status
            const updates: any = { metadata: { ...order.metadata, smspool_status: data.status, last_check: new Date().toISOString() } };

            // Map SMSPool status
            if (data.status === 6 || data.status === 2 || data.status === 'refunded') {
                // Set SMS lifecycle status — DB trigger handles wallet credit
                updates.status = 'refunded';
                console.log(`[check_order] Setting status=refunded for ${order_id} — trigger will handle wallet credit`);
            } else if (data.status === 3 || data.status === 'completed') {
                updates.status = 'completed';
                updates.payment_status = 'completed';
                if (data.sms && data.sms !== order.metadata?.sms_code) {
                    updates.sms_code = data.sms;
                    const newLog = {
                        id: Date.now().toString(),
                        sender: 'Service',
                        message: `Your code is ${data.sms}`,
                        code: data.sms,
                        receivedAt: new Date().toISOString()
                    };
                    updates.metadata.logs = [newLog, ...(order.metadata?.logs || [])];

                    // Update Verifications
                    await supabase
                        .from('verifications')
                        .update({
                            otp_code: data.sms,
                            full_sms: data.full_sms || data.sms,
                            received_at: new Date().toISOString()
                        })
                        .eq('order_id', order_id);
                }
            } else if (data.status === 1 || data.status === 'pending') {
                // SMSPool status 1 = pending (code hasn't arrived yet) — no change needed
                console.log(`[check_order] Order ${order_id} is pending on SMSPool (waiting for code)`);
            }

            const { error } = await supabase.from('orders').update(updates).eq('id', order_id);

            return new Response(JSON.stringify({ success: true, data }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // Countdown API for frontend display
        if (action === 'get_order_countdown') {
            const { order_id } = payload;
            if (!order_id) {
                return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            try {
                const { data: order, error: orderErr } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', order_id)
                    .single();

                if (orderErr || !order) {
                    return new Response(JSON.stringify({ success: false, message: 'Order not found' }), {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                    });
                }

                // Calculate countdown
                const orderCreatedAt = new Date(order.created_at).getTime();
                const currentTime = Date.now();
                const totalDuration = 80000; // 80 seconds
                const elapsed = currentTime - orderCreatedAt;
                const remaining = Math.max(0, totalDuration - elapsed);
                const percentage = Math.round((elapsed / totalDuration) * 100);

                const isActive = order.status !== 'completed' && order.status !== 'refunded' && order.status !== 'failed' && remaining > 0;

                const response = {
                    success: true,
                    order_id: order_id,
                    status: order.status,
                    countdown: {
                        active: isActive,
                        total_duration: totalDuration,
                        elapsed: elapsed,
                        remaining: remaining,
                        percentage: Math.min(percentage, 100),
                        time_remaining_seconds: Math.round(remaining / 1000),
                        time_elapsed_seconds: Math.round(elapsed / 1000),
                        message: isActive ? 'Waiting for OTP...' :
                            order.status === 'completed' ? 'OTP received' :
                                order.status === 'refunded' ? 'Order refunded' : 'Order completed'
                    },
                    order_details: {
                        phone_number: order.phone_number,
                        service_type: order.metadata?.serviceId,
                        country_id: order.metadata?.countryId,
                        created_at: order.created_at,
                        payment_status: order.payment_status
                    }
                };

                return new Response(JSON.stringify(response), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (error) {
                return new Response(JSON.stringify({ success: false, message: error.message }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // ─── NEW: get_order_status ─── Frontend polling endpoint ───
        if (action === 'get_order_status') {
            const { order_id } = payload;
            if (!order_id) {
                return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const log = (msg: string) => console.log(`[get_order_status] ${msg}`);
            log(`Getting status for order ${order_id}`);

            const { data: order, error: orderErr } = await supabase
                .from('orders')
                .select('id, status, sms_code, phone_number, request_id, created_at, completed_at, timeout_at, metadata, price_kobo, user_id')
                .eq('id', order_id)
                .single();

            if (orderErr || !order) {
                log(`Order not found: ${orderErr?.message}`);
                return new Response(JSON.stringify({ success: false, message: 'Order not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // Calculate time info
            const createdAt = new Date(order.created_at).getTime();
            const now = Date.now();
            const timeoutMs = ORDER_TIMEOUT_MS;
            const elapsed = now - createdAt;
            const remaining = Math.max(0, timeoutMs - elapsed);
            const isActive = !['completed', 'refunded', 'cancelled', 'failed'].includes(order.status) && remaining > 0;

            // Get status logs
            const { data: logs } = await supabase
                .from('order_status_logs')
                .select('*')
                .eq('order_id', order_id)
                .order('created_at', { ascending: false })
                .limit(10);

            const response = {
                success: true,
                order_id: order.id,
                status: order.status,
                sms_code: order.sms_code,
                phone_number: order.phone_number,
                request_id: order.request_id,
                created_at: order.created_at,
                completed_at: order.completed_at,
                timeout_at: order.timeout_at,
                countdown: {
                    active: isActive,
                    total_duration: timeoutMs,
                    elapsed: elapsed,
                    remaining: remaining,
                    percentage: Math.min(100, Math.round((elapsed / timeoutMs) * 100)),
                    time_remaining_seconds: Math.round(remaining / 1000),
                    time_elapsed_seconds: Math.round(elapsed / 1000),
                    message: isActive ? 'Waiting for OTP...' :
                        order.status === 'completed' ? 'OTP received' :
                            order.status === 'refunded' ? 'Order refunded' :
                                order.status === 'cancelled' ? 'Order cancelled' :
                                    order.status === 'failed' ? 'Order failed' : 'Unknown'
                },
                metadata: {
                    serviceId: order.metadata?.serviceId,
                    countryId: order.metadata?.countryId,
                    price_kobo: order.price_kobo
                },
                status_logs: logs || []
            };

            log(`Returning status: ${order.status}, sms_code: ${order.sms_code ? '***' : 'none'}`);

            return new Response(JSON.stringify(response), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response("Invalid action", { status: 400, headers: corsHeaders });
        }

    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
