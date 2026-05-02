/**
 * REPAIR COSTS FUNDS_V3
 * Limpieza de inconsistencias en costes (TER, Retrocesiones)
 * (c) 2026 Admin DB Repair Utility
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Config
const SERVICE_ACCOUNT_FILE = "C:\\Users\\oanti\\OneDrive\\Documentos\\CARGADOR DE PDFS\\ROBOT_CARGA\\serviceAccountKey.json";
const COLLECTION_NAME = "funds_v3";
const DRY_RUN = !process.argv.includes("--apply");

if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
    process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_FILE);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function repair() {
    console.log(`\n🚀 INICIANDO REPARACIÓN DE COSTES EN ${COLLECTION_NAME.toUpperCase()}`);
    console.log(`   MODO: ${DRY_RUN ? "🔍 DRY-RUN (Solo lectura)" : "🔥 APPLY (Escritura activa)"}`);
    console.log("-------------------------------------------\n");

    const snapshot = await db.collection(COLLECTION_NAME).get();
    console.log(`📝 Total documentos encontrados: ${snapshot.size}\n`);

    const writer = db.bulkWriter();
    let stats = {
        scanned: 0,
        affected: 0,
        fieldsDeleted: {
            msCostsTer: 0,
            msCostsRetro: 0,
            msCostsEntry: 0,
            msCostsExit: 0,
            msCostsEntire: 0,
            terRoot: 0,
            retroRoot: 0
        },
        examples: []
    };

    for (const doc of snapshot.docs) {
        stats.scanned++;
        const data = doc.data();
        const isin = doc.id;
        let updates = {};
        let docFieldsRemoved = [];

        // 1. Limpieza de ms.costs.*
        if (data.ms && data.ms.costs) {
            const c = data.ms.costs;

            if (c.hasOwnProperty('ter')) {
                updates["ms.costs.ter"] = admin.firestore.FieldValue.delete();
                stats.fieldsDeleted.msCostsTer++;
                docFieldsRemoved.push("ms.costs.ter");
            }
            if (c.hasOwnProperty('retrocession')) {
                updates["ms.costs.retrocession"] = admin.firestore.FieldValue.delete();
                stats.fieldsDeleted.msCostsRetro++;
                docFieldsRemoved.push("ms.costs.retrocession");
            }
            if (c.hasOwnProperty('retrocession2')) {
                updates["ms.costs.retrocession2"] = admin.firestore.FieldValue.delete();
                stats.fieldsDeleted.msCostsRetro++;
                docFieldsRemoved.push("ms.costs.retrocession2");
            }
            if (c.hasOwnProperty('entry_fee')) {
                updates["ms.costs.entry_fee"] = admin.firestore.FieldValue.delete();
                stats.fieldsDeleted.msCostsEntry++;
                docFieldsRemoved.push("ms.costs.entry_fee");
            }
            if (c.hasOwnProperty('exit_fee')) {
                updates["ms.costs.exit_fee"] = admin.firestore.FieldValue.delete();
                stats.fieldsDeleted.msCostsExit++;
                docFieldsRemoved.push("ms.costs.exit_fee");
            }

            // Si después de estos borrados solo queda management_fee (o nada), evaluamos borrar el objeto ms.costs
            const remainingKeys = Object.keys(c).filter(k =>
                !['ter', 'retrocession', 'retrocession2', 'entry_fee', 'exit_fee'].includes(k)
            );

            // Si lo que queda es gestión null o vacío, borramos ms.costs entero
            if (remainingKeys.length === 0 || (remainingKeys.length === 1 && remainingKeys[0] === 'management_fee' && (c.management_fee === null || c.management_fee === undefined))) {
                // EVITAR CONFLICTO: Si borramos ms.costs, no debemos mandar borrado de campos hijos
                Object.keys(updates).forEach(k => { if (k.startsWith("ms.costs.")) delete updates[k]; });

                updates["ms.costs"] = admin.firestore.FieldValue.delete();
                stats.fieldsDeleted.msCostsEntire++;
                docFieldsRemoved = docFieldsRemoved.filter(f => !f.startsWith("ms.costs."));
                docFieldsRemoved.push("ms.costs (completo)");
            }
        }

        // 2. Limpieza de campos raíz (Legacy)
        if (data.hasOwnProperty('ter')) {
            updates["ter"] = admin.firestore.FieldValue.delete();
            stats.fieldsDeleted.terRoot++;
            docFieldsRemoved.push("ter (raíz)");
        }
        if (data.hasOwnProperty('retrocession')) {
            updates["retrocession"] = admin.firestore.FieldValue.delete();
            stats.fieldsDeleted.retroRoot++;
            docFieldsRemoved.push("retrocession (raíz)");
        }
        if (data.hasOwnProperty('retrocession2')) {
            updates["retrocession2"] = admin.firestore.FieldValue.delete();
            stats.fieldsDeleted.retroRoot++;
            docFieldsRemoved.push("retrocession2 (raíz)");
        }

        // 3. Limpieza de manual.costs (Eliminar retrocession2 por petición expresa)
        if (data.manual && data.manual.costs && data.manual.costs.hasOwnProperty('retrocession2')) {
            updates["manual.costs.retrocession2"] = admin.firestore.FieldValue.delete();
            docFieldsRemoved.push("manual.costs.retrocession2");
        }

        // Aplicar
        if (Object.keys(updates).length > 0) {
            stats.affected++;
            if (stats.examples.length < 10) {
                stats.examples.push({ isin, removed: docFieldsRemoved });
            }

            if (!DRY_RUN) {
                writer.update(doc.ref, updates);
            } else {
                // En modo dry-run mostramos lo que haríamos si hay pocos ejemplos
                if (stats.affected <= 5) {
                    console.log(`🔍 [DRY-RUN] ${isin}: Se borrarían ${docFieldsRemoved.join(", ")}`);
                }
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
    console.log("📊 REPORTE DE REPARACIÓN");
    console.log("==========================================");
    console.log(`Documentos escaneados:  ${stats.scanned}`);
    console.log(`Documentos afectados:  ${stats.affected}`);
    console.log("------------------------------------------");
    console.log("Desglose de campos eliminados:");
    console.log(`- ms.costs.ter:          ${stats.fieldsDeleted.msCostsTer}`);
    console.log(`- ms.costs.retrocession: ${stats.fieldsDeleted.msCostsRetro}`);
    console.log(`- ms.costs.entry/exit:   ${stats.fieldsDeleted.msCostsEntry + stats.fieldsDeleted.msCostsExit}`);
    console.log(`- ms.costs (total):      ${stats.fieldsDeleted.msCostsEntire}`);
    console.log(`- ter raíz (legacy):     ${stats.fieldsDeleted.terRoot}`);
    console.log(`- retro raíz (legacy):   ${stats.fieldsDeleted.retroRoot}`);
    console.log("------------------------------------------");
    console.log("Ejemplos de ISINs modificados:");
    stats.examples.forEach(ex => {
        console.log(`  • ${ex.isin.padEnd(14)} -> [${ex.removed.join(", ")}]`);
    });
    console.log("==========================================\n");
}

repair().catch(err => {
    console.error("❌ Errorfatal:", err);
    process.exit(1);
});
