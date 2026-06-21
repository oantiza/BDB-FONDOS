# FASE 4B.5C.2 — Plan: 5 Mutantes Bajo Riesgo sin Dry-Run

**Fecha:** 2026-05-04  
**Estado:** PLAN — solo análisis, sin modificaciones.  
**Contexto:** 45 scripts refactorizados. Último commit: `9b0beee`.

---

## 1. Lista Exacta de 5 Scripts

| # | Archivo | Lenguaje |
|---|---|---|
| 1 | `scripts/maintenance/update_3_retros.js` | JS |
| 2 | `functions_python/scripts/reports/recalc_metrics_single.py` | Python |
| 3 | `functions_python/scripts/fixes/fix_data_anomalies.py` | Python |
| 4 | `functions_python/scripts/fixes/trim_last_anomaly.py` | Python |
| 5 | `functions_python/scripts/update_risk_profiles_firestore.py` | Python |

---

## 2. Análisis Detallado por Script

### Script 1: `scripts/maintenance/update_3_retros.js`

| Campo | Valor |
|---|---|
| **Lenguaje** | JavaScript |
| **Escritura** | `.update()` |
| **Colección** | `funds_v3` |
| **Scope** | Whitelist de 3 ISINs hardcoded |
| **Confirmación manual** | No |
| **Rollback/log** | Console.log por ISIN |
| **Riesgo inherente** | BAJO — solo 3 documentos específicos |
| **Riesgo refactor init** | BAJO |

**Init actual (L14–19):**
```javascript
const SA_PATH = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(SA_PATH);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
```

**Cambio propuesto:** Patrón D estándar — `process.env.GOOGLE_APPLICATION_CREDENTIALS` → `applicationDefault()` → `fs.existsSync(SA_PATH)` → fallback. Añadir `require("fs")`.

---

### Script 2: `functions_python/scripts/reports/recalc_metrics_single.py`

| Campo | Valor |
|---|---|
| **Lenguaje** | Python |
| **Escritura** | `.update()` (L157: `fund_ref.update(new_metrics)`) |
| **Colección** | `funds_v3` (lectura+escritura), `historico_vl_v2` (lectura) |
| **Scope** | Single-doc — un solo ISIN pasado como argumento |
| **Confirmación manual** | No (pero `__main__` tiene `pass`, no ejecuta nada por defecto) |
| **Rollback/log** | Print de métricas nuevas antes de actualizar |
| **Riesgo inherente** | BAJO — single-doc, __main__ no ejecuta |
| **Riesgo refactor init** | BAJO |

**Init actual (L23–34):**
```python
def initialize():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        if os.path.exists("./serviceAccountKey.json"):
            cred = credentials.Certificate("./serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        elif os.path.exists("../serviceAccountKey.json"):
            cred = credentials.Certificate("../serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
    return firestore.client()
```

**Cambio propuesto:** Insertar GAC check como primera opción dentro del `except ValueError`.

---

### Script 3: `functions_python/scripts/fixes/fix_data_anomalies.py`

| Campo | Valor |
|---|---|
| **Lenguaje** | Python |
| **Escritura** | `.update()` (L113: `h_ref.update({series_field: new_list})`) |
| **Colección** | `historico_vl_v2` |
| **Scope** | Driven por `audit_results.csv` — solo fondos con `DATA_ANOMALY` |
| **Confirmación manual** | No |
| **Rollback/log** | Print de ISINs procesados + CSV de salida |
| **Riesgo inherente** | MEDIO-BAJO — batch pero limitado por CSV input |
| **Riesgo refactor init** | BAJO |

**Init actual (L21–33):** Idéntico a `recalc_metrics_single.py` — `get_app()` → `except` → path checks.

**Cambio propuesto:** Mismo patrón — insertar GAC check como primera opción.

---

### Script 4: `functions_python/scripts/fixes/trim_last_anomaly.py`

| Campo | Valor |
|---|---|
| **Lenguaje** | Python |
| **Escritura** | `.update()` (L54: `doc_ref.update({"history": clean_history})`) |
| **Colección** | `historico_vl_v2` |
| **Scope** | Single-doc — ISIN `LU0251853072` hardcoded |
| **Confirmación manual** | No |
| **Rollback/log** | Print antes/después de puntos |
| **Riesgo inherente** | BAJO — un solo documento |
| **Riesgo refactor init** | BAJO |

**Init actual (L22–27):**
```python
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate(KEY_PATH)
        initialize_app(cred)
except:
    pass
```

**Cambio propuesto:** Insertar GAC check antes de `Certificate(KEY_PATH)`. Conservar `KEY_PATH` como fallback.

---

### Script 5: `functions_python/scripts/update_risk_profiles_firestore.py`

| Campo | Valor |
|---|---|
| **Lenguaje** | Python |
| **Escritura** | `.set()` (L51: `doc_ref.set(payload)`) |
| **Colección** | `system_settings` (documento `risk_profiles`) |
| **Scope** | Single-doc — solo `system_settings/risk_profiles` |
| **Confirmación manual** | No |
| **Rollback/log** | Print de éxito |
| **Riesgo inherente** | BAJO — configuración, no datos de clientes |
| **Riesgo refactor init** | BAJO |

