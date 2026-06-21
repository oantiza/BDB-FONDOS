# FASE 4B.5C.4a — Plan Ultra-Conservador: 2 Scripts Alto Riesgo Purge/Delete

**Fecha:** 2026-05-04  
**Estado:** PLAN — solo análisis, sin modificaciones.  
**Contexto:** 55 scripts refactorizados. Último commit: `23099da`.

---

## 1. Lista Exacta de 2 Scripts

| # | Archivo | Lenguaje |
|---|---|---|
| 1 | `scripts/maintenance/purge_legacy_root_fields.js` | JS |
| 2 | `scripts/remediate_orphans.py` | Python |

---

## 2. Análisis Detallado por Script

### Script 1: `purge_legacy_root_fields.js`

| Campo | Valor |
|---|---|
| **Ruta** | `scripts/maintenance/purge_legacy_root_fields.js` |
| **Lenguaje** | JavaScript (62 líneas) |
| **Header SAFE_MODE** | `REVIEW` |

#### Operaciones Peligrosas

| Línea | Operación | Detalle |
|---|---|---|
| L35 | `db.bulkWriter()` | Writer masivo sin límite de batch |
| L43 | `FieldValue.delete()` | Borra campo `asset_class` |
| L44 | `FieldValue.delete()` | Borra campo `std_type` |
| L45 | `FieldValue.delete()` | Borra campo `std_region` |
| L46 | `FieldValue.delete()` | Borra campo `primary_region` |
| L47 | `FieldValue.delete()` | Borra campo `category_morningstar` |
| L48 | `FieldValue.delete()` | Borra campo `sectors` |
| L51 | `writer.update(doc.ref, updates)` | Aplica deletes via bulkWriter |
| L56 | `writer.close()` | Commit de todos los deletes |

#### Colección y Scope

| Campo | Valor |
|---|---|
| **Colección** | `funds_v3` |
| **Scope** | **TODOS los documentos** — `db.collection("funds_v3").get()` |
| **Campos eliminados** | 6 campos root legacy por documento |
| **Dry-run** | ❌ NO |
| **Confirmación manual** | ❌ NO |
| **Whitelist/limit** | ❌ NO — procesa la colección completa |
| **Rollback** | ❌ NO — deletes irreversibles |
| **Log** | Sí — conteo final |

#### Riesgo

| Tipo | Nivel | Justificación |
|---|---|---|
| **Riesgo del script** | 🔴 **ALTO** | `FieldValue.delete()` masivo sobre TODOS los docs de funds_v3. Irreversible. Sin dry-run. Sin confirmación. |
| **Riesgo del refactor init** | 🟢 **BAJO** | Solo toca L16–L25, no modifica lógica de purge. |

#### Init Actual (L15–L27)
```javascript
const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");
if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
    console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
    process.exit(1);
}
const serviceAccount = require(SERVICE_ACCOUNT_FILE);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
});
const db = admin.firestore();
```

---

### Script 2: `remediate_orphans.py`

| Campo | Valor |
|---|---|
| **Ruta** | `scripts/remediate_orphans.py` |
| **Lenguaje** | Python (60 líneas) |
| **Header SAFE_MODE** | (sin header) |

#### Operaciones Peligrosas

| Línea | Operación | Detalle |
|---|---|---|
| L26 | `db.batch()` | Batch de escritura |
| L36 | `batch.delete(doc_ref)` | **Elimina documentos completos** (modo `--delete`) |
| L41 | `batch.update(doc_ref, {'disabled': True, ...})` | Deshabilitación (modo default) |
| L46 | `batch.commit()` | Commit del batch (cada 400 docs) |
| L51 | `batch.commit()` | Commit final |

#### Colección y Scope

| Campo | Valor |
|---|---|
| **Colección** | `funds_v3` |
| **Scope** | **25 ISINs hardcoded** (L16–L22) |
| **Operación default** | Disable (`disabled: True`) — no destructivo |
| **Operación `--delete`** | `batch.delete()` — **elimina documentos completos** |
| **Dry-run** | ❌ NO |
| **Confirmación manual** | Parcial — `--delete` flag requerido para eliminar |
| **Whitelist** | ✅ SÍ — 25 ISINs hardcoded |
| **Rollback** | ❌ NO — deletes irreversibles |
| **Log** | Sí — print por ISIN + conteo |

