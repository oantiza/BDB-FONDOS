# FASE 4B.2 — Inventario Detallado de Scripts Hardcoded-Only con serviceAccountKey.json

**Fecha:** 2026-05-04
**Estado:** Inventario de lectura — Ningún cambio ejecutado.

---

## 1. Resumen Actualizado

| Clasificación | Cantidad |
|---|---|
| **Total archivos con referencia SAK** | **67** |
| Compatible/Fallback (no requiere cambio) | 27 |
| Hardcoded-only (requiere refactor) | 40 |
| Producción (main.py, api/, services/) | 0 |

---

## 2. Scripts COMPATIBLES con GOOGLE_APPLICATION_CREDENTIALS (27)

Estos ya tienen fallback a `initialize_app()` o usan `GOOGLE_APPLICATION_CREDENTIALS`. **No requieren cambios.**

| # | Archivo | Lang | Mutaciones | Mecanismo |
|---|---|---|---|---|
| 1 | `fp/scripts/audit/analyze_history_anomalies.py` | PY | ❌ | `initialize_app()` fallback |
| 2 | `fp/scripts/audit/audit_fund_data.py` | PY | ❌ | `get_app()` + fallback |
| 3 | `fp/scripts/audit/audit_taxonomy_v2.py` | PY | ❌ | `initialize_app()` fallback |
| 4 | `fp/scripts/audit/sample_taxonomy_review_50.py` | PY | ✅ | `initialize_app()` fallback |
| 5 | `fp/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py` | PY | ✅ | `initialize_app()` fallback |
| 6 | `fp/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py` | PY | ✅ | `initialize_app()` fallback |
| 7 | `fp/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py` | PY | ✅ | `initialize_app()` fallback |
| 8 | `fp/scripts/debug/debug_fondibas.py` | PY | ❌ | `get_app()` + fallback |
| 9 | `fp/scripts/debug/find_fund_by_isin.py` | PY | ❌ | `get_app()` + fallback |
| 10 | `fp/scripts/debug/inspect_anomaly_dates.py` | PY | ❌ | `get_app()` + fallback |
| 11 | `fp/scripts/debug/inspect_categories.py` | PY | ✅ | `get_app()` + fallback |
| 12 | `fp/scripts/fixes/fix_and_reparse_anomalies.py` | PY | ❌ | `initialize_app()` fallback |
| 13 | `fp/scripts/fixes/fix_data_anomalies.py` | PY | ✅ | `get_app()` + fallback |
| 14 | `fp/scripts/fixes/populate_derived_category.py` | PY | ✅ | `GAC` explícito |
| 15 | `fp/scripts/migration/populate_taxonomy_v2.py` | PY | ✅ | `initialize_app()` fallback |
| 16 | `fp/scripts/migration/populate_taxonomy_v2_backup.py` | PY | ✅ | `initialize_app()` fallback |
| 17 | `fp/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py` | PY | ✅ | `initialize_app()` fallback |
| 18 | `fp/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py` | PY | ✅ | `initialize_app()` fallback |
| 19 | `fp/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py` | PY | ✅ | `initialize_app()` fallback |
| 20 | `fp/scripts/reports/generate_benchmarks.py` | PY | ✅ | `get_app()` fallback |
| 21 | `fp/scripts/reports/recalc_metrics_single.py` | PY | ✅ | `get_app()` + fallback |
| 22 | `fp/scripts/tests/test_optimizer.py` | PY | ❌ | `GAC` explícito |
| 23 | `fp/scripts/e2e_smoke_test.py` | PY | ❌ | `GAC` explícito |
| 24 | `fp/scripts/update_risk_profiles_firestore.py` | PY | ✅ | `get_app()` + fallback |
| 25 | `scripts/maintenance/audit_funds_v3.js` | JS | ❌ | `GAC` fallback |
| 26 | `scripts/maintenance/populate_taxonomy_v2.py` | PY | ✅ | `initialize_app()` fallback |
| 27 | `scripts/populate_taxonomy_v2_FINAL.py` | PY | ✅ | `initialize_app()` fallback |

---

## 3. Scripts HARDCODED-ONLY — Inventario Completo (40)

### 3.1 Python Hardcoded — Solo Lectura (6)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 1 | `fp/scripts/fixes/check_sync_results.py` | FP fixes | BAJO | Refactorizar (Lote 1) |
| 2 | `fp/scripts/fixes/fix_anomalies.py` | FP fixes | BAJO | Refactorizar (Lote 1) |
| 3 | `fp/scripts/sandbox/analyze_db_categories.py` | FP sandbox | BAJO | Refactorizar (Lote 1) |
| 4 | `fp/scripts/sandbox/inspect_fund_debug.py` | FP sandbox | BAJO | Refactorizar (Lote 1) |
| 5 | `fp/scripts/export_funds_to_csv.py` | FP raíz | BAJO | Refactorizar (Lote 1) |
| 6 | `scripts/aggressive_audit.py` | Scripts raíz | BAJO | Refactorizar (Lote 1) |

