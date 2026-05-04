# FASE 4B — Plan de Externalización de serviceAccountKey.json

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.

---

## 1. Inventario de Referencias

### 1.1 Resumen por categoría

| Categoría | Archivos | Con fallback | Solo hardcoded |
|---|---|---|---|
| API/Services (producción) | **0** | — | — |
| FP scripts categorizados | 31 | 17 | 14 |
| FP scripts raíz | 4 | 2 | 2 |
| JS maintenance | 22 | 5 | 17 |
| JS scripts raíz | 6 | 1 | 5 |
| Frontend scripts | 2 | 0 | 2 |
| Legacy (data/) | 2 | 0 | 2 |
| **Total** | **67** | **25** | **42** |

> [!TIP]
> **Hallazgo crítico:** El código de producción (`main.py`, `functions_python/api/`, `functions_python/services/`) **NO referencia** `serviceAccountKey.json`. Usa `initialize_app()` sin argumentos, que funciona automáticamente en Cloud Functions. Solo los scripts de mantenimiento local usan la clave.

### 1.2 Archivos con fallback a `initialize_app()` (25) — Funcionarán con `GOOGLE_APPLICATION_CREDENTIALS`

Estos ya tienen el patrón:
```python
try:
    firebase_admin.get_app()
except ValueError:
    if os.path.exists("./serviceAccountKey.json"):
        cred = credentials.Certificate("./serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()  # ← usa GAC automáticamente
```

Archivos: `analyze_history_anomalies.py`, `audit_fund_data.py`, `audit_taxonomy_v2.py`, `check_reports.py`, `sample_taxonomy_review_50.py` (×4), `scoring_comparison.py`, `debug_fondibas.py`, `debug_reports.py`, `find_fund_by_isin.py`, `inspect_anomaly_dates.py`, `inspect_categories.py`, `inspect_fund_data.py`, `inspect_ter.py`, `cleanup_dummy_reports.py`, `fix_data_anomalies.py`, `insert_dummy_reports.py`, `insert_report_function.py`, `insert_user_report.py`, `migrate_reports.py`, `populate_taxonomy_v2.py` (×3), `recalc_metrics_single.py`, `test_gemini_models.py`, `test_smart_portfolio.py`

### 1.3 Archivos HARDCODED_ONLY (42) — Requieren refactorización o variable

**Python (16):**
- `fixes/check_sync_results.py`, `clean_classification_v3.py`, `clean_csv_categories.py`, `fix_anomalies.py`, `sync_categories_to_firestore.py`, `trim_last_anomaly.py`
- `migration/check_and_import_retrocesion.py`
- `reports/generate_benchmarks.py`
- `sandbox/analyze_db_categories.py`, `inspect_fund_debug.py`
- `export_funds_to_csv.py`, `export_funds_v3.js`
- `scripts/aggressive_audit.py`, `remediate_orphans.py`, `repo/create_backup.py`
- `scripts/populate_taxonomy_v2_FINAL.py`

**JS (22):**
- `scripts/maintenance/` (17 archivos)
- `scripts/migrate_*.js` (2), `scripts/backfill_*.js` (2)
- `frontend/scripts/inspect_db.cjs`, `inspect_db.js`

**Legacy (2):** `data/work/legacy_roots/` (ignorables)

---

## 2. Patrones de Inicialización Detectados

### Patrón A: Python con fallback (seguro) — 25 archivos
```python
try:
    firebase_admin.get_app()
except ValueError:
    if os.path.exists("./serviceAccountKey.json"):
        cred = credentials.Certificate(...)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()  # usa GAC
```
**Impacto de externalizar:** NINGUNO. Funciona automáticamente con `GOOGLE_APPLICATION_CREDENTIALS`.

### Patrón B: Python hardcoded con PROJECT_ROOT — 10 archivos
```python
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
cred = credentials.Certificate(KEY_PATH)
firebase_admin.initialize_app(cred)
```
**Impacto:** FALLA si se mueve. Requiere refactorizar a Patrón A o usar GAC.

### Patrón C: Python hardcoded simple — 6 archivos
```python
cred = credentials.Certificate("./serviceAccountKey.json")
firebase_admin.initialize_app(cred)
```
**Impacto:** FALLA si se mueve. Requiere refactorizar.

### Patrón D: JS con GAC fallback — 5 archivos
```javascript
const serviceAccountPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.join(__dirname, "..", "serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
```
**Impacto:** NINGUNO. Usa GAC si está configurada.

### Patrón E: JS hardcoded — 17 archivos
```javascript
const serviceAccount = require("../serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
```
**Impacto:** FALLA si se mueve. Requiere refactorizar a Patrón D.

---

## 3. Helper Central

> [!IMPORTANT]
> **No existe un helper central de Firebase.** Cada script tiene su propia lógica de inicialización. Sin embargo, el código de producción (`main.py`) usa `initialize_app()` limpio, que es el patrón correcto.

