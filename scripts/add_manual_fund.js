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
    const isin = "AAAAAAAAAAA";
    const fundData = {
        isin: isin,
        name: "CARTERA BOLSA",
        currency: "EUR",
        // Empty structures to match schema
        ms: {
            sectors: {},
            fixed_income: {},
            holdings_top10: [],
            portfolio: {
                asset_allocation: { equity: 0, bond: 0, cash: 0, other: 0 }
            },
            costs: { retrocession: 0 },
            regions: { macro: {} },
            equity_style: { market_cap: {}, style: {} },
            category_morningstar: null
        },
        derived: {
            asset_class: "Otros",
            ruleset_version: "manual",
            subcategories: []
        },
        quality: {
            ok: true,
            warnings: ["Manual entry created by user request"],
            parsed_at: admin.firestore.FieldValue.serverTimestamp()
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        manual: {
            costs: {
                retrocession: 0
            }
        },
        std_perf: {},
        std_extra: {}
    };

    console.log(`Creating fund ${isin}...`);
    await db.collection("funds_v3").doc(isin).set(fundData);
    console.log("Success! Fund created.");
}

main().catch(console.error);
