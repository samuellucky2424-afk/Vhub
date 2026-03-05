import https from 'https';

const apiKey = 'hL7noSdy86GcFPFn0xNuAIGrb8dNpkKk';

function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Test SMSPool cancel endpoint
async function testSMSPoolCancel() {
    console.log("🧪 Testing SMSPool Cancel Endpoint\n");
    
    // First, let's test with a fake order ID to see the error response
    console.log("1. Testing cancel with fake order ID...");
    try {
        const fakeOrderId = "FAKE_ORDER_ID_12345";
        const cancelUrl = `https://api.smspool.net/sms/cancel?key=${apiKey}&orderid=${fakeOrderId}`;
        console.log(`URL: ${cancelUrl}`);
        
        const response = await fetchData(cancelUrl);
        console.log("Cancel response (fake order):", JSON.stringify(response));
        
    } catch (error) {
        console.log("Cancel error (fake order):", error.message);
    }
    
    // Test check endpoint to see what a pending order looks like
    console.log("\n2. Testing check endpoint with fake order ID...");
    try {
        const fakeOrderId = "FAKE_ORDER_ID_12345";
        const checkUrl = `https://api.smspool.net/sms/check?key=${apiKey}&orderid=${fakeOrderId}`;
        console.log(`URL: ${checkUrl}`);
        
        const response = await fetchData(checkUrl);
        console.log("Check response (fake order):", JSON.stringify(response));
        
    } catch (error) {
        console.log("Check error (fake order):", error.message);
    }
    
    // Test with a real order ID if you have one
    console.log("\n3. To test with a real order ID:");
    console.log("Replace 'REAL_ORDER_ID_HERE' with an actual SMSPool order ID");
    
    const realOrderId = "REAL_ORDER_ID_HERE"; // Replace this
    if (realOrderId !== "REAL_ORDER_ID_HERE") {
        try {
            // First check the order status
            const checkUrl = `https://api.smspool.net/sms/check?key=${apiKey}&orderid=${realOrderId}`;
            console.log(`\nChecking real order: ${checkUrl}`);
            
            const checkResponse = await fetchData(checkUrl);
            console.log("Real order status:", JSON.stringify(checkResponse));
            
            // Then try to cancel it
            const cancelUrl = `https://api.smspool.net/sms/cancel?key=${apiKey}&orderid=${realOrderId}`;
            console.log(`\nCancelling real order: ${cancelUrl}`);
            
            const cancelResponse = await fetchData(cancelUrl);
            console.log("Real order cancel response:", JSON.stringify(cancelResponse));
            
        } catch (error) {
            console.log("Real order error:", error.message);
        }
    }
    
    console.log("\n=== SMSPool API Testing Complete ===");
    console.log("If you see error responses, that's expected with fake order IDs.");
    console.log("The important thing is that the API endpoints are responding.");
}

testSMSPoolCancel().catch(console.error);
