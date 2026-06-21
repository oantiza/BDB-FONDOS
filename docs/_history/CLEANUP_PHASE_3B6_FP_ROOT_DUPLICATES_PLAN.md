# FASE 3B.6 — Plan de Eliminación de Duplicados Raíz en functions_python/scripts/

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.
**Referencia:** `docs/CLEANUP_PHASE_3A_VALIDATION_REPORT.md`

---

## 1. Inventario Completo de scripts raíz en `functions_python/scripts/`

### 1.1 Scripts con equivalente en subdirectorio (29 pares)

| # | Script raíz | Subdirectorio |
|---|---|---|
| 1 | `analyze_history_anomalies.py` | `audit/` |
| 2 | `audit_fund_data.py` | `audit/` |
| 3 | `audit_taxonomy_v2.py` | `audit/` |
| 4 | `check_reports.py` | `audit/` |
| 5 | `sample_taxonomy_review_50.py` | `audit/` |
| 6 | `scoring_comparison.py` | `audit/` |
| 7 | `check_and_import_retrocesion.py` | `migration/` |
| 8 | `migrate_reports.py` | `migration/` |
| 9 | `cleanup_dummy_reports.py` | `fixes/` |
| 10 | `fix_anomalies.py` | `fixes/` |
| 11 | `fix_data_anomalies.py` | `fixes/` |
| 12 | `trim_last_anomaly.py` | `fixes/` |
| 13 | `debug_fondibas.py` | `debug/` |
| 14 | `debug_reports.py` | `debug/` |
| 15 | `find_fund_by_isin.py` | `debug/` |
| 16 | `inspect_anomaly_dates.py` | `debug/` |
| 17 | `inspect_categories.py` | `debug/` |
| 18 | `inspect_fund_data.py` | `debug/` |
| 19 | `inspect_ter.py` | `debug/` |
| 20 | `generate_benchmarks.py` | `reports/` |
| 21 | `insert_dummy_reports.py` | `reports/` |
| 22 | `insert_report_function.py` | `reports/` |
| 23 | `insert_user_report.py` | `reports/` |
| 24 | `recalc_metrics_batch.py` | `reports/` |
| 25 | `recalc_metrics_single.py` | `reports/` |
| 26 | `test_gemini_models.py` | `tests/` |
| 27 | `test_optimizer.py` | `tests/` |
| 28 | `test_research.py` | `tests/` |
| 29 | `test_smart_portfolio.py` | `tests/` |

### 1.2 Scripts ÚNICOS en raíz (sin equivalente en subdirectorio — 8 archivos)

| Script | Tamaño | Notas |
|---|---|---|
| `assess_funds_eligibility_bdb.py` | 3,295 B | Único |
| `audit_funds_v3.py` | 29,805 B | Único |
| `audit_funds_v3_bdb.py` | 3,818 B | Único |
| `build_optimizer_universe_bdb.py` | 5,413 B | Único |
| `e2e_smoke_test.py` | 6,829 B | Único |
| `export_funds_to_csv.py` | 3,002 B | Único |
| `infer_region_primary_bdb.py` | 5,447 B | Único en FP (versión diferente en `scripts/`) |
| `repair_funds_v3_bdb.py` | 2,505 B | Único |
| `update_risk_profiles_firestore.py` | 2,330 B | Único |

### 1.3 Archivos no-script en raíz (intocables)

| Archivo | Tipo |
|---|---|
| `script_manifest.json` | Manifest |
| `README.md` | Documentación |
| `subcategory_sectors_mapping.csv` | Datos |
| `subcategory_tokens_mapping.csv` | Datos |
| `export_funds_v3.js` | Script JS único |

---

## 2. Clasificación de Diferencias (29 pares)

### Tipo A: Solo desplazamiento de línea por `import firebase_admin` (9 pares)
La versión raíz tiene `import firebase_admin` como primera línea; la versión subdirectorio lo absorbe en el header. El cuerpo funcional es **idéntico**.

| Script | Líneas extra | Línea única raíz |
|---|---|---|
| `check_reports.py` | +10 | `import firebase_admin` |
| `cleanup_dummy_reports.py` | +10 | `import firebase_admin` |
| `debug_fondibas.py` | +10 | `import firebase_admin` |
| `find_fund_by_isin.py` | +10 | `import firebase_admin` |
| `insert_dummy_reports.py` | +10 | `import firebase_admin` |
| `inspect_categories.py` | +10 | `import firebase_admin` |
| `inspect_fund_data.py` | +10 | `import firebase_admin` |
| `scoring_comparison.py` | +10 | `import firebase_admin` |
| `test_gemini_models.py` | +10 | `import firebase_admin` |

