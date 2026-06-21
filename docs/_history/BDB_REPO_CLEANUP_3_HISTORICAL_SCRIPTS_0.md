# BDB-FONDOS — Limpieza 3: Marcado de Scripts Historicos
## BDB-REPO-CLEANUP-3-HISTORICAL-SCRIPTS-0 | 2026-05-12

**Referencia**: `docs/BDB_REPO_CLEANUP_AUDIT_0.md` (seccion 3)
**HEAD inicial**: `74f972d` (pendiente: `d4f4b63`)

---

## 1. Scripts Marcados como HISTORICAL ONLY

Se agrego cabecera `HISTORICAL ONLY -- DO NOT RUN` a 17 scripts con capacidad de escritura a Firestore.

### JavaScript (14 scripts)

| # | Script | Tipo de write |
|---|---|---|
| 1 | `scripts/maintenance/import_retrocesiones.js` | Firestore bulk write |
| 2 | `scripts/maintenance/purge_legacy_root_fields.js` | Firestore delete fields |
| 3 | `scripts/maintenance/recalculate_derived_fields.js` | Firestore update |
| 4 | `scripts/maintenance/refresh_derived_data.js` | Firestore update |
| 5 | `scripts/maintenance/repair_costs_funds_v3.js` | Firestore update |
| 6 | `scripts/maintenance/update_ms_stars_funds_v3.js` | Firestore update |
| 7 | `scripts/maintenance/update_retrocessions_funds_v3.js` | Firestore update |
| 8 | `scripts/maintenance/copy_fund_data.js` | Firestore copy |
| 9 | `scripts/maintenance/import_history_manual.js` | Firestore write |
| 10 | `scripts/apply_manual_overrides.js` | Firestore write |
| 11 | `scripts/backfill_asset_class_aggressive_v1.js` | Firestore write |
| 12 | `scripts/backfill_asset_class_fill_only_v1.js` | Firestore write |
| 13 | `scripts/migrate_regions_to_canonical.js` | Firestore write |
| 14 | `scripts/migrate_sectors_to_canonical.js` | Firestore write |

### Python (3 scripts)

| # | Script | Tipo de write |
|---|---|---|
| 15 | `functions_python/scripts/migration/check_and_import_retrocesion.py` | Firestore write |
| 16 | `functions_python/scripts/fixes/sync_categories_to_firestore.py` | Firestore write |
| 17 | `functions_python/scripts/update_risk_profiles_firestore.py` | Firestore write |

---

## 2. Cambio Aplicado

Cabecera JS:
```
// HISTORICAL ONLY -- DO NOT RUN
// This script belongs to a historical BDB-FONDOS remediation/migration.
// Do not re-execute without explicit gate, dry-run, approved diff and rollback plan.
```

Cabecera Python:
```
# HISTORICAL ONLY -- DO NOT RUN
# This script belongs to a historical BDB-FONDOS remediation/migration.
# Do not re-execute without explicit gate, dry-run, approved diff and rollback plan.
```

---

## 3. Confirmaciones

| Verificacion | Estado |
|---|---|
| Logica modificada | **NO** — solo cabeceras |
| Imports modificados | **NO** |
| Comportamiento modificado | **NO** |
| Deploy | **NO** |
| Firestore writes | **0** |
| CORE | **NO tocado** |
| Write-gates / rollback artifacts | **NO tocados** |

---

**Fecha**: 2026-05-12
**Autor**: Agente automatico
