# FASE 3B.4 — Eliminación de Duplicados Exactos SHA256

**Fecha de ejecución:** 2026-05-04T08:39 (CET)
**Ejecutado por:** Claude Opus 4.6 en Antigravity IDE
**Plan de referencia:** `docs/CLEANUP_PHASE_3A_VALIDATION_REPORT.md`

---

## 1. SHA256 Pre-Borrado (confirmación final)

| Script | SHA256 | Match |
|---|---|---|
| `fetch_missing_history.py` | `B13A7A45B7E7C325...` | ✅ MATCH |
| `fondos_no_en_csv.js` | `3DC6FE35AB595099...` | ✅ MATCH |
| `import_retrocesiones.js` | `B5A5CECEA1C714B1...` | ✅ MATCH |
| `repair_costs_funds_v3.js` | `4FDA9BB3E70A86E3...` | ✅ MATCH |
| `set_retro_zero.js` | `A758B606CCEA4660...` | ✅ MATCH |
| `update_ms_stars_funds_v3.js` | `CBD2ECF83D055BF5...` | ✅ MATCH |

Los 6 pares fueron confirmados idénticos byte a byte justo antes de la eliminación.

## 2. Archivos Eliminados (raíz)

| Archivo eliminado |
|---|
| `scripts/fetch_missing_history.py` |
| `scripts/fondos_no_en_csv.js` |
| `scripts/import_retrocesiones.js` |
| `scripts/repair_costs_funds_v3.js` |
| `scripts/set_retro_zero.js` |
| `scripts/update_ms_stars_funds_v3.js` |

## 3. Archivos Conservados (maintenance)

| Archivo conservado | Estado |
|---|---|
| `scripts/maintenance/fetch_missing_history.py` | ✅ Presente |
| `scripts/maintenance/fondos_no_en_csv.js` | ✅ Presente |
| `scripts/maintenance/import_retrocesiones.js` | ✅ Presente |
| `scripts/maintenance/repair_costs_funds_v3.js` | ✅ Presente |
| `scripts/maintenance/set_retro_zero.js` | ✅ Presente |
| `scripts/maintenance/update_ms_stars_funds_v3.js` | ✅ Presente |

## 4. Verificaciones

| Verificación | Estado |
|---|---|
| 6 copias raíz eliminadas | ✅ |
| 6 copias maintenance presentes | ✅ |
| `scripts/package.json` no modificado | ✅ |
| `script_manifest.json` no modificado | ✅ |
| `README.md` no modificado | ✅ |
| `scripts/infer_region_primary_bdb.py` no tocado | ✅ |
| `scripts/populate_taxonomy_v2_FINAL.py` no tocado | ✅ |
| Credenciales presentes | ✅ |
| `frontend/src/` intacto | ✅ |
| `functions_python/api/` intacto | ✅ |
| `functions_python/services/` intacto | ✅ |
| Duplicados DIFF no tocados | ✅ |
| Duplicados header-only no tocados | ✅ |

## 5. Confirmación de Integridad

- ✅ No se ejecutó ningún script.
- ✅ No se tocó código funcional.
- ✅ No se modificaron credenciales.
- ✅ No se eliminó ningún duplicado header-only (reservado para FASE 3B.5).
- ✅ No se tocó `functions_python/scripts/`.

## 6. Git Status

Los 6 archivos eliminados aparecen como `D` (deleted) en git status, lo cual es esperado. El resto del status corresponde a eliminaciones anteriores (archive en 3B.1) y archivos untracked de maintenance.

## 7. Próxima Fase Recomendada (NO ejecutada)

**FASE 3B.5:** Revisar y eliminar los 17 duplicados header-only de `scripts/` raíz.

Estos son scripts donde la versión en `scripts/maintenance/` es idéntica al cuerpo + 9-10 líneas de header metadata. Antes de eliminarlos:

1. Verificar que `scripts/package.json` main (`update_retrocessions_funds_v3.js`) tiene equivalente en maintenance.
2. Actualizar `scripts/package.json` main si es necesario.
3. Eliminar los 17 scripts raíz duplicados header-only.
4. Verificar que los scripts que NO son duplicados (como `backfill_*.js`, `apply_manual_overrides.js`, `infer_region_primary_bdb.py`, `populate_taxonomy_v2_FINAL.py`, etc.) siguen presentes en raíz.