**Oportunidad:** Crear un helper central `functions_python/scripts/utils/firebase_init.py` que todos los scripts importen, unificando el patrón.

---

## 4. Estrategia Propuesta

### Opción A: Variable de entorno + refactorización gradual (RECOMENDADA) ⭐

1. Configurar `GOOGLE_APPLICATION_CREDENTIALS` como variable del sistema.
2. Mover `serviceAccountKey.json` fuera del repo.
3. Los 25 archivos con fallback **funcionan inmediatamente**.
4. Refactorizar los 42 hardcoded en lotes.

### Opción B: Symlink de compatibilidad

1. Mover la clave fuera del repo.
2. Crear symlink `serviceAccountKey.json → ruta_externa`.
3. Todos los scripts funcionan sin cambios.
4. Desventaja: el symlink sigue "existiendo" en el repo.

### Opción C: Helper central + refactorización masiva

1. Crear `functions_python/scripts/utils/firebase_init.py`.
2. Refactorizar los 67 archivos para usarlo.
3. Mover la clave fuera.
4. Desventaja: cambio masivo, alto riesgo de errores.

---

## 5. Ruta Externa Propuesta

```
C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json
```

Variable de entorno:
```
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\oanti\.config\bdb-fondos\serviceAccountKey.json
```

---

## 6. Plan por Subfases

### FASE 4B.1: Documentar setup local (riesgo cero)
- Crear `docs/LOCAL_SETUP.md` con instrucciones.
- Documentar que `GOOGLE_APPLICATION_CREDENTIALS` es la forma recomendada.

### FASE 4B.2: Crear helper central (riesgo bajo)
- Crear `functions_python/scripts/utils/firebase_init.py`.
- Patrón: buscar GAC → buscar archivo local → `initialize_app()`.
- NO editar scripts aún.

### FASE 4B.3: Refactorizar Python hardcoded (riesgo medio)
- Editar los ~16 scripts Python hardcoded para usar el helper o Patrón A.
- Agrupar por subdirectorio: fixes, sandbox, raíz.
- Verificar con import-only (sin ejecutar).

### FASE 4B.4: Refactorizar JS hardcoded (riesgo medio)
- Editar los ~17 scripts JS maintenance para usar Patrón D (GAC fallback).
- Editar 2 frontend scripts.

### FASE 4B.5: Mover serviceAccountKey.json (riesgo medio)
- Copiar a `C:\Users\oanti\.config\bdb-fondos\`.
- Configurar variable de entorno del sistema.
- Verificar que los scripts con fallback funcionan.
- Eliminar copia del repo.

### FASE 4B.6: Verificar scripts críticos (riesgo bajo)
- Import-only test de scripts Python clave.
- Dry-run de scripts JS con `--help` o equivalente.
- NO ejecutar migraciones ni scripts mutantes.

### FASE 4B.7: Rotar clave (requiere usuario)
- El usuario genera nueva clave en Firebase Console.
- El usuario reemplaza el archivo en la ruta externa.
- El usuario invalida la clave anterior.

---

## 7. Scripts Peligrosos — NO Ejecutar para Verificar

| Script | Razón |
|---|---|
| `*_retrocesion*` | Escribe retrocesiones |
| `fix_*`, `repair_*` | Escribe correcciones |
| `populate_taxonomy_*` | Escribe clasificaciones |
| `sync_categories_*` | Escribe categorías |
| `cleanup_dummy_reports.py` | Borra reportes |
| `insert_*_report*.py` | Inserta reportes |
| `cargador_lotes*.js` | Escribe fondos |
| `update_*` | Actualiza campos |

---

## 8. Qué NO Hacer Todavía

- ❌ NO mover la clave.
- ❌ NO crear symlinks.
- ❌ NO editar scripts.
- ❌ NO rotar claves.
- ❌ NO ejecutar scripts para verificar.
- ❌ NO configurar variables de entorno del sistema.

---

## 9. Prompt Recomendado para FASE 4B.1

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.1 — crear documentación de setup local.

REGLAS ESTRICTAS:
- NO muevas serviceAccountKey.json.
- NO edites código funcional.
- NO ejecutes scripts.
- NO toques credenciales.
- Solo crear documentación.

OBJETIVO:
1. Crear docs/LOCAL_SETUP.md con instrucciones de:
   - clonar el repositorio.
   - configurar .env desde .env.example.
   - configurar frontend/.env desde frontend/.env.example.
   - obtener serviceAccountKey.json de Firebase Console.
   - configurar GOOGLE_APPLICATION_CREDENTIALS.
   - instalar dependencias.
   - ejecutar frontend local.
   - ejecutar scripts de mantenimiento.

2. Commit con mensaje: "docs: add local development setup guide"

ENTREGABLE:
Crear: docs/CLEANUP_PHASE_4B1_SETUP_DOCS_REPORT.md
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido movido, borrado, ejecutado ni modificado. Las credenciales permanecen intactas.
