import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { startApp } from './app_modern.js'; 
import { initVipSystem } from './modals.js'; 

const firebaseConfig = {
  apiKey: "AIzaSyBvT1dl1cqFQLAAqLfuumKIVzL078LQwmw", // <--- TU NUEVA CLAVE
  authDomain: "bdb-fondos.firebaseapp.com",
  projectId: "bdb-fondos",
  storageBucket: "bdb-fondos.firebasestorage.app",
  messagingSenderId: "224039281626",
  appId: "1:224039281626:web:058e5268888ce78afa56e3",
  measurementId: "G-PVTZF8NQQ8"
};

// Inicialización de Firebase
let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Error crítico inicializando Firebase:", error);
}

window.login = function() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        alert("Por favor, introduce usuario y contraseña.");
        return;
    }

    const btn = document.querySelector('#formulario-acceso button');
    const originalText = btn.innerText;
    btn.innerText = "Verificando...";
    btn.disabled = true;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            console.error("Error Auth:", error.code, error.message);
            btn.innerText = originalText;
            btn.disabled = false;
            
            const errorMsg = document.getElementById('error-mensaje');
            let mensaje = "Error de acceso: " + error.code;
            
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                mensaje = "Usuario o contraseña incorrectos.";
            } else if (error.code === 'auth/invalid-api-key') {
                mensaje = "Error de configuración: API Key inválida.";
            }
            
            alert(mensaje);
        });
};

window.logout = function() {
    signOut(auth).then(() => window.location.reload());
};

let appStarted = false;
onAuthStateChanged(auth, (user) => {
    const loginContainer = document.getElementById('formulario-acceso');
    const protectedContent = document.getElementById('contenido-protegido');

    if (user) {
        if(loginContainer) loginContainer.style.display = 'none';
        if(protectedContent) {
            protectedContent.classList.remove('hidden');
            protectedContent.classList.add('flex');
        }
        
        if (!appStarted) {
            console.log("Usuario autenticado:", user.email);
            initVipSystem(db); 
            startApp(user, app);
            appStarted = true;
        }
    } else {
        if(loginContainer) loginContainer.style.display = 'flex';
        if(protectedContent) protectedContent.classList.add('hidden');
        appStarted = false;
    }
});