#### Riesgo

| Tipo | Nivel | Justificación |
|---|---|---|
| **Riesgo del script (default)** | 🟡 **MEDIO** | Solo deshabilitación (`disabled: True`). Reversible. |
| **Riesgo del script (`--delete`)** | 🔴 **ALTO** | `batch.delete()` elimina documentos completos. Irreversible. |
| **Riesgo del refactor init** | 🟢 **BAJO** | Solo toca L10–L14, no modifica lógica de remediación. |

#### Init Actual (L10–L14)
```python
cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()
```

---

## 3. Tabla Comparativa

| Campo | `purge_legacy_root_fields.js` | `remediate_orphans.py` |
|---|---|---|
| **Lenguaje** | JS | Python |
| **Operación destructiva** | `FieldValue.delete()` × 6 campos | `batch.delete()` documentos |
| **Colección** | funds_v3 | funds_v3 |
| **Scope** | TODOS los docs | 25 ISINs hardcoded |
| **Dry-run** | ❌ | ❌ |
| **Guard CLI** | ❌ | ✅ `--delete` flag |
| **Whitelist** | ❌ | ✅ 25 ISINs |
| **Reversible** | ❌ (campos borrados) | ❌ (docs borrados con --delete) |
| **Riesgo script** | 🔴 ALTO | 🔴 ALTO (--delete) / 🟡 MEDIO (default) |
| **Riesgo refactor init** | 🟢 BAJO | 🟢 BAJO |

---

## 4. Decisión: ¿Refactorizar Init Ahora?

### Recomendación: **SÍ, refactorizar SOLO la inicialización Firebase**

#### Justificación:

1. **El riesgo del refactor es ortogonal al riesgo del script.** Cambiar cómo se obtienen credenciales no altera la lógica de purge/delete.

2. **El refactor es mecánico e idéntico** a los 55 scripts ya refactorizados sin incidentes.

3. **No se ejecutará el script** — solo verificación sintáctica (`node --check` / `py_compile`).

4. **No se añadirá dry-run en esta fase** — eso es scope de una FASE 4C separada.

5. **El fallback a serviceAccountKey.json se mantiene** — no se rompe funcionalidad existente.

#### Contraindicaciones consideradas y descartadas:

| Objeción | Respuesta |
|---|---|
| "Es peligroso tocar scripts de purge" | No tocamos la lógica de purge, solo el bloque de init. |
| "Podría ejecutarse accidentalmente" | No ejecutamos scripts. Solo editamos + verificamos sintaxis. |
| "Mejor no tocar nada" | Dejar init hardcoded es deuda técnica. El refactor no aumenta el riesgo operativo. |

---

## 5. Política Operativa para Scripts Purge/Delete

> ⚠️ **POLÍTICA: Estos scripts NUNCA deben ejecutarse sin:**
> 1. Backup previo de la colección afectada.
> 2. Dry-run verificado (pendiente implementar en FASE 4C).
> 3. Aprobación explícita del operador.
> 4. Log de auditoría de campos/docs afectados.

Esta política es independiente del refactor de inicialización.

---

## 6. Alcance Exacto del Cambio

### ✅ SE CAMBIARÁ:
- Bloque de inicialización Firebase (solo).
- Soporte para `GOOGLE_APPLICATION_CREDENTIALS`.
- Fallback temporal a `serviceAccountKey.json`.
- Guard `apps.length` / `_apps` si falta.

### ❌ NO SE CAMBIARÁ:
- `FieldValue.delete()` (purge_legacy).
- `batch.delete()` (remediate_orphans).
- `batch.update()` / `batch.commit()`.
- `bulkWriter` / `writer.update` / `writer.close`.
- ISINs hardcoded.
- Flag `--delete`.
- Colecciones target.
- Scope de documentos.

