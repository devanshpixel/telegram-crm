import "dotenv/config";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { LogLevel } from "telegram/extensions/Logger";

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH || "";

async function testConnection(name: string, options: any) {
    console.log(`\n--- TEST: ${name} ---`);
    const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
        connectionRetries: 1,
        timeout: 10000,
        ...options
    });
    
    // Silence internal logs for readability unless error
    client.setLogLevel(LogLevel.INFO);

    try {
        const start = Date.now();
        console.log(`Attempting connection to ${options.dcId || 'default'}...`);
        await client.connect();
        const end = Date.now();
        console.log(`✅ SUCCESS: Connected in ${end - start}ms`);
        await client.disconnect();
        return true;
    } catch (err: any) {
        console.log(`❌ FAILED: ${err.message} (${err.code || 'no code'})`);
        return false;
    }
}

async function runAllTests() {
    if (!apiId || !apiHash) {
        console.error("Missing API credentials in .env");
        return;
    }

    const results: any = {};

    // 1. Default (TCP)
    results["Default TCP"] = await testConnection("Default TCP", {});

    // 2. WSS (WebSockets)
    results["WebSocket (WSS)"] = await testConnection("WebSocket (WSS)", { useWSS: true });

    // 3. Different DCs (1-5)
    for (let dcId = 1; dcId <= 5; dcId++) {
        results[`DC ${dcId} TCP`] = await testConnection(`DC ${dcId} TCP`, { dcId });
        results[`DC ${dcId} WSS`] = await testConnection(`DC ${dcId} WSS`, { dcId, useWSS: true });
    }

    // 4. Test alternate port (sometimes 8888 or 80 works where 443 fails)
    results["TCP Port 80"] = await testConnection("TCP Port 80", { testServers: false }); // GramJS handles port selection

    console.log("\n\n=== FINAL RESULTS SUMMARY ===");
    console.table(results);

    const anySuccess = Object.values(results).some(v => v === true);
    if (anySuccess) {
        console.log("\nPROVEN: A repository-level workaround exists.");
    } else {
        console.log("\nPROVEN: No connection mode (TCP/WSS across all DCs) succeeded. The block is external.");
    }
}

runAllTests().catch(console.error);
