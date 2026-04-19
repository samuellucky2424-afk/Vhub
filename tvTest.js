

async function test() {
    const TEXTVERIFIED_API_KEY = "4mf4LGpBdnckP9rLhqAjdBP4pZr9ojthJh9F1mJ4PeCnBvl3UXiH3iRYXNO6n1";
    const TEXTVERIFIED_API_USERNAME = "samuellucky2424@gmail.com";
    
    // Auth
    const authRes = await fetch("https://www.textverified.com/api/pub/v2/auth", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-KEY": TEXTVERIFIED_API_KEY,
            "X-API-USERNAME": TEXTVERIFIED_API_USERNAME
        }
    });

    const authData = await authRes.json();
    console.log("Auth:", authData);
    
    const bearerToken = authData.token;
    
    // Fetch Services
    const svcRes = await fetch("https://www.textverified.com/api/pub/v2/services?numberType=mobile&reservationType=verification", {
        headers: { "Authorization": `Bearer ${bearerToken}` }
    });
    const svcData = await svcRes.json();
    console.log("Services Data (Type):", typeof svcData, Array.isArray(svcData), Object.keys(svcData));
    console.log("Services Data Sample:", Array.isArray(svcData) ? svcData.slice(0,2) : Object.keys(svcData).slice(0, 5));
}

test().catch(console.error);
