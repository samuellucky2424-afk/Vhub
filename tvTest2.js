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
    const bearerToken = authData.token;
    
    const res = await fetch("https://www.textverified.com/api/pub/v2/area-codes", {
        headers: { "Authorization": `Bearer ${bearerToken}` }
    });
    const data = await res.json();
    console.log("Area Codes Data (Type):", typeof data, Array.isArray(data));
    console.log("Area Codes Data Sample:", Array.isArray(data) ? data.slice(0,2) : data);
}

test().catch(console.error);