### 3.2 Python Hardcoded — Escribe Datos (8)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 7 | `fp/scripts/fixes/clean_classification_v3.py` | FP fixes | ALTO | Refactorizar (Lote 3) |
| 8 | `fp/scripts/fixes/clean_csv_categories.py` | FP fixes | ALTO | Refactorizar (Lote 3) |
| 9 | `fp/scripts/fixes/sync_categories_to_firestore.py` | FP fixes | ALTO | Refactorizar (Lote 3) |
| 10 | `fp/scripts/fixes/trim_last_anomaly.py` | FP fixes | ALTO | Refactorizar (Lote 3) |
| 11 | `fp/scripts/migration/check_and_import_retrocesion.py` | FP migration | ALTO | Refactorizar (Lote 3) |
| 12 | `scripts/maintenance/fetch_missing_history.py` | Scripts maint | ALTO | Refactorizar (Lote 3) |
| 13 | `scripts/maintenance/heal_historical_gaps.py` | Scripts maint | ALTO | Refactorizar (Lote 3) |
| 14 | `scripts/remediate_orphans.py` | Scripts raíz | MEDIO | Refactorizar (Lote 3) |

### 3.3 Python Hardcoded — Otros (3)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 15 | `scripts/maintenance/check_history.py` | Scripts maint | BAJO | Refactorizar (Lote 1) |
| 16 | `scripts/maintenance/create_zip.py` | Scripts maint | BAJO | Refactorizar (Lote 1) |
| 17 | `scripts/repo/create_backup.py` | Scripts repo | BAJO | Refactorizar (Lote 1) |

### 3.4 JS Hardcoded — Solo Lectura (5)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 18 | `scripts/maintenance/analyze_sin_retrocesion.js` | Scripts maint | BAJO | Refactorizar (Lote 2) |
| 19 | `scripts/maintenance/audit_derived_unknowns.js` | Scripts maint | BAJO | Refactorizar (Lote 2) |
| 20 | `scripts/maintenance/exploreDB.js` | Scripts maint | BAJO | Refactorizar (Lote 2) |
| 21 | `scripts/maintenance/export_fondos_retrocesion.js` | Scripts maint | BAJO | Refactorizar (Lote 2) |
| 22 | `fp/scripts/export_funds_v3.js` | FP raíz | BAJO | Refactorizar (Lote 2) |

### 3.5 JS Hardcoded — Escribe Datos (13)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 23 | `scripts/maintenance/cargador_lotes.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 24 | `scripts/maintenance/cargador_lotes_v_2.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 25 | `scripts/maintenance/fondos_no_en_csv.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 26 | `scripts/maintenance/import_retrocesiones.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 27 | `scripts/maintenance/purge_legacy_root_fields.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 28 | `scripts/maintenance/recalculate_derived_fields.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 29 | `scripts/maintenance/refresh_derived_data.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 30 | `scripts/maintenance/repair_costs_funds_v3.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 31 | `scripts/maintenance/set_retro_zero.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 32 | `scripts/maintenance/update_3_retros.js` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 33 | `scripts/maintenance/validate_nav_pipeline.py` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 34 | `scripts/maintenance/verify_history.py` | Scripts maint | ALTO | Refactorizar (Lote 4) |
| 35 | `scripts/migrate_regions_to_canonical.js` | Scripts raíz | ALTO | Refactorizar (Lote 4) |
| 36 | `scripts/migrate_sectors_to_canonical.js` | Scripts raíz | ALTO | Refactorizar (Lote 4) |

### 3.6 Frontend Scripts (2)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 37 | `frontend/scripts/inspect_db.cjs` | Frontend | BAJO | Refactorizar (Lote 2) |
| 38 | `frontend/scripts/inspect_db.js` | Frontend | BAJO | Refactorizar (Lote 2) |

### 3.7 Legacy — Ignorar (2)

| # | Archivo | Categoría | Riesgo | Recomendación |
|---|---|---|---|---|
| 39 | `data/work/legacy_roots/.../cargador_lotes.js` | Legacy | N/A | Ignorar / Archivar |
| 40 | `data/work/legacy_roots/.../cargador_lotes_CORREGIDO.js` | Legacy | N/A | Ignorar / Archivar |

---

## 4. Tabla de Scripts Peligrosos (Escriben en Firestore)

> [!CAUTION]
> Estos scripts NO deben ejecutarse para verificar. Solo refactorizar con edición de texto.

