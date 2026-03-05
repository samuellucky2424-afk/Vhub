// Debug script to check why auto-cancel isn't working
console.log("🔍 Debugging Auto-Cancel Issue\n");

// Check if the order exists and its current status
async function debugOrder(orderId) {
    console.log(`=== Debugging Order: ${orderId} ===`);
    
    try {
        // 1. Check order details
        console.log("\n1. Checking order details...");
        const orderResponse = await fetch('https://your-project.supabase.co/rest/v1/orders?id=eq.' + orderId + '&select=*', {
            headers: {
                'apikey': 'YOUR_SUPABASE_ANON_KEY',
                'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
            }
        });
        
        const orders = await orderResponse.json();
        
        if (orders.length === 0) {
            console.log("❌ Order not found in database");
            return;
        }
        
        const order = orders[0];
        console.log("✅ Order found:");
        console.log(`   - Status: ${order.status}`);
        console.log(`   - Payment Status: ${order.payment_status}`);
        console.log(`   - Request ID: ${order.request_id}`);
        console.log(`   - User ID: ${order.user_id}`);
        console.log(`   - Created: ${order.created_at}`);
        console.log(`   - Metadata:`, order.metadata);
        
        // 2. Check if fast polling was triggered
        console.log("\n2. Checking if fast polling was triggered...");
        if (order.metadata?.polling_attempts) {
            console.log(`✅ Fast polling was attempted (${order.metadata.polling_attempts} attempts)`);
        } else {
            console.log("❌ No fast polling attempts recorded");
        }
        
        // 3. Check SMSPool order status
        if (order.request_id) {
            console.log("\n3. Checking SMSPool order status...");
            try {
                const smspoolCheck = await fetch(`https://api.smspool.net/sms/check?key=YOUR_SMSPOOL_API_KEY&orderid=${order.request_id}`);
                const smspoolData = await smspoolCheck.json();
                console.log("SMSPool response:", smspoolData);
                
                if (smspoolData.status === 1) {
                    console.log("⚠️ Order is still pending on SMSPool - should have timed out");
                } else if (smspoolData.status === 6) {
                    console.log("✅ Order was refunded on SMSPool");
                } else {
                    console.log(`📊 SMSPool status: ${smspoolData.status}`);
                }
            } catch (err) {
                console.log("❌ Failed to check SMSPool status:", err.message);
            }
        }
        
        // 4. Check verification record
        console.log("\n4. Checking verification record...");
        const verifyResponse = await fetch(`https://your-project.supabase.co/rest/v1/verifications?order_id=eq.${orderId}&select=*`, {
            headers: {
                'apikey': 'YOUR_SUPABASE_ANON_KEY',
                'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
            }
        });
        
        const verifications = await verifyResponse.json();
        if (verifications.length > 0) {
            const verification = verifications[0];
            console.log("✅ Verification found:");
            console.log(`   - OTP Code: ${verification.otp_code}`);
            console.log(`   - Received At: ${verification.received_at}`);
            console.log(`   - Full SMS: ${verification.full_sms}`);
        } else {
            console.log("❌ No verification record found");
        }
        
        // 5. Check wallet transactions
        console.log("\n5. Checking wallet transactions...");
        const walletResponse = await fetch(`https://your-project.supabase.co/rest/v1/wallet_transactions?order_id=eq.${orderId}&select=*`, {
            headers: {
                'apikey': 'YOUR_SUPABASE_ANON_KEY',
                'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
            }
        });
        
        const transactions = await walletResponse.json();
        if (transactions.length > 0) {
            console.log("✅ Wallet transactions found:");
            transactions.forEach(tx => {
                console.log(`   - Type: ${tx.transaction_type}, Amount: ${tx.amount}, Reason: ${tx.reason}`);
            });
        } else {
            console.log("❌ No wallet transactions found");
        }
        
        // 6. Manual trigger fast polling
        console.log("\n6. Manually triggering fast polling...");
        console.log("You can manually trigger fast polling with:");
        console.log(`curl -X POST https://your-project.supabase.co/functions/v1/smspool-service \\`);
        console.log(`  -H "Content-Type: application/json" \\`);
        console.log(`  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \\`);
        console.log(`  -d '{"action": "fast_poll_otp", "order_id": "${orderId}"}'`);
        
    } catch (error) {
        console.error("Debug error:", error);
    }
}

console.log(`
To use this debug script:

1. Replace 'YOUR_ORDER_ID_HERE' with the actual order ID that didn't cancel
2. Replace 'your-project.supabase.co' with your actual Supabase URL  
3. Replace 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase anon key
4. Replace 'YOUR_SMSPOOL_API_KEY' with your actual SMSPool API key
5. Run: node debug_order.js ORDER_ID

Example: node debug_order.js abc-123-def-456

This will help identify:
- If the order exists and its current status
- If fast polling was actually triggered
- What SMSPool says about the order
- If verification records were created
- If wallet transactions were processed
- How to manually trigger the polling
`);

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debugOrder };
}
