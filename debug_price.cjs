const https = require('https');

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

async function run() {
    try {
        // Test with US (ID=1) and WhatsApp (common service)
        // First, let's get a valid service ID
        console.log("Fetching Services to find WhatsApp...");
        const services = await fetchData(`https://api.smspool.net/service/retrieve_all?key=${apiKey}`);
        const whatsapp = services.find(s => s.name.toLowerCase().includes('whatsapp'));

        if (whatsapp) {
            console.log("Found WhatsApp service:", whatsapp);

            console.log("\nFetching price for US + WhatsApp...");
            const price = await fetchData(`https://api.smspool.net/request/price?key=${apiKey}&country=1&service=${whatsapp.ID}`);
            console.log("Price response:", JSON.stringify(price, null, 2));
        } else {
            console.log("WhatsApp not found, using first service");
            const firstService = services[0];
            console.log("First service:", firstService);

            console.log("\nFetching price for US + first service...");
            const price = await fetchData(`https://api.smspool.net/request/price?key=${apiKey}&country=1&service=${firstService.ID}`);
            console.log("Price response:", JSON.stringify(price, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

run();
