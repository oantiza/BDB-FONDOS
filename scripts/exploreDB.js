const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'bdb-fondos'
});

const db = admin.firestore();

async function exploreDB() {
    console.log('Project:', serviceAccount.project_id, '\n');

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
