// Simple test to check if the issue is with the countdown API
console.log("Testing countdown API endpoint...");

const testOrderId = "TEST-ORDER-123";

fetch('https://your-project.supabase.co/functions/v1/smspool-service', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY'
    },
    body: JSON.stringify({
        action: 'get_order_countdown',
        order_id: testOrderId
    })
})
.then(response => {
    console.log('Response status:', response.status);
    return response.json();
})
.then(data => {
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
        console.log('✅ Countdown API working!');
        console.log('- Order ID:', data.order_id);
        console.log('- Countdown active:', data.countdown?.active);
        console.log('- Time remaining:', data.countdown?.time_remaining_seconds);
    } else {
        console.log('❌ Countdown API failed:', data.message);
    }
})
.catch(error => {
    console.error('❌ Network error:', error.message);
});

console.log(`
Test this command to see if the countdown API works:
node test_countdown_simple.js

If this works, the issue is with the main function deployment.
If this fails, there might be a syntax error in the countdown API section.
`);
