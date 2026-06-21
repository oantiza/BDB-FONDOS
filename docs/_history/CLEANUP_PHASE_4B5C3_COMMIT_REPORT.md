# FASE 4B.5C.3 — Commit Report

**Fecha:** 2026-05-04  
**Commit:** `23099da`  
**Mensaje:** `chore: support env-based Firebase init in medium-risk mutating tools`  
**Archivos:** 7 (5 scripts + 2 docs)  
**Líneas:** +519 / −26

---

## Archivos Incluidos

### Documentación (2)

| Archivo | Estado |
|---|---|
| `docs/CLEANUP_PHASE_4B5C3_MEDIUM_RISK_MUTANTS_PLAN.md` | NEW |
| `docs/CLEANUP_PHASE_4B5C3_MEDIUM_RISK_MUTANTS_REFACTOR_REPORT.md` | NEW |

### Scripts Refactorizados (5)

| # | Archivo | Escritura | Colección |
|---|---|---|---|
| 1 | `functions_python/scripts/fixes/clean_classification_v3.py` | `.update()` masivo | funds_v3 |
| 2 | `functions_python/scripts/reports/generate_benchmarks.py` | `batch.set`+`commit` | synthetic_benchmarks |
| 3 | `functions_python/scripts/migration/check_and_import_retrocesion.py` | `.set(merge=True)` | funds_v3 |
| 4 | `scripts/maintenance/fetch_missing_history.py` | `.set()`+`.update()` | historico_vl_v2 + funds_v3 |
| 5 | `scripts/maintenance/heal_historical_gaps.py` | `batch.update`+`commit` | historico_vl_v2 + funds_v3 |

---

## Confirmaciones de Seguridad

- ✅ **serviceAccountKey.json** NO incluido.
- ✅ **.env** NO incluido.
- ✅ **frontend/.env** NO incluido.
- ✅ No se ejecutó ningún script.
- ✅ No se hizo push.
- ✅ Lógica de escritura intacta en los 5 scripts.
- ✅ EODHD API key intacta.

---

## Historial de Commits FASE 4B

| Commit | Fase | Archivos | Descripción |
|---|---|---|---|
| `64bb990` | 4B.1–4B.3 | 14 | Python readonly + documentación |
| `42f16ed` | 4B.4 | 9 | JS/CJS readonly |
| `e2f687a` | 4B.5A | 9 | Python readonly residual |
| `0654592` | 4B.5B | 21 | Mutantes con dry-run |
| `9b0beee` | 4B.5C.1 | 7 | Readonly/snapshots restantes |
| `8f0f027` | 4B.5C.2 | 7 | Mutantes bajo riesgo |
| **`23099da`** | **4B.5C.3** | **7** | **Mutantes medio riesgo** |

**Total acumulado:** 74 archivos en 7 commits.

---

## Progreso General FASE 4B

| Sublote | Scripts | Estado | Commit |
|---|---|---|---|
| 4B.3 Python readonly | 7 | ✅ | `64bb990` |
| 4B.4 JS/CJS readonly | 7 | ✅ | `42f16ed` |
| 4B.5A Python readonly residual | 7 | ✅ | `e2f687a` |
| 4B.5B Mutantes con dry-run | 19 | ✅ | `0654592` |
| 4B.5C.1 Readonly/snapshots | 5 | ✅ | `9b0beee` |
| 4B.5C.2 Mutantes bajo riesgo | 5 | ✅ | `8f0f027` |
| 4B.5C.3 Mutantes medio riesgo | 5 | ✅ | `23099da` |
| 4B.5C.4a Alto riesgo purge/delete | 2 | ⏳ | — |
| 4B.5C.4b Bloqueados | 3 | ⏳ | — |
| **Total completado** | **55/~59** | | |

---

## Próxima Fase Recomendada

**FASE 4B.5C.4a** — Plan para 2 scripts de alto riesgo:

1. `scripts/maintenance/purge_legacy_root_fields.js` — `FieldValue.delete()` masivo con `bulkWriter`
2. `scripts/remediate_orphans.py` — `batch.delete()` sobre funds_v3

> ⚠️ **No iniciada.** Requiere aprobación explícita.
