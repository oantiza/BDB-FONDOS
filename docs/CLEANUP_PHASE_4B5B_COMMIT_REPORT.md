# FASE 4B.5B — Commit Report

**Fecha:** 2026-05-04
**Commit:** `0654592`
**Mensaje:** `chore: support env-based Firebase init in dry-run mutating tools`
**Archivos:** 21 (19 scripts + 2 docs)
**Líneas:** +715 / −262

---

## Archivos Incluidos

### Documentación (2)

| Archivo | Estado |
|---|---|
| `docs/CLEANUP_PHASE_4B5B_MUTANTS_WITH_DRYRUN_PLAN.md` | NEW |
| `docs/CLEANUP_PHASE_4B5B_MUTANTS_WITH_DRYRUN_REFACTOR_REPORT.md` | NEW |

### Scripts Python Refactorizados (12)

| # | Archivo | Patrón |
|---|---|---|
| 1 | `functions_python/scripts/audit/sample_taxonomy_review_50.py` | A — key_paths |
| 2 | `functions_python/scripts/fixes/clean_csv_categories.py` | B — bare cert |
| 3 | `functions_python/scripts/fixes/sync_categories_to_firestore.py` | B — bare cert |
| 4 | `functions_python/scripts/migration/populate_taxonomy_v2.py` | A — key_paths |
| 5 | `functions_python/scripts/migration/populate_taxonomy_v2_backup.py` | A — key_paths |
| 6 | `functions_python/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py` | A — key_paths |
| 7 | `functions_python/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py` | A — key_paths |
| 8 | `functions_python/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py` | A — key_paths |
| 9 | `scripts/maintenance/validate_nav_pipeline.py` | C — cred_path |
| 10 | `scripts/maintenance/verify_history.py` | C — cred_path |
| 11 | `scripts/maintenance/populate_taxonomy_v2.py` | A — key_paths |
| 12 | `scripts/populate_taxonomy_v2_FINAL.py` | A — key_paths |

### Scripts JS Refactorizados (7)

| # | Archivo | Patrón |
|---|---|---|
| 13 | `scripts/maintenance/import_retrocesiones.js` | D — apps.length guard |
| 14 | `scripts/maintenance/recalculate_derived_fields.js` | D — apps.length + exit |
| 15 | `scripts/maintenance/refresh_derived_data.js` | D — partial ADC |
| 16 | `scripts/maintenance/repair_costs_funds_v3.js` | E — absolute path |
| 17 | `scripts/maintenance/set_retro_zero.js` | D — inline cert |
| 18 | `scripts/migrate_regions_to_canonical.js` | E — absolute path |
| 19 | `scripts/migrate_sectors_to_canonical.js` | E — absolute path |

---

## Verificación Pre-Commit

| Check | Resultado |
|---|---|
| `py_compile` (12 Python) | 12/12 ✅ |
| `node --check` (7 JS) | 7/7 ✅ |
| GAC en todos los archivos | 19/19 ✅ |
| Paths absolutos ROBOT_CARGA eliminados | 3/3 ✅ |
| `.env` en staged | NO ✅ |
| `frontend/.env` en staged | NO ✅ |
| `serviceAccountKey.json` en staged | NO ✅ |

---

## Confirmaciones de Seguridad

- ✅ **serviceAccountKey.json** NO incluido en el commit.
- ✅ **.env** NO incluido en el commit.
- ✅ **frontend/.env** NO incluido en el commit.
- ✅ **No se ejecutó ningún script.**
- ✅ **No se hizo push.**
- ✅ **No se modificó lógica de escritura, dry-run flags, ni colecciones target.**

---

## Historial de Commits FASE 4B

| Commit | Fase | Archivos | Descripción |
|---|---|---|---|
| `64bb990` | 4B.1–4B.3 | 14 | Python readonly + documentación |
| `42f16ed` | 4B.4 | 9 | JS/CJS readonly |
| `e2f687a` | 4B.5A | 9 | Python readonly residual |
| **`0654592`** | **4B.5B** | **21** | **Mutantes con dry-run** |

**Total acumulado:** 53 archivos en 4 commits.

---

## Git Status Post-Commit

Los 19 scripts de FASE 4B.5B ya no aparecen en `git status`.
Los cambios restantes son de desarrollo no relacionado (frontend, API, etc.).

```
No push realizado.
Commits locales pendientes: 11 (desde 8b095ab).
```

---

## Progreso General FASE 4B

| Sublote | Scripts | Estado | Commit |
|---|---|---|---|
| 4B.3 Python readonly | 7 | ✅ DONE | `64bb990` |
| 4B.4 JS/CJS readonly | 7 | ✅ DONE | `42f16ed` |
| 4B.5A Python readonly residual | 7 | ✅ DONE | `e2f687a` |
| 4B.5B Mutantes con dry-run | 19 | ✅ DONE | `0654592` |
| 4B.5C/D Mutantes sin dry-run | ~16 | ⏳ Pendiente | — |
| **Total completado** | **40/~56** | | |

---

## Próxima Fase Recomendada

**FASE 4B.5C** — Plan para scripts mutantes SIN mecanismo dry-run.

Acciones:
1. Recalcular inventario actual de `serviceAccountKey.json` hardcoded-only tras commit `0654592`.
2. Identificar scripts restantes sin `--dry-run` ni `--apply` guard.
3. Clasificar por riesgo (alto/medio).
4. Documentar plan en `docs/CLEANUP_PHASE_4B5C_*.md`.

> ⚠️ **No iniciada.** Requiere aprobación explícita del usuario.
