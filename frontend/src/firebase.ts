/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
export const functionsUsCentral = getFunctions(app, "us-central1");
export const auth = getAuth(app);

// Emulator connection: opt-in via VITE_USE_EMULATORS=true in .env.local
// Default: connect to PRODUCTION functions even in dev mode
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
    console.log("🛠️ Connecting to Firebase Emulators (Functions only)...");
    // Firestore & Auth use PRODUCTION (emulator has no data/users)
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    connectFunctionsEmulator(functionsUsCentral, "127.0.0.1", 5001);
} else if (import.meta.env.DEV) {
    console.log("🔗 DEV mode — using PRODUCTION functions (no emulator)");
}

