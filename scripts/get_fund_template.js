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
    // Get one document to use as template
    const snapshot = await db.collection("funds_v3").limit(1).get();
    if (snapshot.empty) {
        console.log("No funds found.");
        return;
    }

    const doc = snapshot.docs[0];
    console.log(JSON.stringify(doc.data(), null, 2));
}

main().catch(console.error);
