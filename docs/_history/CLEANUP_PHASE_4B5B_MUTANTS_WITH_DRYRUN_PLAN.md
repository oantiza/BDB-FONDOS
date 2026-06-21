# FASE 4B.5B — Plan de Refactor: Scripts Mutantes con Dry-Run

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.

---

## 1. Resumen del Sublote

| Propiedad | Valor |
|---|---|
| Total archivos | **19** |
| Python | 12 |
| JS | 7 |
| Todos tienen dry-run | ✅ |
| Todos NO tienen GAC | ✅ |
| Riesgo del refactor | **BAJO** (solo init) |

---

## 2. Inventario Completo

### 2A. Python con dry-run (12 archivos)

| # | Archivo | Writes | Colección | Init actual | Líneas init |
|---|---|---|---|---|---|
| 1 | `fp/scripts/audit/sample_taxonomy_review_50.py` | .update | funds_v3 | `init_firebase()` + key_paths | ~L146-178 |
| 2 | `fp/scripts/fixes/clean_csv_categories.py` | .update | funds_v3 | `_apps` + bare Certificate | L9-11 |
| 3 | `fp/scripts/fixes/sync_categories_to_firestore.py` | .update | funds_v3 | `_apps` + bare Certificate | L9-11 |
| 4 | `fp/scripts/migration/populate_taxonomy_v2.py` | .update | funds_v3 | `init_firebase()` + key_paths | ~L174-206 |
| 5 | `fp/scripts/migration/populate_taxonomy_v2_backup.py` | .update | funds_v3 | `init_firebase()` + key_paths | ~L93-125 |
| 6 | `fp/scripts/migration/populate_taxonomy_v2_FINAL_STABLE.py` | .update | funds_v3 | `init_firebase()` + key_paths | similar |
| 7 | `fp/scripts/migration/populate_taxonomy_v2_STABLE_31conflicts.py` | .update | funds_v3 | `init_firebase()` + key_paths | similar |
| 8 | `fp/scripts/migration/populate_taxonomy_v2_STABLE_71conflicts.py` | .update | funds_v3 | `init_firebase()` + key_paths | similar |
| 9 | `scripts/maintenance/validate_nav_pipeline.py` | .update, batch | funds_v3, historico_vl | `_apps` + cred_path | L14-22 |
| 10 | `scripts/maintenance/verify_history.py` | .set, .delete | historico_vl | `_apps` + cred_path | L20-23 |
| 11 | `scripts/maintenance/populate_taxonomy_v2.py` | .update | funds_v3 | `init_firebase()` + key_paths | ~L183-215 |
| 12 | `scripts/populate_taxonomy_v2_FINAL.py` | .update | funds_v3 | `init_firebase()` + key_paths | ~L174-206 |

### 2B. JS con dry-run (7 archivos)

| # | Archivo | Writes | Colección | Init actual | Problema |
|---|---|---|---|---|---|
| 13 | `scripts/maintenance/import_retrocesiones.js` | .update, batch | funds_v3 | `apps.length` + require(SA_PATH) | require fuera de guard |
| 14 | `scripts/maintenance/recalculate_derived_fields.js` | .set, .add, bulk | funds_v3 | `apps.length` + hard exit | `process.exit(1)` si falta |
| 15 | `scripts/maintenance/refresh_derived_data.js` | .update, batch | funds_v3 | `apps.length` + existsSync + ADC fallback | Ya tiene fallback parcial |
| 16 | `scripts/maintenance/repair_costs_funds_v3.js` | .update, .delete, bulk | funds_v3 | bare init + **absolute path** | 🔴 Path a `ROBOT_CARGA` |
| 17 | `scripts/maintenance/set_retro_zero.js` | .update, bulk | funds_v3 | `apps.length` + require inline | require fuera de guard |
| 18 | `scripts/migrate_regions_to_canonical.js` | .update, .delete, bulk | funds_v3 | bare init + **absolute path** | 🔴 Path a `ROBOT_CARGA` |
| 19 | `scripts/migrate_sectors_to_canonical.js` | .update, .delete, bulk | funds_v3 | bare init + **absolute path** | 🔴 Path a `ROBOT_CARGA` |

---

## 3. Patrones de Init Detectados

### Patrón A: `init_firebase()` con key_paths (8 archivos Python)
Scripts #1, #4-8, #11, #12. Tienen función `init_firebase()` con lista de paths. 
**Cambio:** Insertar `os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")` como primera opción antes del loop de key_paths.

### Patrón B: `_apps` guard con Certificate bare (2 archivos Python)
Scripts #2, #3. Usan `credentials.Certificate("serviceAccountKey.json")` directamente.
**Cambio:** Insertar GAC check antes del Certificate.

### Patrón C: `_apps` guard con cred_path (2 archivos Python)
Scripts #9, #10. Construyen path con `os.path.abspath(os.path.join(...))`.
**Cambio:** Insertar GAC check antes del cred_path.

