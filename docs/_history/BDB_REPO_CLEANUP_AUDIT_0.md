# BDB-FONDOS — Auditoría de Limpieza del Repositorio
## BDB-REPO-CLEANUP-AUDIT-0 | 2026-05-12

**HEAD**: `97e9a26` | **Rama**: `master` | **Working tree**: limpio | **Pendientes**: 0

---

## 1. Resumen Ejecutivo

El repositorio contiene **~5,200 archivos tracked** (excluyendo node_modules/venv). Se identificaron **~80 candidatos de limpieza** distribuidos en:

| Categoría | Candidatos | Peso estimado |
|---|---|---|
| **D — Eliminar** (basura segura) | 22 | ~26 MB |
| **C — Archivar fuera del repo** | 12 | ~0.9 MB |
| **B — Agregar a .gitignore** | 3 | ~0 MB (ya ignorado o dirs vacíos) |
| **E — Revisar humano** | 8 | ~15 MB |
| **A — Conservar** | ~35+ | (audit trail, write-gates, rollback) |

**Hallazgo principal**: `docs/audits/legacy/` contiene 4 JSONs de ~6.4 MB cada uno (snapshots `funds_v3`). Solo están tracked por Git y representan ~25.8 MB de peso muerto en el historial.

---

## 2. Candidatos a Limpieza

### 2.1 — Categoría D: ELIMINAR (basura segura)

| # | Ruta | Tipo | Tamaño | Tracked | Riesgo |
|---|---|---|---|---|---|
| D1 | `docs/audits/legacy/funds_v3_backup.json` | Snapshot duplicado | 6.38 MB | Sí | Nulo — copia de funds_v3.json |
| D2 | `docs/audits/legacy/funds_v3_repaired.json` | Snapshot intermedio | 6.39 MB | Sí | Nulo — superseded por region_inferred |
| D3 | `docs/audits/legacy/funds_v3_region_inferred.json` | Snapshot intermedio | 6.40 MB | Sí | Nulo — superseded por datos live |
| D4 | `docs/audits/legacy/memory_graph.jsonl` | LLM work artifact | 4.4 KB | Sí | Nulo |
| D5 | `docs/audits/taxonomy_v2_review/all_conflicts_20260312_164447.csv` | Timestamped dupe | 77.8 KB | Sí | Nulo |
| D6 | `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165656.csv` | Timestamped dupe | 91.8 KB | Sí | Nulo |
| D7 | `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165835.csv` | Timestamped dupe | 91.8 KB | Sí | Nulo |
| D8 | `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165927.csv` | Timestamped dupe | 91.8 KB | Sí | Nulo |
| D9 | `docs/audits/taxonomy_v2_review/all_conflicts_20260312_170027.csv` | Timestamped dupe | 91.8 KB | Sí | Nulo |
| D10 | `data/work/legacy_roots/_backup_old/` | Old backup scripts | ~50 KB | Sí | Nulo — scratch_*.cjs y bat legacy |
| D11 | `data/work/scripts_backup/` | Script duplicates | ~53 KB | Sí | Nulo — copias de scripts/ raíz |
| D12 | `scripts/validate_manual_overrides.js` (raíz) | Stub vacío (93 bytes) | 93 B | Sí | Nulo — real está en overrides/ |
| D13 | `scripts/maintenance/examine_files.py` | Utility desechable | 652 B | Sí | Nulo |
| D14 | `scripts/maintenance/examine_files2.py` | Utility desechable | 547 B | Sí | Nulo |
| D15 | `scripts/maintenance/examine_excel.py` | Utility desechable | 260 B | Sí | Nulo |
| D16 | `scripts/maintenance/restore_name.js` | One-off fix | 903 B | Sí | Nulo |
| D17 | `scripts/maintenance/verify_creation.js` | One-off verify | 1 KB | Sí | Nulo |
| D18 | `scripts/maintenance/update_3_retros.js` | One-off fix (3 fondos) | 1.6 KB | Sí | Nulo |
| D19 | `scripts/maintenance/set_retro_zero.js` | One-off fix | 2.7 KB | Sí | Nulo |
| D20 | `scripts/maintenance/limpieza_segura.bat` | Windows batch legacy | 2.9 KB | Sí | Nulo |
| D21 | `scripts/maintenance/create_zip.py` | Utility — dupe of repo/ | 1.9 KB | Sí | Nulo |
| D22 | `scripts/maintenance/__pycache__/` | Cache (no tracked) | ~0 | No | Nulo |

### 2.2 — Categoría C: ARCHIVAR fuera del repo

