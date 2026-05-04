# Configuración Local de Credenciales — BDB-FONDOS

## ¿Qué es `serviceAccountKey.json`?

Es la clave privada del Firebase Admin SDK para el proyecto `bdb-fondos`. Permite acceso total a Firestore, Storage, Authentication y todos los servicios Firebase del proyecto.

**Riesgo:** Si se filtra (publicación en GitHub, copia insegura, etc.), cualquier persona con esta clave puede leer, escribir y borrar todos los datos del proyecto.

**Estado actual:** El archivo está en la raíz del repositorio, protegido por `.gitignore` (nunca fue commiteado al historial). Sin embargo, la práctica recomendada es mantenerlo **fuera del directorio del repositorio**.

---

## Ruta Externa Objetivo

```
C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json
```

> ⚠️ **No mover la clave todavía.** Primero hay que completar el refactor de los 42 scripts que tienen el path hardcoded. Si se mueve antes, esos scripts dejarán de funcionar.

---

## Variable de Entorno: `GOOGLE_APPLICATION_CREDENTIALS`

Firebase Admin SDK (tanto Python como Node.js) detecta automáticamente esta variable de entorno. Si está configurada, no necesita recibir el path del archivo de credenciales como argumento.

### Cómo configurarla en Windows (PowerShell)

**A nivel de usuario (persistente):**
```powershell
[System.Environment]::SetEnvironmentVariable(
    "GOOGLE_APPLICATION_CREDENTIALS",
    "C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json",
    "User"
)
```

**A nivel de sesión (temporal):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json"
```

### Verificar que está configurada

```powershell
# Comprobar valor
echo $env:GOOGLE_APPLICATION_CREDENTIALS

# Comprobar que el archivo existe
Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS
```

> ⚠️ **No ejecutar estos comandos todavía.** Esta documentación es preparatoria. La variable se configurará cuando se complete la externalización en FASE 4B.5.

---

## Cómo Funciona la Inicialización Firebase

### En producción (Cloud Functions)

```python
# functions_python/main.py
from firebase_admin import initialize_app
initialize_app()  # Sin argumentos — usa credenciales automáticas de GCP
```

El código de producción (`main.py`, `api/`, `services/`) **no referencia** `serviceAccountKey.json`. En Cloud Functions, las credenciales son inyectadas automáticamente por la plataforma.

### En scripts locales — Patrón con Fallback (25 scripts)

```python
try:
    firebase_admin.get_app()
except ValueError:
    if os.path.exists("./serviceAccountKey.json"):
        cred = credentials.Certificate("./serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()  # ← usa GOOGLE_APPLICATION_CREDENTIALS
```

Estos scripts **ya funcionan** con `GOOGLE_APPLICATION_CREDENTIALS` si el archivo no está en el directorio local. No requieren cambios.

### En scripts locales — Patrón Hardcoded (42 scripts)

```python
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
cred = credentials.Certificate(KEY_PATH)
firebase_admin.initialize_app(cred)
```

O en JS:
```javascript
const serviceAccount = require("../serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
```

Estos scripts **fallarán** si se mueve el archivo. Requieren refactorización antes de la externalización.

---

## Clasificación de Scripts

| Categoría | Cantidad | Estado |
|---|---|---|
| Producción (main.py, api/, services/) | 0 refs | ✅ No depende de SAK |
| Scripts con fallback | 25 | ✅ Compatible con GAC |
| Scripts hardcoded Python | 16 | ❌ Requiere refactor |
| Scripts hardcoded JS | 22 | ❌ Requiere refactor |
| Legacy/frontend scripts | 4 | ❌ Requiere refactor |

---

## Orden de Operaciones (No ejecutar todavía)

1. ✅ Documentar setup (este documento).
2. ⬜ Refactorizar scripts hardcoded Python (16 archivos).
3. ⬜ Refactorizar scripts hardcoded JS (22 archivos).
4. ⬜ Configurar `GOOGLE_APPLICATION_CREDENTIALS` como variable de usuario.
5. ⬜ Copiar `serviceAccountKey.json` a ruta externa.
6. ⬜ Verificar scripts críticos (import-only, no ejecutar mutantes).
7. ⬜ Eliminar `serviceAccountKey.json` del directorio del repo.
8. ⬜ Rotar clave en Firebase Console (manual).

---

## Obtener una Nueva Clave (referencia futura)

1. Ir a [Firebase Console](https://console.firebase.google.com/).
2. Seleccionar proyecto `bdb-fondos`.
3. Settings (⚙️) → Project Settings → Service Accounts.
4. Clic en "Generate new private key".
5. Guardar en la ruta externa: `C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json`.
6. Invalidar la clave anterior en el mismo panel.
