// Quick script to call the insertMonthlyReport Cloud Function
// Run this in browser console on https://bdb-fondos.web.app

import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(undefined, 'europe-west1');
const insertReport = httpsCallable(functions, 'insertMonthlyReport');

insertReport({})
    .then((result) => {
        console.log('✅ Report inserted:', result.data);
    })
    .catch((error) => {
        console.error('❌ Error:', error);
    });
