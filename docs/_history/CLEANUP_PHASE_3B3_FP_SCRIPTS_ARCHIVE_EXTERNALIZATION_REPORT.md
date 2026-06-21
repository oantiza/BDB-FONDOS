# FASE 3B.3 — Externalización de functions_python/scripts/archive/

**Fecha de ejecución:** 2026-05-04T08:37 (CET)
**Ejecutado por:** Claude Opus 4.6 en Antigravity IDE
**Plan de referencia:** `docs/CLEANUP_PHASE_3B2_SCRIPT_MANIFEST_CLEANUP_REPORT.md`

---

## 1. Archivos Movidos

**7 archivos** movidos desde `functions_python/scripts/archive/` al almacenamiento externo.

| Archivo | Tamaño |
|---|---|
| `populate_taxonomy_v2_FINAL_STABLE.py` | 61,095 B |
| `populate_taxonomy_v2_STABLE_31conflicts.py` | 61,095 B |
| `populate_taxonomy_v2_STABLE_71conflicts.py` | 61,095 B |
| `populate_taxonomy_v2_backup.py` | 59,132 B |
| `sample_taxonomy_review_50_FINAL_STABLE.py` | 28,978 B |
| `sample_taxonomy_review_50_STABLE_31conflicts.py` | 28,978 B |
| `sample_taxonomy_review_50_STABLE_71conflicts.py` | 26,145 B |

## 2. Ruta Externa Final

```
C:\Users\oanti\Documents\BDB-FONDOS-EXTERNAL-ARCHIVE\fp_scripts_archive_2026-05-04\
```

7 archivos verificados en destino.

## 3. Entradas Eliminadas del Manifest

7 entradas con `"status": "ARCHIVED_EXTERNAL_PENDING"` eliminadas de `script_manifest.json`:

| Nombre | Path original |
|---|---|
| `populate_taxonomy_v2_FINAL_STABLE.py` | `functions_python/scripts/archive/...` |
| `populate_taxonomy_v2_STABLE_31conflicts.py` | `functions_python/scripts/archive/...` |
| `populate_taxonomy_v2_STABLE_71conflicts.py` | `functions_python/scripts/archive/...` |
| `populate_taxonomy_v2_backup.py` | `functions_python/scripts/archive/...` |
| `sample_taxonomy_review_50_FINAL_STABLE.py` | `functions_python/scripts/archive/...` |
| `sample_taxonomy_review_50_STABLE_31conflicts.py` | `functions_python/scripts/archive/...` |
| `sample_taxonomy_review_50_STABLE_71conflicts.py` | `functions_python/scripts/archive/...` |

## 4. Estado del Manifest Post-Edición

| Métrica | Antes (3B.2) | Después (3B.3) |
|---|---|---|
| Total entradas | 41 | **34** |
| ACTIVE | 34 | **34** |
| ARCHIVED_EXTERNAL_PENDING | 7 | **0** |
| Entradas huérfanas | 0 | **0** |

✅ JSON válido. Todas las 34 entradas ACTIVE apuntan a archivos existentes.

## 5. Verificaciones

| Verificación | Estado |
|---|---|
| `functions_python/scripts/archive/` eliminado | ✅ |
| `scripts/archive/` sigue sin existir (externalizado en 3B.1) | ✅ |
| `scripts/maintenance/` presente | ✅ |
| `scripts/package.json` no modificado | ✅ |
| `README.md` no modificado | ✅ |
| `scripts/infer_region_primary_bdb.py` no tocado | ✅ |
| `scripts/populate_taxonomy_v2_FINAL.py` no tocado | ✅ |
| `serviceAccountKey.json` presente | ✅ |
| `.env` y `frontend/.env` presentes | ✅ |
| `frontend/src/` intacto | ✅ |
| `functions_python/api/` intacto | ✅ |
| `functions_python/services/` intacto | ✅ |

## 6. Git Status

```
M functions_python/scripts/script_manifest.json
```

Único archivo modificado en esta fase. Sin cambios en código funcional.

## 7. Confirmación de Integridad

- ✅ No se ejecutó ningún script.
- ✅ No se tocó código funcional.
- ✅ No se modificaron credenciales.
- ✅ Solo se editó `script_manifest.json` y se movieron los 7 archivos archive.

## 8. Resumen Acumulado de Almacenamiento Externo

```
C:\Users\oanti\Documents\BDB-FONDOS-EXTERNAL-ARCHIVE\
├── archive_2026-05-04\                    (15 archivos, ~118 MB — FASE 2)
├── scripts_archive_2026-05-04\            (55 archivos — FASE 3B.1)
└── fp_scripts_archive_2026-05-04\         (7 archivos, ~326 KB — FASE 3B.3)
```

## 9. Próxima Fase Recomendada (NO ejecutada)

**FASE 3B.4:** Eliminar duplicados exactos SHA256 de `scripts/` raíz.

Los 6 pares confirmados por SHA256 en FASE 3A:
- `fetch_missing_history.py` (raíz = maintenance)
- `fondos_no_en_csv.js` (raíz = maintenance)
- `import_retrocesiones.js` (raíz = maintenance)
- `repair_costs_funds_v3.js` (raíz = maintenance)
- `set_retro_zero.js` (raíz = maintenance)
- `update_ms_stars_funds_v3.js` (raíz = maintenance)

Acción: eliminar la copia raíz, conservar la versión en `scripts/maintenance/`.
