# FASE 4B.5C.3 — Informe de Refactor: 5 Mutantes Medio Riesgo

**Fecha:** 2026-05-04  
**Estado:** COMPLETADO — 5/5 archivos refactorizados.

---

## 1. Resumen Ejecutivo

| Métrica | Valor |
|---|---|
| **Archivos refactorizados** | **5** (todos Python) |
| py_compile exitosos | 5/5 ✅ |
| GAC presente en todos | 5/5 ✅ |
| Lógica de escritura intacta | 5/5 ✅ |
| EODHD API key intacta | ✅ |
| Credenciales intactas | ✅ |
| Scripts ejecutados | 0 |

---

## 2. Archivos Refactorizados

| # | Archivo | Escritura | Colección | Patrón | Resultado |
|---|---|---|---|---|---|
| 1 | `functions_python/scripts/fixes/clean_classification_v3.py` | `.update()` masivo | funds_v3 | C — _apps + GAC | ✅ py_compile OK |
| 2 | `functions_python/scripts/reports/generate_benchmarks.py` | `batch.set` + `commit` | synthetic_benchmarks | B — get_app + GAC | ✅ py_compile OK |
| 3 | `functions_python/scripts/migration/check_and_import_retrocesion.py` | `.set(merge=True)` | funds_v3 | C — _apps + GAC | ✅ py_compile OK |
| 4 | `scripts/maintenance/fetch_missing_history.py` | `.set()` + `.update()` | historico_vl_v2 + funds_v3 | E — module-level + GAC | ✅ py_compile OK |
| 5 | `scripts/maintenance/heal_historical_gaps.py` | `batch.update` + `commit` | historico_vl_v2 + funds_v3 | C — _apps + GAC | ✅ py_compile OK |

---

## 3. Cambios Aplicados por Script

### Script 1: `clean_classification_v3.py`
- Reemplazado `FileNotFoundError` con patrón GAC → KEY_PATH fallback → default.
- **Lógica intacta:** `doc.reference.update(updates)` sin cambios.

### Script 2: `generate_benchmarks.py`
- Insertado GAC check como primera opción en `except ValueError` de `get_db()`.
- **Lógica intacta:** `batch.set(doc_ref, doc_data)` + `batch.commit()` sin cambios.

### Script 3: `check_and_import_retrocesion.py`
- Insertado GAC check en module-level init antes de `Certificate(KEY_PATH)`.
- **Lógica intacta:** `doc_ref.set({"manual": ...}, merge=True)` sin cambios.
- **Flags intactos:** `--import`, `--force`, `--isins` sin cambios.

### Script 4: `fetch_missing_history.py`
- Envuelto init en `_apps` guard + GAC check. `sa_path` movido dentro del else.
- **Lógica intacta:** `.set()` en historico_vl_v2 + `.update()` en funds_v3 sin cambios.
- **EODHD API key intacta:** `EODHD_API_KEY = "6943decfb2bb14.96572592"` sin cambios.

### Script 5: `heal_historical_gaps.py`
- Insertado GAC check en `init_firestore()` antes de `cred_path` fallback.
- **Lógica intacta:** `batch.update(hist_ref, ...)` + `batch.commit()` sin cambios.
- **Concurrency intacta:** `ThreadPoolExecutor(max_workers=15)` sin cambios.

---

## 4. Verificaciones

| Check | Resultado |
|---|---|
| `py_compile` (5 Python) | 5/5 ✅ |
| GAC en todos | 5/5 ✅ |
| Write logic intacta | 5/5 ✅ |
| EODHD API key intacta | ✅ |
| Batch size / concurrency intactos | ✅ |
| CLI flags intactos | ✅ |
| `serviceAccountKey.json` intacto | ✅ |
| `.env` intacto | ✅ |
| `frontend/.env` intacto | ✅ |
| Scripts ejecutados | 0 |
| Conexiones Firestore | 0 |

---

## 5. Estado de git

```
5 archivos modificados (M):
  functions_python/scripts/fixes/clean_classification_v3.py
  functions_python/scripts/reports/generate_benchmarks.py
  functions_python/scripts/migration/check_and_import_retrocesion.py
  scripts/maintenance/fetch_missing_history.py
  scripts/maintenance/heal_historical_gaps.py

1 archivo nuevo (plan):
  docs/CLEANUP_PHASE_4B5C3_MEDIUM_RISK_MUTANTS_PLAN.md

NO commiteado todavía.
```

---

## 6. Progreso Acumulado FASE 4B

| Sublote | Scripts | Estado | Commit |
|---|---|---|---|
| 4B.3 Python readonly | 7 | ✅ | `64bb990` |
| 4B.4 JS/CJS readonly | 7 | ✅ | `42f16ed` |
| 4B.5A Python readonly residual | 7 | ✅ | `e2f687a` |
| 4B.5B Mutantes con dry-run | 19 | ✅ | `0654592` |
| 4B.5C.1 Readonly/snapshots | 5 | ✅ | `9b0beee` |
| 4B.5C.2 Mutantes bajo riesgo | 5 | ✅ | `8f0f027` |
| **4B.5C.3 Mutantes medio riesgo** | **5** | **✅ DONE** | **Pendiente commit** |
| 4B.5C.4 Alto riesgo / bloqueados | 5 | ⏳ | — |
| **Total completado** | **55/~59** | | |

---

## 7. Próxima Fase Recomendada

**Opción 1:** Commit de FASE 4B.5C.3 (7 archivos: 5 scripts + 1 plan + 1 report).

**Opción 2:** Continuar con plan 4B.5C.4a (alto riesgo) antes de commit.

> **Recomendación:** Commit 4B.5C.3 primero, luego plan 4B.5C.4a.
