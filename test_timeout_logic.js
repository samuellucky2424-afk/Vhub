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

// Test the timeout logic specifically
async function testTimeoutLogic() {
    console.log("🧪 Testing Timeout Logic\n");
    
    const startTime = Date.now();
    const maxDuration = 80000; // 80 seconds
    let attempt = 0;
    let foundCode = null;
    let finalStatus = null;
    
    console.log(`Starting test with max duration: ${maxDuration}ms (${maxDuration/1000}s)`);
    
    // Simulate the exact loop condition from our implementation
    while (Date.now() - startTime < maxDuration && !foundCode && !finalStatus) {
        attempt++;
        const elapsed = Date.now() - startTime;
        
        console.log(`Attempt ${attempt} (${Math.round(elapsed/1000)}s elapsed) - Loop condition: ${Date.now() - startTime < maxDuration}`);
        
        // Simulate different scenarios
        if (attempt === 10) {
            // Simulate timeout scenario - no code found
            console.log("Simulating timeout - no code will be found");
            foundCode = null; // Ensure no code found
            finalStatus = null; // Ensure no final status
        }
        
        // Wait a bit to simulate real polling
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Check timeout condition after loop exits
    const finalElapsed = Date.now() - startTime;
    console.log(`\nLoop exited after ${Math.round(finalElapsed/1000)}s`);
    console.log(`Final conditions:`);
    console.log(`- foundCode: ${foundCode}`);
    console.log(`- finalStatus: ${finalStatus}`);
    console.log(`- Time elapsed: ${finalElapsed}ms`);
    console.log(`- Max duration: ${maxDuration}ms`);
    console.log(`- Should timeout: ${finalElapsed >= maxDuration}`);
    
    // Test the timeout condition
    if (!foundCode && !finalStatus && (Date.now() - startTime >= maxDuration)) {
        console.log("✅ TIMEOUT CONDITION TRIGGERED - Auto-cancel should execute");
        console.log("🔄 Calling cancel API...");
        console.log("💰 Calling refund RPC...");
        console.log("📊 Updating order status to 'failed'");
        return { success: false, message: "OTP timeout - order cancelled and refunded" };
    } else {
        console.log("❌ TIMEOUT CONDITION FAILED - This is the bug!");
        console.log("Expected timeout but condition was not met");
        return { success: true, message: "No timeout detected" };
    }
}

// Test with different time scenarios
async function runTimeoutTests() {
    console.log("🚀 Testing Timeout Logic Scenarios\n");
    
    // Test 1: Normal timeout
    console.log("--- Test 1: Normal Timeout (80s) ---");
    await testTimeoutLogic();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 2: Quick success (should not timeout)
    console.log("\n--- Test 2: Quick Success (should not timeout) ---");
    await testQuickSuccess();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 3: Edge case timing
    console.log("\n--- Test 3: Edge Case Timing ---");
    await testEdgeCase();
    
    console.log("\n=== Test Summary ===");
    console.log("✅ Timeout logic test completed");
    console.log("If Test 1 shows 'TIMEOUT CONDITION TRIGGERED' - logic is correct");
    console.log("If Test 1 shows 'TIMEOUT CONDITION FAILED' - there's a bug");
}

async function testQuickSuccess() {
    const startTime = Date.now();
    const maxDuration = 80000;
    let foundCode = null;
    let finalStatus = null;
    
    // Simulate finding code after 10 seconds
    while (Date.now() - startTime < 15000 && !foundCode && !finalStatus) {
        const elapsed = Date.now() - startTime;
        
        if (elapsed >= 10000) {
            foundCode = '123456';
            finalStatus = 'completed';
            console.log("✅ Code found - should not timeout");
            break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!foundCode && !finalStatus && (Date.now() - startTime >= maxDuration)) {
        console.log("❌ Should not reach here - code was found");
    } else {
        console.log("✅ Correctly avoided timeout - code was found");
    }
}

async function testEdgeCase() {
    console.log("Testing exact timing boundary...");
    
    const startTime = Date.now();
    const maxDuration = 80000;
    
    // Simulate exactly 80 seconds
    console.log("Simulating exactly 80 seconds...");
    await new Promise(resolve => setTimeout(resolve, 80000));
    
    const elapsed = Date.now() - startTime;
    console.log(`Elapsed: ${elapsed}ms, Max: ${maxDuration}ms`);
    console.log(`Condition check: ${elapsed >= maxDuration}`);
    
    if (elapsed >= maxDuration) {
        console.log("✅ Boundary condition works correctly");
    } else {
        console.log("❌ Boundary condition failed");
    }
}

runTimeoutTests().catch(console.error);
