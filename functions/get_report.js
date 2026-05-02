const admin = require('firebase-admin');
var serviceAccount = require("./credentials.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function getLastReport() {
    const s = await admin.firestore().collection('reports')
        .where('type', '==', 'WEEKLY_REPORT')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

    s.forEach(d => {
        console.log("ID:", d.id);
        console.log(JSON.stringify(d.data(), null, 2));
    });
}
getLastReport().then(() => process.exit(0));
