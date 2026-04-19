const https = require('https');

// Key from .env
const SMSPOOL_API_KEY = 'hL7noSdy86GcFPFn0xNuAIGrb8dNpkKk';

function checkOrder(orderId) {
    const url = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${orderId}`;
    console.log(`Checking URL: ${url}`);

    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            console.log('Response:', data);
            try {
                const parsed = JSON.parse(data);
                console.log('Parsed Status:', parsed.status);
                console.log('Parsed SMS:', parsed.sms);
            } catch (e) {
                console.error(e);
            }
        });
    }).on('error', err => {
        console.error('Error:', err.message);
    });
}

// Order ID from DB check earlier (status 3 / completed if any exists)
// From prev logs: 94b49771... is TNCNWYTA (Refunded/6)
// Let's try to find a completed on in the list if user has one.
// The list from check_db_orders.cjs showed:
// 2NRPWDDR, 760BA6WL, PWESL5XB, ELQFLC0K, UME1UHCM, UXRL3Z8M, TNCNWYTA
// I will check one of these to see if it has a message (status 3).

const ordersToCheck = ['2NRPWDDR', '760BA6WL', 'PWESL5XB', 'ELQFLC0K', 'UME1UHCM', 'UXRL3Z8M', 'TNCNWYTA'];

console.log('Checking recent orders for SMS example...');
// Just check the first few to see if any have data
ordersToCheck.forEach((id, index) => {
    setTimeout(() => checkOrder(id), index * 1500); // verify rate limits
});
