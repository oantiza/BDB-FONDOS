/**
 * FONDOS EN DB QUE NO ESTÁN EN EL CSV
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
        if (fs.existsSync(SA_PATH)) {
            admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
        } else {
            admin.initializeApp();
        }
    }
}
const db = admin.firestore();

const CSV_PATH = path.join(__dirname, "..", "Copia de R_2.csv");

function parseCSVIsins(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const isins = new Set();
    for (const line of lines) {
        const parts = line.split(";");
        if (parts.length >= 2) {
            const isin = parts[1].trim();
            if (isin && isin.length >= 10 && isin !== "isin") {
                isins.add(isin);
            }
        }
    }
    return isins;
}

async function main() {
    const csvIsins = parseCSVIsins(CSV_PATH);
    console.log(`📄 ISINs en el CSV: ${csvIsins.size}`);

    const snapshot = await db.collection("funds_v3").get();
    console.log(`📝 Fondos en funds_v3: ${snapshot.size}\n`);

    const notInCSV = [];

    snapshot.forEach((doc) => {
        const isin = doc.id;
        if (!csvIsins.has(isin)) {
            const d = doc.data();
            notInCSV.push({
                isin,
                name: d.name || d.fund_name || d.nombre || "N/A",
                hasRetro: d.manual?.costs?.retrocession > 0,
                retro: d.manual?.costs?.retrocession || null,
            });
        }
    });

    const sinRetro = notInCSV.filter(f => !f.hasRetro);
    const conRetro = notInCSV.filter(f => f.hasRetro);

    console.log(`${"═".repeat(65)}`);
    console.log(`📊 FONDOS EN DB QUE NO ESTÁN EN EL CSV: ${notInCSV.length}`);
    console.log(`   - Sin retrocesión: ${sinRetro.length}`);
    console.log(`   - Con retrocesión (ya la tienen): ${conRetro.length}`);
    console.log(`${"═".repeat(65)}`);

    console.log(`\n❌ SIN RETROCESIÓN y SIN estar en CSV (${sinRetro.length}):`);
    console.log(`${"ISIN".padEnd(16)} Nombre`);
    console.log("─".repeat(65));
    sinRetro.sort((a, b) => a.name.localeCompare(b.name));
    sinRetro.forEach(f => {
        const shortName = f.name.length > 48 ? f.name.substring(0, 48) + "..." : f.name;
        console.log(`${f.isin.padEnd(16)} ${shortName}`);
    });

    console.log(`\n${"═".repeat(65)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
