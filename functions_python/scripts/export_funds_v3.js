const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

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