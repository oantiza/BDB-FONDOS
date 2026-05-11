# BDB_CREDENTIALS_WORKSPACE_CLEANUP_0

**Fecha:** 2026-05-11  
**Ejecutado por:** Antigravity Agent (Claude Sonnet 4.6 Thinking)  
**Sesión:** BDB-CREDENTIALS-WORKSPACE-CLEANUP-0  
**Tipo:** Limpieza de seguridad — sin escritura, sin deploy

---

## 1. Motivo de la limpieza

Durante los bloques de remediación MIXED (write gates 1–8), se utilizó una service account local para ejecutar scripts de lectura/escritura controlada contra Firestore. Las credenciales se colocaron temporalmente dentro del workspace del repositorio:

- `scripts/serviceAccountKey.json`
- `ServiceAccountkey.json` (raíz del repo)

Aunque ambas rutas estaban correctamente ignoradas por `.gitignore` (regla `**/serviceAccount*.json`, línea 99), **no es buena práctica mantener credenciales dentro de un workspace de repositorio**, incluso si están ignoradas por git. Una mala configuración futura, un error humano o una herramienta de análisis de código podría exponer estos archivos.

---

## 2. Estado previo confirmado

| Archivo | Existía | Ignorado por git |
|---|---|---|
| `scripts/serviceAccountKey.json` | ✅ Sí | ✅ Sí (`.gitignore:99`) |
| `ServiceAccountkey.json` | ✅ Sí | ✅ Sí (`.gitignore:99`) |

Ambos archivos tenían el mismo tamaño (2370 bytes) y timestamp (2026-05-10 18:01:03), consistente con ser copias del mismo archivo.

---

## 3. Rutas antiguas eliminadas

```
C:\Users\oanti\Documents\BDB-FONDOS\scripts\serviceAccountKey.json  → ELIMINADO
C:\Users\oanti\Documents\BDB-FONDOS\ServiceAccountkey.json          → ELIMINADO
```

Verificado post-eliminación con `Get-ChildItem -Recurse -Filter "*service*account*key*.json"` → resultado vacío.

---

## 4. Nueva ruta externa segura

La credencial válida fue **copiada** (no solo movida) a la siguiente ruta externa, fuera del workspace del repositorio:

```
C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json
```

**Verificación del archivo en ruta destino:**
- `FullName`: `C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json`
- `Length`: 2370 bytes
- `LastWriteTime`: 2026-05-10 18:01:03
- `project_id`: `bdb-fondos`
- `client_email`: `firebase-adminsdk-fbsvc@bdb-fondos.iam.gserviceaccount.com`
- `type`: `service_account`

---

## 5. Confirmación: no se commiteó ninguna credencial

El archivo nunca fue trackeado por git. Confirmado con:

```
git check-ignore -v scripts/serviceAccountKey.json
→ .gitignore:99:**/serviceAccount*.json   scripts/serviceAccountKey.json

git check-ignore -v ServiceAccountkey.json
→ .gitignore:99:**/serviceAccount*.json   ServiceAccountkey.json
```

**No existe ningún commit en el historial del repositorio que contenga la service account key.**  
`git log --oneline origin/master..HEAD` → sin commits locales pendientes al iniciar la sesión.

---

## 6. Confirmación: no write / no deploy

- ✅ **No se escribió ningún documento en Firestore** durante esta sesión.
- ✅ **No se realizó ningún deploy** (Firebase Hosting, Functions, ni Rules).
- ✅ **No se modificó código runtime, frontend, backend, optimizer, parser ni firestore.rules**.
- ✅ **No se tocó BDB-FONDOS-CORE**.
- ✅ La validación de credencial fue **únicamente de parseo JSON local** — sin llamadas a la API de Firebase ni a Google Cloud.

---

## 7. Cómo usar GOOGLE_APPLICATION_CREDENTIALS en futuras sesiones

### PowerShell (sesión temporal — recomendado para scripts):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json"
```

Esta variable solo existe en la sesión actual de PowerShell. Al cerrar la terminal, se pierde automáticamente.

### Verificar que está activa:

```powershell
echo $env:GOOGLE_APPLICATION_CREDENTIALS
```

### Para scripts Node.js / Python / Firebase Admin SDK:

El SDK de Firebase Admin SDK pickup automáticamente `GOOGLE_APPLICATION_CREDENTIALS` si la variable está definida. No es necesario hardcodear ninguna ruta en el código.

```javascript
// No necesitas hacer esto si GOOGLE_APPLICATION_CREDENTIALS está definida:
// const serviceAccount = require('./serviceAccountKey.json'); // ← NUNCA hacer esto

// El SDK lo detecta automáticamente:
const admin = require('firebase-admin');
admin.initializeApp(); // Usa GOOGLE_APPLICATION_CREDENTIALS automáticamente
```

---

## 8. Recomendación: no volver a copiar secrets dentro del repo

> ⚠️ **REGLA PERMANENTE**: Nunca copiar archivos de service account, tokens OAuth, API keys ni ninguna credencial dentro de ningún directorio que forme parte de un repositorio git, incluso si el archivo está en `.gitignore`.

**Razones:**
1. Los archivos en `.gitignore` pueden ser accidentalmente commiteados si alguien usa `git add -f` o modifica el `.gitignore`.
2. Herramientas de análisis estático o IDEs pueden indexar el contenido del archivo.
3. Un backup automático del workspace podría incluir la credencial.
4. Una futura rotación de `.gitignore` podría exponer el archivo.

**Patrón seguro para este proyecto:**

```
C:\Users\oanti\Documents\_SECRETS\          ← Credenciales fuera del repo
C:\Users\oanti\Documents\BDB-FONDOS\        ← Workspace del repo (limpio)
```

---

## 9. Git status al finalizar la sesión

```
HEAD: 2db5a24
git status --short: limpio (sin archivos modificados trackeados)
```

Los archivos eliminados (`scripts/serviceAccountKey.json`, `ServiceAccountkey.json`) nunca estuvieron trackeados por git, por lo que su eliminación no genera ningún cambio en el estado del repositorio.

---

## 10. Commit de este documento

Este documento fue commiteado como:  
`SECURITY: document external service account credential path`

**No se incluyó ninguna credencial en el commit.**

---

*Documento generado automáticamente por Antigravity Agent — BDB-CREDENTIALS-WORKSPACE-CLEANUP-0*
