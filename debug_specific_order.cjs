const https = require('https');

const apiKey = 'hL7noSdy86GcFPFn0xNuAIGrb8dNpkKk';
const orderId = 'BEYYI7BY'; // From previous DB check

function fetchData(url) {
    return new Promise((resolve, reject) => {
        console.log("Fetching URL:", url.replace(apiKey, "HIDDEN_KEY"));
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    console.log("Response received, parsing JSON...");
                    resolve(JSON.parse(data));
                } catch (e) {
                    console.error("JSON Parse Error:", e);
                    console.log("Raw Data:", data);
                    reject(e);
                }
            });
        });
        req.on('error', (e) => {
            console.error("Request Error:", e);
            reject(e);
        });
    });
}

async function run() {
    try {
        console.log(`Checking Order ${orderId}...`);
        const checkUrl = `https://api.smspool.net/sms/check?key=${apiKey}&orderid=${orderId}`;
        const checkData = await fetchData(checkUrl);
        console.log("Check Data:", JSON.stringify(checkData, null, 2));

        console.log("\nFetching Active Orders...");
        const activeUrl = `https://api.smspool.net/request/active?key=${apiKey}`;
        const activeData = await fetchData(activeUrl);
        console.log("Active Orders Count:", Array.isArray(activeData) ? activeData.length : 'Not Array');
        if (Array.isArray(activeData)) {
            const found = activeData.find(o => o.order_id === orderId);
            console.log("Found in Active List?", found ? "YES" : "NO");
            if (found) console.log("Active Entry:", found);
        } else {
            console.log("Active Data:", activeData);
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

run();
