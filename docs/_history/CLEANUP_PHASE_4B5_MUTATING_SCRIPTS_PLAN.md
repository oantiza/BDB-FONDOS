# FASE 4B.5 — Plan de Refactor de Scripts Mutantes y Residuales

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.

---

## 1. Estado Actual Post-4B.4

| Categoría | Archivos | Estado |
|---|---|---|
| HAS_GAC + READONLY (ya completados) | 14 | ✅ Commiteados |
| HAS_GAC + WRITES (ya compatibles) | 2 | ✅ No requieren cambio |
| NO_GAC + READONLY (pendientes) | 7 | ⏳ Sublote 4B.5A |
| NO_GAC + WRITES (mutantes) | 33 | ⏳ Sublotes 4B.5B–D |
| FALSE_POSITIVE | 2 | ✅ Ignorar |
| LEGACY (data/work/) | 2 | ✅ Ignorar |
| **Total con ref SAK** | **60** | — |

---

## 2. Sublote 4B.5A — Python Solo Lectura Residual (7 archivos)

Scripts que usan Firebase pero NO escriben. Se omitieron del Lote 1 por estar en subdirectorios no cubiertos.

| # | Archivo | Escribe | Firebase |
|---|---|---|---|
| 1 | `fp/scripts/audit/analyze_history_anomalies.py` | ❌ | ✅ |
| 2 | `fp/scripts/audit/audit_fund_data.py` | ❌ | ✅ |
| 3 | `fp/scripts/audit/audit_taxonomy_v2.py` | ❌ | ✅ |
| 4 | `fp/scripts/debug/debug_fondibas.py` | ❌ | ✅ |
| 5 | `fp/scripts/debug/find_fund_by_isin.py` | ❌ | ✅ |
| 6 | `fp/scripts/debug/inspect_anomaly_dates.py` | ❌ | ✅ |
| 7 | `fp/scripts/fixes/fix_and_reparse_anomalies.py` | ❌ | ✅ |

**Riesgo:** BAJO — Idéntico al Lote 1.
**Patrón:** Mismo que 4B.3 (Python GAC → fallback).
**Pruebas:** `python -m py_compile`.

---

## 3. Sublote 4B.5B — Mutantes con Dry-Run (16 archivos)

Scripts que escriben pero tienen modo `--dry-run` o `DRY_RUN`. El refactor de init no cambia la lógica de escritura.

### Python con dry-run (8)

| # | Archivo | Operaciones | Colección | Dry-run |
|---|---|---|---|---|
| 1 | `fp/scripts/audit/sample_taxonomy_review_50.py` | .update | funds_v3 | ✅ |
| 2 | `fp/scripts/fixes/clean_csv_categories.py` | .update | funds_v3 | ✅ |
| 3 | `fp/scripts/fixes/sync_categories_to_firestore.py` | .update | funds_v3 | ✅ |
| 4 | `fp/scripts/migration/populate_taxonomy_v2.py` | .update | funds_v3 | ✅ |
| 5 | `fp/scripts/migration/populate_taxonomy_v2_backup.py` | .update | funds_v3 | ✅ |
| 6 | `fp/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py` | .update | funds_v3 | ✅ |
| 7 | `fp/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py` | .update | funds_v3 | ✅ |
| 8 | `fp/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py` | .update | funds_v3 | ✅ |

### JS con dry-run (8)

| # | Archivo | Operaciones | Colección | Dry-run |
|---|---|---|---|---|
| 9 | `scripts/maintenance/import_retrocesiones.js` | .update, batch | funds_v3 | ✅ |
| 10 | `scripts/maintenance/recalculate_derived_fields.js` | .set, .add, bulk | funds_v3 | ✅ |
| 11 | `scripts/maintenance/refresh_derived_data.js` | .update, batch | funds_v3 | ✅ |
| 12 | `scripts/maintenance/repair_costs_funds_v3.js` | .update, .delete, bulk | funds_v3 | ✅ |
| 13 | `scripts/maintenance/set_retro_zero.js` | .update, bulk | funds_v3 | ✅ |
| 14 | `scripts/maintenance/validate_nav_pipeline.py` | .update, batch | funds_v3, historico_vl | ✅ |
| 15 | `scripts/maintenance/verify_history.py` | .set, .delete | historico_vl | ✅ |
| 16 | `scripts/maintenance/populate_taxonomy_v2.py` | .update | funds_v3 | ✅ |

**Riesgo:** BAJO — Solo se modifica init, no lógica de escritura. Dry-run existente protege ejecución accidental.

---

## 4. Sublote 4B.5C — Mutantes sin Dry-Run, Riesgo Medio (11 archivos)

### Python sin dry-run (7)

| # | Archivo | Operaciones | Colección | Confirm |
|---|---|---|---|---|
| 1 | `fp/scripts/debug/inspect_categories.py` | .add | funds_v3 | ❌ |
| 2 | `fp/scripts/fixes/clean_classification_v3.py` | .update | funds_v3 | ❌ |
| 3 | `fp/scripts/fixes/fix_data_anomalies.py` | .update | historico_vl | ❌ |
| 4 | `fp/scripts/fixes/trim_last_anomaly.py` | .update | historico_vl | ❌ |
| 5 | `fp/scripts/migration/check_and_import_retrocesion.py` | .set, .add | funds_v3 | ❌ |
| 6 | `fp/scripts/reports/generate_benchmarks.py` | .set, batch | historico_vl, benchmarks | ❌ |
| 7 | `fp/scripts/reports/recalc_metrics_single.py` | .update | funds_v3, historico_vl | ❌ |

