// Test script to manually trigger fast polling for a specific order
const testOrderId = 'YOUR_ORDER_ID_HERE'; // Replace with actual order ID

console.log(`Testing fast polling for order: ${testOrderId}`);

fetch('https://your-project.supabase.co/functions/v1/smspool-service', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_SUPABASE_ANON_KEY' // Add your auth if needed
    },
    body: JSON.stringify({
        action: 'fast_poll_otp',
        order_id: testOrderId
    })
})
.then(response => response.json())
.then(data => {
    console.log('Fast poll result:', data);
})
.catch(error => {
    console.error('Fast poll error:', error);
});

console.log(`
To use this test:
1. Replace 'YOUR_ORDER_ID_HERE' with an actual order ID from your database
2. Replace 'https://your-project.supabase.co' with your actual Supabase URL
3. Replace 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase anon key (if needed)
4. Run: node test_manual_poll.js
`);