### Patrón D: JS con `apps.length` guard (4 archivos JS)
Scripts #13, #14, #15, #17. Ya tienen guard pero sin GAC.
**Cambio:** Insertar `process.env.GOOGLE_APPLICATION_CREDENTIALS` check.

### Patrón E: JS con absolute path y bare init (3 archivos JS)
Scripts #16, #18, #19. Usan `C:\\Users\\oanti\\OneDrive\\...\\ROBOT_CARGA\\serviceAccountKey.json`.
**Cambio:** Reemplazar con patrón estándar GAC + relative path + guard.

---

## 4. Patrón de Refactor Estándar

### Python — init_firebase() con key_paths
```python
def init_firebase():
    # ... (preservar estructura existente)
    if not firebase_admin._apps:
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            firebase_admin.initialize_app()
            print("[INIT] Firebase initialized via GOOGLE_APPLICATION_CREDENTIALS")
        else:
            key_paths = [...]  # mantener paths existentes
            for kp in key_paths:
                if os.path.exists(kp):
                    cred = credentials.Certificate(kp)
                    firebase_admin.initialize_app(cred)
                    break
            else:
                firebase_admin.initialize_app()
```

### Python — bare Certificate
```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists("serviceAccountKey.json"):
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
```

### JS — patrón estándar
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

## 5. Riesgos Específicos

| Archivo | Riesgo inherente | Riesgo refactor | Nota |
|---|---|---|---|
| #16 repair_costs_funds_v3.js | 🔴 ALTO | BAJO | Path absoluto a eliminar |
| #18 migrate_regions_to_canonical.js | 🔴 ALTO | BAJO | Path absoluto a eliminar |
| #19 migrate_sectors_to_canonical.js | 🔴 ALTO | BAJO | Path absoluto a eliminar |
| #14 recalculate_derived_fields.js | 🟡 MEDIO | BAJO | `process.exit(1)` a eliminar |
| Resto (15 archivos) | 🟢 BAJO | BAJO | Solo insertar GAC check |

> [!IMPORTANT]
> El riesgo del **refactor** es siempre BAJO porque solo se modifica la inicialización Firebase. NO se cambia lógica de escritura ni flags de dry-run.

---

## 6. Verificaciones Seguras

- **Python:** `python -m py_compile <archivo>`
- **JS:** `node --check <archivo>`
- **Grep:** Confirmar `GOOGLE_APPLICATION_CREDENTIALS` presente en los 19 archivos.
- **NO ejecutar** ningún script.
- **NO conectar** a Firestore.
- **Confirmar** que no se añadieron/modificaron operaciones de escritura.

---

## 7. Scripts NO Incluidos en 4B.5B

Estos quedan para 4B.5C/4B.5D:

| Archivo | Razón de exclusión |
|---|---|
| `fp/scripts/debug/inspect_categories.py` | Sin dry-run |
| `fp/scripts/fixes/clean_classification_v3.py` | Sin dry-run |
| `fp/scripts/fixes/fix_data_anomalies.py` | Sin dry-run |
| `fp/scripts/fixes/trim_last_anomaly.py` | Sin dry-run |
| `fp/scripts/migration/check_and_import_retrocesion.py` | Sin dry-run |
| `fp/scripts/reports/generate_benchmarks.py` | Sin dry-run |
| `fp/scripts/reports/recalc_metrics_single.py` | Sin dry-run |
| `fp/scripts/update_risk_profiles_firestore.py` | Sin dry-run |
| `scripts/maintenance/cargador_lotes.js` | Sin dry-run, CONFIRM |
| `scripts/maintenance/cargador_lotes_v_2.js` | Sin dry-run, CONFIRM |
| `scripts/maintenance/fondos_no_en_csv.js` | Sin dry-run |
| `scripts/maintenance/purge_legacy_root_fields.js` | Sin dry-run |
| `scripts/maintenance/update_3_retros.js` | Sin dry-run |
| `scripts/maintenance/fetch_missing_history.py` | Sin dry-run |
| `scripts/maintenance/heal_historical_gaps.py` | Sin dry-run |
| `scripts/remediate_orphans.py` | Sin dry-run |

---

## 8. Prompt Recomendado para Ejecutar FASE 4B.5B

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.5B — refactorizar 19 scripts mutantes 
con dry-run para GOOGLE_APPLICATION_CREDENTIALS.

REGLAS:
- Edita SOLO la inicialización Firebase.
- NO cambies lógica de escritura.
- NO cambies flags dry-run.
- NO ejecutes scripts.
- NO toques credenciales.
- NO hagas push.

Seguir docs/CLEANUP_PHASE_4B5B_MUTANTS_WITH_DRYRUN_PLAN.md.

Total: 19 archivos (12 Python + 7 JS).

Verificar con py_compile / node --check.
No commit automático — reportar resultado.
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido editado, movido ni ejecutado. Solo análisis y documentación.
