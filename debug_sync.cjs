const https = require('https');

// Load env vars if needed, or just hardcode for this quick test based on .env
// For now I will use the values I saw earlier or waiting for .env view
const SUPABASE_URL_FULL = process.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI1MzgsImV4cCI6MjA4NTYyODUzOH0.T3mZaWb4LBwXjOSu6kSCly9kiE2ob8q8y6KgD3AFdQM';

// Parse hostname from URL
const urlParts = new URL(SUPABASE_URL_FULL);
const hostname = urlParts.hostname;

const testPayload = {
    action: 'check_sms'
};

const postData = JSON.stringify(testPayload);

const options = {
    hostname: hostname,
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

console.log('Testing smspool-service check_sms...');
console.log('Target:', hostname);

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\nStatus Code:', res.statusCode);
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
