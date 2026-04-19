// Test script to verify smspool-metadata Edge Function
const https = require('https');

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI1MzgsImV4cCI6MjA4NTYyODUzOH0.T3mZaWb4LBwXjOSu6kSCly9kiE2ob8q8y6KgD3AFdQM';

const options = {
    hostname: 'msbthxbmpwskializgaa.supabase.co',
    port: 443,
    path: '/functions/v1/smspool-metadata',
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
    }
};

console.log('Testing Metadata Edge Function...');

const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\nStatus Code:', res.statusCode);
        console.log('\nResponse Body (truncated):');
        try {
            const parsed = JSON.parse(data);
            const countries = Array.isArray(parsed.countries) ? parsed.countries.length : 'Not Array';
            const services = Array.isArray(parsed.services) ? parsed.services.length : 'Not Array';
            console.log(`Countries: ${countries}, Services: ${services}`);
            console.log('Sample Country:', parsed.countries?.[0]);
            console.log('Sample Service:', parsed.services?.[0]);
        } catch (e) {
            console.log(data.substring(0, 500));
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.end();
