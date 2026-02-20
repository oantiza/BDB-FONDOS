/**
 * ANALYZE FUNDS WITHOUT RETROCESION
 * Analiza por qué algunos fondos no tienen retrocesión
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

    const withRetro = [];
    const withoutRetro = [];

    snapshot.forEach((doc) => {
        const d = doc.data();
        const retro = d.manual?.costs?.retrocession;
        const info = {
            isin: doc.id,
            name: d.name || d.fund_name || d.nombre || "N/A",
            category: d.category || d.ms?.category || "N/A",
            currency: d.currency || d.ms?.currency || "N/A",
            hasManualCosts: !!d.manual?.costs,
            hasTer: d.manual?.costs?.ter !== undefined && d.manual?.costs?.ter !== null,
            isETF: (d.name || "").toLowerCase().includes("etf") || (d.type || "").toLowerCase().includes("etf"),
            isIndex: (d.name || "").toLowerCase().includes("index") || (d.name || "").toLowerCase().includes("índice"),
            type: d.type || "N/A",
            provider: d.provider || d.ms?.provider || "N/A",
        };

        if (retro !== undefined && retro !== null) {
            withRetro.push(info);
        } else {
            withoutRetro.push(info);
        }
    });

    console.log("═".repeat(60));
    console.log("📊 ANÁLISIS: FONDOS SIN RETROCESIÓN");
    console.log("═".repeat(60));
    console.log(`\nTotal fondos:              ${snapshot.size}`);
    console.log(`CON campo retrocesión:     ${withRetro.length}`);
    console.log(`SIN campo retrocesión:     ${withoutRetro.length}`);

    // Análisis: ¿Tienen manual.costs?
    const sinRetroConManualCosts = withoutRetro.filter(f => f.hasManualCosts);
    const sinRetroSinManualCosts = withoutRetro.filter(f => !f.hasManualCosts);
    const sinRetroConTer = withoutRetro.filter(f => f.hasTer);

    console.log(`\n─── Fondos SIN retrocesión (${withoutRetro.length}) ───`);
    console.log(`   Tienen manual.costs:    ${sinRetroConManualCosts.length}`);
    console.log(`   NO tienen manual.costs: ${sinRetroSinManualCosts.length}`);
    console.log(`   Tienen TER:             ${sinRetroConTer.length}`);

    // ¿Son ETFs?
    const etfs = withoutRetro.filter(f => f.isETF);
    const indexFunds = withoutRetro.filter(f => f.isIndex);
    console.log(`   Son ETFs:               ${etfs.length}`);
    console.log(`   Son Indexados:          ${indexFunds.length}`);

    // Listar los que SÍ tienen manual.costs pero NO retrocesión
    if (sinRetroConManualCosts.length > 0) {
        console.log(`\n─── Fondos con manual.costs PERO sin retrocesión (${sinRetroConManualCosts.length}) ───`);
        sinRetroConManualCosts.slice(0, 15).forEach(f => {
            console.log(`   ${f.isin.padEnd(16)} ${f.name.substring(0, 45)}`);
        });
        if (sinRetroConManualCosts.length > 15) {
            console.log(`   ... y ${sinRetroConManualCosts.length - 15} más`);
        }
    }

    // Listar los que NO tienen nada en manual.costs
    if (sinRetroSinManualCosts.length > 0) {
        console.log(`\n─── Fondos SIN manual.costs en absoluto (${sinRetroSinManualCosts.length}) ───`);
        sinRetroSinManualCosts.slice(0, 15).forEach(f => {
            console.log(`   ${f.isin.padEnd(16)} ${f.name.substring(0, 45)}`);
        });
        if (sinRetroSinManualCosts.length > 15) {
            console.log(`   ... y ${sinRetroSinManualCosts.length - 15} más`);
        }
    }

    // Listar los ETFs
    if (etfs.length > 0) {
        console.log(`\n─── ETFs sin retrocesión (${etfs.length}) ───`);
        etfs.forEach(f => {
            console.log(`   ${f.isin.padEnd(16)} ${f.name.substring(0, 45)}`);
        });
    }

    console.log("\n" + "═".repeat(60));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
