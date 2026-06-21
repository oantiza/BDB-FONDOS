# FASE 4 — Plan de Seguridad de Credenciales

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.
**Referencia:** Commit `8b095ab` (Fases 1–3 consolidadas)

---

## 1. Inventario de Credenciales

### 1.1 Archivos sensibles presentes localmente

| Archivo | Tamaño | Contenido | Nivel |
|---|---|---|---|
| `.env` | 57 bytes | `GEMINI_API_KEY="AIz****"` | 🔴 ALTO |
| `frontend/.env` | 377 bytes | 7 variables `VITE_FIREBASE_*` | 🟡 MEDIO |
| `serviceAccountKey.json` | 2,370 bytes | Firebase Admin SDK key completa | 🔴 CRÍTICO |

### 1.2 Otros archivos sensibles

| Búsqueda | Resultado |
|---|---|
| `*.pem`, `*.key`, `*.crt` | ❌ Ninguno encontrado |
| `*credential*`, `*secret*` | ❌ Ninguno encontrado |
| `*service-account*`, `*bdb-fondos-sa*` | ❌ Ninguno encontrado |
| `functions_python/.env` | ❌ No existe |

---

## 2. Estado Git Actual

### 2.1 Tracking

| Archivo | Trackeado por Git | Ignorado por .gitignore |
|---|---|---|
| `.env` | ❌ No | ✅ Sí |
| `frontend/.env` | ❌ No | ✅ Sí |
| `serviceAccountKey.json` | ❌ No | ✅ Sí (`serviceAccount*.json`) |

**Veredicto:** ✅ Los 3 archivos están correctamente protegidos y no aparecen en staging.

### 2.2 Historial Git

| Patrón | En historial commits |
|---|---|
| `serviceAccountKey.json` (archivo) | ✅ **LIMPIO** — nunca fue commiteado |
| `.env` (archivo) | ✅ **LIMPIO** — nunca fue commiteado |
| `private_key` (valor) | ✅ **LIMPIO** — no aparece en diffs |
| `client_email` (valor) | ✅ **LIMPIO** — no aparece en diffs |
| `GEMINI_API_KEY` (referencia) | ⚠️ Aparece como **variable name** en código (no valor) |
| `apiKey` (referencia) | ⚠️ Aparece en `firebase.ts` como `import.meta.env.VITE_FIREBASE_API_KEY` (no valor) |
| `FIREBASE` (referencia) | ⚠️ Aparece como nombre de constantes (no credenciales) |

> [!TIP]
> **Historial limpio.** Las credenciales sensibles (valores reales de API keys y private keys) **nunca fueron commiteadas** al historial Git. Las coincidencias son solo referencias a nombres de variables de entorno, lo cual es correcto. **NO se necesita BFG ni git filter-repo.**

---

## 3. Análisis del .gitignore Actual

### 3.1 Protecciones existentes

```gitignore
# VARIABLES DE ENTORNO
.env
.env.*
frontend/.env
functions_python/.env

# CREDENCIALES
*.pem
*.key
*.crt
serviceAccount*.json
scripts/service-account.json
scripts/bdb-fondos-sa.json
```

### 3.2 Evaluación

| Patrón | Protege | Estado |
|---|---|---|
| `.env` | Raíz .env | ✅ |
| `.env.*` | `.env.local`, `.env.production`, etc. | ✅ |
| `frontend/.env` | Frontend env | ✅ |
| `functions_python/.env` | Functions env | ✅ |
| `serviceAccount*.json` | Cualquier service account | ✅ |
| `*.pem`, `*.key`, `*.crt` | Certificados | ✅ |

### 3.3 Mejoras propuestas

```gitignore
# Añadir cobertura adicional:
**/serviceAccount*.json    # Cualquier subdirectorio
**/*credentials*.json      # Archivos de credenciales genéricos
**/*secret*.json           # Archivos de secretos
.env.local                 # Variante común
.env.development           # Variante común
```

---

## 4. Clasificación de Riesgo

### 🔴 CRÍTICO: `serviceAccountKey.json`

