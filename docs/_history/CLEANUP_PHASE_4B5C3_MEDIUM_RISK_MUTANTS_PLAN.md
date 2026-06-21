# FASE 4B.5C.3 — Plan: 5 Mutantes Medio Riesgo sin Dry-Run

**Fecha:** 2026-05-04  
**Estado:** PLAN — solo análisis, sin modificaciones.  
**Contexto:** 50 scripts refactorizados. Último commit: `8f0f027`.

---

## 1. Lista Exacta de 5 Scripts

| # | Archivo | Lenguaje |
|---|---|---|
| 1 | `functions_python/scripts/fixes/clean_classification_v3.py` | Python |
| 2 | `functions_python/scripts/reports/generate_benchmarks.py` | Python |
| 3 | `functions_python/scripts/migration/check_and_import_retrocesion.py` | Python |
| 4 | `scripts/maintenance/fetch_missing_history.py` | Python |
| 5 | `scripts/maintenance/heal_historical_gaps.py` | Python |

---

## 2. Análisis Detallado por Script

### Script 1: `clean_classification_v3.py`

| Campo | Valor |
|---|---|
| **Escritura** | `.update()` (L140: `doc.reference.update(updates)`) |
| **Colección** | `funds_v3` |
| **Usa batch** | No — doc individual en loop |
| **CSV/data input** | No — procesa todos los docs de funds_v3 |
| **Afecta múltiples docs** | **SÍ** — itera sobre `funds_v3.stream()` completo |
| **Límite/whitelist** | No |
| **Confirmación manual** | No |
| **Log** | Sí — print por ISIN actualizado + resumen final |
| **Riesgo inherente** | MEDIO — batch masivo sobre funds_v3, pero idempotente (solo arregla mojibake, UNKNOWN region/subtype) |
| **Riesgo refactor init** | BAJO |

**Init actual (L17–23):**
```python
def get_db():
    if not firebase_admin._apps:
        if not os.path.exists(KEY_PATH):
            raise FileNotFoundError(f"Key not found: {KEY_PATH}")
        cred = credentials.Certificate(KEY_PATH)
        firebase_admin.initialize_app(cred)
    return firestore.client()
```

**Cambio:** Insertar GAC check antes de `os.path.exists(KEY_PATH)`.

---

### Script 2: `generate_benchmarks.py`

| Campo | Valor |
|---|---|
| **Escritura** | `batch.set()` + `batch.commit()` (L200, L204) |
| **Colección** | `synthetic_benchmarks` (no datos de clientes) |
| **Usa batch** | **SÍ** — `db.batch()` con 5 documentos |
| **CSV/data input** | No — ISINs hardcoded (IE00B18GC888, IE00B03HCZ61) |
| **Afecta múltiples docs** | Sí, 5 perfiles sintéticos |
| **Límite/whitelist** | 5 perfiles hardcoded (CONSERVADOR, MODERADO, etc.) |
| **Confirmación manual** | No |
| **Log** | Sí — tabla markdown final |
| **Riesgo inherente** | MEDIO-BAJO — solo escribe en synthetic_benchmarks, datos regenerables |
| **Riesgo refactor init** | BAJO |

**Init actual (L34–48):**
```python
def get_db():
    try:
        app = firebase_admin.get_app()
    except ValueError:
        cred_path = os.path.join(...)
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print(f"Error: {cred_path} not found")
            return None
    return firestore.client()
```

**Cambio:** Insertar GAC check como primera opción en `except ValueError`.

---

### Script 3: `check_and_import_retrocesion.py`

| Campo | Valor |
|---|---|
| **Escritura** | `.set(merge=True)` (L173–174) |
| **Colección** | `funds_v3` |
| **Usa batch** | No — doc individual en loop |
| **CSV/data input** | **SÍ** — lee `fondos_con_retrocesion.csv` |
| **Afecta múltiples docs** | Sí, pero solo con `--import` o `--force` |
| **Límite/whitelist** | SÍ — flags `--import`, `--force`, `--isins` |
| **Confirmación manual** | **SÍ** — por defecto es solo lectura |
| **Log** | Sí — reporte detallado de conflictos, imports, errores |
| **Riesgo inherente** | MEDIO — escribe en funds_v3 pero con guards explícitos |
| **Riesgo refactor init** | BAJO |

**Init actual (L39–43):** Module-level sin guard:
```python
if not firebase_admin._apps:
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred)
db = firestore.client()
```