**Riesgo de eliminación:** NINGUNO.

### Tipo B: Header + `sys.path.append` diferente (10 pares)
La versión raíz usa `os.path.dirname(os.path.dirname(...))` (2 niveles). La versión subdirectorio usa 3 niveles o paths absolutos. Ambos resuelven al mismo directorio `functions_python/`. El resto del cuerpo es idéntico o difiere solo en emojis/encoding.

| Script | Líneas extra | Diferencias |
|---|---|---|
| `audit_fund_data.py` | +10 | `sys.path` 2→3 niveles |
| `inspect_anomaly_dates.py` | +10 | `sys.path` 2→3 niveles |
| `inspect_ter.py` | +10 | `sys.path` 2→3 niveles |
| `recalc_metrics_single.py` | +10 | `sys.path` 2→3 niveles |
| `fix_data_anomalies.py` | +10 | `sys.path` + emoji encoding |
| `recalc_metrics_batch.py` | +10 | `sys.path` + emoji encoding |
| `test_optimizer.py` | +10 | `sys.path` + emoji encoding |
| `test_smart_portfolio.py` | +10 | emoji encoding |
| `debug_reports.py` | +10 | emoji encoding |
| `generate_benchmarks.py` | +10 | emoji encoding |

**Riesgo de eliminación:** BAJO (subdirectorio tiene paths más robustos).

### Tipo C: Header + docstrings/comentarios mejorados (6 pares)
La versión subdirectorio tiene headers y docstrings ligeramente diferentes en contenido textual (español con encoding mejorado, comentarios de sección reorganizados).

| Script | Líneas extra | Diferencias |
|---|---|---|
| `audit_taxonomy_v2.py` | +10 | Docstring + sección headers + emoji |
| `check_and_import_retrocesion.py` | +10 | Docstring detallada + emoji |
| `insert_report_function.py` | +10 | Datos de ejemplo (texto español largo) |
| `insert_user_report.py` | +10 | Datos de ejemplo (texto español largo) |
| `migrate_reports.py` | +10 | emoji encoding |
| `test_research.py` | +10 | `sys.path` + `.env` path |

**Riesgo de eliminación:** BAJO.

### Tipo D: Header + encoding + comments + paths (3 pares)

| Script | Líneas extra | Diferencias |
|---|---|---|
| `analyze_history_anomalies.py` | +11 | Auth local section reorganizada |
| `sample_taxonomy_review_50.py` | +9 | Docstring + encoding español |
| `trim_last_anomaly.py` | +10 | Auth local + encoding |

**Riesgo de eliminación:** BAJO.

### Tipo E: Diferencias estructurales significativas (1 par)

| Script | Líneas extra | Diferencias |
|---|---|---|
| `fix_anomalies.py` | **+31** | Imports completamente reestructurados, paths absolutos con `FUNCTIONS_PYTHON_DIR`/`PROJECT_ROOT`, `sys.path.append` mejorado. Versión subdirectorio es **más robusta**. |

**Riesgo de eliminación:** NINGUNO (subdirectorio es mejor).

---

## 3. Referencias

### 3.1 Manifest
✅ **Ninguna** entrada del manifest apunta a raíz. Todas las 34 entradas ACTIVE apuntan a subdirectorios.

### 3.2 `functions_python/scripts/README.md`
Referencia los 29 scripts por nombre base (sin path), como tabla de inventario. Es documentación auto-generada del manifest. **No se rompe** al eliminar copias raíz.

### 3.3 `package.json` raíz y `scripts/package.json`
Ninguna referencia a scripts de `fp/scripts/`.

> [!CAUTION]
> ### 3.4 BLOQUEANTE: Cross-import descubierto
> ```python
> # En reports/recalc_metrics_batch.py (línea 18):
> from recalc_metrics_single import recalculate_single
> ```
> Este import **bare** resuelve via `sys.path` a `functions_python/scripts/recalc_metrics_single.py` (raíz). Si se elimina la copia raíz de `recalc_metrics_single.py`, el import de `recalc_metrics_batch.py` **se romperá**.
>
> **Solución:** NO eliminar `recalc_metrics_single.py` de raíz hasta que se refactorice el import en `reports/recalc_metrics_batch.py` a `from reports.recalc_metrics_single import recalculate_single` o equivalente.

---

## 4. Scripts Candidatos a Eliminar (27 de 29)

Todos los 29 pares excepto los 2 bloqueados:

| # | Script raíz a eliminar | Subdir conservado | Tipo diff |
|---|---|---|---|
| 1 | `analyze_history_anomalies.py` | `audit/` | D |
| 2 | `audit_fund_data.py` | `audit/` | B |
| 3 | `audit_taxonomy_v2.py` | `audit/` | C |
| 4 | `check_reports.py` | `audit/` | A |
| 5 | `sample_taxonomy_review_50.py` | `audit/` | D |
| 6 | `scoring_comparison.py` | `audit/` | A |
| 7 | `check_and_import_retrocesion.py` | `migration/` | C |
| 8 | `migrate_reports.py` | `migration/` | C |
| 9 | `cleanup_dummy_reports.py` | `fixes/` | A |
| 10 | `fix_anomalies.py` | `fixes/` | E |
| 11 | `fix_data_anomalies.py` | `fixes/` | B |
| 12 | `trim_last_anomaly.py` | `fixes/` | D |
| 13 | `debug_fondibas.py` | `debug/` | A |
| 14 | `debug_reports.py` | `debug/` | B |
| 15 | `find_fund_by_isin.py` | `debug/` | A |
| 16 | `inspect_anomaly_dates.py` | `debug/` | B |
| 17 | `inspect_categories.py` | `debug/` | A |
| 18 | `inspect_fund_data.py` | `debug/` | A |
| 19 | `inspect_ter.py` | `debug/` | B |
| 20 | `generate_benchmarks.py` | `reports/` | B |
| 21 | `insert_dummy_reports.py` | `reports/` | A |
| 22 | `insert_report_function.py` | `reports/` | C |
| 23 | `insert_user_report.py` | `reports/` | C |
| 24 | `recalc_metrics_batch.py` | `reports/` | B |
| 25 | `test_gemini_models.py` | `tests/` | A |
| 26 | `test_optimizer.py` | `tests/` | B |
| 27 | `test_smart_portfolio.py` | `tests/` | B |

## 5. Scripts que NO Deben Eliminarse

| Script | Razón |
|---|---|
| `recalc_metrics_single.py` | **BLOQUEANTE:** `reports/recalc_metrics_batch.py` lo importa via bare import |
| `test_research.py` | Tiene `sys.path` y `.env` path diferente — requiere verificación adicional |
| `assess_funds_eligibility_bdb.py` | Único — sin equivalente |
| `audit_funds_v3.py` | Único — sin equivalente |
| `audit_funds_v3_bdb.py` | Único — sin equivalente |
| `build_optimizer_universe_bdb.py` | Único — sin equivalente |
| `e2e_smoke_test.py` | Único — sin equivalente |
| `export_funds_to_csv.py` | Único — sin equivalente |
| `infer_region_primary_bdb.py` | Único en FP (lógica diferente a `scripts/`) |
| `repair_funds_v3_bdb.py` | Único — sin equivalente |
| `update_risk_profiles_firestore.py` | Único — sin equivalente |
| `script_manifest.json` | Manifest |
| `README.md` | Documentación |
| `subcategory_sectors_mapping.csv` | Datos |
| `subcategory_tokens_mapping.csv` | Datos |
| `export_funds_v3.js` | Script JS único |

---

## 6. Secuencia de Ejecución Segura

```
Paso 1: Verificar que los 27 pares tienen equivalente en subdirectorio.
Paso 2: Eliminar los 27 scripts raíz candidatos.
Paso 3: Verificar que los 27 subdirectorios están intactos.
Paso 4: Verificar que los 16 intocables siguen en raíz.
Paso 5: Verificar que script_manifest.json tiene 34 entradas válidas.
Paso 6: git status.
```

---

## 7. Prompt Recomendado para Ejecución

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 3B.6 — eliminar 27 duplicados raíz de functions_python/scripts/.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 3B.6.
- NO toques los 16 archivos INTOCABLES listados en sección 5 del plan.
- NO elimines recalc_metrics_single.py (bloqueante por cross-import).
- NO elimines test_research.py (requiere verificación adicional).
- NO toques script_manifest.json.
- NO toques functions_python/scripts/README.md.
- NO ejecutes ningún script.
- NO modifiques código funcional.
- NO toques credenciales.
- NO toques frontend/src/.
- NO toques functions_python/api/ ni functions_python/services/.
- No imprimas secretos.

OBJETIVO:
1. Eliminar los 27 scripts raíz listados en sección 4 del plan.
2. Verificar 27 versiones subdirectorio presentes.
3. Verificar 16 intocables presentes.
4. Verificar manifest válido con 34 entradas y 0 huérfanas.
5. git status.

ENTREGABLE:
Crear: docs/CLEANUP_PHASE_3B6_FP_ROOT_DUPLICATES_REMOVAL_REPORT.md
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido movido, borrado, ejecutado ni modificado durante esta planificación. El repositorio permanece en su estado post-FASE 3B.5.
