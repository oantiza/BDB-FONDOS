const admin = require("firebase-admin");
const path = require("path");

const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(SA_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function main() {
    const isins = [
        { isin: "LU0231205856", retro: 0.0158 },
        { isin: "LU0637335638", retro: 0.0069 },
        { isin: "LU0267984697", retro: 0.0155 }
    ];

    for (const item of isins) {
        console.log(`Updating ISIN: ${item.isin}...`);
        const docRef = db.collection("funds_v3").doc(item.isin);
        try {
            await docRef.update({ "manual.costs.retrocession": item.retro });
            console.log(`Success: ${item.isin} -> ${item.retro}`);
        } catch (e) {
            console.error(`Error updating ${item.isin}:`, e.message);
        }
    }
}

main().then(() => {
    console.log("Done");
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
