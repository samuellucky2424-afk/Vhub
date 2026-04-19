import https from 'https';

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

async function testPoolSelection() {
    try {
        console.log("=== Testing Pool Selection Implementation ===\n");
        
        // Test 1: Get service stats for WhatsApp US
        console.log("1. Testing service stats retrieval...");
        const service = "WhatsApp";
        const country = "US";
        
        const statsUrl = `https://api.smspool.net/service/stats?key=${apiKey}&service=${service}&country=${country}`;
        console.log(`Fetching: ${statsUrl}`);
        
        const stats = await fetchData(statsUrl);
        console.log("Stats Response:", JSON.stringify(stats, null, 2));
        
        if (Array.isArray(stats) && stats.length > 0) {
            console.log(`\nFound ${stats.length} pools for ${service} in ${country}`);
            
            // Test filtering logic
            const eligiblePools = stats.filter(pool => 
                pool.success_rate >= 70 && 
                pool.available_numbers > 0
            );
            
            console.log(`\nEligible pools (>=70% success rate, >0 available): ${eligiblePools.length}`);
            
            if (eligiblePools.length > 0) {
                // Sort by success rate
                eligiblePools.sort((a, b) => b.success_rate - a.success_rate);
                const bestPool = eligiblePools[0];
                
                console.log("\n=== BEST POOL SELECTED ===");
                console.log(`Pool ID: ${bestPool.pool_id}`);
                console.log(`Pool Name: ${bestPool.pool_name}`);
                console.log(`Success Rate: ${bestPool.success_rate}%`);
                console.log(`Available Numbers: ${bestPool.available_numbers}`);
                
                // Test purchase URL with best pool
                const purchaseUrl = `https://api.smspool.net/purchase/sms?key=${apiKey}&country=${country}&service=${service}&pool=${bestPool.pool_id}`;
                console.log(`\nPurchase URL with best pool: ${purchaseUrl}`);
                
            } else {
                console.log("No eligible pools found - would use default selection");
            }
        } else {
            console.log("No stats available or invalid response format");
        }
        
        // Test 2: Test with different service/country
        console.log("\n\n2. Testing with different service...");
        const statsUrl2 = `https://api.smspool.net/service/stats?key=${apiKey}&service=Telegram&country=US`;
        const stats2 = await fetchData(statsUrl2);
        console.log("Telegram Stats:", JSON.stringify(stats2, null, 2));
        
    } catch (error) {
        console.error("Test failed:", error);
    }
}

testPoolSelection();