### Python sin dry-run — scripts/ (4)

| # | Archivo | Operaciones | Colección | Confirm |
|---|---|---|---|---|
| 8 | `fp/scripts/update_risk_profiles_firestore.py` | .set | unknown | ❌ |
| 9 | `scripts/maintenance/fetch_missing_history.py` | .set, .update | funds_v3, historico_vl | ❌ |
| 10 | `scripts/maintenance/heal_historical_gaps.py` | .update, batch | funds_v3, historico_vl | ❌ |
| 11 | `scripts/populate_taxonomy_v2_FINAL.py` | .update | funds_v3 | ❌ |

**Riesgo:** MEDIO — Refactor de init es seguro, pero estos scripts no tienen protección contra ejecución accidental.

---

## 5. Sublote 4B.5D — Mutantes Peligrosos / Migraciones / Legacy (8 archivos)

### JS peligrosos sin dry-run (6)

| # | Archivo | Operaciones | Colección | Riesgo |
|---|---|---|---|---|
| 1 | `scripts/maintenance/cargador_lotes.js` | .set,.update,.delete,.add,bulk | funds_v3 | 🔴 ALTO |
| 2 | `scripts/maintenance/cargador_lotes_v_2.js` | .set,.update,.delete,.add,bulk | funds_v3 | 🔴 ALTO |
| 3 | `scripts/maintenance/fondos_no_en_csv.js` | .add | funds_v3 | 🟡 MEDIO |
| 4 | `scripts/maintenance/purge_legacy_root_fields.js` | .update,.delete,bulk | funds_v3 | 🔴 ALTO |
| 5 | `scripts/maintenance/update_3_retros.js` | .update | funds_v3 | 🟡 MEDIO |
| 6 | `scripts/remediate_orphans.py` | .update,.delete,batch | funds_v3 | 🔴 ALTO |

### JS migraciones con dry-run (2)

| # | Archivo | Operaciones | Colección | Riesgo |
|---|---|---|---|---|
| 7 | `scripts/migrate_regions_to_canonical.js` | .update,.delete,bulk | funds_v3 | 🟡 MEDIO (dry-run) |
| 8 | `scripts/migrate_sectors_to_canonical.js` | .update,.delete,bulk | funds_v3 | 🟡 MEDIO (dry-run) |

### Variantes legacy/snapshot (3 — candidatos a archivar)

| # | Archivo | Nota |
|---|---|---|
| 1 | `fp/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py` | Snapshot de #1 |
| 2 | `fp/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py` | Snapshot de #1 |
| 3 | `fp/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py` | Snapshot de #1 |

---

## 6. Resumen por Sublote

| Sublote | Descripción | Archivos | Riesgo | Acción init |
|---|---|---|---|---|
| **4B.5A** | Python readonly residual | 7 | BAJO | Refactorizar ahora |
| **4B.5B** | Mutantes con dry-run | 16 | BAJO | Refactorizar ahora |
| **4B.5C** | Mutantes sin dry-run | 11 | MEDIO | Refactorizar ahora |
| **4B.5D** | Peligrosos / migraciones | 8 | ALTO | Refactorizar ahora |
| Legacy snapshots | Variantes archivo | 3 | — | Refactorizar (son copias) |

> [!IMPORTANT]
> **TODOS los sublotes son seguros de refactorizar** porque SOLO se modifica la inicialización Firebase, NO la lógica de escritura. La distinción por riesgo es para documentar la peligrosidad del script en sí, no del refactor.

---

## 7. Patrón de Refactor

### Python
```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists(<relative_sak_path>):
        firebase_admin.initialize_app(credentials.Certificate(<path>))
    else:
        firebase_admin.initialize_app()
```

### JS/CJS
```javascript
if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const saPath = path.join(__dirname, ...);
        if (fs.existsSync(saPath)) {
            admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
        } else {
            admin.initializeApp();
        }
    }
}
```

---

## 8. Pruebas Seguras

- **Python:** `python -m py_compile <archivo>`
- **JS:** `node --check <archivo>`
- **NO ejecutar** ningún script.
- **NO conectar** a Firestore.
- **Grep** post-refactor para confirmar GAC presente.

---

## 9. Estrategia de Ejecución Recomendada

Dado que el riesgo del refactor es siempre el mismo (solo cambia init, no lógica), se recomienda ejecutar **todos los sublotes en una sola sesión** para completar FASE 4B.5 eficientemente.

**Total archivos a refactorizar: 45** (7 + 16 + 11 + 8 + 3).

---

## 10. Prompt Recomendado para Ejecutar FASE 4B.5

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.5 — refactorizar TODOS los scripts mutantes
y readonly residuales para GOOGLE_APPLICATION_CREDENTIALS.

REGLAS:
- Edita SOLO la inicialización Firebase.
- NO cambies lógica de escritura.
- NO ejecutes scripts.
- NO toques credenciales.
- NO hagas push.

Seguir docs/CLEANUP_PHASE_4B5_MUTATING_SCRIPTS_PLAN.md.

Sublotes: 4B.5A (7 readonly) + 4B.5B (16 dry-run) + 4B.5C (11 sin dry-run) + 4B.5D (8 peligrosos) + 3 legacy.
Total: 45 archivos.

Verificar con py_compile / node --check.
Commit: "chore: support env-based Firebase init in all remaining scripts"
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido editado, movido ni ejecutado. Solo análisis y documentación.
