const admin = require("firebase-admin");
const path = require("path");

// Try to load service account from current directory
try {
    const serviceAccount = require("./service-account.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    console.warn("Could not load ./service-account.json, trying applicationDefault...");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
}

const db = admin.firestore();

async function main() {
    console.log("Querying funds_v3 for retrocessions...");
    const snapshot = await db.collection("funds_v3").get();

    const funds = [];
    let processed = 0;

    snapshot.forEach(doc => {
        processed++;
        const data = doc.data();
        // Check various paths where retrocession might be stored, just in case
        // Based on previous analysis: manual.costs.retrocession is the target
        const retro = data.manual?.costs?.retrocession;

        if (retro !== undefined && retro !== null && retro > 0) {
            funds.push({
                isin: doc.id,
                name: data.name || data.fund_name || data.nombre || "N/A",
                retro: retro
            });
        }
    });

    console.log(`Processed ${processed} documents.`);
    console.log(`Found ${funds.length} funds with retrocessions > 0.`);
    console.log("\nISIN | Retrocession | Name");
    console.log("-".repeat(100));

    funds.sort((a, b) => b.retro - a.retro); // Sort by retro descending

    funds.forEach(f => {
        // Display as percentage
        const retroPct = (f.retro * 100).toFixed(2) + "%";
        console.log(`${f.isin.padEnd(12)} | ${retroPct.padStart(12)} | ${f.name}`);
    });
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