**Cambio:** Insertar GAC check antes de `credentials.Certificate(KEY_PATH)`.

---

### Script 4: `fetch_missing_history.py`

| Campo | Valor |
|---|---|
| **Escritura** | `.set()` (L109) + `.update()` (L164) |
| **Colección** | `historico_vl_v2` (.set) + `funds_v3` (.update) |
| **Usa batch** | No — doc individual en loop |
| **CSV/data input** | No — itera funds_v3 completo |
| **Afecta múltiples docs** | **SÍ** — todos los fondos sin histórico |
| **Límite/whitelist** | No |
| **Confirmación manual** | No |
| **Log** | Sí — resumen detallado con contadores |
| **Riesgo inherente** | MEDIO — API externa (EODHD) + writes multi-colección |
| **Riesgo refactor init** | BAJO |

**Init actual (L14–17):** Module-level sin guard:
```python
sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
cred = credentials.Certificate(sa_path)
firebase_admin.initialize_app(cred)
db = firestore.client()
```

⚠️ **Nota:** Este script tiene una **API key hardcoded** (L19: `EODHD_API_KEY`). Esto NO es parte del scope de 4B.5C pero se documenta para futura revisión.

**Cambio:** Envolver en guard `_apps` + GAC check primero.

---

### Script 5: `heal_historical_gaps.py`

| Campo | Valor |
|---|---|
| **Escritura** | `batch.update()` + `batch.commit()` (L79, L83, L89) |
| **Colección** | `historico_vl_v2` + `funds_v3` |
| **Usa batch** | **SÍ** — `db.batch()` por fondo |
| **CSV/data input** | No — itera todos los fondos activos |
| **Afecta múltiples docs** | **SÍ** — todos los fondos con gaps |
| **Límite/whitelist** | No |
| **Confirmación manual** | No |
| **Log** | Sí — logger con contadores |
| **Riesgo inherente** | MEDIO — concurrent workers (15 hilos) + batch writes |
| **Riesgo refactor init** | BAJO |

**Init actual (L18–25):**
```python
def init_firestore():
    if not firebase_admin._apps:
        cred_path = os.path.abspath(os.path.join(...))
        if not os.path.exists(cred_path):
            raise FileNotFoundError(...)
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    return firestore.client()
```

**Cambio:** Insertar GAC check antes de `os.path.exists(cred_path)`.

---

## 3. Tabla Resumen de Riesgo

| # | Script | Escritura | Colección | Multi-doc | Batch | Guard | Riesgo |
|---|---|---|---|---|---|---|---|
| 1 | `clean_classification_v3.py` | `.update()` | funds_v3 | SÍ (masivo) | No | Idempotente | MEDIO |
| 2 | `generate_benchmarks.py` | `batch.set` + `batch.commit` | synthetic_benchmarks | 5 docs | SÍ | 5 perfiles fijos | MEDIO-BAJO |
| 3 | `check_and_import_retrocesion.py` | `.set(merge=True)` | funds_v3 | CSV-driven | No | `--import` flag | MEDIO |
| 4 | `fetch_missing_history.py` | `.set()` + `.update()` | historico_vl_v2 + funds_v3 | SÍ | No | Sin guard | MEDIO |
| 5 | `heal_historical_gaps.py` | `batch.update` + `batch.commit` | historico_vl_v2 + funds_v3 | SÍ (masivo) | SÍ | Sin guard | MEDIO |

---

## 4. Decisión: ¿Refactor Init Ahora o Dry-Run Primero?

### Recomendación: **Refactorizar solo init AHORA**

**Justificación:**
1. El cambio es **mecánico** — solo toca el bloque de inicialización Firebase.
2. **No se altera** ninguna lógica de escritura, batch size, colección, filtro o transformación.
3. No se ejecutarán los scripts — solo verificación sintáctica.
4. Añadir dry-run a estos 5 scripts es una tarea separada (FASE 4C potencial) que requiere diseño cuidadoso por script.
5. El riesgo del refactor init es **independiente** del riesgo inherente de escritura.

> ⚠️ **Nota importante:** La ausencia de dry-run en estos scripts es un riesgo operativo real, pero NO un riesgo del refactor de inicialización. Son problemas ortogonales.

---

## 5. Alcance Exacto del Cambio

