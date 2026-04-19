

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env manually since dotenv might not be installed
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
        const firstEquals = line.indexOf("=");
        if (firstEquals !== -1) {
            const key = line.substring(0, firstEquals).trim();
            const value = line.substring(firstEquals + 1).trim();
            if (key && value) {
                process.env[key] = value;
            }
        }
    });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

console.log(`URL: ${SUPABASE_URL}`);
console.log(`Key Prefix: ${SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`);
console.log(`Key Length: ${SUPABASE_SERVICE_ROLE_KEY.length}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function checkOrders() {
    console.log("Fetching last 5 orders...");
    const { data: orders, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log("No orders found.");
        return;
    }

    console.log(`Found ${orders.length} orders:`);
    for (const order of orders) {
        console.log("---------------------------------------------------");
        console.log(`Order ID: ${order.id}`);
        console.log(`Created At: ${order.created_at}`);
        console.log(`Status: ${order.payment_status}`);
        console.log(`Amount (USD): ${order.price_usd}`);
        console.log(`Reference: ${order.payment_reference}`);
        console.log(`Service Type: ${order.service_type}`);
        console.log(`Request ID (SMSPool):`, order.request_id);
        console.log(`Metadata:`, JSON.stringify(order.metadata, null, 2));

        if (order.payment_status === 'paid' && !order.request_id) {
            console.log("⚠️  WARNING: Order is PAID but has no SMSPool Request ID!");
        }
    }
}

checkOrders();