- **Qué es:** Clave privada RSA del Firebase Admin SDK.
- **Qué permite:** Acceso total a Firestore, Storage, Auth, y todos los servicios Firebase del proyecto `bdb-fondos`.
- **Riesgo si se filtra:** Compromiso completo del backend.
- **Archivos que lo referencian:** **86 archivos** usan el path `serviceAccountKey.json` hardcoded.
- **Patrón actual:** La mayoría busca `./serviceAccountKey.json` o `../serviceAccountKey.json` con fallback a `firebase_admin.initialize_app()` sin credenciales.
- **Archivos que usan `GOOGLE_APPLICATION_CREDENTIALS`:** Solo 6 archivos (pattern más seguro).

### 🔴 ALTO: `GEMINI_API_KEY` en `.env`

- **Qué es:** API Key de Google AI Studio para Gemini.
- **Qué permite:** Uso del modelo Gemini con la cuota del propietario.
- **Riesgo si se filtra:** Consumo de cuota, posible abuso.
- **Uso:** Leída via `process.env.GEMINI_API_KEY` en scripts JS.

### 🟡 MEDIO-BAJO: `frontend/.env` (Firebase Web Config)

- **Qué es:** Configuración pública del SDK Firebase Web.
- **Qué permite:** Inicializar el SDK Firebase en el navegador.
- **Riesgo si se filtra:** Bajo. Firebase Web config es **diseñada para ser pública** (se embebe en el frontend). La seguridad se controla via Firestore Rules, no via la API key.
- **Nota:** Ya se sirve al cliente en el bundle de producción. Proteger en `.env` es buena práctica para evitar scraping, pero no es un secreto real.

---

## 5. Plan por Subfases

### FASE 4A: Reforzar .gitignore + crear .env.example

**Riesgo:** NINGUNO
**Acción:**
1. Añadir patrones adicionales al `.gitignore`.
2. Crear `.env.example` (sin valores reales).
3. Crear `frontend/.env.example` (sin valores reales).
4. Documentar instrucciones de setup.

**Archivos a tocar:** `.gitignore`, `.env.example` (nuevo), `frontend/.env.example` (nuevo)

---

### FASE 4B: Externalizar `serviceAccountKey.json`

**Riesgo:** MEDIO — requiere ajustar path o variable de entorno.
**Acción:**
1. Mover `serviceAccountKey.json` a ruta local segura fuera del repo:
   ```
   C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json
   ```
2. Configurar variable de entorno:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json
   ```
3. Verificar que Firebase Admin SDK lo detecta automáticamente.

**Dependencias:** 86 archivos referencian `serviceAccountKey.json`. Sin embargo:
- Firebase Admin SDK con `GOOGLE_APPLICATION_CREDENTIALS` configurado no necesita path explícito.
- La mayoría de scripts tienen fallback `firebase_admin.initialize_app()` que usa la variable automáticamente.
- Solo requeriría editar scripts que hacen `credentials.Certificate("./serviceAccountKey.json")` explícitamente.

**Decisión del usuario:** ¿Refactorizar los 86 scripts o mantener symlink/variable?

---

### FASE 4C: Actualizar scripts para `GOOGLE_APPLICATION_CREDENTIALS`

**Riesgo:** MEDIO-ALTO — toca lógica de inicialización en muchos scripts.
**Acción:** Refactorizar el patrón de inicialización Firebase:

```python
# ANTES (hardcoded):
cred = credentials.Certificate("./serviceAccountKey.json")
firebase_admin.initialize_app(cred)

