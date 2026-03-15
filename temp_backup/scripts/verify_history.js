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
    const doc = await db.collection("historico_vl_v2").doc(isin).get();

    if (doc.exists) {
        const data = doc.data();
        console.log("VERIFICATION SUCCESS: History found!");
        console.log(`Document ID: ${doc.id}`);
        console.log(`Currency: ${data.currency}`);
        console.log(`Points count: ${data.history.length}`);
        if (data.history.length > 0) {
            console.log("First point:", data.history[0]);
            console.log("Last point:", data.history[data.history.length - 1]);
        }
    } else {
        console.error("VERIFICATION FAILED: History document not found.");
        process.exit(1);
    }
}

main().catch(console.error);
