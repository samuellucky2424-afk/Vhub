import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const signature = req.headers.get("x-paystack-signature");
        if (!signature) {
            return new Response("No signature provided", { status: 401 });
        }

        const body = await req.text();

        console.log("[LOG] Webhook Received: Validating Signature...");

        // Verify Signature
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(PAYSTACK_SECRET_KEY),
            { name: "HMAC", hash: "SHA-512" },
            false,
            ["verify"]
        );

        // Convert hex signature to Uint8Array
        const signatureBytes = new Uint8Array(
            signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );

        const verified = await crypto.subtle.verify(
            "HMAC",
            key,
            signatureBytes,
            encoder.encode(body)
        );

        if (!verified) {
            console.error("Signature verification failed");
            return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body);

        if (event.event === "charge.success") {
            const { reference, metadata } = event.data;

            console.log(`Processing Transaction: ${reference}`);

            // CHECK FOR WALLET FUNDING
            if (reference.startsWith('fund_') || metadata?.type === 'wallet_funding') {
                console.log(`[LOG] Wallet Funding Detected: ${reference}`);

                const userId = metadata?.user_id;
                const amountNGN = event.data.amount / 100;

                if (!userId) {
                    console.error('Missing user_id in metadata for wallet funding');
                    return new Response("Missing user_id", { status: 400 });
                }

                // Call credit_wallet RPC
                const { data: creditResult, error: creditError } = await supabase.rpc('credit_wallet', {
                    p_user_id: userId,
                    p_amount: amountNGN,
                    p_reference: reference,
                    p_metadata: {
                        source: 'paystack',
                        paystack_reference: reference,
                        description: `Wallet funding via Paystack`
                    }
                });

                if (creditError) {
                    console.error('Credit Wallet RPC Error:', creditError);
                    // If duplicate, it's fine
                    if (creditError.message.includes('Transaction already processed')) {
                        return new Response("Duplicate transaction", { status: 200 });
                    }
                    return new Response("Wallet credit failed", { status: 500 });
                }

                if (creditResult && !creditResult.success) {
                    // Handled within RPC but just in case
                    if (creditResult.message === 'Transaction already processed') {
                        return new Response("Duplicate transaction", { status: 200 });
                    }
                    console.error('Credit Wallet Failed:', creditResult);
                    return new Response(creditResult.message || "Wallet credit failed", { status: 500 });
                }

                console.log(`[LOG] Wallet Credited Successfully: ${userId} +${amountNGN}`);
                return new Response("Wallet funded", { status: 200 });
            }

            // EXISTING ORDER PROCESSING LOGIC
            // Fetch Order details first... (Logic for orders)
            console.log(`Processing Order Payment: ${reference}`);

            // Fetch Order details first to validate amount
            const { data: order, error: fetchError } = await supabase
                .from("orders")
                .select("*")
                .eq("payment_reference", reference)
                .single();

            // ... (rest of existing order logic) ...


            if (fetchError || !order) {
                console.error("Order fetch failed. Reference:", reference);
                console.error("Error details:", JSON.stringify(fetchError));
                return new Response(JSON.stringify({
                    error: "Order fetch failed",
                    details: fetchError,
                    reference: reference,
                    hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY
                }), {
                    status: 500,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // AMOUNT VALIDATION
            const paidAmount = event.data.amount / 100; // Convert kobo to NGN
            const expectedAmount = order.metadata?.total_paid_ngn;

            console.log(`Validation: Paid ${paidAmount} vs Expected ${expectedAmount}`);

            if (expectedAmount && paidAmount < expectedAmount) {
                console.error(`Underpayment detected! Paid: ${paidAmount}, Expected: ${expectedAmount}`);

                // Mark as failed/underpaid
                await supabase
                    .from("orders")
                    .update({
                        payment_status: "failed",
                        metadata: {
                            ...order.metadata,
                            payment_error: `User paid ${paidAmount} but required ${expectedAmount}`
                        }
                    })
                    .eq("id", order.id);

                return new Response("Payment underpaid", { status: 200 }); // Return 200 to stop Paystack retries
            }

            console.log(`[LOG] Payment Valid: Updating Order ${reference} to Paid...`);

            // Update order status to paid if validation passes
            const { error: updateError } = await supabase
                .from("orders")
                .update({ payment_status: "paid" })
                .eq("id", order.id);

            if (updateError) {
                console.error("Order status update failed:", updateError);
                return new Response("Order update failed", { status: 500 });
            }

            // Trigger SMSPool Service
            console.log(`[LOG] Triggering SMSPool API for Order ID: ${order.id}...`);

            try {
                // We call the internal service to buy the number
                const buyResponse = await fetch(`${SUPABASE_URL}/functions/v1/smspool-service`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({
                        action: "purchase",
                        order_id: order.id,
                        service_type: order.service_type,
                        user_id: order.user_id
                    }),
                });

                const contentType = buyResponse.headers.get("content-type");
                let responseData;
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    responseData = await buyResponse.json();
                } else {
                    responseData = await buyResponse.text();
                }

                console.log(`[LOG] SMSPool Response: ${JSON.stringify(responseData)}`);

                if (!buyResponse.ok || (responseData && responseData.success === 0) || (responseData && responseData.error)) {
                    throw new Error(responseData.message || responseData.error || "Failed to trigger SMSPool service");
                }

            } catch (serviceError) {
                console.error("SMSPool Service Failed:", serviceError);

                // Update order to manual intervention
                await supabase
                    .from("orders")
                    .update({
                        payment_status: "manual_intervention_required",
                        metadata: {
                            ...order.metadata,
                            error_log: `SMSPool purchase failed: ${serviceError.message}`
                        }
                    })
                    .eq("id", order.id);
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (err) {
        console.error(err);
        return new Response("Internal Server Error", { status: 500 });
    }
});