| # | Archivo | Operación destructiva |
|---|---|---|
| 1 | `clean_classification_v3.py` | `.update()` clasificaciones |
| 2 | `clean_csv_categories.py` | `.update()` categorías |
| 3 | `sync_categories_to_firestore.py` | `.set()` categorías |
| 4 | `trim_last_anomaly.py` | `.update()` anomalías |
| 5 | `check_and_import_retrocesion.py` | `.set()` retrocesiones |
| 6 | `cargador_lotes.js` | `.set()` fondos completos |
| 7 | `cargador_lotes_v_2.js` | `.set()` fondos completos |
| 8 | `import_retrocesiones.js` | `.set()` retrocesiones |
| 9 | `purge_legacy_root_fields.js` | `.update()` + `.delete()` campos |
| 10 | `set_retro_zero.js` | `.update()` retrocesiones a 0 |
| 11 | `recalculate_derived_fields.js` | `.update()` campos derivados |
| 12 | `repair_costs_funds_v3.js` | `.update()` costes |
| 13 | `migrate_regions_to_canonical.js` | `.update()` regiones |
| 14 | `migrate_sectors_to_canonical.js` | `.update()` sectores |

---

## 5. Plan de Refactorización por Lotes

### Lote 1: Python solo lectura + utilidades (9 archivos) — PRIMERO
- Riesgo: BAJO
- Archivos: #1–6, #15–17
- Patrón: Sustituir `Certificate(path)` por fallback con `initialize_app()`
- Verificación: import-only (no ejecutar)

### Lote 2: JS solo lectura + frontend (7 archivos) — SEGUNDO
- Riesgo: BAJO
- Archivos: #18–22, #37–38
- Patrón: Añadir `process.env.GOOGLE_APPLICATION_CREDENTIALS ||` antes del path
- Verificación: `node -e "require('./script')"` (syntax check)

### Lote 3: Python que escribe datos (8 archivos) — TERCERO
- Riesgo: MEDIO
- Archivos: #7–14
- Patrón: Mismo que Lote 1
- Verificación: import-only, NO ejecutar

### Lote 4: JS que escribe datos (14 archivos) — CUARTO
- Riesgo: MEDIO
- Archivos: #23–36
- Patrón: Mismo que Lote 2
- Verificación: syntax check, NO ejecutar

### Legacy: Ignorar (2 archivos)
- Archivos: #39–40
- Acción: No refactorizar. Están en `data/work/legacy_roots/` y no se usan.

---

## 6. Patrón Estándar Futuro (NO implementar todavía)

### Python
```python
import firebase_admin
from firebase_admin import credentials, firestore
import os

# Inicialización centralizada
if not firebase_admin._apps:
    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key_path and os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred)
    elif os.path.exists("./serviceAccountKey.json"):
        cred = credentials.Certificate("./serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()

db = firestore.client()
```

### JavaScript
```javascript
const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(__dirname, "..", "serviceAccountKey.json");

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
    });
}

const db = admin.firestore();
```

---

## 7. Propuesta de Subfases Siguientes

| Subfase | Acción | Archivos | Riesgo |
|---|---|---|---|
| **4B.3** | Refactorizar Lote 1 (PY readonly) | 9 | BAJO |
| **4B.4** | Refactorizar Lote 2 (JS readonly + frontend) | 7 | BAJO |
| **4B.5** | Refactorizar Lote 3 (PY writes) | 8 | MEDIO |
| **4B.6** | Refactorizar Lote 4 (JS writes) | 14 | MEDIO |
| **4B.7** | Mover SAK fuera del repo | 1 | MEDIO |
| **4B.8** | Verificar scripts críticos | — | BAJO |

---

## 8. Prompt Recomendado para FASE 4B.3

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.3 — refactorizar Lote 1 (Python solo lectura).

REGLAS ESTRICTAS:
- Edita SOLO la inicialización Firebase.
- NO cambies lógica funcional.
- NO ejecutes scripts.
- NO toques credenciales.

OBJETIVO:
Refactorizar 9 scripts Python solo-lectura hardcoded para usar
patrón de fallback compatible con GOOGLE_APPLICATION_CREDENTIALS.

Archivos:
1. fp/scripts/fixes/check_sync_results.py
2. fp/scripts/fixes/fix_anomalies.py
3. fp/scripts/sandbox/analyze_db_categories.py
4. fp/scripts/sandbox/inspect_fund_debug.py
5. fp/scripts/export_funds_to_csv.py
6. scripts/aggressive_audit.py
7. scripts/maintenance/check_history.py
8. scripts/maintenance/create_zip.py
9. scripts/repo/create_backup.py

Patrón destino: GAC → archivo local → initialize_app()
Verificación: import-only de cada script.
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido movido, borrado, editado ni ejecutado. Las credenciales permanecen intactas. No se imprimieron secretos.
