# FASE 3B.6 — Eliminación de Duplicados Raíz en functions_python/scripts/

**Fecha de ejecución:** 2026-05-04T08:53 (CET)
**Ejecutado por:** Claude Opus 4.6 en Antigravity IDE
**Plan de referencia:** `docs/CLEANUP_PHASE_3B6_FP_ROOT_DUPLICATES_PLAN.md`

---

## 1. Scripts Raíz Eliminados (27)

| # | Script eliminado |
|---|---|
| 1 | `functions_python/scripts/analyze_history_anomalies.py` |
| 2 | `functions_python/scripts/audit_fund_data.py` |
| 3 | `functions_python/scripts/audit_taxonomy_v2.py` |
| 4 | `functions_python/scripts/check_reports.py` |
| 5 | `functions_python/scripts/sample_taxonomy_review_50.py` |
| 6 | `functions_python/scripts/scoring_comparison.py` |
| 7 | `functions_python/scripts/check_and_import_retrocesion.py` |
| 8 | `functions_python/scripts/migrate_reports.py` |
| 9 | `functions_python/scripts/cleanup_dummy_reports.py` |
| 10 | `functions_python/scripts/fix_anomalies.py` |
| 11 | `functions_python/scripts/fix_data_anomalies.py` |
| 12 | `functions_python/scripts/trim_last_anomaly.py` |
| 13 | `functions_python/scripts/debug_fondibas.py` |
| 14 | `functions_python/scripts/debug_reports.py` |
| 15 | `functions_python/scripts/find_fund_by_isin.py` |
| 16 | `functions_python/scripts/inspect_anomaly_dates.py` |
| 17 | `functions_python/scripts/inspect_categories.py` |
| 18 | `functions_python/scripts/inspect_fund_data.py` |
| 19 | `functions_python/scripts/inspect_ter.py` |
| 20 | `functions_python/scripts/generate_benchmarks.py` |
| 21 | `functions_python/scripts/insert_dummy_reports.py` |
| 22 | `functions_python/scripts/insert_report_function.py` |
| 23 | `functions_python/scripts/insert_user_report.py` |
| 24 | `functions_python/scripts/recalc_metrics_batch.py` |
| 25 | `functions_python/scripts/test_gemini_models.py` |
| 26 | `functions_python/scripts/test_optimizer.py` |
| 27 | `functions_python/scripts/test_smart_portfolio.py` |

## 2. Equivalentes en Subdirectorios Conservados

✅ **27/27** versiones en subdirectorios verificadas presentes:
- `audit/` (6), `migration/` (2), `fixes/` (4), `debug/` (7), `reports/` (4), `tests/` (3), `sandbox/` (1 — `recalc_metrics_batch` en reports)

## 3. Intocables Verificados

✅ **16/16** archivos intocables de raíz presentes:

| Archivo | Estado |
|---|---|
| `recalc_metrics_single.py` | ✅ **NO eliminado** (bloqueante por cross-import) |
| `test_research.py` | ✅ **NO eliminado** (pendiente de verificación) |
| `assess_funds_eligibility_bdb.py` | ✅ |
| `audit_funds_v3.py` | ✅ |
| `audit_funds_v3_bdb.py` | ✅ |
| `build_optimizer_universe_bdb.py` | ✅ |
| `e2e_smoke_test.py` | ✅ |
| `export_funds_to_csv.py` | ✅ |
| `infer_region_primary_bdb.py` | ✅ |
| `repair_funds_v3_bdb.py` | ✅ |
| `update_risk_profiles_firestore.py` | ✅ |
| `script_manifest.json` | ✅ |
| `README.md` | ✅ |
| `subcategory_sectors_mapping.csv` | ✅ |
| `subcategory_tokens_mapping.csv` | ✅ |
| `export_funds_v3.js` | ✅ |

## 4. Estado del Manifest

| Métrica | Valor |
|---|---|
| JSON válido | ✅ |
| Total entradas | 34 |
| ACTIVE | 34 |
| Huérfanas | 0 |

## 5. Verificaciones Globales

| Verificación | Estado |
|---|---|
| `frontend/src/` intacto | ✅ |
| `functions_python/api/` intacto | ✅ |
| `functions_python/services/` intacto | ✅ |
| `serviceAccountKey.json` presente | ✅ |
| `.env` y `frontend/.env` presentes | ✅ |
| `firebase.json` presente | ✅ |

## 6. Confirmación de Integridad

- ✅ No se ejecutó ningún script.
- ✅ No se tocó código funcional.
- ✅ No se modificaron credenciales.
- ✅ No se tocó `script_manifest.json`.
- ✅ No se tocó `README.md`.
- ✅ `recalc_metrics_single.py` conservado (cross-import).
- ✅ `test_research.py` conservado (pendiente verificación).

## 7. Resumen Acumulado FASE 3 Completa

| Subfase | Acción | Archivos |
|---|---|---|
| 3B.1 | Externalizar `scripts/archive/` | 55 movidos |
| 3B.2 | Limpiar manifest (huérfanos + pending) | 11 entradas |
| 3B.3 | Externalizar `fp/scripts/archive/` | 7 movidos + 7 entradas |
| 3B.4 | Eliminar duplicados SHA256 exactos | 6 eliminados |
| 3B.5 | Eliminar duplicados header-only scripts/ | 17 eliminados + 2 pkg.json |
| **3B.6** | **Eliminar duplicados raíz fp/scripts/** | **27 eliminados** |
| **Total FASE 3** | | **112 archivos + 18 entradas manifest** |

## 8. Próxima Fase Recomendada (NO ejecutada)

**FASE 3B.7 (opcional):** Tareas de cierre pendientes:

1. **Refactorizar cross-import:** Cambiar `from recalc_metrics_single import recalculate_single` en `reports/recalc_metrics_batch.py` a un import relativo, y luego eliminar `recalc_metrics_single.py` de raíz.
2. **Verificar `test_research.py`:** Decidir si la versión raíz o `tests/test_research.py` es la correcta.
3. **Actualizar `fp/scripts/README.md`:** Reflejar la nueva estructura sin scripts raíz duplicados.
4. **Commit de consolidación:** Hacer un commit único con todos los cambios de FASE 3.
