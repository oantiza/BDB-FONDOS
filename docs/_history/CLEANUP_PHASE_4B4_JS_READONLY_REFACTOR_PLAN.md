# FASE 4B.4 — Plan de Refactor JS/CJS Solo Lectura Hardcoded

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.

---

## 1. Inventario Actualizado JS/CJS con serviceAccountKey.json

### Estado total de archivos JS/CJS

| Clasificación | Archivos |
|---|---|
| JS/CJS solo lectura, sin GAC (refactorizar ahora) | **7** |
| JS mutantes, sin GAC (refactorizar en FASE 4B.5) | **4** |
| JS mutantes, con GAC (ya compatibles, FASE 4B.5) | **7** |
| JS con GAC completo (ya compatibles, no tocar) | **2** |
| Legacy (ignorar) | **2** |
| **Total** | **22** |

---

## 2. Scripts JS/CJS SOLO LECTURA a Refactorizar (7)

### Archivo 1: `frontend/scripts/inspect_db.cjs`

**Patrón actual:**
```javascript
const serviceAccount = require("c:/Users/oanti/Documents/BDB-FONDOS_LOCAL/BDB-FONDOS/functions_python/serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
```
- ⚠️ Path absoluto hardcoded (a un directorio que ya no existe)
- Sin guard `admin.apps.length`
- Tipo: CJS

---

### Archivo 2: `frontend/scripts/inspect_db.js`

**Patrón actual:**
```javascript
const serviceAccount = require("c:/Users/oanti/Documents/BDB-FONDOS_LOCAL/BDB-FONDOS/functions_python/serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
```
- ⚠️ Path absoluto hardcoded (idéntico a .cjs)
- Sin guard `admin.apps.length`
- Tipo: JS

---

### Archivo 3: `functions_python/scripts/export_funds_v3.js`

**Patrón actual:**
```javascript
const serviceAccount = require('../../serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
```
- Path relativo (funciona desde su ubicación)
- Sin guard `admin.apps.length`
- Tipo: JS

---

### Archivo 4: `scripts/maintenance/analyze_sin_retrocesion.js`

**Patrón actual:**
```javascript
const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(SA_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
```
- ✅ Tiene guard `admin.apps.length`
- ❌ Sin GAC fallback — require falla si archivo no existe
- Tipo: JS

---

### Archivo 5: `scripts/maintenance/audit_derived_unknowns.js`

**Patrón actual:**
```javascript
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");
if (!admin.apps.length) {
    const serviceAccount = require(SERVICE_ACCOUNT_FILE);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
    });
}
```
- ✅ Tiene guard + require dentro del guard
- ❌ Sin GAC fallback
- Tipo: JS

---

### Archivo 6: `scripts/maintenance/exploreDB.js`

**Patrón actual:**
```javascript
const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
```
- Sin guard `admin.apps.length`
- Sin GAC fallback
- Tipo: JS

---

### Archivo 7: `scripts/maintenance/export_fondos_retrocesion.js`

**Patrón actual:**
```javascript
const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(SA_PATH)) { console.error(...); process.exit(1); }
const serviceAccount = require(SA_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
```
- ✅ Tiene guard `admin.apps.length` + existence check
- ❌ Sin GAC fallback
- Tipo: JS

---

## 3. Scripts JS Mutantes EXCLUIDOS (para FASE 4B.5)

### Sin GAC (4):
| Archivo | Escrituras |
|---|---|
| `scripts/maintenance/purge_legacy_root_fields.js` | `.update()`, `.delete()`, bulkWriter |
| `scripts/maintenance/repair_costs_funds_v3.js` | `.update()`, `.delete()`, bulkWriter |
| `scripts/migrate_regions_to_canonical.js` | `.update()`, `.delete()`, bulkWriter |
| `scripts/migrate_sectors_to_canonical.js` | `.update()`, `.delete()`, bulkWriter |

### Con guard pero sin GAC (7):
| Archivo | Escrituras |
|---|---|
| `scripts/maintenance/cargador_lotes.js` | `.set()`, `.update()`, `.delete()`, `.add()`, bulk |
| `scripts/maintenance/cargador_lotes_v_2.js` | `.set()`, `.update()`, `.delete()`, `.add()`, bulk |
| `scripts/maintenance/fondos_no_en_csv.js` | `.add()` |
| `scripts/maintenance/import_retrocesiones.js` | `.update()`, batch |
| `scripts/maintenance/recalculate_derived_fields.js` | `.set()`, `.add()`, bulk |
| `scripts/maintenance/refresh_derived_data.js` | `.update()`, batch |
| `scripts/maintenance/set_retro_zero.js` | `.update()`, bulk |
| `scripts/maintenance/update_3_retros.js` | `.update()` |