| # | Ruta | Tipo | Tamaño | Tracked | Justificación |
|---|---|---|---|---|---|
| C1 | `functions_python/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py` | Frozen snapshot | 61 KB | Sí | Histórico; current en populate_taxonomy_v2.py |
| C2 | `functions_python/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py` | Frozen snapshot | 61 KB | Sí | Idéntico a FINAL_STABLE |
| C3 | `functions_python/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py` | Frozen snapshot | 61 KB | Sí | Snapshot intermedio |
| C4 | `functions_python/scripts/migration/populate_taxonomy_v2_backup.py` | Backup copy | 59 KB | Sí | Old version |
| C5 | `functions_python/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py` | Frozen snapshot | 29 KB | Sí | Histórico |
| C6 | `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py` | Frozen snapshot | 29 KB | Sí | Snapshot |
| C7 | `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py` | Frozen snapshot | 26 KB | Sí | Snapshot |
| C8 | `scripts/populate_taxonomy_v2_FINAL.py` | Raíz duplicate | 70 KB | Sí | Copia de migration/ |
| C9 | `scripts/convert_font.py` | Font utility one-off | 641 B | Sí | No se necesita en repo |
| C10 | `scripts/create_fonts_ts.py` | Font utility one-off | 250 B | Sí | No se necesita en repo |
| C11 | `scripts/dedupe_retro_excel.js` | One-off dedup | 878 B | Sí | Histórico |
| C12 | `scripts/repo/reorganize_bdb_structure.ps1` | Repo reorganization | 15 KB | Sí | Ya ejecutado, no reutilizable |

### 2.3 — Categoría B: Agregar a .gitignore

| # | Ruta | Estado | Nota |
|---|---|---|---|
| B1 | `MORNINGSTAR_PDF_PARSER/ENTRADA/*.pdf` | Ya ignorado vía `*.pdf` | OK — solo .gitkeep y README tracked |
| B2 | `.pytest_cache/` | Ya en .gitignore | OK — no tracked |
| B3 | `scripts/maintenance/__pycache__/` | Ya en .gitignore | OK — no tracked |

> **Nota**: `.gitignore` ya cubre bien node_modules, venv, __pycache__, .env, *.pdf, *.zip, data/. No hay gaps significativos.

### 2.4 — Categoría E: REVISAR HUMANO

| # | Ruta | Tipo | Tamaño | Tracked | Preocupación |
|---|---|---|---|---|---|
| E1 | `docs/audits/legacy/funds_v3.json` | Snapshot maestro original | 6.40 MB | Sí | ¿Conservar como baseline regulatorio? |
| E2 | `docs/audits/legacy/audit_funds_v3_details.jsonl` | Detalle de auditoría | 564 KB | Sí | Puede tener valor de trazabilidad |
| E3 | `docs/audits/legacy/no_fill_report.md` | Reporte de gaps NAV | 47 KB | Sí | Puede tener valor histórico |
| E4 | `AUDITORIA_BDB-FONDOS.pdf` | PDF raíz | 74 KB | Sí | PDF tracked pese a *.pdf en .gitignore — forzado con git add -f |
| E5 | `scripts/maintenance/cargador_lotes.js` | Legacy batch loader (44KB) | 43.9 KB | Sí | Posible uso futuro vs. v2 |
| E6 | `scripts/maintenance/populate_taxonomy_v2.py` | Copia raíz de migration/ | 71.9 KB | Sí | ¿Duplicado o canonical? |
| E7 | `scripts/maintenance/recalculate_derived_fields.js` | Write script activo | 29 KB | Sí | Útil pero peligroso — requiere header |
| E8 | `docs/WORK_SESSION_FINAL_STATUS.md` | Session state doc | 8 KB | Sí | ¿Obsoleto o útil? |

### 2.5 — Categoría A: CONSERVAR (no tocar)

Las siguientes áreas **NO deben modificarse**:

| Área | Motivo |
|---|---|
| `docs/BDB_*.md` (255 archivos, 1.89 MB) | Trazabilidad de auditoría, write-gates, cierre de bloques |
| `artifacts/` (155 archivos, 12.16 MB) | Rollback manifests, snapshots, evidencia |
| `scripts/maintenance/bdb_*.py` (30+ archivos) | Write-gates, dry-runs, audit scripts — evidencia regulatoria |
| `scripts/maintenance/archive/` | Archivos ya archivados con README |
| `data/canonical/` (960 archivos) | Parser canonical outputs |
| `data/error/` (299 archivos) | Parser error tracking |
| `data/review/` (73 archivos) | Parser review queue |
| `data/work/manifests/` (14 archivos) | Batch manifests |
| `data/work/parsed_ms/` (526 archivos) | Parsed Morningstar outputs |
| `data/work/raw_llm/` (526 archivos) | LLM raw responses |
| `data/work/raw_text/` (526 archivos) | PDF raw extractions |
| `tests/` (4 subdirectorios) | Test fixtures y gates |
| `MORNINGSTAR_PDF_PARSER/src/`, `tests/`, `config/` | Parser código activo |
| `functions_python/scripts/script_manifest.json` | Manifest de clasificación |
| `optimizer_universe/` (7 archivos, 0.8 MB) | Universe activo de producción |
| `overrides/validate_manual_overrides.js` | Validador activo |
| `schemas/manual_override.schema.json` | Schema activo |
| `functions_python/scripts/README.md` | Documentación de scripts |
| `SECURITY_NOTES.txt`, `SNAPSHOT_NOTES.txt` | Notas de gobierno |

