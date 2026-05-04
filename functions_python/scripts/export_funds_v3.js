const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const saPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
        if (fs.existsSync(saPath)) {
            admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
        } else {
            admin.initializeApp();
        }
    }
}

const db = admin.firestore();

async function exportFunds() {
  const snapshot = await db.collection('funds_v3').get();

  const data = [];

  snapshot.forEach(doc => {
    data.push({
      id: doc.id,
      ...doc.data()
    });
  });

  fs.writeFileSync('funds_v3.json', JSON.stringify(data, null, 2));
  console.log(`Exportados ${data.length} fondos`);
}

exportFunds();