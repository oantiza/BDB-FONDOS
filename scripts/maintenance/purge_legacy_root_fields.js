/**
 * BDB-FONDOS SCRIPT
 *
 * STATUS: ACTIVE
 * CATEGORY: maintenance
 * PURPOSE: Utility script: purge_legacy_root_fields.js
 * SAFE_MODE: REVIEW
 * RUN: node scripts/maintenance/purge_legacy_root_fields.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
    process.exit(1);
}
const serviceAccount = require(SERVICE_ACCOUNT_FILE);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function run() {
    console.log("🧹 Iniciando purgado de campos legacy en funds_v3...");
    const snapshot = await db.collection("funds_v3").get();
    console.log(`📦 Se han encontrado ${snapshot.size} fondos en la base de datos.`);

    // Usamos bulkWriter para eficiencia de escritura en batch
    const writer = db.bulkWriter();
    let fundsCleaned = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        const updates = {};

        // Campos canónicos que ahora viven dentro de derived.* o ms.*
        if (data.asset_class !== undefined) updates.asset_class = admin.firestore.FieldValue.delete();
        if (data.std_type !== undefined) updates.std_type = admin.firestore.FieldValue.delete();
        if (data.std_region !== undefined) updates.std_region = admin.firestore.FieldValue.delete();
        if (data.primary_region !== undefined) updates.primary_region = admin.firestore.FieldValue.delete();
        if (data.category_morningstar !== undefined) updates.category_morningstar = admin.firestore.FieldValue.delete();
        if (data.sectors !== undefined) updates.sectors = admin.firestore.FieldValue.delete();

        if (Object.keys(updates).length > 0) {
            writer.update(doc.ref, updates);
            fundsCleaned++;
        }
    });

    await writer.close();
    console.log(`\n✅ Purgado completo. Se han limpiado campos sobrantes en ${fundsCleaned} fondos.`);
    process.exit(0);
}

run().catch(console.error);