---

## 3. Scripts Peligrosos (requieren header HISTORICAL-ONLY)

Los siguientes scripts contienen writes a Firestore y deberían marcarse con un header `# ⚠️ HISTORICAL-ONLY — DO NOT RUN without explicit authorization`:

| Script | Tipo de write |
|---|---|
| `scripts/maintenance/import_retrocesiones.js` | Firestore bulk write |
| `scripts/maintenance/purge_legacy_root_fields.js` | Firestore delete fields |
| `scripts/maintenance/recalculate_derived_fields.js` | Firestore update |
| `scripts/maintenance/refresh_derived_data.js` | Firestore update |
| `scripts/maintenance/repair_costs_funds_v3.js` | Firestore update |
| `scripts/maintenance/update_ms_stars_funds_v3.js` | Firestore update |
| `scripts/maintenance/update_retrocessions_funds_v3.js` | Firestore update |
| `scripts/maintenance/copy_fund_data.js` | Firestore copy |
| `scripts/maintenance/import_history_manual.js` | Firestore write |
| `scripts/apply_manual_overrides.js` | Firestore write |
| `scripts/backfill_asset_class_aggressive_v1.js` | Firestore write |
| `scripts/backfill_asset_class_fill_only_v1.js` | Firestore write |
| `scripts/migrate_regions_to_canonical.js` | Firestore write |
| `scripts/migrate_sectors_to_canonical.js` | Firestore write |
| `functions_python/scripts/migration/check_and_import_retrocesion.py` | Firestore write |
| `functions_python/scripts/fixes/sync_categories_to_firestore.py` | Firestore write |
| `functions_python/scripts/update_risk_profiles_firestore.py` | Firestore write |

---

## 4. Propuesta de Plan en Fases

### CLEANUP-1: .gitignore + local-only
- Agregar `AUDITORIA_BDB-FONDOS.pdf` a `.gitignore` si se decide no conservar tracked.
- Confirmar que `data/` sigue correctamente ignorado para nuevos archivos.
- No se detectaron gaps significativos en `.gitignore`.

### CLEANUP-2: Eliminar basura segura (D1–D22)
- **Peso total removido**: ~26 MB (mayormente los 3 JSONs duplicados de legacy).
- **Riesgo**: Nulo — todo recuperable vía `git log`.
- **Archivos**: 22.
- Ejecutar `git rm` y commit único: `CLEANUP: remove legacy duplicates and throwaway scripts`.

### CLEANUP-3: Archivar fuera del repo (C1–C12)
- Mover los 7 snapshots `*_STABLE_*`, `*_backup*`, `*_FINAL*` de migration/audit a un directorio externo o zip de archivo.
- Ejecutar `git rm` y commit: `CLEANUP: archive frozen taxonomy snapshots`.
- **Peso total**: ~397 KB.

### CLEANUP-4: Documentar scripts históricos
- Agregar header `HISTORICAL-ONLY` a los 17 scripts con writes.
- Commit: `DOCS: mark mutating scripts as historical-only`.
- No cambia funcionalidad — solo comentarios de cabecera.

### CLEANUP-5 (opcional): Revisar con humano (E1–E8)
- Decidir sobre `funds_v3.json` original (6.4 MB) — ¿baseline regulatorio o archivable?
- Decidir sobre `AUDITORIA_BDB-FONDOS.pdf` — ¿tracked o solo local?
- Decidir sobre `cargador_lotes.js` vs. `cargador_lotes_v_2.js`.

---

## 5. Confirmaciones

| Verificación | Estado |
|---|---|
| Código modificado | **NO** |
| Archivos borrados | **NO** |
| Archivos movidos | **NO** |
| Firestore writes | **0** |
| Deploy | **NO** |
| CORE | **NO tocado** |
| Push | **NO** |

---

**Fecha**: 2026-05-12
**HEAD**: `97e9a26`
**Autor**: Agente automático — auditoría read-only
