/**
 * FIX RETROCESIONES FORMAT + DIFFERENCES
 * 1. Convert 15 newly added from decimal to percentage format
 * 2. Fix 3 different values using CSV (Jupiter = 0.5%)
 */
const admin = require("firebase-admin");
const path = require("path");

const sa = require(path.join(__dirname, "serviceAccountKey.json"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🔧 CORREGIR FORMATO Y DIFERENCIAS`);
    console.log(`   Modo: ${DRY_RUN ? "🔍 DRY-RUN" : "🔥 APPLY"}`);
    console.log(`${"═".repeat(60)}\n`);

    const batch = db.batch();
    let count = 0;

    // 1. Fix the 15 newly added (decimal → percentage format)
    // These were stored as pct/100 (e.g., 0.0093 for 0.93%)
    // Need to multiply by 100 to match existing format (0.93)
    const snapshot = await db.collection("funds_v3").get();
    const newlyAdded = [];

    snapshot.forEach(doc => {
        const raw = doc.data().manual?.costs?.retrocession;
        if (raw !== undefined && raw !== null && raw > 0 && raw < 0.03) {
            // Values < 0.03 are likely in decimal format (max CSV is 2.50% = 0.025)
            // Values in percentage format would be >= 0.02 (2%) up to 2.50
            // So anything < 0.03 that isn't exactly a common pct value is decimal
            const corrected = parseFloat((raw * 100).toFixed(4));
            newlyAdded.push({
                isin: doc.id,
                name: (doc.data().name || "N/A").substring(0, 40),
                oldValue: raw,
                newValue: corrected
            });
        }
    });

    console.log(`📝 Fondos con formato decimal a corregir: ${newlyAdded.length}`);
    newlyAdded.forEach(f => {
        console.log(`   ${f.isin.padEnd(16)} ${f.oldValue} → ${f.newValue}`);
        if (!DRY_RUN) {
            batch.update(db.collection("funds_v3").doc(f.isin), {
                "manual.costs.retrocession": f.newValue
            });
            count++;
        }
    });

    // 2. Fix the 3 different values
    const fixes = [
        { isin: "ES0162295002", name: "Cartera Renta Fija Horizonte 2027 FI", value: 0.52 },
        { isin: "IE00BYR8H148", name: "Jupiter Merian World Equity Fund", value: 0.5 },
        { isin: "ES0118537002", name: "Olea Neutral FI", value: 0.82 },
    ];

    console.log(`\n📝 Fondos con valor diferente a corregir: ${fixes.length}`);
    for (const fix of fixes) {
        const doc = await db.collection("funds_v3").doc(fix.isin).get();
        const current = doc.exists ? doc.data().manual?.costs?.retrocession : "N/A";
        console.log(`   ${fix.isin.padEnd(16)} ${current} → ${fix.value}  (${fix.name})`);
        if (!DRY_RUN) {
            batch.update(db.collection("funds_v3").doc(fix.isin), {
                "manual.costs.retrocession": fix.value
            });
            count++;
        }
    }

    if (!DRY_RUN) {
        await batch.commit();
        console.log(`\n✅ ${count} documentos actualizados correctamente.`);
    } else {
        console.log(`\n💡 Para aplicar: node scripts/fix_retro_format.js --apply`);
    }

    console.log(`\n${"═".repeat(60)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