# DESPUÉS (env-based):
firebase_admin.initialize_app()  # Usa GOOGLE_APPLICATION_CREDENTIALS automáticamente
```

**Alcance:** ~86 archivos. Pero muchos ya tienen el fallback. Solo los que NO tienen fallback necesitan edición.

---

### FASE 4D: Rotar Gemini API Key

**Riesgo:** BAJO (si se actualiza .env inmediatamente)
**Acción:**
1. Generar nueva API Key en Google AI Studio.
2. Actualizar `.env` con la nueva key.
3. Invalidar la key anterior.

**Requiere intervención manual del usuario:** Sí (Google AI Studio console).

---

### FASE 4E: Rotar Firebase Admin SDK Key

**Riesgo:** MEDIO (si se actualiza en todos los entornos)
**Acción:**
1. Generar nueva service account key en Firebase Console.
2. Reemplazar `serviceAccountKey.json` local.
3. Invalidar la key anterior.
4. Actualizar cualquier deployment que use la key antigua.

**Requiere intervención manual del usuario:** Sí (Firebase Console > Project Settings > Service Accounts).

---

### FASE 4F: Limpiar historial Git (si fuera necesario)

**Estado:** ✅ **NO NECESARIO.** El historial está limpio — ninguna credencial real fue commiteada.

---

## 6. Acciones Seguras Inmediatas (FASE 4A)

Pueden ejecutarse sin riesgo:

| Acción | Riesgo |
|---|---|
| Reforzar `.gitignore` | NINGUNO |
| Crear `.env.example` | NINGUNO |
| Crear `frontend/.env.example` | NINGUNO |
| Documentar setup en README | NINGUNO |

## 7. Acciones que Requieren Autorización Manual

| Acción | Quién | Dónde |
|---|---|---|
| Rotar Gemini API Key | Usuario | [Google AI Studio](https://aistudio.google.com/apikey) |
| Rotar Firebase Admin Key | Usuario | [Firebase Console](https://console.firebase.google.com/) > Settings > Service Accounts |
| Configurar `GOOGLE_APPLICATION_CREDENTIALS` | Usuario | Variables de entorno del sistema |
| Decidir si refactorizar 86 scripts | Usuario | Decisión de arquitectura |
| Decidir si mover SAK fuera del repo | Usuario | Decisión de seguridad |

---

## 8. Evaluación de Riesgo por Subfase

| Subfase | Riesgo | Impacto si falla | Reversible |
|---|---|---|---|
| 4A: .gitignore + examples | NINGUNO | — | Sí |
| 4B: Externalizar SAK | MEDIO | Scripts locales no encuentran credencial | Sí (copiar de vuelta) |
| 4C: Refactorizar init pattern | MEDIO-ALTO | Scripts rotos si hay errores | Sí (git revert) |
| 4D: Rotar Gemini Key | BAJO | Scripts Gemini fallan hasta actualizar .env | Sí (regenerar key) |
| 4E: Rotar Firebase Key | MEDIO | Todo el backend local falla hasta reemplazar | Sí (regenerar key) |
| 4F: Limpiar historial | N/A | No necesario | — |

---

## 9. Recomendación

> [!IMPORTANT]
> **Prioridad inmediata:** Ejecutar solo FASE 4A (riesgo cero). Las fases 4B–4E requieren decisiones del usuario y deben ejecutarse secuencialmente con verificación entre cada una.

> [!TIP]
> **Buena noticia:** El historial Git está limpio. No se necesita BFG ni filter-repo. El `.gitignore` actual ya protege correctamente los archivos sensibles. La situación de seguridad es **aceptable** para desarrollo local.

---

## 10. Prompt Recomendado para FASE 4A

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4A — reforzar .gitignore y crear archivos .env.example.

REGLAS ESTRICTAS:
- NO toques .env ni frontend/.env.
- NO toques serviceAccountKey.json.
- NO revoques claves.
- NO ejecutes scripts.
- NO toques código funcional.
- NO hagas push.
- No imprimas secretos.

OBJETIVO:
1. Añadir al .gitignore:
   - **/serviceAccount*.json
   - **/*credentials*.json
   - **/*secret*.json
   - .env.local
   - .env.development

2. Crear .env.example:
   GEMINI_API_KEY="your-gemini-api-key-here"

3. Crear frontend/.env.example:
   VITE_FIREBASE_API_KEY="your-firebase-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="your-project-id"
   VITE_FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
   VITE_FIREBASE_APP_ID="your-app-id"
   VITE_FIREBASE_MEASUREMENT_ID="your-measurement-id"

4. Verificar git check-ignore para los 3 archivos sensibles.
5. Commit con mensaje: "chore: add env examples and reinforce gitignore"
6. git status.

ENTREGABLE:
Crear: docs/CLEANUP_PHASE_4A_GITIGNORE_ENV_EXAMPLES_REPORT.md
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido movido, borrado, ejecutado ni modificado. Las credenciales permanecen intactas. No se imprimieron valores secretos completos.
