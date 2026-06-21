# FASE 3B.5 — Plan de Eliminación de Duplicados Header-Only

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.
**Referencia:** `docs/CLEANUP_PHASE_3A_VALIDATION_REPORT.md`, `docs/CLEANUP_PHASE_3B4_EXACT_DUPLICATES_REMOVAL_REPORT.md`

---

## 1. Duplicados Header-Only Confirmados (17 pares)

Todos reconfirmados: el cuerpo de código de la versión raíz es **idéntico byte a byte** al cuerpo de la versión maintenance (tras eliminar 9-10 líneas de header).

| # | Script | Root (líneas) | Maintenance (líneas) | Header extra |
|---|---|---|---|---|
| 1 | `add_manual_fund.js` | 65 | 75 | +10 |
| 2 | `audit_derived_unknowns.js` | 282 | 291 | +9 |
| 3 | `calculate_manual_metrics.js` | 133 | 143 | +10 |
| 4 | `copy_fund_data.js` | 89 | 99 | +10 |
| 5 | `generate_change_report.py` | 97 | 107 | +10 |
| 6 | `generate_extremos.py` | 75 | 85 | +10 |
| 7 | `get_current_risk_free_rate.js` | 37 | 47 | +10 |
| 8 | `get_fund_template.js` | 33 | 43 | +10 |
| 9 | `import_history_manual.js` | 89 | 99 | +10 |
| 10 | `purge_legacy_root_fields.js` | 51 | 61 | +10 |
| 11 | `recalculate_derived_fields.js` | 989 | 998 | +9 |
| 12 | `refresh_derived_data.js` | 274 | 284 | +10 |
| 13 | `restore_name.js` | 28 | 38 | +10 |
| 14 | `search_isin.py` | 17 | 27 | +10 |
| 15 | `update_3_retros.js` | 38 | 48 | +10 |
| 16 | `update_retrocessions_funds_v3.js` | 150 | 160 | +10 |
| 17 | `update_years_span_from_extremos.py` | 129 | 139 | +10 |

## 2. Referencias Encontradas

| Fuente | Script referenciado | Tipo de referencia | Riesgo |
|---|---|---|---|
| `scripts/package.json` | `update_retrocessions_funds_v3.js` | campo `"main"` | **MEDIO** — debe actualizarse |
| `package.json` (raíz) | `audit_derived_unknowns.js` | campo `"main"` | **MEDIO** — debe actualizarse |
| `docs/CLEANUP_*.md` | Todos los 17 | Documentación de auditoría | **NINGUNO** — referencias históricas |

> [!IMPORTANT]
> **Descubrimiento nuevo:** El `package.json` raíz del proyecto (`c:\Users\oanti\Documents\BDB-FONDOS\package.json`) tiene `"main": "audit_derived_unknowns.js"`. Este archivo está en la raíz del proyecto y apunta a `scripts/audit_derived_unknowns.js`. Debe actualizarse antes de eliminar ese script.

Otros scripts raíz sobrevivientes (`apply_manual_overrides.js`, `backfill_*.js`, etc.) **no referencian** ninguno de los 17 header-only.

Las versiones en `maintenance/` ya tienen headers `RUN:` apuntando a `scripts/maintenance/...`, por lo que son autodocumentadas.

## 3. Cambios Propuestos en package.json

### 3.1 `scripts/package.json`

```diff
- "main": "update_retrocessions_funds_v3.js",
+ "main": "maintenance/update_retrocessions_funds_v3.js",
```

**Riesgo:** BAJO. El campo `main` en un `package.json` de scripts de mantenimiento no es invocado por ningún sistema automático. Solo sería relevante si alguien ejecuta `node .` desde `scripts/`.

### 3.2 `package.json` (raíz del proyecto)

```diff
- "main": "audit_derived_unknowns.js",
+ "main": "scripts/maintenance/audit_derived_unknowns.js",
```

**Riesgo:** BAJO. Este `main` no es invocado por ningún build system, deploy, ni test. El `package.json` raíz se usa principalmente por npm para metadata del proyecto y para los scripts de `manual-overrides`. Ninguno de esos scripts referencia `audit_derived_unknowns.js`.

## 4. Archivos Candidatos a Eliminar

