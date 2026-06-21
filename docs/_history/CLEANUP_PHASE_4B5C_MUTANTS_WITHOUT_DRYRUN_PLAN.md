# FASE 4B.5C — Plan: Scripts Mutantes sin Dry-Run

**Fecha:** 2026-05-04  
**Estado:** PLAN — solo análisis, sin modificaciones.  
**Contexto:** 40 scripts ya refactorizados en commits `64bb990`, `42f16ed`, `e2f687a`, `0654592`.

---

## 1. Inventario Actual Post-Commit `0654592`

### 1.1 Archivos con `serviceAccountKey` sin soporte GAC

Se detectaron **23 archivos** que aún referencian `serviceAccountKey.json` sin soporte `GOOGLE_APPLICATION_CREDENTIALS`.

Tras análisis, se desglosan en:

| Categoría | Cantidad | Acción |
|---|---|---|
| Falsos positivos (no usan SAK para auth) | 2 | No tocar |
| Legacy backups (carpeta `data/work/legacy_roots/`) | 2 | No tocar |
| Snapshots readonly (copias de scripts ya refactorizados) | 3 | Sublote 4B.5C.1 |
| Readonly reales (`.add()` es `set.add()`, no Firestore) | 2 | Sublote 4B.5C.1 |
| Mutantes sin dry-run — bajo riesgo | 5 | Sublote 4B.5C.2 |
| Mutantes sin dry-run — medio riesgo | 5 | Sublote 4B.5C.3 |
| Mutantes sin dry-run — alto riesgo | 2 | Sublote 4B.5C.4 (bloquear) |
| Cross-project migration | 1 | Sublote 4B.5C.4 (bloquear) |
| Cargadores principales (infraestructura) | 2 | Sublote 4B.5C.4 (bloquear) |

**Total real pendiente de refactor init:** 19 archivos (excluidos falsos positivos y legacy).

---

## 2. Falsos Positivos y Exclusiones

### 2.1 Falsos Positivos (no tocar)

| Archivo | Motivo |
|---|---|
| `scripts/maintenance/create_zip.py` | Referencia SAK solo para incluirlo en ZIP, no para auth. |
| `scripts/repo/create_backup.py` | Referencia SAK solo para incluirlo en backup, no para auth. |

### 2.2 Legacy Backups (no tocar)

| Archivo | Motivo |
|---|---|
| `data/work/legacy_roots/_backup_old/legacy_scripts/cargador_lotes.js` | Copia legacy archivada. |
| `data/work/legacy_roots/_backup_old/legacy_scripts/cargador_lotes_CORREGIDO.js` | Copia legacy archivada. |

---

## 3. Tabla de Riesgo Completa

### 3.1 Sublote 4B.5C.1 — Readonly / Snapshots (sin escrituras Firestore)

| # | Archivo | Lenguaje | Escrituras | Colección | Riesgo Init | Recomendación |
|---|---|---|---|---|---|---|
| 1 | `functions_python/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py` | Python | `set.add()` — Python set, NO Firestore | funds_v3 (lectura) | BAJO | a) Refactorizar solo init |
| 2 | `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py` | Python | `set.add()` — Python set, NO Firestore | funds_v3 (lectura) | BAJO | a) Refactorizar solo init |
| 3 | `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py` | Python | `set.add()` — Python set, NO Firestore | funds_v3 (lectura) | BAJO | a) Refactorizar solo init |
| 4 | `functions_python/scripts/debug/inspect_categories.py` | Python | `set.add()` — Python set, NO Firestore | funds_v3 (lectura) | BAJO | a) Refactorizar solo init |
| 5 | `scripts/maintenance/fondos_no_en_csv.js` | JS | `Set.add()` — JS Set, NO Firestore | funds_v3 (lectura) | BAJO | a) Refactorizar solo init |

**Análisis:** Los 5 scripts son en realidad **de solo lectura**. Las llamadas `.add()` son sobre conjuntos Python/JS (`set.add()`, `Set.add()`), no sobre colecciones Firestore. Se podrían haber clasificado como readonly en fases anteriores.

