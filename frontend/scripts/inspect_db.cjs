
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
    console.log("Querying 'Morningstar Emerging Markets'...");

    // Query by Category
    const snapshot = await db.collection('funds_v3')
        .where('ms.category_morningstar', '==', 'Morningstar Emerging Markets')
        .limit(5)
        .get();

    if (snapshot.empty) {
        console.log("No funds found for 'Morningstar Emerging Markets'. Checking partial...");
        return;
    }

    console.log(`Found ${snapshot.size} funds. Inspecting samples...`);

    snapshot.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`   Name: ${d.name}`);
        console.log(`   Asset Class (derived.asset_class): '${d.derived?.asset_class}'`);
        console.log(`   Asset Class (std_type): '${d.std_type}'`);
        console.log(`   Region (derived.primary_region): '${d.derived?.primary_region}'`);
        console.log(`   Category (ms.category): '${d.ms?.category_morningstar}'`);
        console.log("-----------------------");
    });
}

inspect();