**Init actual (L11–33):** `get_firebase_app()` con loop de paths + fallback `ApplicationDefault()`.

**Cambio propuesto:** Insertar GAC check como primera opción antes del loop de paths.

---

## 3. Tabla Resumen de Riesgo

| # | Script | Escritura | Colección | Scope | Riesgo init |
|---|---|---|---|---|---|
| 1 | `update_3_retros.js` | `.update()` | funds_v3 | 3 ISINs | BAJO |
| 2 | `recalc_metrics_single.py` | `.update()` | funds_v3 | Single-doc | BAJO |
| 3 | `fix_data_anomalies.py` | `.update()` | historico_vl_v2 | CSV-driven | BAJO |
| 4 | `trim_last_anomaly.py` | `.update()` | historico_vl_v2 | 1 ISIN | BAJO |
| 5 | `update_risk_profiles_firestore.py` | `.set()` | system_settings | 1 doc config | BAJO |

**Riesgo de refactorizar la inicialización: BAJO en los 5 casos.**  
El cambio no afecta la lógica de escritura, solo la forma de obtener credenciales.

---

## 4. Alcance Exacto del Cambio

### ✅ SE CAMBIARÁ:
- Bloque de inicialización Firebase.
- Soporte para `GOOGLE_APPLICATION_CREDENTIALS`.
- Fallback temporal a `serviceAccountKey.json`.
- Guard `_apps` / `apps.length` si no existe.

### ❌ NO SE CAMBIARÁ:
- Lógica de escritura (`.update()`, `.set()`).
- Colecciones target.
- Filtros, condiciones, datos.
- ISINs o whitelists.
- Argumentos de CLI.
- Imports funcionales.

---

## 5. Patrones de Refactor

### JS (update_3_retros.js) — Patrón D

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

### Python — Patrón B (recalc_metrics_single, fix_data_anomalies)

```python
try:
    app = firebase_admin.get_app()
except ValueError:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists("./serviceAccountKey.json"):
        cred = credentials.Certificate("./serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    elif os.path.exists("../serviceAccountKey.json"):
        cred = credentials.Certificate("../serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
```

### Python — Patrón C (trim_last_anomaly, update_risk_profiles)

```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists(KEY_PATH):
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
```

---

## 6. Verificaciones Seguras

| Verificación | Método |
|---|---|
| Compilación Python | `python -m py_compile` sobre los 4 Python |
| Sintaxis JS | `node --check` sobre el 1 JS |
| GAC presente | `grep GOOGLE_APPLICATION_CREDENTIALS` en los 5 |
| No escrituras nuevas | Verificar que `.update()` / `.set()` no se añadieron |
| Credenciales intactas | `Test-Path` de SAK, .env, frontend/.env |
| No ejecución | 0 scripts ejecutados, 0 conexiones Firestore |

---

## 7. Scripts NO Autorizados (Fases Posteriores)

### 4B.5C.3 — Medio riesgo (NO TOCAR)
- `clean_classification_v3.py`
- `generate_benchmarks.py`
- `check_and_import_retrocesion.py`
- `fetch_missing_history.py`
- `heal_historical_gaps.py`

### 4B.5C.4a — Alto riesgo (NO TOCAR)
- `purge_legacy_root_fields.js`
- `remediate_orphans.py`

### 4B.5C.4b — Bloqueados (NO TOCAR)
- `migrate_reports.py`
- `cargador_lotes.js`
- `cargador_lotes_v_2.js`

---

## 8. Prompt Recomendado para Ejecución 4B.5C.2

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.5C.2 — refactor 5 mutantes bajo riesgo para GAC.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 4B.5C.2.
- Sigue docs/CLEANUP_PHASE_4B5C2_LOW_RISK_MUTANTS_PLAN.md.
- NO toques 4B.5C.3, 4B.5C.4a ni 4B.5C.4b.
- NO toques scripts bloqueados.
- NO cambies lógica de escritura.
- NO cambies colecciones, filtros, datos.
- NO ejecutes scripts funcionales.
- NO conectes a Firestore.
- NO muevas serviceAccountKey.json.
- NO borres serviceAccountKey.json.
- NO edites .env.
- NO edites frontend/.env.
- NO hagas push.
- No imprimas secretos.

OBJETIVO:
Refactorizar SOLO estos 5 archivos:
1. scripts/maintenance/update_3_retros.js
2. functions_python/scripts/reports/recalc_metrics_single.py
3. functions_python/scripts/fixes/fix_data_anomalies.py
4. functions_python/scripts/fixes/trim_last_anomaly.py
5. functions_python/scripts/update_risk_profiles_firestore.py

Patrón: GAC-first → fallback local → default.
Verificar: py_compile / node --check + grep GAC.
Crear report en docs/CLEANUP_PHASE_4B5C2_LOW_RISK_MUTANTS_REFACTOR_REPORT.md.
```

---

## 9. Confirmaciones

- ✅ No se modificó ningún archivo de código.
- ✅ No se ejecutó ningún script.
- ✅ No se hizo commit ni push.
- ✅ No se tocaron credenciales.
- ✅ Solo análisis y documentación.