**Init block tipo:**
- #1–3: `init_firebase()` con key_paths (idéntico a Patrón A ya conocido, sin GAC).
- #4: Bare `credentials.Certificate("./serviceAccountKey.json")`.
- #5: `require(path.join(__dirname, "serviceAccountKey.json"))` sin guard `apps.length`.

---

### 3.2 Sublote 4B.5C.2 — Mutantes bajo riesgo (scope reducido, whitelist o single-doc)

| # | Archivo | Lenguaje | Escrituras | Colección | Guard | Riesgo | Recomendación |
|---|---|---|---|---|---|---|---|
| 6 | `scripts/maintenance/update_3_retros.js` | JS | `.update()` | funds_v3 | Whitelist 3 ISINs fijos | BAJO | a) Refactorizar solo init |
| 7 | `functions_python/scripts/reports/recalc_metrics_single.py` | Python | `.update()` | funds_v3, historico_vl_v2 | `--limit` disponible | BAJO | a) Refactorizar solo init |
| 8 | `functions_python/scripts/fixes/fix_data_anomalies.py` | Python | `.update()` | historico_vl_v2 | Ninguno | MEDIO-BAJO | a) Refactorizar solo init |
| 9 | `functions_python/scripts/fixes/trim_last_anomaly.py` | Python | `.update()` | historico_vl_v2 | Ninguno | MEDIO-BAJO | a) Refactorizar solo init |
| 10 | `functions_python/scripts/update_risk_profiles_firestore.py` | Python | `.set()` | system_settings | Scope limitado (config) | BAJO | a) Refactorizar solo init |

**Análisis:**
- `update_3_retros.js`: Solo actualiza 3 ISINs hardcoded. Zero riesgo masivo.
- `recalc_metrics_single.py`: Tiene `--limit`. Actualiza un fondo específico.
- `fix_data_anomalies.py` y `trim_last_anomaly.py`: Actualizan historial pero con scope claro.
- `update_risk_profiles_firestore.py`: Escribe en `system_settings`, no en datos de fondos.

---

### 3.3 Sublote 4B.5C.3 — Mutantes medio riesgo (batch/masivos sin dry-run)

| # | Archivo | Lenguaje | Escrituras | Colección | Guard | Riesgo | Recomendación |
|---|---|---|---|---|---|---|---|
| 11 | `functions_python/scripts/fixes/clean_classification_v3.py` | Python | `.update()` | funds_v3 | Ninguno | MEDIO | a) Refactorizar solo init |
| 12 | `functions_python/scripts/reports/generate_benchmarks.py` | Python | `.set()`, `batch.commit` | synthetic_benchmarks | Ninguno | MEDIO | a) Refactorizar solo init |
| 13 | `functions_python/scripts/migration/check_and_import_retrocesion.py` | Python | `.set()` | funds_v3 | `--import` / `--force` flags | MEDIO | a) Refactorizar solo init |
| 14 | `scripts/maintenance/fetch_missing_history.py` | Python | `.set()`, `.update()` | funds_v3, historico_vl_v2 | `--limit` disponible | MEDIO | a) Refactorizar solo init |
| 15 | `scripts/maintenance/heal_historical_gaps.py` | Python | `.update()`, `batch.commit` | historico_vl_v2, funds_v3 | Ninguno | MEDIO | a) Refactorizar solo init |

**Análisis:**
- `check_and_import_retrocesion.py`: Tiene flags `--import` y `--force` — sin flag es solo lectura (readonly por defecto).
- `generate_benchmarks.py`: Escribe en `synthetic_benchmarks` (no datos de clientes).
- `clean_classification_v3.py`: Actualiza `funds_v3` en batch pero es idempotente.
- `fetch_missing_history.py`: Tiene `--limit` como safety.
- `heal_historical_gaps.py`: Batch updates sin limit — algo más peligroso.

---

### 3.4 Sublote 4B.5C.4 — Alto riesgo / Bloquear

