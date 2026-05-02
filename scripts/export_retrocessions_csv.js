const admin = require("firebase-admin");

// Try to load service account
try {
    const serviceAccount = require("./service-account.json");
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
}

const db = admin.firestore();

async function main() {
    const snapshot = await db.collection("funds_v3").get();

    const funds = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const retro = data.manual?.costs?.retrocession;

        if (retro !== undefined && retro !== null && retro > 0) {
            funds.push({
                isin: doc.id,
                name: (data.name || data.fund_name || data.nombre || "N/A").replace(/"/g, '""'), // Escape quotes
                retro: retro
            });
        }
    });

    // Sort by retro descending
    funds.sort((a, b) => b.retro - a.retro);

    // Output CSV Header
    console.log("ISIN;Retrocesion;Fondo");

    // Output CSV Rows
    funds.forEach(f => {
        // Format retro as percentage with 2 decimals (e.g., 2.50%)
        const retroPct = (f.retro * 100).toFixed(2) + "%";
        console.log(`${f.isin};${retroPct};"${f.name}"`);
    });
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
