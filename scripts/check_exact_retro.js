const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const sa = require(path.join(__dirname, "serviceAccountKey.json"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const csv = fs.readFileSync(path.join(__dirname, "..", "Copia de R_2.csv"), "utf-8").split(/\r?\n/);

async function main() {
    const results = { exact: [], diff: [], newlyAdded: [] };

    for (const line of csv) {
        const p = line.split(";");
        if (p.length < 3) continue;
        const isin = (p[1] || "").trim();
        const retStr = (p[2] || "").trim();
        if (!isin || isin.length < 10 || isin === "isin") continue;
        const csvPct = parseFloat(retStr.replace("%", "").replace(",", "."));
        if (isNaN(csvPct) || csvPct === 0) continue;

        const doc = await db.collection("funds_v3").doc(isin).get();
        if (!doc.exists) continue;

        const rawDB = doc.data().manual?.costs?.retrocession;
        if (rawDB === undefined || rawDB === null) continue;

        // Compare: DB raw value vs CSV percentage
        // Option A: DB stores as decimal (0.008 = 0.80%) → rawDB * 100 should equal csvPct
        // Option B: DB stores as percentage (0.80 = 0.80%) → rawDB should equal csvPct

        const dbAsPctA = (rawDB * 100).toFixed(4);  // if decimal
        const dbAsPctB = rawDB.toFixed(4);           // if already pct
        const csvPctStr = csvPct.toFixed(4);

        let match = "NONE";
        if (dbAsPctB === csvPctStr) match = "EXACT_AS_PCT";
        else if (dbAsPctA === csvPctStr) match = "EXACT_AS_DECIMAL";

        const entry = {
            isin,
            name: p[0].trim().substring(0, 40),
            rawDB,
            csvPct,
            match
        };

        if (match !== "NONE") {
            results.exact.push(entry);
        } else {
            results.diff.push(entry);
        }
    }

    console.log(`\n${"═".repeat(70)}`);
    console.log(`📊 COMPARACIÓN EXACTA DB vs CSV`);
    console.log(`${"═".repeat(70)}`);
    console.log(`\n✅ Coinciden:   ${results.exact.length}`);
    console.log(`❌ Diferentes:  ${results.diff.length}`);

    // Show format distribution
    const asDecimal = results.exact.filter(e => e.match === "EXACT_AS_DECIMAL").length;
    const asPct = results.exact.filter(e => e.match === "EXACT_AS_PCT").length;
    console.log(`\n   Formato decimal (0.008 = 0.80%): ${asDecimal}`);
    console.log(`   Formato porcentaje (0.80 = 0.80%): ${asPct}`);

    if (results.diff.length > 0) {
        console.log(`\n❌ FONDOS REALMENTE DIFERENTES:`);
        console.log(`${"ISIN".padEnd(16)} ${"DB raw".padStart(10)} ${"CSV %".padStart(8)}  Nombre`);
        console.log("─".repeat(70));
        results.diff.forEach(f => {
            console.log(`${f.isin.padEnd(16)} ${f.rawDB.toString().padStart(10)} ${(f.csvPct + "%").padStart(8)}  ${f.name}`);
        });
    }

    // Show some examples of each format
    console.log(`\n📋 Ejemplos de formato en DB:`);
    const sample = results.exact.slice(0, 5);
    sample.forEach(e => {
        console.log(`   ${e.isin}: raw=${e.rawDB} → match=${e.match} (CSV: ${e.csvPct}%)`);
    });

    console.log(`\n${"═".repeat(70)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