| # | Archivo raíz a eliminar | Versión maintenance conservada |
|---|---|---|
| 1 | `scripts/add_manual_fund.js` | `scripts/maintenance/add_manual_fund.js` |
| 2 | `scripts/audit_derived_unknowns.js` | `scripts/maintenance/audit_derived_unknowns.js` |
| 3 | `scripts/calculate_manual_metrics.js` | `scripts/maintenance/calculate_manual_metrics.js` |
| 4 | `scripts/copy_fund_data.js` | `scripts/maintenance/copy_fund_data.js` |
| 5 | `scripts/generate_change_report.py` | `scripts/maintenance/generate_change_report.py` |
| 6 | `scripts/generate_extremos.py` | `scripts/maintenance/generate_extremos.py` |
| 7 | `scripts/get_current_risk_free_rate.js` | `scripts/maintenance/get_current_risk_free_rate.js` |
| 8 | `scripts/get_fund_template.js` | `scripts/maintenance/get_fund_template.js` |
| 9 | `scripts/import_history_manual.js` | `scripts/maintenance/import_history_manual.js` |
| 10 | `scripts/purge_legacy_root_fields.js` | `scripts/maintenance/purge_legacy_root_fields.js` |
| 11 | `scripts/recalculate_derived_fields.js` | `scripts/maintenance/recalculate_derived_fields.js` |
| 12 | `scripts/refresh_derived_data.js` | `scripts/maintenance/refresh_derived_data.js` |
| 13 | `scripts/restore_name.js` | `scripts/maintenance/restore_name.js` |
| 14 | `scripts/search_isin.py` | `scripts/maintenance/search_isin.py` |
| 15 | `scripts/update_3_retros.js` | `scripts/maintenance/update_3_retros.js` |
| 16 | `scripts/update_retrocessions_funds_v3.js` | `scripts/maintenance/update_retrocessions_funds_v3.js` |
| 17 | `scripts/update_years_span_from_extremos.py` | `scripts/maintenance/update_years_span_from_extremos.py` |

## 5. Archivos INTOCABLES (no deben eliminarse en esta fase)

| Archivo | Razón |
|---|---|
| `scripts/infer_region_primary_bdb.py` | Lógica diferente a la versión FP — requiere revisión manual |
| `scripts/populate_taxonomy_v2_FINAL.py` | Referenciado en README.md |
| `scripts/backfill_asset_class_aggressive_v1.js` | Sin equivalente en maintenance (su duplicado exacto estaba en archive, ya externalizado) |
| `scripts/backfill_asset_class_fill_only_v1.js` | Ídem |
| `scripts/apply_manual_overrides.js` | Sin equivalente en maintenance |
| `scripts/migrate_regions_to_canonical.js` | Sin equivalente en maintenance (estaba en archive) |
| `scripts/migrate_sectors_to_canonical.js` | Ídem |
| `scripts/aggressive_audit.py` | Sin equivalente en maintenance |
| `scripts/dedupe_retro_excel.js` | Sin equivalente en maintenance |
| `scripts/remediate_orphans.py` | Sin equivalente en maintenance |
| `scripts/seed_emulator_data.py` | Sin equivalente en maintenance |
| `scripts/convert_font.py` | Utilidad única |
| `scripts/create_fonts_ts.py` | Utilidad única |
| `scripts/validate_manual_overrides.js` | Referenciado por `package.json` scripts |
| `scripts/package.json` | Definición de dependencias JS |
| `scripts/package-lock.json` | Lock de dependencias |

## 6. Secuencia de Ejecución Segura

```
Paso 1: Actualizar package.json raíz
        - Cambiar main de "audit_derived_unknowns.js" a "scripts/maintenance/audit_derived_unknowns.js"

Paso 2: Actualizar scripts/package.json
        - Cambiar main de "update_retrocessions_funds_v3.js" a "maintenance/update_retrocessions_funds_v3.js"

Paso 3: Verificar que ambos JSON son válidos

Paso 4: Eliminar los 17 scripts raíz

Paso 5: Verificar que las 17 copias maintenance existen

Paso 6: Verificar que los 16 archivos intocables siguen en raíz

Paso 7: git status
```

## 7. Prompt Recomendado para Ejecución

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 3B.5 — eliminar 17 duplicados header-only de scripts/ raíz.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 3B.5.
- NO toques los 16 archivos listados como INTOCABLES en
  docs/CLEANUP_PHASE_3B5_HEADER_ONLY_DUPLICATES_PLAN.md sección 5.
- NO toques functions_python/scripts/.
- NO toques script_manifest.json.
- NO toques README.md.
- NO ejecutes ningún script.
- NO modifiques código funcional.
- NO toques credenciales.
- NO toques frontend/src/.
- NO toques functions_python/api/ ni functions_python/services/.
- No imprimas secretos.

OBJETIVO:
1. Actualizar package.json raíz: main → "scripts/maintenance/audit_derived_unknowns.js"
2. Actualizar scripts/package.json: main → "maintenance/update_retrocessions_funds_v3.js"
3. Verificar ambos JSON válidos.
4. Eliminar los 17 scripts raíz listados en sección 4 del plan.
5. Verificar las 17 versiones maintenance presentes.
6. Verificar los 16 archivos intocables presentes.
7. git status.

ENTREGABLE:
Crear: docs/CLEANUP_PHASE_3B5_HEADER_ONLY_DUPLICATES_REMOVAL_REPORT.md
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido movido, borrado, ejecutado ni modificado durante esta planificación. El repositorio permanece en su estado post-FASE 3B.4.
