const admin = require("firebase-admin");

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
    const doc = await db.collection("funds_v3").doc(isin).get();

    if (doc.exists) {
        console.log("VERIFICATION SUCCESS: Fund found!");
        console.log(doc.data());
    } else {
        console.error("VERIFICATION FAILED: Fund not found.");
        process.exit(1);
    }
}

main().catch(console.error);
