const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const sa = require(path.join(__dirname, "serviceAccountKey.json"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const csv = fs.readFileSync(path.join(__dirname, "..", "Copia de R_2.csv"), "utf-8").split(/\r?\n/);

async function main() {
    const diffs = [];
    for (const line of csv) {
        const p = line.split(";");
        if (p.length < 3) continue;
        const isin = (p[1] || "").trim();
        const retStr = (p[2] || "").trim();
        if (!isin || isin.length < 10 || isin === "isin") continue;
        const pct = parseFloat(retStr.replace("%", "").replace(",", "."));
        if (isNaN(pct)) continue;

        const doc = await db.collection("funds_v3").doc(isin).get();
        if (!doc.exists) continue;

        const cur = doc.data().manual?.costs?.retrocession;
        if (cur !== undefined && cur !== null && cur > 0) {
            const curPct = (cur * 100).toFixed(2);
            const csvPct = pct.toFixed(2);
            if (curPct !== csvPct) {
                diffs.push({ isin, name: p[0].trim(), dbPct: curPct + "%", csvPct: csvPct + "%" });
            }
        }
    }

    console.log(`\nFONDOS CON RETROCESIÓN DIFERENTE: ${diffs.length}\n`);
    if (diffs.length > 0) {
        console.log(`${"ISIN".padEnd(16)} ${"En DB".padStart(8)} ${"En CSV".padStart(8)}  Nombre`);
        console.log("─".repeat(65));
        diffs.forEach(f => {
            const name = f.name.length > 35 ? f.name.substring(0, 35) + "..." : f.name;
            console.log(`${f.isin.padEnd(16)} ${f.dbPct.padStart(8)} ${f.csvPct.padStart(8)}  ${name}`);
        });
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
