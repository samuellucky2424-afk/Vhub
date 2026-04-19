async function run(){ 
    const auth = await fetch('https://www.textverified.com/api/pub/v2/auth',{
        method:'POST',
        headers:{
            'Content-Type':'application/json',
            'x-api-username':'samuellucky2424@gmail.com',
            'x-api-key':'4mf4LGpBdnckP9rLhqAjdBP4pZr9ojthJh9F1mJ4PeCnBvl3UXiH3iRYXNO6n1'
        }
    }); 
    const {token} = await auth.json(); 
    
    // Test base pricing
    const r1 = await fetch('https://www.textverified.com/api/pub/v2/pricing/verifications',{
        method: "POST",
        headers:{
            'Authorization':'Bearer '+token,
            'Content-Type':'application/json'
        },
        body: JSON.stringify({
            serviceName: "whatsapp",
            areaCode: false,
            carrier: false,
            numberType: "mobile",
            capability: "sms"
        })
    }); 
    console.log("Base:", r1.status, await r1.text()); 

    // Test area code pricing
    const r2 = await fetch('https://www.textverified.com/api/pub/v2/pricing/verifications',{
        method: "POST",
        headers:{
            'Authorization':'Bearer '+token,
            'Content-Type':'application/json'
        },
        body: JSON.stringify({
            serviceName: "whatsapp",
            areaCode: true,
            carrier: false,
            numberType: "mobile",
            capability: "sms"
        })
    }); 
    console.log("AreaCode=true:", r2.status, await r2.text()); 
} 
run();