| # | Archivo | Lenguaje | Escrituras | Colección | Guard | Riesgo | Recomendación |
|---|---|---|---|---|---|---|---|
| 16 | `scripts/maintenance/purge_legacy_root_fields.js` | JS | `.update()`, `FieldValue.delete()`, `bulkWriter` | funds_v3 | Ninguno | ALTO | a) Refactorizar solo init, pero **documentar riesgo** |
| 17 | `scripts/remediate_orphans.py` | Python | `.delete()`, `.update()`, `batch.commit` | funds_v3 | Ninguno | ALTO | a) Refactorizar solo init, pero **documentar riesgo** |
| 18 | `functions_python/scripts/migration/migrate_reports.py` | Python | `.set()` | analysis_results | Cross-project (2 Firebase apps) | ALTO | c) Bloquear — requiere revisión especial |
| 19 | `scripts/maintenance/cargador_lotes.js` | JS | `.set()`, `.update()`, `.delete()`, `.add()`, `bulkWriter`, `FieldValue.delete` | funds_v3 | `readline.question` confirmación manual | ALTO | c) Bloquear — infraestructura core |
| — | `scripts/maintenance/cargador_lotes_v_2.js` | JS | (idéntico al anterior) | funds_v3 | Confirmación manual | ALTO | c) Bloquear — infraestructura core |

**Análisis:**
- `purge_legacy_root_fields.js`: `bulkWriter` con `FieldValue.delete()` masivo sobre `funds_v3`. Sin dry-run. Solo refactorizar init es seguro.
- `remediate_orphans.py`: `batch.delete()` sobre `funds_v3`. Sin dry-run. Solo refactorizar init es seguro.
- `migrate_reports.py`: **Cross-project** — conecta a `boutique-financiera-app` Y `bdb-fondos`. Requiere revisión especial del patrón multi-app.
- `cargador_lotes.js` / `cargador_lotes_v_2.js`: **Motor de carga principal**. Máximo riesgo. Tiene confirmación `readline` pero es el pipeline de producción.

---

## 4. Política de Ejecución

### 4.1 Reglas Inmutables

1. **NO ejecutar** ningún script sin dry-run durante el refactor.
2. **NO cambiar** lógica de escritura en FASE 4B.5C.
3. **Solo modificar** el bloque de inicialización Firebase.
4. **Mantener** fallback temporal a `serviceAccountKey.json`.
5. **Verificar** solo sintaxis (`py_compile` / `node --check`).
6. **NO conectar** a Firestore.

### 4.2 Patrón de Refactor

**Python (Patrón A — key_paths):**
```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    else:
        # ... key_paths fallback existente
```

**Python (Patrón B — bare Certificate):**
```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists("./serviceAccountKey.json"):
        cred = credentials.Certificate("./serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
```

**JS (Patrón D — apps.length guard):**
```javascript
if (!admin.apps.length) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
    } else {
        const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
        if (fs.existsSync(SA_PATH)) {
            admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
        } else {
            admin.initializeApp();
        }
    }
}
```

---

## 5. Plan de Sublotes

### 5.1 Sublote 4B.5C.1 — Readonly / Snapshots (5 archivos)

**Riesgo:** BAJO  
**Archivos:**
1. `functions_python/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py`
2. `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py`
3. `functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py`
4. `functions_python/scripts/debug/inspect_categories.py`
5. `scripts/maintenance/fondos_no_en_csv.js`

**Justificación:** Cero escrituras Firestore. Las llamadas `.add()` son sobre sets Python/JS, no colecciones.

**Acción:** Refactorizar solo init → verificar sintaxis → commit.

---

### 5.2 Sublote 4B.5C.2 — Mutantes bajo riesgo (5 archivos)

**Riesgo:** BAJO  
**Archivos:**
1. `scripts/maintenance/update_3_retros.js`
2. `functions_python/scripts/reports/recalc_metrics_single.py`
3. `functions_python/scripts/fixes/fix_data_anomalies.py`
4. `functions_python/scripts/fixes/trim_last_anomaly.py`
5. `functions_python/scripts/update_risk_profiles_firestore.py`

**Justificación:** Scope reducido (whitelist, limit, single-doc) o colección no-crítica.

**Acción:** Refactorizar solo init → verificar sintaxis → commit.

