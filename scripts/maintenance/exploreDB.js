/**
 * BDB-FONDOS SCRIPT
 *
 * STATUS: ACTIVE
 * CATEGORY: maintenance
 * PURPOSE: Utility script: exploreDB.js
 * SAFE_MODE: REVIEW
 * RUN: node scripts/maintenance/exploreDB.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const saPath = path.join(__dirname, '..', 'serviceAccountKey.json');
        if (fs.existsSync(saPath)) {
            const serviceAccount = require(saPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
        } else {
            admin.initializeApp();
        }
    }
}

const db = admin.firestore();

async function exploreDB() {
    console.log('Project: bdb-fondos\n');

    // List all root-level collections
    const rootCollections = await db.listCollections();
    console.log('Root collections:');
    for (const col of rootCollections) {
        const snap = await col.limit(3).get();
        console.log(` - ${col.id} (${snap.size} sample docs)`);

        // For each doc, list subcollections
        for (const doc of snap.docs) {
            const subcols = await doc.ref.listCollections();
            if (subcols.length > 0) {
                console.log(`   └─ Doc: ${doc.id}`);
                for (const subcol of subcols) {
                    const subSnap = await subcol.limit(2).get();
                    console.log(`      └─ ${subcol.id} (${subSnap.size} docs)`);
                    subSnap.forEach(d => console.log(`         - ${d.id}: name=${d.data().name}`));
                }
            }
        }
    }

    process.exit(0);
}

exploreDB().catch(err => { console.error(err); process.exit(1); });