### ✅ SE CAMBIARÁ:
- Bloque de inicialización Firebase.
- Soporte para `GOOGLE_APPLICATION_CREDENTIALS`.
- Fallback temporal a `serviceAccountKey.json`.
- Guard `_apps` si no existe.

### ❌ NO SE CAMBIARÁ:
- Lógica de escritura (`.update()`, `.set()`, `batch.commit()`).
- Colecciones target.
- Filtros, condiciones, transformaciones.
- Batch size / concurrency.
- API keys (EODHD en fetch_missing_history.py).
- CSV input paths.
- Argumentos de CLI.

---

## 6. Patrones de Refactor

### Patrón C — `_apps` guard + GAC (clean_classification, check_and_import, heal_historical_gaps)

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

### Patrón B — `get_app()` + GAC (generate_benchmarks)

```python
try:
    app = firebase_admin.get_app()
except ValueError:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
```

### Patrón E — Module-level refactor (fetch_missing_history)

```python
if not firebase_admin._apps:
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    else:
        sa_path = os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json')
        if os.path.exists(sa_path):
            cred = credentials.Certificate(sa_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
db = firestore.client()
```

---

## 7. Verificaciones Seguras

| Verificación | Método |
|---|---|
| Compilación Python | `python -m py_compile` sobre los 5 |
| GAC presente | `grep GOOGLE_APPLICATION_CREDENTIALS` en los 5 |
| Write lines intactas | Verificar que `.update()`, `.set()`, `batch.commit()` no se modificaron |
| Credenciales intactas | `Test-Path` de SAK, .env, frontend/.env |
| No ejecución | 0 scripts ejecutados, 0 conexiones Firestore |

---

## 8. Scripts NO Autorizados

### 4B.5C.4a — Alto riesgo (NO TOCAR)
- `scripts/maintenance/purge_legacy_root_fields.js` — `FieldValue.delete()` masivo
- `scripts/remediate_orphans.py` — `batch.delete()` sobre funds_v3

### 4B.5C.4b — Bloqueados (NO TOCAR)
- `functions_python/scripts/migration/migrate_reports.py` — Cross-project multi-app
- `scripts/maintenance/cargador_lotes.js` — Pipeline de producción
- `scripts/maintenance/cargador_lotes_v_2.js` — Pipeline de producción

---

## 9. Prompt Recomendado para Ejecución 4B.5C.3

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.5C.3 — refactor 5 mutantes medio riesgo para GAC.

REGLAS ESTRICTAS:
- Ejecuta SOLO FASE 4B.5C.3.
- Sigue docs/CLEANUP_PHASE_4B5C3_MEDIUM_RISK_MUTANTS_PLAN.md.
- NO toques 4B.5C.4a ni 4B.5C.4b.
- NO cambies lógica de escritura.
- NO cambies colecciones, filtros, batch size, concurrency.
- NO cambies API keys.
- NO cambies CSV paths ni CLI args.
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
1. functions_python/scripts/fixes/clean_classification_v3.py
2. functions_python/scripts/reports/generate_benchmarks.py
3. functions_python/scripts/migration/check_and_import_retrocesion.py
4. scripts/maintenance/fetch_missing_history.py
5. scripts/maintenance/heal_historical_gaps.py

Patrón: GAC-first → fallback local → default.
Verificar: py_compile + grep GAC + write lines intactas.
Crear report en docs/CLEANUP_PHASE_4B5C3_MEDIUM_RISK_MUTANTS_REFACTOR_REPORT.md.
```

---

## 10. Observaciones Adicionales

### ⚠️ API Key Hardcoded (fetch_missing_history.py)
- L19: `EODHD_API_KEY = "6943decfb2bb14.96572592"`
- **No es scope de 4B.5C** pero debe documentarse para futura revisión (FASE 4C o similar).
- No modificar en esta fase.

### ⚠️ Header incorrecto (generate_benchmarks.py)
- L7: `SAFE_MODE: READ_ONLY` — el script usa `batch.set()` + `batch.commit()`.
- **No es scope de 4B.5C** pero el header debería decir `MUTATES_FIRESTORE`.
- No modificar en esta fase.

---

## 11. Confirmaciones

- ✅ No se modificó ningún archivo de código.
- ✅ No se ejecutó ningún script.
- ✅ No se hizo commit ni push.
- ✅ No se tocaron credenciales.
- ✅ Solo análisis y documentación.
