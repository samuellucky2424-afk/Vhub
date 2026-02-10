// Test script to verify different prices
const https = require('https');

const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'place_holder_key';

function getPrice(country, service) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            action: 'get_price',
            country: country,
            service: service,
            _t: Date.now()
        });

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

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ country, service, price: parsed.display_ngn, raw: parsed.final_ngn });
                } catch (e) {
                    resolve({ country, service, error: data });
                }
            });
        });

        req.write(postData);
        req.end();
    });
}

async function runTests() {
    console.log('Testing different combinations...');

    // US WhatsApp
    const t1 = await getPrice('1', '1012');
    console.log('US (1) + WhatsApp (1012):', t1);

    // US 1688
    const t2 = await getPrice('1', '1');
    console.log('US (1) + 1688 (1):', t2);

    // UK WhatsApp (Try ID 2 or 44? Let's try 44 first as it's common code, if fails try 2)
    // Actually let's assume UK is 2 based on some SMS services, or 44. 
    // Let's try 2 first.
    const t3 = await getPrice('2', '1012');
    console.log('Country 2 + WhatsApp (1012):', t3);
}

runTests();
