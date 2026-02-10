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
        console.log("Fetching Services...");
        const services = await fetchData(`https://api.smspool.net/service/retrieve_all?key=${apiKey}`);
        console.log("Services Type:", Array.isArray(services) ? "Array" : typeof services);
        if (Array.isArray(services) && services.length > 0) {
            console.log("First Service Item:", services[0]);
        } else {
            console.log("Services Data:", JSON.stringify(services).substring(0, 200));
        }

        console.log("\nFetching Countries...");
        const countries = await fetchData(`https://api.smspool.net/country/retrieve_all?key=${apiKey}`);
        console.log("Countries Type:", Array.isArray(countries) ? "Array" : typeof countries);
        if (Array.isArray(countries) && countries.length > 0) {
            console.log("First Country Item:", countries[0]);
        } else {
            console.log("Countries Data:", JSON.stringify(countries).substring(0, 200));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

run();
