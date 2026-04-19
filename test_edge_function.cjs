// Test script to verify smspool-service Edge Function
// Run with: node test_edge_function.cjs

const https = require('https');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI1MzgsImV4cCI6MjA4NTYyODUzOH0.T3mZaWb4LBwXjOSu6kSCly9kiE2ob8q8y6KgD3AFdQM';

const testPayload = {
    action: 'get_price',
    country: '1', // USA
    service: '307' // Frontend default for WhatsApp?
};

const postData = JSON.stringify(testPayload);

const options = {
    hostname: 'msbthxbmpwskializgaa.supabase.co',
    port: 443,
    path: '/functions/v1/smspool-service',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
    }
};

console.log('Testing Edge Function...');
console.log('Payload:', testPayload);

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\nStatus Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('\nResponse Body:');
        try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(postData);
req.end();
