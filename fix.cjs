const fs = require('fs');

let c = fs.readFileSync('pages/checkout/CheckoutSummary.tsx', 'utf8');

const t = `        const fetchMetadata = async () => {
            try {
                const response = await fetch(\`\${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smspool-service\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${import.meta.env.VITE_SUPABASE_ANON_KEY}\`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                        'x-client-info': 'vhub-web'
                    },
                    body: JSON.stringify({ action: 'get_metadata' }),
                    signal: controller.signal
                });
                
                if (!response.ok) return;
                const data = await response.json();

                if (controller.signal.aborted) return;

                if (data) {
                    // Handle Area Codes (Countries Dropdown)
                    if (Array.isArray(data.countries)) {
                        setCountries(data.countries);
                        if (data.countries.length > 0) setSelectedCountry(data.countries[0].ID.toString());
                    }

                    // Handle Services
                    if (Array.isArray(data.services)) {
                        setServices(data.services);`;

c = c.replace(/const fetchMetadata = async \(\) => \{[\s\S]*?setServices\(data\.services\);/, t);

fs.writeFileSync('pages/checkout/CheckoutSummary.tsx', c);
