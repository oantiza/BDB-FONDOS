/**
 * IMPORT RETROCESIONES FROM CSV
 * Lee un CSV y actualiza manual.costs.retrocession en funds_v3
 * 
 * Modo DRY-RUN por defecto. Usar --apply para ejecutar cambios.
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(SA_PATH);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

const DRY_RUN = !process.argv.includes("--apply");
const CSV_PATH = path.join(__dirname, "..", "Copia de R_2.csv");

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split(/\r?\n/);
    const funds = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip header lines
        if (line.startsWith("RETROCESIONES") || line.startsWith("nombre;isin;retro") || line === ";;;;;;;") continue;

        const parts = line.split(";");
        if (parts.length < 3) continue;

        const name = parts[0].trim();
        const isin = parts[1].trim();
        const retroStr = parts[2].trim();

        if (!isin || isin.length < 10) continue;

        // Parse retrocesion: "0,80%" -> 0.008 (as decimal)
        let retroDecimal = null;
        if (retroStr) {
            const cleaned = retroStr.replace("%", "").replace(",", ".").trim();
            const pct = parseFloat(cleaned);
            if (!isNaN(pct)) {
                retroDecimal = pct / 100; // Convert percentage to decimal
            }
        }

        if (retroDecimal !== null) {
            funds.push({ name, isin, retrocesion: retroDecimal, retroPct: retroStr });
        }
    }

    return funds;
}

async function main() {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`📥 IMPORTAR RETROCESIONES DESDE CSV`);
    console.log(`   Modo: ${DRY_RUN ? "🔍 DRY-RUN (solo lectura)" : "🔥 APPLY (escritura activa)"}`);
    console.log(`${"═".repeat(60)}\n`);

    // 1. Parse CSV
    const csvFunds = parseCSV(CSV_PATH);
    console.log(`📄 Fondos leídos del CSV: ${csvFunds.length}\n`);

    // 2. Get current DB state for those ISINs
    const newRetro = [];       // No tienen retrocesión → se añade
    const sameRetro = [];      // Ya tienen la misma retrocesión → skip
    const diffRetro = [];      // Ya tienen retrocesión DIFERENTE → preguntar
    const notFound = [];       // No existen en funds_v3
    const zeroRetro = [];      // CSV tiene 0% → skip

    for (const fund of csvFunds) {
        const docRef = db.collection("funds_v3").doc(fund.isin);
        const doc = await docRef.get();

        if (!doc.exists) {
            notFound.push(fund);
            continue;
        }

        if (fund.retrocesion === 0) {
            zeroRetro.push(fund);
            continue;
        }

        const data = doc.data();
        const currentRetro = data.manual?.costs?.retrocession;

        if (currentRetro === undefined || currentRetro === null) {
            // No tiene retrocesión → AÑADIR
            newRetro.push({ ...fund, current: null });
        } else if (Math.abs(currentRetro - fund.retrocesion) < 0.0001) {
            // Misma retrocesión → SKIP
            sameRetro.push({ ...fund, current: currentRetro });
        } else {
            // Retrocesión DIFERENTE → CONFLICTO
            diffRetro.push({ ...fund, current: currentRetro });
        }
    }

    // REPORT
    console.log(`${"─".repeat(60)}`);
    console.log(`✅ NUEVAS (se añadirán):           ${newRetro.length}`);
    console.log(`⏩ YA IGUALES (sin cambio):        ${sameRetro.length}`);
    console.log(`⚠️  DIFERENTES (conflicto):         ${diffRetro.length}`);
    console.log(`0️⃣  CSV con 0% (se ignoran):        ${zeroRetro.length}`);
    console.log(`❌ NO ENCONTRADOS en funds_v3:     ${notFound.length}`);
    console.log(`${"─".repeat(60)}\n`);

    // Detalle de NUEVAS
    if (newRetro.length > 0) {
        console.log(`\n✅ FONDOS QUE RECIBIRÁN RETROCESIÓN NUEVA:`);
        console.log(`${"ISIN".padEnd(16)} ${"Retro".padStart(8)}  Nombre`);
        console.log("─".repeat(60));
        newRetro.forEach(f => {
            const shortName = f.name.length > 35 ? f.name.substring(0, 35) + "..." : f.name;
            console.log(`${f.isin.padEnd(16)} ${f.retroPct.padStart(8)}  ${shortName}`);
        });
    }

    // Detalle de CONFLICTOS
    if (diffRetro.length > 0) {
        console.log(`\n⚠️  FONDOS CON RETROCESIÓN DIFERENTE (NO SE TOCAN):`);
        console.log(`${"ISIN".padEnd(16)} ${"Actual".padStart(8)} ${"→ CSV".padStart(8)}  Nombre`);
        console.log("─".repeat(60));
        diffRetro.forEach(f => {
            const currentPct = (f.current * 100).toFixed(2) + "%";
            const shortName = f.name.length > 30 ? f.name.substring(0, 30) + "..." : f.name;
            console.log(`${f.isin.padEnd(16)} ${currentPct.padStart(8)} ${f.retroPct.padStart(8)}  ${shortName}`);
        });
    }

    // Detalle de NO ENCONTRADOS
    if (notFound.length > 0) {
        console.log(`\n❌ ISINs NO ENCONTRADOS en funds_v3:`);
        notFound.forEach(f => {
            console.log(`   ${f.isin.padEnd(16)} ${f.name}`);
        });
    }

    // Detalle de ZERO
    if (zeroRetro.length > 0) {
        console.log(`\n0️⃣  CSV con retrocesión 0% (ignorados):`);
        zeroRetro.forEach(f => {
            console.log(`   ${f.isin.padEnd(16)} ${f.name}`);
        });
    }

    // APPLY
    if (!DRY_RUN && newRetro.length > 0) {
        console.log(`\n🔥 Aplicando ${newRetro.length} retrocesiones nuevas...`);
        const batch = db.batch();
        let count = 0;

        for (const fund of newRetro) {
            const docRef = db.collection("funds_v3").doc(fund.isin);
            batch.update(docRef, { "manual.costs.retrocession": fund.retrocesion });
            count++;

            // Firestore batches max 500
            if (count % 450 === 0) {
                await batch.commit();
                console.log(`   Committed ${count} updates...`);
            }
        }

        await batch.commit();
        console.log(`\n✅ ${count} retrocesiones nuevas aplicadas correctamente.`);
    } else if (!DRY_RUN && newRetro.length === 0) {
        console.log("\nNo hay retrocesiones nuevas que aplicar.");
    } else {
        console.log(`\n💡 Para aplicar los cambios, ejecuta:`);
        console.log(`   node scripts/import_retrocesiones.js --apply`);
    }

    console.log(`\n${"═".repeat(60)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error("❌", e); process.exit(1); });
