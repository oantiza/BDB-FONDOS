/**
 * CHECK RETROCESION FIELDS
 * Revisa todos los posibles campos de retrocesión en funds_v3
 */
const admin = require("firebase-admin");
const path = require("path");

const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(SA_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function main() {
    const snapshot = await db.collection("funds_v3").get();
    console.log(`📝 Total documentos en funds_v3: ${snapshot.size}\n`);

    const counts = {
        "manual.costs.retrocession": [],
        "manual.costs.retrocession2": [],
        "ms.costs.retrocession": [],
        "ms.costs.retrocession2": [],
        "retrocession (raíz)": [],
        "retrocession2 (raíz)": [],
    };

    snapshot.forEach((doc) => {
        const d = doc.data();
        const id = doc.id;

        if (d.manual?.costs?.retrocession !== undefined && d.manual?.costs?.retrocession !== null) {
            counts["manual.costs.retrocession"].push({ isin: id, value: d.manual.costs.retrocession });
        }
        if (d.manual?.costs?.retrocession2 !== undefined && d.manual?.costs?.retrocession2 !== null) {
            counts["manual.costs.retrocession2"].push({ isin: id, value: d.manual.costs.retrocession2 });
        }
        if (d.ms?.costs?.retrocession !== undefined && d.ms?.costs?.retrocession !== null) {
            counts["ms.costs.retrocession"].push({ isin: id, value: d.ms.costs.retrocession });
        }
        if (d.ms?.costs?.retrocession2 !== undefined && d.ms?.costs?.retrocession2 !== null) {
            counts["ms.costs.retrocession2"].push({ isin: id, value: d.ms.costs.retrocession2 });
        }
        if (d.retrocession !== undefined && d.retrocession !== null) {
            counts["retrocession (raíz)"].push({ isin: id, value: d.retrocession });
        }
        if (d.retrocession2 !== undefined && d.retrocession2 !== null) {
            counts["retrocession2 (raíz)"].push({ isin: id, value: d.retrocession2 });
        }
    });

    console.log("═".repeat(55));
    console.log("📊 CAMPOS DE RETROCESIÓN EN FUNDS_V3");
    console.log("═".repeat(55));

    for (const [field, items] of Object.entries(counts)) {
        const withValue = items.filter(i => i.value > 0);
        const zeros = items.filter(i => i.value === 0);
        const icon = items.length > 0 ? "⚠️ " : "✅";
        console.log(`\n${icon} ${field}`);
        console.log(`   Total con dato:   ${items.length}`);
        console.log(`   Con valor > 0:    ${withValue.length}`);
        console.log(`   Con valor = 0:    ${zeros.length}`);

        if (items.length > 0 && items.length <= 10) {
            items.forEach(i => console.log(`     → ${i.isin}: ${i.value}`));
        } else if (items.length > 10) {
            items.slice(0, 5).forEach(i => console.log(`     → ${i.isin}: ${i.value}`));
            console.log(`     ... y ${items.length - 5} más`);
        }
    }

    console.log("\n" + "═".repeat(55));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
