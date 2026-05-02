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
    const doc = await db.collection('system_settings').doc('risk_free_rate').get();

    if (doc.exists) {
        const data = doc.data();
        console.log("Current Risk Free Rate in DB:");
        console.log(`Rate: ${(data.rate * 100).toFixed(3)}%`);
        console.log(`Source: ${data.source}`);
        if (data.updated_at) {
            const date = data.updated_at.toDate ? data.updated_at.toDate() : new Date(data.updated_at._seconds * 1000);
            console.log(`Updated At: ${date.toISOString()}`);
        }
    } else {
        console.log("No risk free rate found in DB (using fallback of 3.0%).");
    }
}

main().catch(console.error);
