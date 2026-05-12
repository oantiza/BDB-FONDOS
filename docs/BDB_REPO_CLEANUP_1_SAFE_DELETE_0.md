# BDB-FONDOS — Limpieza 1: Eliminación Segura
## BDB-REPO-CLEANUP-1-SAFE-DELETE-0 | 2026-05-12

**Referencia**: `docs/BDB_REPO_CLEANUP_AUDIT_0.md`
**HEAD inicial**: `74f972d`

---

## 1. Rutas Eliminadas (Categoría D)

### Snapshots JSON duplicados (~19.5 MB)

| Ruta | Tamaño |
|---|---|
| `docs/audits/legacy/funds_v3_backup.json` | 6.38 MB |
| `docs/audits/legacy/funds_v3_repaired.json` | 6.39 MB |
| `docs/audits/legacy/funds_v3_region_inferred.json` | 6.40 MB |
| `docs/audits/legacy/memory_graph.jsonl` | 4.4 KB |

### CSVs timestamped duplicados (~449 KB)

| Ruta | Tamaño |
|---|---|
| `docs/audits/taxonomy_v2_review/all_conflicts_20260312_164447.csv` | 77.8 KB |
| `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165656.csv` | 91.8 KB |
| `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165835.csv` | 91.8 KB |
| `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165927.csv` | 91.8 KB |
| `docs/audits/taxonomy_v2_review/all_conflicts_20260312_170027.csv` | 91.8 KB |

### Directorios backup legacy (~53 KB)

| Ruta | Archivos |
|---|---|
| `data/work/legacy_roots/_backup_old/` | 10 archivos (scratch_*.cjs, bat, services) |
| `data/work/scripts_backup/` | 2 archivos (copias de scripts raíz) |

### Scripts desechables (~12 KB)

| Ruta | Tamaño |
|---|---|
| `scripts/validate_manual_overrides.js` | 93 B (stub vacío) |
| `scripts/maintenance/examine_files.py` | 652 B |
| `scripts/maintenance/examine_files2.py` | 547 B |
| `scripts/maintenance/examine_excel.py` | 260 B |
| `scripts/maintenance/restore_name.js` | 903 B |
| `scripts/maintenance/verify_creation.js` | 1.0 KB |
| `scripts/maintenance/update_3_retros.js` | 1.6 KB |
| `scripts/maintenance/set_retro_zero.js` | 2.7 KB |
| `scripts/maintenance/limpieza_segura.bat` | 2.9 KB |
| `scripts/maintenance/create_zip.py` | 1.9 KB |

---

## 2. Resumen

| Métrica | Valor |
|---|---|
| Archivos tracked eliminados | **31** |
| Espacio liberado (working copy) | **~20 MB** |
| Rutas D que no existían | 0 |
| Rutas D omitidas por duda | 1 (`scripts/maintenance/__pycache__/` — no tracked, local-only) |

---

## 3. Categorías NO tocadas

| Categoría | Estado |
|---|---|
| A — Conservar | ✅ No tocada |
| B — .gitignore | ✅ No tocada |
| C — Archivar | ✅ No tocada |
| E — Revisar humano | ✅ No tocada |

---

## 4. Confirmaciones de Seguridad

| Verificación | Estado |
|---|---|
| Deploy | **NO** |
| Firestore writes | **0** |
| CORE | **NO tocado** |
| Scripts históricos/write-gates | **NO tocados** |
| Rollback manifests | **NO tocados** |
| Secrets / .env / service account | **NO tocados** |
| Firestore rules | **NO tocadas** |
| Storage rules | **NO tocadas** |

---

## 5. Próximos Bloques

| Bloque | Descripción |
|---|---|
| CLEANUP-2 | Archivar fuera del repo (C1–C12): snapshots STABLE/FINAL de taxonomy |
| CLEANUP-3 | Marcar scripts mutantes como HISTORICAL-ONLY (17 scripts) |
| CLEANUP-4 | Revisión humana categoría E (8 candidatos, ~15 MB) |

---

**Fecha**: 2026-05-12
**Autor**: Agente automático