### Legacy (2 — no tocar):
| Archivo | Nota |
|---|---|
| `data/work/legacy_roots/.../cargador_lotes.js` | Backup antiguo |
| `data/work/legacy_roots/.../cargador_lotes_CORREGIDO.js` | Backup antiguo |

### Ya con GAC completo (2 — no tocar):
| Archivo | Estado |
|---|---|
| `scripts/maintenance/audit_funds_v3.js` | ✅ Ya usa `process.env.GOOGLE_APPLICATION_CREDENTIALS` |
| `scripts/maintenance/update_retrocessions_funds_v3.js` | ✅ Ya usa GAC |

---

## 4. Patrón Destino Estándar JS

```javascript
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    } else {
        const saPath = path.join(__dirname, "..", "serviceAccountKey.json");
        if (fs.existsSync(saPath)) {
            admin.initializeApp({
                credential: admin.credential.cert(require(saPath)),
            });
        } else {
            admin.initializeApp();
        }
    }
}

const db = admin.firestore();
```

**Prioridad:**
1. `GOOGLE_APPLICATION_CREDENTIALS` → `applicationDefault()`
2. Path relativo local → `cert(require(path))`
3. Sin credenciales → `initializeApp()` (ADC / Cloud env)

---

## 5. Cambio Mínimo por Archivo

### Archivos 1–2: `inspect_db.cjs` / `inspect_db.js`
- Eliminar path absoluto hardcoded.
- Añadir GAC check + guard `admin.apps.length`.
- Path relativo: `path.join(__dirname, "..", "..", "serviceAccountKey.json")`

### Archivo 3: `export_funds_v3.js`
- Añadir GAC check + guard.
- Mantener path relativo `../../serviceAccountKey.json`.

### Archivos 4, 7: `analyze_sin_retrocesion.js`, `export_fondos_retrocesion.js`
- Ya tienen guard. Solo añadir GAC branch antes del require.

### Archivo 5: `audit_derived_unknowns.js`
- Ya tiene guard + require dentro. Solo añadir GAC branch.

### Archivo 6: `exploreDB.js`
- Añadir guard `admin.apps.length` + GAC check.

---

## 6. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Error de sintaxis JS | Baja | Bajo | `node --check` |
| `require()` falla si archivo no existe | Media | Bajo | Mover `require` dentro del else-branch |
| Script deja de funcionar | Baja | Bajo | Son solo lectura |

---

## 7. Pruebas Seguras

```powershell
# Verificación sintáctica (sin ejecutar):
node --check <archivo.js>

# Para .cjs:
node --check <archivo.cjs>
```

**NO ejecutar** los scripts — solo verificación sintáctica.

---

## 8. Prompt Recomendado para Ejecutar FASE 4B.4

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.4 — refactorizar 7 scripts JS/CJS solo lectura.

REGLAS ESTRICTAS:
- Edita SOLO la inicialización Firebase Admin.
- NO cambies lógica funcional.
- NO ejecutes scripts contra Firebase.
- NO toques credenciales.
- NO hagas push.

OBJETIVO:
Refactorizar 7 scripts:
1. frontend/scripts/inspect_db.cjs
2. frontend/scripts/inspect_db.js
3. functions_python/scripts/export_funds_v3.js
4. scripts/maintenance/analyze_sin_retrocesion.js
5. scripts/maintenance/audit_derived_unknowns.js
6. scripts/maintenance/exploreDB.js
7. scripts/maintenance/export_fondos_retrocesion.js

Patrón destino:
  if (!admin.apps.length) {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
          admin.initializeApp({ credential: admin.credential.applicationDefault() });
      } else {
          const saPath = path.join(__dirname, ...);
          if (fs.existsSync(saPath)) {
              admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
          } else {
              admin.initializeApp();
          }
      }
  }

Seguir docs/CLEANUP_PHASE_4B4_JS_READONLY_REFACTOR_PLAN.md.

Verificación: node --check para cada uno.
Commit: "chore: support env-based Firebase init in JS readonly scripts (batch 2)"
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido editado, movido ni ejecutado. Solo análisis y documentación.
