/* eslint-disable no-undef */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const saPath = path.join(__dirname, "..", "..", "serviceAccountKey.json");
        if (fs.existsSync(saPath)) {
            admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
        } else {
            admin.initializeApp();
        }
    }
}

const db = admin.firestore();

async function inspect() {
    console.log("Fetching 1 document from funds_v3...");
    const snapshot = await db.collection('funds_v3').limit(1).get();
    if (snapshot.empty) {
        console.log("No documents found in funds_v3");
        return;
    }

    const data = snapshot.docs[0].data();
    console.log("Document ID:", snapshot.docs[0].id);
    console.log("Data Structure:", JSON.stringify(data, null, 2));

    // Check specific fields we are querying
    console.log("------------------------------------------------");
    console.log("Checking commonly used fields for query:");
    console.log("derived.asset_class:", data.derived?.asset_class);
    console.log("derived.primary_region:", data.derived?.primary_region);
    console.log("std_perf.sharpe_3y:", data.std_perf?.sharpe_3y);
}

inspect();
