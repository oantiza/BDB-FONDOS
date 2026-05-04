# FASE 3B.1 — Externalización de scripts/archive/

**Fecha de ejecución:** 2026-05-04T08:24 (CET)
**Ejecutado por:** Claude Opus 4.6 en Antigravity IDE
**Plan de referencia:** `docs/CLEANUP_PHASE_3A_VALIDATION_REPORT.md`

---

## 1. Archivos Movidos

**55 archivos** movidos desde `scripts/archive/` al almacenamiento externo.

<details>
<summary>Lista completa de archivos (55)</summary>

| Archivo | Tamaño |
|---|---|
| `ISIN_Nombres.csv` | 43 KB |
| `aggressive_audit.py` | 4.7 KB |
| `analyze_csv_unknowns.py` | 893 B |
| `analyze_sin_retrocesion.js` | 4.0 KB |
| `analyze_spikes.py` | 3.9 KB |
| `audit_funds_v2.py` | 5.4 KB |
| `audit_retrocessions_py.py` | 2.7 KB |
| `audit_via_api.py` | 2.3 KB |
| `backfill_asset_class_aggressive_v1.js` | 13.2 KB |
| `backfill_asset_class_fill_only_v1.js` | 13.3 KB |
| `check_diff_retro.js` | 2.1 KB |
| `check_exact_retro.js` | 3.7 KB |
| `check_fund_history.py` | 2.8 KB |
| `check_history_status.py` | 2.1 KB |
| `check_retrocesion_fields.js` | 3.3 KB |
| `dedupe_retro_excel.js` | 1.1 KB |
| `diagnose_history.py` | 2.6 KB |
| `exploreDB.js` | 1.4 KB |
| `export_all_fields_csv.py` | 3.6 KB |
| `export_fondos_retrocesion.js` | 4.3 KB |
| `export_funds_categories.py` | 4.3 KB |
| `export_retrocessions_csv.js` | 1.5 KB |
| `export_unclassified_funds.py` | 2.2 KB |
| `fix_legacy_fund.py` | 3.6 KB |
| `fix_lu0232524495.py` | 1.8 KB |
| `fix_missing_data_quality.py` | 2.4 KB |
| `fix_missing_std_perf.py` | 4.8 KB |
| `fix_retro_format.js` | 3.5 KB |
| `fix_via_api.py` | 1.5 KB |
| `fix_via_api_v2.py` | 3.7 KB |
| `inspect_refresh_results.py` | 1.6 KB |
| `list_blackrock.py` | 454 B |
| `list_funds_with_retrocessions.js` | 2.0 KB |
| `list_isin_ids.py` | 524 B |
| `list_missing_ms_stars.js` | 1.7 KB |
| `migrate_regions_to_canonical.js` | 10.5 KB |
| `migrate_sectors_to_canonical.js` | 5.1 KB |
| `remediate_orphans.py` | 2.4 KB |
| `run_diagnosis.py` | 825 B |
| `test_backtester_volatility.py` | 1.2 KB |
| `test_db_subtype.py` | 446 B |
| `test_despiking.py` | 842 B |
| `test_frontier.py` | 740 B |
| `test_fund_fetch.py` | 5.7 KB |
| `test_shrinkage.py` | 807 B |
| `test_update_history.py` | 873 B |
| `test_v2_refinement.py` | 2.2 KB |
| `test_volatility.py` | 3.0 KB |
| `trigger_calc.py` | 1.8 KB |
| `trigger_daily_refresh.py` | 1.3 KB |
| `trigger_metadata_update.py` | 2.1 KB |
| `trigger_restore.py` | 610 B |
| `verify_creation.js` | 845 B |
| `verify_history.js` | 1.2 KB |
| `verify_history.py` | 1.9 KB |

</details>

## 2. Ruta Externa Final

```
C:\Users\oanti\Documents\BDB-FONDOS-EXTERNAL-ARCHIVE\scripts_archive_2026-05-04\
```

55 archivos verificados en destino.

## 3. Confirmaciones

| Verificación | Estado |
|---|---|
| `scripts/archive/` eliminado de BDB-FONDOS | ✅ |
| `functions_python/scripts/archive/` NO tocado | ✅ Presente |
| `scripts/maintenance/` intacto | ✅ Presente |
| `scripts/sandbox/` intacto | ✅ Presente |
| `scripts/firebase/` intacto | ✅ Presente |
| `scripts/repo/` intacto | ✅ Presente |
| `scripts/package.json` no modificado | ✅ Presente |
| `script_manifest.json` no modificado | ✅ Presente |
| `scripts/infer_region_primary_bdb.py` no tocado | ✅ Presente |
| `scripts/populate_taxonomy_v2_FINAL.py` no tocado | ✅ Presente |
| `serviceAccountKey.json` presente | ✅ |
| `.env` presente | ✅ |
| `frontend/.env` presente | ✅ |
| `firebase.json` presente | ✅ |
| `firestore.rules` presente | ✅ |
| `frontend/src/` intacto | ✅ |
| `functions_python/api/` intacto | ✅ |
| `functions_python/services/` intacto | ✅ |

## 4. Resultado de `git status`

- Los archivos previamente trackeados de `scripts/archive/` que ya habían sido movidos a `scripts/archive/` en un commit anterior aparecen como `D` (deleted). Esto es esperado.
- No hay cambios nuevos en código funcional producidos por esta operación.
- Los documentos `docs/CLEANUP_*.md` aparecen como `??` (untracked), lo cual es esperado.

## 5. Confirmación de Integridad

- ✅ No se ejecutó ningún script.
- ✅ No se tocó código funcional.
- ✅ No se modificaron credenciales.
- ✅ No se tocó `functions_python/scripts/archive/`.
- ✅ No se modificó `script_manifest.json`.
- ✅ No se modificó `scripts/package.json`.
- ✅ No se modificó `README.md`.

## 6. Próxima Fase Recomendada (NO ejecutada)

**FASE 3B.2:** Limpiar `script_manifest.json`:
- Eliminar las 4 entradas huérfanas (sandbox files que no existen).
- Actualizar las 7 entradas de `fp/scripts/archive/` a `status: "ARCHIVED_EXTERNAL"` (o eliminarlas) simultáneamente con la externalización de `functions_python/scripts/archive/`.
