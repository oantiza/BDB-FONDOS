import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBvT1dl1cqFQLAAqLfuumKIVzL078LQwmw",
    authDomain: "bdb-fondos.firebaseapp.com",
    projectId: "bdb-fondos",
    storageBucket: "bdb-fondos.firebasestorage.app",
    messagingSenderId: "224039281626",
    appId: "1:224039281626:web:058e5268888ce78afa56e3",
    measurementId: "G-PVTZF8NQQ8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
export const auth = getAuth(app);

