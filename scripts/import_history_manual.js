const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

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

function parseCSV(content) {
    const lines = content.split(/\r?\n/);
    const history = [];

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        // CSV: Date,Value_EUR,Index_100,Daily_Return
        const dateStr = parts[0];
        const valStr = parts[1];

        if (!dateStr || !valStr) continue;

        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0) {
            history.push({
                date: dateStr, // stored as YYYY-MM-DD string
                nav: val
            });
        }
    }

    // Sort just in case
    history.sort((a, b) => a.date.localeCompare(b.date));
    return history;
}

async function main() {
    const isin = "AAAAAAAAAAA";
    const csvPath = path.join(__dirname, "..", "HISTORICO.csv");

    if (!fs.existsSync(csvPath)) {
        console.error(`Error: File not found at ${csvPath}`);
        process.exit(1);
    }

    console.log(`Reading CSV from ${csvPath}...`);
    const content = fs.readFileSync(csvPath, "utf-8");
    const history = parseCSV(content);

    console.log(`Parsed ${history.length} valid data points.`);
    if (history.length > 0) {
        console.log(`First: ${history[0].date} = ${history[0].nav}`);
        console.log(`Last:  ${history[history.length - 1].date} = ${history[history.length - 1].nav}`);
    } else {
        console.log("No valid data found. Exiting.");
        return;
    }

    const docRef = db.collection("historico_vl_v2").doc(isin);
    const payload = {
        isin: isin,
        currency: "EUR",
        history: history,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "manual_csv_import"
    };

    console.log(`Uploading to historico_vl_v2/${isin}...`);
    await docRef.set(payload);
    console.log("Success! Historical data imported.");
}

main().catch(console.error);
