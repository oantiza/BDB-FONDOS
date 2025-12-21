
import { getFunctions, httpsCallable } from 'firebase/functions';

// Asegúrate de que apunte a la región correcta (europe-west1)
const functions = getFunctions(undefined, 'europe-west1');
const generateReport = httpsCallable(functions, 'generate_analysis_report');

console.log("🧠 Solicitando generación de MATRIZ ESTRATÉGICA...");

generateReport({ type: 'STRATEGY' })
    .then((result) => {
        console.log('✅ Matriz generada exitosamente:', result.data);
    })
    .catch((error) => {
        console.error('❌ Error generando matriz:', error);
    });
