/**
 * MIGRATE SECTORS TO CLEAN NUMBERS
 * Asegura que ms.sectors sean tipos Number y elimina basura (strings, comas, etc.)
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Config
const SERVICE_ACCOUNT_FILE = "C:\\Users\\oanti\\OneDrive\\Documentos\\CARGADOR DE PDFS\\ROBOT_CARGA\\serviceAccountKey.json";
const COLLECTION_NAME = "funds_v3";
const DRY_RUN = !process.argv.includes("--apply");
const LIMIT = process.argv.includes("--limit") ? parseInt(process.argv[process.argv.indexOf("--limit") + 1]) : null;

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_FILE);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// -----------------------------
// Utilidades de Normalización
// -----------------------------
function parseNum(x) {
    if (x === null || x === undefined || x === "") return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const s = String(x).replace("%", "").replace(",", ".").trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
}

function clampPct(n) {
    const v = parseNum(n);
    if (v === null) return null;
    return Math.min(100, Math.max(0, v));
}

function normalizeSectors(rawObj) {
    if (!rawObj || typeof rawObj !== "object") return null;
    const cleanObj = {};
    for (const [rawK, rawV] of Object.entries(rawObj)) {
        const val = clampPct(rawV);
        if (val !== null && val > 0) {
            // Normalizamos la key a snake_case por consistencia
            const cleanK = String(rawK).trim().toLowerCase().replace(/[\s-]/g, "_").replace(/[^a-z0-9_]/g, "");
            cleanObj[cleanK] = val;
        }
    }
    return Object.keys(cleanObj).length > 0 ? cleanObj : null;
}

// -----------------------------
// Migración
// -----------------------------
async function migrate() {
    console.log(`\n🚀 INICIANDO NORMALIZACIÓN DE SECTORES`);
    console.log(`   MODO: ${DRY_RUN ? "🔍 DRY-RUN" : "🔥 APPLY"}`);
    console.log("-------------------------------------------\n");

    let query = db.collection(COLLECTION_NAME);
    if (LIMIT) query = query.limit(LIMIT);

    const snapshot = await query.get();
    console.log(`📝 Documentos a procesar: ${snapshot.size}\n`);

    const writer = db.bulkWriter();
    let stats = {
        scanned: 0,
        changed: 0,
        stringsFound: 0,
        examples: []
    };

    for (const doc of snapshot.docs) {
        stats.scanned++;
        const data = doc.data();
        const isin = doc.id;

        if (!data.ms || !data.ms.sectors) continue;

        const oldSectors = data.ms.sectors;

        // Detectar si hay tipos mixtos o strings sucios
        let needsFix = false;
        for (const v of Object.values(oldSectors)) {
            if (typeof v !== 'number' || v > 100 || v < 0) {
                needsFix = true;
                stats.stringsFound++;
                break;
            }
        }

        const newSectors = normalizeSectors(oldSectors);

        // También detectamos cambios estructurales (keys que cambiaron a snake_case)
        if (!needsFix && JSON.stringify(oldSectors) !== JSON.stringify(newSectors)) {
            needsFix = true;
        }

        if (needsFix) {
            stats.changed++;

            if (stats.examples.length < 5) {
                stats.examples.push({ isin, before: oldSectors, after: newSectors });
            }

            if (!DRY_RUN) {
                writer.update(doc.ref, {
                    "ms.sectors": newSectors || admin.firestore.FieldValue.delete(),
                    "quality.sectors_normalized_at": admin.firestore.FieldValue.serverTimestamp()
                });
            }
        }
    }

    if (!DRY_RUN) {
        await writer.close();
        console.log("\n✅ Sectores normalizados correctamente.");
    } else {
        console.log("\n✅ Simulación de sectores completada.");
    }

    console.log("\n==========================================");
    console.log("📊 REPORTE DE SECTORES");
    console.log("==========================================");
    console.log(`Documentos escaneados:  ${stats.scanned}`);
    console.log(`Documentos con "basura": ${stats.changed}`);
    console.log("------------------------------------------");

    if (stats.examples.length > 0) {
        console.log("\n🔍 EJEMPLOS DE LIMPIEZA:");
        stats.examples.forEach(ex => {
            console.log(`  • ${ex.isin}:`);
            console.log(`    Before: ${JSON.stringify(ex.before)}`);
            console.log(`    After : ${JSON.stringify(ex.after)}`);
        });
    }
    console.log("==========================================\n");
}

migrate().catch(err => {
    console.error("❌ Error Fatal:", err);
    process.exit(1);
});
