# FASE 3B.5 — Eliminación de Duplicados Header-Only

**Fecha de ejecución:** 2026-05-04T08:45 (CET)
**Ejecutado por:** Claude Opus 4.6 en Antigravity IDE
**Plan de referencia:** `docs/CLEANUP_PHASE_3B5_HEADER_ONLY_DUPLICATES_PLAN.md`

---

## 1. Cambios en package.json

### 1.1 `package.json` (raíz)
```diff
- "main": "audit_derived_unknowns.js",
+ "main": "scripts/maintenance/audit_derived_unknowns.js",
```
✅ JSON válido post-edición.

### 1.2 `scripts/package.json`
```diff
- "main": "update_retrocessions_funds_v3.js",
+ "main": "maintenance/update_retrocessions_funds_v3.js",
```
✅ JSON válido post-edición.

## 2. Scripts Raíz Eliminados (17)

| # | Script eliminado |
|---|---|
| 1 | `scripts/add_manual_fund.js` |
| 2 | `scripts/audit_derived_unknowns.js` |
| 3 | `scripts/calculate_manual_metrics.js` |
| 4 | `scripts/copy_fund_data.js` |
| 5 | `scripts/generate_change_report.py` |
| 6 | `scripts/generate_extremos.py` |
| 7 | `scripts/get_current_risk_free_rate.js` |
| 8 | `scripts/get_fund_template.js` |
| 9 | `scripts/import_history_manual.js` |
| 10 | `scripts/purge_legacy_root_fields.js` |
| 11 | `scripts/recalculate_derived_fields.js` |
| 12 | `scripts/refresh_derived_data.js` |
| 13 | `scripts/restore_name.js` |
| 14 | `scripts/search_isin.py` |
| 15 | `scripts/update_3_retros.js` |
| 16 | `scripts/update_retrocessions_funds_v3.js` |
| 17 | `scripts/update_years_span_from_extremos.py` |

## 3. Versiones Maintenance Conservadas

✅ **17/17** versiones en `scripts/maintenance/` presentes y verificadas.

## 4. Archivos Intocables Verificados

✅ **16/16** archivos intocables de `scripts/` raíz presentes:
- `infer_region_primary_bdb.py`, `populate_taxonomy_v2_FINAL.py`, `backfill_asset_class_aggressive_v1.js`, `backfill_asset_class_fill_only_v1.js`, `apply_manual_overrides.js`, `migrate_regions_to_canonical.js`, `migrate_sectors_to_canonical.js`, `aggressive_audit.py`, `dedupe_retro_excel.js`, `remediate_orphans.py`, `seed_emulator_data.py`, `convert_font.py`, `create_fonts_ts.py`, `validate_manual_overrides.js`, `package.json`, `package-lock.json`.

## 5. Verificaciones Adicionales

| Verificación | Estado |
|---|---|
| `README.md` no modificado | ✅ |
| `script_manifest.json` no modificado | ✅ |
| `serviceAccountKey.json` presente | ✅ |
| `.env` y `frontend/.env` presentes | ✅ |
| `frontend/src/` intacto | ✅ |
| `functions_python/api/` intacto | ✅ |
| `functions_python/services/` intacto | ✅ |
| `firebase.json` presente | ✅ |
| `firestore.rules` presente | ✅ |

## 6. Git Status

- `M package.json` — actualizado main
- `M scripts/package.json` — actualizado main
- `D scripts/*.js|*.py` — 17 scripts header-only eliminados + eliminaciones previas de fases anteriores

## 7. Confirmación de Integridad

- ✅ No se ejecutó ningún script.
- ✅ No se tocó código funcional.
- ✅ No se modificaron credenciales.
- ✅ No se tocó `README.md` ni `script_manifest.json`.
- ✅ No se tocó `functions_python/scripts/`.

## 8. Resumen Acumulado FASE 3

| Subfase | Acción | Archivos afectados |
|---|---|---|
| 3B.1 | Externalizar `scripts/archive/` | 55 movidos |
| 3B.2 | Limpiar manifest (huérfanos + pending) | 11 entradas eliminadas |
| 3B.3 | Externalizar `fp/scripts/archive/` | 7 movidos + 7 entradas eliminadas |
| 3B.4 | Eliminar duplicados SHA256 exactos | 6 eliminados |
| **3B.5** | **Eliminar duplicados header-only** | **17 eliminados + 2 package.json actualizados** |
| **Total** | | **85 archivos limpiados** |

## 9. Próxima Fase Recomendada (NO ejecutada)

**FASE 3B.6:** Limpieza de duplicados raíz en `functions_python/scripts/`.

FASE 3A validó que hay ~29 scripts raíz en `fp/scripts/` que son duplicados header+import de sus versiones en subdirectorios categorizados. La diferencia típica es:
- 10 líneas de header metadata
- 1 línea `import firebase_admin` reubicada

Todos los paths del manifest ya apuntan a los subdirectorios, por lo que eliminar las copias raíz no rompe el manifest.
