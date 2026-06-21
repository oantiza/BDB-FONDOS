# FASE 4B.5B — Informe de Refactor: Scripts Mutantes con Dry-Run

**Fecha:** 2026-05-04
**Estado:** COMPLETADO — 19/19 archivos refactorizados.

---

## 1. Resumen Ejecutivo

| Métrica | Valor |
|---|---|
| **Archivos refactorizados** | **19** |
| Python | 12 |
| JS | 7 |
| py_compile exitosos | 12/12 ✅ |
| node --check exitosos | 7/7 ✅ |
| GAC presente en todos | 19/19 ✅ |
| Paths absolutos eliminados | 3/3 ✅ |
| Credenciales intactas | ✅ |
| Scripts ejecutados | 0 |
| Lógica de escritura modificada | 0 |

---

## 2. Archivos Refactorizados por Patrón

### Patrón A: `init_firebase()` con key_paths (8 Python)

| # | Archivo | Resultado |
|---|---|---|
| 1 | `functions_python/scripts/audit/sample_taxonomy_review_50.py` | ✅ py_compile OK |
| 2 | `functions_python/scripts/migration/populate_taxonomy_v2.py` | ✅ py_compile OK |
| 3 | `functions_python/scripts/migration/populate_taxonomy_v2_backup.py` | ✅ py_compile OK |
| 4 | `functions_python/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py` | ✅ py_compile OK |
| 5 | `functions_python/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py` | ✅ py_compile OK |
| 6 | `functions_python/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py` | ✅ py_compile OK |
| 7 | `scripts/maintenance/populate_taxonomy_v2.py` | ✅ py_compile OK |
| 8 | `scripts/populate_taxonomy_v2_FINAL.py` | ✅ py_compile OK |

**Cambio aplicado:** Insertar `os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")` como primera opción antes del loop `for kp in key_paths`.

### Patrón B: `_apps` + Certificate bare (2 Python)

| # | Archivo | Resultado |
|---|---|---|
| 9 | `functions_python/scripts/fixes/clean_csv_categories.py` | ✅ py_compile OK |
| 10 | `functions_python/scripts/fixes/sync_categories_to_firestore.py` | ✅ py_compile OK |

**Cambio aplicado:** Insertar GAC check → `os.path.exists` guard → fallback.

### Patrón C: `_apps` + cred_path construido (2 Python)

| # | Archivo | Resultado |
|---|---|---|
| 11 | `scripts/maintenance/validate_nav_pipeline.py` | ✅ py_compile OK |
| 12 | `scripts/maintenance/verify_history.py` | ✅ py_compile OK |

**Cambio aplicado:** Mover `cred_path` dentro del `else` block, priorizar GAC.

### Patrón D: JS con `apps.length` guard (4 JS)

| # | Archivo | Resultado |
|---|---|---|
| 13 | `scripts/maintenance/import_retrocesiones.js` | ✅ node --check OK |
| 14 | `scripts/maintenance/recalculate_derived_fields.js` | ✅ node --check OK |
| 15 | `scripts/maintenance/refresh_derived_data.js` | ✅ node --check OK |
| 16 | `scripts/maintenance/set_retro_zero.js` | ✅ node --check OK |

**Cambio aplicado:** Insertar `process.env.GOOGLE_APPLICATION_CREDENTIALS` → `applicationDefault()` antes del fallback a `cert(require(...))`.

**Correcciones adicionales:**
- `recalculate_derived_fields.js`: Eliminado `process.exit(1)` si falta SAK.
- `refresh_derived_data.js`: Eliminado `projectId: "bdb-fondos"` hardcoded.
- `set_retro_zero.js`: Añadido `require("fs")` para `existsSync`.

### Patrón E: JS con absolute path (3 JS)

| # | Archivo | Path eliminado | Resultado |
|---|---|---|---|
| 17 | `scripts/maintenance/repair_costs_funds_v3.js` | `C:\\Users\\...\\ROBOT_CARGA\\` | ✅ node --check OK |
| 18 | `scripts/migrate_regions_to_canonical.js` | `C:\\Users\\...\\ROBOT_CARGA\\` | ✅ node --check OK |
| 19 | `scripts/migrate_sectors_to_canonical.js` | `C:\\Users\\...\\ROBOT_CARGA\\` | ✅ node --check OK |

**Cambio aplicado:** Reemplazar path absoluto completo con patrón estándar GAC → relative path → fallback. Eliminado `process.exit(1)` si falta SAK.

---

## 3. Verificaciones Realizadas

### 3.1 Compilación
```
Python (py_compile):  12/12 OK ✅
JS (node --check):     7/7 OK ✅
```

### 3.2 Soporte GAC
```
GOOGLE_APPLICATION_CREDENTIALS presente: 19/19 ✅
```

### 3.3 Paths absolutos
```
ROBOT_CARGA en archivos refactorizados: 0/19 ✅
```

### 3.4 Credenciales intactas
```
serviceAccountKey.json: EXISTS ✅
.env:                   EXISTS ✅
frontend/.env:          EXISTS ✅
```

### 3.5 No modificación de lógica de escritura
- NO se añadieron nuevas operaciones `.set()`, `.update()`, `.delete()`, `.add()`, `batch.commit`, `bulkWriter`.
- NO se modificaron flags `dry-run`, `--apply`, `--execute`.
- NO se cambiaron colecciones target.
- NO se ejecutó ningún script.
- NO se conectó a Firestore.

---

## 4. Estado de git

```
19 archivos con estado M (modified):
  functions_python/scripts/audit/sample_taxonomy_review_50.py
  functions_python/scripts/fixes/clean_csv_categories.py
  functions_python/scripts/fixes/sync_categories_to_firestore.py
  functions_python/scripts/migration/populate_taxonomy_v2.py
  functions_python/scripts/migration/populate_taxonomy_v2_backup.py
  functions_python/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py
  functions_python/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py
  functions_python/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py
  scripts/maintenance/validate_nav_pipeline.py
  scripts/maintenance/verify_history.py
  scripts/maintenance/populate_taxonomy_v2.py
  scripts/populate_taxonomy_v2_FINAL.py
  scripts/maintenance/import_retrocesiones.js
  scripts/maintenance/recalculate_derived_fields.js
  scripts/maintenance/refresh_derived_data.js
  scripts/maintenance/repair_costs_funds_v3.js
  scripts/maintenance/set_retro_zero.js
  scripts/migrate_regions_to_canonical.js
  scripts/migrate_sectors_to_canonical.js

1 archivo nuevo (plan):
  docs/CLEANUP_PHASE_4B5B_MUTANTS_WITH_DRYRUN_PLAN.md

NO commiteado todavía.
```

---

## 5. Progreso General FASE 4B

| Sublote | Archivos | Estado | Commit |
|---|---|---|---|
| 4B.3 Python readonly | 7 | ✅ DONE | `64bb990` |
| 4B.4 JS/CJS readonly | 7 | ✅ DONE | `42f16ed` |
| 4B.5A Python readonly residual | 7 | ✅ DONE | `e2f687a` |
| **4B.5B Mutantes con dry-run** | **19** | **✅ DONE** | **Pendiente commit** |
| 4B.5C/D Mutantes sin dry-run | ~16 | ⏳ Pendiente plan | — |
| **Total completado** | **40/~56** | | |

---

## 6. Próxima Fase Recomendada

**Opción 1:** Commit de FASE 4B.5B (20 archivos: 19 scripts + 1 plan + 1 report).

**Opción 2:** Preparar plan FASE 4B.5C para scripts mutantes sin dry-run.

> **Recomendación:** Commit primero, luego plan 4B.5C.
