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
    await db.collection("funds_v3").doc(isin).update({
        name: "CARTERA BOLSA"
    });
    console.log("Renamed to CARTERA BOLSA confirmed.");
}

main().catch(console.error);
