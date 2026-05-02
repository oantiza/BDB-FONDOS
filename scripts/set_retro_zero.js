/**
 * SET RETROCESION = 0 FOR FUNDS WITHOUT IT
 * Aplica retrocesion 0 a todos los fondos de funds_v3 que no tienen el campo
 */
const admin = require("firebase-admin");
const path = require("path");

const sa = require(path.join(__dirname, "serviceAccountKey.json"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`🔧 APLICAR RETROCESIÓN = 0 A FONDOS SIN RETROCESIÓN`);
    console.log(`   Modo: ${DRY_RUN ? "🔍 DRY-RUN" : "🔥 APPLY"}`);
    console.log(`${"═".repeat(60)}\n`);

    const snapshot = await db.collection("funds_v3").get();
    console.log(`📝 Total fondos en funds_v3: ${snapshot.size}`);

    const sinRetro = [];

    snapshot.forEach(doc => {
        const d = doc.data();
        const retro = d.manual?.costs?.retrocession;
        if (retro === undefined || retro === null) {
            sinRetro.push({
                isin: doc.id,
                name: (d.name || d.fund_name || d.nombre || "N/A").substring(0, 45),
                hasManualCosts: !!d.manual?.costs,
            });
        }
    });

    console.log(`📊 Fondos sin retrocesión: ${sinRetro.length}\n`);

    sinRetro.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`${"ISIN".padEnd(16)} Nombre`);
    console.log("─".repeat(60));
    sinRetro.forEach(f => {
        console.log(`${f.isin.padEnd(16)} ${f.name}`);
    });

    if (!DRY_RUN && sinRetro.length > 0) {
        console.log(`\n🔥 Aplicando retrocesión = 0 a ${sinRetro.length} fondos...`);
        const writer = db.bulkWriter();

        for (const fund of sinRetro) {
            const docRef = db.collection("funds_v3").doc(fund.isin);
            writer.update(docRef, { "manual.costs.retrocession": 0 });
        }

        await writer.close();
        console.log(`\n✅ ${sinRetro.length} fondos actualizados con retrocesión = 0.`);
    } else if (DRY_RUN) {
        console.log(`\n💡 Para aplicar: node scripts/set_retro_zero.js --apply`);
    }

    console.log(`\n${"═".repeat(60)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