---

### 5.3 Sublote 4B.5C.3 — Mutantes medio riesgo (5 archivos)

**Riesgo:** MEDIO  
**Archivos:**
1. `functions_python/scripts/fixes/clean_classification_v3.py`
2. `functions_python/scripts/reports/generate_benchmarks.py`
3. `functions_python/scripts/migration/check_and_import_retrocesion.py`
4. `scripts/maintenance/fetch_missing_history.py`
5. `scripts/maintenance/heal_historical_gaps.py`

**Justificación:** Batch writes sin dry-run pero idempotentes o con flags de protección.

**Acción:** Refactorizar solo init → verificar sintaxis → commit.

---

### 5.4 Sublote 4B.5C.4 — Alto riesgo / Bloquear (4 archivos)

**Riesgo:** ALTO  
**Archivos:**
1. `scripts/maintenance/purge_legacy_root_fields.js` — `FieldValue.delete` masivo
2. `scripts/remediate_orphans.py` — `batch.delete()` sobre funds_v3
3. `functions_python/scripts/migration/migrate_reports.py` — Cross-project multi-app
4. `scripts/maintenance/cargador_lotes.js` + `cargador_lotes_v_2.js` — Pipeline de producción

**Acción propuesta:**
- `purge_legacy_root_fields.js` y `remediate_orphans.py`: **Refactorizar solo init** es seguro (no cambia lógica). Hacerlo con máxima precaución.
- `migrate_reports.py`: **BLOQUEAR**. Usa patrón multi-app con credenciales inline. Requiere diseño especial.
- `cargador_lotes.js` / `cargador_lotes_v_2.js`: **BLOQUEAR**. Son el motor de carga principal. Cualquier cambio requiere testing en staging.

---

## 6. Resumen de Acciones Propuestas

| Sublote | Archivos | Riesgo | Acción | ¿Ejecutable? |
|---|---|---|---|---|
| 4B.5C.1 | 5 | BAJO | Refactorizar init | ✅ SÍ |
| 4B.5C.2 | 5 | BAJO | Refactorizar init | ✅ SÍ |
| 4B.5C.3 | 5 | MEDIO | Refactorizar init | ✅ SÍ con precaución |
| 4B.5C.4a | 2 | ALTO | Refactorizar init | ⚠️ SÍ pero documentar |
| 4B.5C.4b | 3 | ALTO | BLOQUEAR | ❌ NO tocar |

**Total refactorizable:** 17 archivos (sublotes 1–3 + 4a).  
**Total bloqueado:** 3 archivos (`migrate_reports.py` + 2 `cargador_lotes`).

---

## 7. Prompt Recomendado para 4B.5C.1

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.5C.1 — readonly/snapshots sin GAC.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 4B.5C.1.
- Sigue docs/CLEANUP_PHASE_4B5C_MUTANTS_WITHOUT_DRYRUN_PLAN.md.
- NO toques scripts mutantes.
- NO ejecutes scripts funcionales.
- NO muevas serviceAccountKey.json.
- NO borres serviceAccountKey.json.
- NO edites .env.
- NO edites frontend/.env.
- NO hagas push.
- No imprimas secretos.

OBJETIVO:
Refactorizar SOLO estos 5 archivos readonly/snapshots:
1. functions_python/scripts/audit/sample_taxonomy_review_50_FINAL_STABLE.py
2. functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_31conflicts.py
3. functions_python/scripts/audit/sample_taxonomy_review_50_STABLE_71conflicts.py
4. functions_python/scripts/debug/inspect_categories.py
5. scripts/maintenance/fondos_no_en_csv.js

Patrón: GAC-first → fallback local → default.
Verificar: py_compile / node --check.
Crear report en docs/CLEANUP_PHASE_4B5C1_READONLY_REFACTOR_REPORT.md.
```

---

## 8. Confirmaciones

- ✅ No se modificó ningún archivo de código.
- ✅ No se ejecutó ningún script.
- ✅ No se hizo commit ni push.
- ✅ No se tocaron credenciales.
- ✅ Solo análisis y documentación.