---

## 7. Patrones de Refactor

### JS — `purge_legacy_root_fields.js` (Patrón D)

```javascript
// Inicializar Firebase Admin
if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const SERVICE_ACCOUNT_FILE = path.join(__dirname, "serviceAccountKey.json");
        if (fs.existsSync(SERVICE_ACCOUNT_FILE)) {
            const serviceAccount = require(SERVICE_ACCOUNT_FILE);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
            });
        } else {
            console.error(`❌ Falta ${SERVICE_ACCOUNT_FILE}`);
            process.exit(1);
        }
    }
}
const db = admin.firestore();
```

### Python — `remediate_orphans.py` (Patrón E)

```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    else:
        cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
db = firestore.client()
```

---

## 8. Verificaciones Seguras

| Verificación | Método |
|---|---|
| Sintaxis JS | `node --check purge_legacy_root_fields.js` |
| Compilación Python | `python -m py_compile remediate_orphans.py` |
| GAC presente | `grep GOOGLE_APPLICATION_CREDENTIALS` en ambos |
| FieldValue.delete intacto | `grep "FieldValue.delete" purge_legacy` — debe seguir en L43–L48 |
| batch.delete intacto | `grep "batch.delete" remediate_orphans` — debe seguir presente |
| bulkWriter intacto | `grep "bulkWriter" purge_legacy` — debe seguir presente |
| --delete flag intacto | `grep "\-\-delete" remediate_orphans` — debe seguir presente |
| ISINs intactos | `grep "ORPHAN_FUNDS" remediate_orphans` — debe seguir presente |
| Credenciales intactas | `Test-Path` de SAK, .env, frontend/.env |
| No ejecución | 0 scripts ejecutados |

---

## 9. Scripts Bloqueados (4B.5C.4b) — NO TOCAR

| Script | Razón del bloqueo |
|---|---|
| `functions_python/scripts/migration/migrate_reports.py` | Cross-project multi-app. Requiere diseño especial. |
| `scripts/maintenance/cargador_lotes.js` | Pipeline de producción. Infraestructura crítica. |
| `scripts/maintenance/cargador_lotes_v_2.js` | Pipeline de producción v2. Infraestructura crítica. |

> 🚫 Estos 3 scripts **no se tocarán** en FASE 4B. Se documentarán en 4B.5C.4b como "bloqueados permanentes hasta revisión formal".

---

## 10. Prompt Recomendado para Ejecución 4B.5C.4a

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.5C.4a — refactor 2 scripts alto riesgo para GAC.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 4B.5C.4a.
- Sigue docs/CLEANUP_PHASE_4B5C4A_HIGH_RISK_PURGE_DELETE_PLAN.md.
- NO toques 4B.5C.4b (bloqueados).
- NO cambies FieldValue.delete() en purge_legacy.
- NO cambies batch.delete() en remediate_orphans.
- NO cambies bulkWriter / writer.update / writer.close.
- NO cambies ISINs hardcoded.
- NO cambies flag --delete.
- NO cambies colecciones.
- NO añadas dry-run en esta fase.
- NO ejecutes scripts funcionales.
- NO conectes a Firestore.
- NO muevas serviceAccountKey.json.
- NO borres serviceAccountKey.json.
- NO edites .env.
- NO edites frontend/.env.
- NO hagas push.
- No imprimas secretos.

OBJETIVO:
Refactorizar SOLO estos 2 archivos:
1. scripts/maintenance/purge_legacy_root_fields.js
2. scripts/remediate_orphans.py

Patrón: GAC-first → fallback local → default (o exit).
Verificar: node --check + py_compile + grep delete/purge intactos.
Crear report en docs/CLEANUP_PHASE_4B5C4A_HIGH_RISK_PURGE_DELETE_REFACTOR_REPORT.md.
```

---

## 11. Confirmaciones

- ✅ No se modificó ningún archivo de código.
- ✅ No se ejecutó ningún script.
- ✅ No se hizo commit ni push.
- ✅ No se tocaron credenciales.
- ✅ Solo análisis y documentación.
