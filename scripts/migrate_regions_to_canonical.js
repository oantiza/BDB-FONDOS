/**
 * MIGRATE REGIONS TO CANONICAL
 * Normaliza las claves de ms.regions en Firestore según el set canónico (snake_case EN).
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
// Diccionario e Helpers (Diferente a cargador_lotes para ser standalone)
// -----------------------------
const REGION_MAPPINGS = {
    "united_states": ["usa", "u.s.", "u.s.a", "eeuu", "estados_unidos", "united_states"],
    "canada": ["canada", "canadá"],
    "latin_america": ["latin_america", "latinoamerica", "latinoamérica", "america_latina", "américa_latina", "iberoamerica", "iberoamérica"],
    "eurozone": ["eurozone", "euro_zone", "zona_euro", "zona_del_euro", "emu"],
    "europe_ex_euro": ["europe_ex_euro", "europe_ex-euro", "europa_ex_euro", "europe_excluding_eurozone", "europa_sin_euro", "europa/o_medio/africa", "europa/o.medio/africa"],
    "united_kingdom": ["uk", "u.k.", "united_kingdom", "reino_unido", "great_britain", "gran_bretaña", "gran_bretana"],
    "europe_emerging": ["emerging_europe", "europa_emergente"],
    "japan": ["japan", "japón", "japon"],
    "developed_asia": ["developed_asia", "asia_desarrollada", "asia_developed"],
    "china": ["china"],
    "asia_emerging": ["asia_emerging", "emerging_asia", "asia_emergente"],
    "middle_east": ["middle_east", "oriente_medio", "oriente_medio_africa", "oriente_medio_/_africa"],
    "africa": ["africa", "áfrica"],
    "australasia": ["australasia", "australia", "new_zealand", "nueva_zelanda"],
    "americas": ["americas", "américas"],
    "europe_me_africa": ["europe_me_africa", "europa_o_medio_africa"],
    "asia": ["asia"]
};

const REGION_LOOKUP = {};
for (const [canonical, aliases] of Object.entries(REGION_MAPPINGS)) {
    aliases.forEach(alias => { REGION_LOOKUP[alias] = canonical; });
}

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

function cleanRegionKey(k) {
    if (!k) return "";
    return String(k)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\s-]/g, "_")
        .replace(/[^a-z0-9_.]/g, "");
}

function normalizeRegions(rawObj, warnings = []) {
    if (!rawObj || typeof rawObj !== "object") return null;

    const canonicalObj = {};
    const rawKeys = Object.keys(rawObj);

    const hasSpecificEurope = rawKeys.some(k => {
        const cleanK = cleanRegionKey(k);
        const can = REGION_LOOKUP[cleanK];
        return can === "eurozone" || can === "europe_ex_euro";
    });

    for (const [rawK, rawV] of Object.entries(rawObj)) {
        const val = clampPct(rawV);
        if (val === null || val === 0) continue;

        const cleanK = cleanRegionKey(rawK);

        if (hasSpecificEurope && (cleanK === "europe" || cleanK === "europa")) continue;

        let canonical = REGION_LOOKUP[cleanK];
        if (!canonical && (cleanK === "europe" || cleanK === "europa")) {
            canonical = "europe_ex_euro";
        }

        if (canonical) {
            canonicalObj[canonical] = (canonicalObj[canonical] || 0) + val;
        } else {
            canonicalObj["other"] = (canonicalObj["other"] || 0) + val;
            if (warnings && !warnings.includes(rawK)) warnings.push(rawK);
        }
    }

    for (const k in canonicalObj) {
        if (canonicalObj[k] > 100) canonicalObj[k] = 100;
    }

    return Object.keys(canonicalObj).length > 0 ? canonicalObj : null;
}

// -----------------------------
// Migración
// -----------------------------
async function migrate() {
    console.log(`\n🚀 INICIANDO MIGRACIÓN DE REGIONES`);
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
        legacyKeys: {},
        unknownKeys: {},
        examples: []
    };

    for (const doc of snapshot.docs) {
        stats.scanned++;
        const data = doc.data();
        const isin = doc.id;

        if (!data.ms || !data.ms.regions) continue;

        const oldMacro = data.ms.regions.macro || {};
        const oldDetail = data.ms.regions.detail || {};

        // Track legacy keys
        Object.keys(oldDetail).forEach(k => {
            stats.legacyKeys[k] = (stats.legacyKeys[k] || 0) + 1;
        });

        const unk = [];
        const newMacro = normalizeRegions(oldMacro, []);
        const newDetail = normalizeRegions(oldDetail, unk);

        unk.forEach(k => {
            stats.unknownKeys[k] = (stats.unknownKeys[k] || 0) + 1;
        });

        const macroChanged = JSON.stringify(oldMacro) !== JSON.stringify(newMacro);
        const detailChanged = JSON.stringify(oldDetail) !== JSON.stringify(newDetail);

        if (macroChanged || detailChanged) {
            stats.changed++;

            let updates = {
                "ms.regions.macro": newMacro || admin.firestore.FieldValue.delete(),
                "ms.regions.detail": newDetail || admin.firestore.FieldValue.delete(),
                "quality.regions_migrated_at": admin.firestore.FieldValue.serverTimestamp()
            };

            // Notita en warnings
            const currentWarnings = data.quality?.warnings || [];
            if (!currentWarnings.includes("regions_canonicalized")) {
                currentWarnings.push("regions_canonicalized");
                updates["quality.warnings"] = currentWarnings;
            }

            if (stats.examples.length < 10) {
                stats.examples.push({
                    isin,
                    before: oldDetail,
                    after: newDetail
                });
            }

            if (!DRY_RUN) {
                writer.update(doc.ref, updates);
            }
        }
    }

    if (!DRY_RUN) {
        await writer.close();
        console.log("\n✅ Cambios aplicados correctamente.");
    } else {
        console.log("\n✅ Simulación completada (No se realizaron cambios).");
    }

    // REPORTE FINAL
    console.log("\n==========================================");
    console.log("📊 REPORTE DE MIGRACIÓN");
    console.log("==========================================");
    console.log(`Documentos escaneados:  ${stats.scanned}`);
    console.log(`Documentos con cambios: ${stats.changed}`);
    console.log("------------------------------------------");

    console.log("\n🔝 TOP CLAVES LEGACY ENCONTRADAS:");
    Object.entries(stats.legacyKeys)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([k, v]) => console.log(`  • ${k.padEnd(25)} : ${v}`));

    console.log("\n❓ CLAVES DESCONOCIDAS (Mapeadas a 'Other'):");
    Object.entries(stats.unknownKeys)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .forEach(([k, v]) => console.log(`  • ${k.padEnd(25)} : ${v}`));

    console.log("\n🔍 EJEMPLOS (Primary Changes):");
    stats.examples.forEach(ex => {
        console.log(`  • ${ex.isin}: [${Object.keys(ex.before).join(",")}] -> [${Object.keys(ex.after || {}).join(",")}]`);
    });
    console.log("==========================================\n");
}

migrate().catch(err => {
    console.error("❌ Errorfatal:", err);
    process.exit(1);
});
