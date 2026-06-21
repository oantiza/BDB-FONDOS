# FASE 4B.3 — Plan de Refactor del Lote 1: Python Solo Lectura Hardcoded

**Fecha:** 2026-05-04
**Estado:** PLAN — Ningún cambio ejecutado.

---

## 1. Lista Definitiva del Lote 1

Tras verificación detallada: **7 archivos reales** (2 del inventario original son falsos positivos).

| # | Archivo | Patrón actual | Acción |
|---|---|---|---|
| 1 | `fp/scripts/fixes/check_sync_results.py` | Hardcoded directo | Refactorizar |
| 2 | `fp/scripts/fixes/fix_anomalies.py` | Hardcoded con PROJECT_ROOT | Refactorizar |
| 3 | `fp/scripts/sandbox/analyze_db_categories.py` | Hardcoded con PROJECT_ROOT | Refactorizar |
| 4 | `fp/scripts/sandbox/inspect_fund_debug.py` | Hardcoded directo | Refactorizar |
| 5 | `fp/scripts/export_funds_to_csv.py` | Hardcoded multi-path | Refactorizar |
| 6 | `scripts/aggressive_audit.py` | Hardcoded relativo | Refactorizar |
| 7 | `scripts/maintenance/check_history.py` | Hardcoded directo | Refactorizar |
| ~~8~~ | ~~`scripts/maintenance/create_zip.py`~~ | ~~Falso positivo~~ | ❌ No tocar |
| ~~9~~ | ~~`scripts/repo/create_backup.py`~~ | ~~Falso positivo~~ | ❌ No tocar |

### Falsos Positivos

- **`create_zip.py`**: Solo lista `serviceAccountKey.json` como archivo a **excluir** del ZIP. No usa Firebase.
- **`create_backup.py`**: Solo lista `serviceAccountKey.json` como archivo a **excluir** del backup. No usa Firebase.

### Escrituras Verificadas

| Archivo | `.set()` | `.update()` | `.delete()` | `.add()` | `batch` |
|---|---|---|---|---|---|
| Todos los 7 | ❌ | ❌ | ❌ | ❌ | ❌ |

✅ **Confirmado: Todos son solo lectura.**

---

## 2. Patrón Actual por Archivo

### Archivo 1: `fp/scripts/fixes/check_sync_results.py`
```python
# ACTUAL:
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
```
- Path: relativo directo sin búsqueda
- Sin fallback

### Archivo 2: `fp/scripts/fixes/fix_anomalies.py`
```python
# ACTUAL:
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
if not firebase_admin._apps:
    if not os.path.exists(KEY_PATH):
        raise FileNotFoundError(f"No se encontró serviceAccountKey.json en: {KEY_PATH}")
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred)
```
- Path: construido desde PROJECT_ROOT
- Tiene check de existencia pero sin fallback

### Archivo 3: `fp/scripts/sandbox/analyze_db_categories.py`
```python
# ACTUAL: (idéntico patrón a fix_anomalies.py)
KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
if not firebase_admin._apps:
    if not os.path.exists(KEY_PATH):
        raise FileNotFoundError(...)
    cred = credentials.Certificate(KEY_PATH)
    firebase_admin.initialize_app(cred)
```

### Archivo 4: `fp/scripts/sandbox/inspect_fund_debug.py`
```python
# ACTUAL: (idéntico patrón a check_sync_results.py)
if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
```

### Archivo 5: `fp/scripts/export_funds_to_csv.py`
```python
# ACTUAL: Multi-path search, hardcoded absoluto como fallback
KEY_PATHS = [
    os.path.join(base_dir, "serviceAccountKey.json"),
    os.path.join(base_dir, "..", "serviceAccountKey.json"),
    os.path.join(base_dir, "..", "..", "serviceAccountKey.json"),
    "C:/Users/oanti/Documents/BDB-FONDOS/functions_python/scripts/serviceAccountKey.json"
]
if not firebase_admin._apps:
    for kp in KEY_PATHS:
        if os.path.exists(kp):
            cred = credentials.Certificate(kp)
            firebase_admin.initialize_app(cred)
            break
    else:
        print("[ERROR] No serviceAccountKey.json found!")
```
- ⚠️ Incluye path absoluto hardcoded
- Sin fallback a `initialize_app()`

### Archivo 6: `scripts/aggressive_audit.py`
```python
# ACTUAL:
cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
cred = credentials.Certificate(cred_path)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
```
- Path relativo al directorio del script
- Sin fallback

### Archivo 7: `scripts/maintenance/check_history.py`
```python
# ACTUAL:
cred = credentials.Certificate('serviceAccountKey.json')
firebase_admin.initialize_app(cred)
```
- Path directo, sin `_apps` check
- Sin fallback
- ⚠️ Falla si se ejecuta dos veces (no tiene guard `_apps`)

---

## 3. Patrón Destino Estándar

```python
import firebase_admin
from firebase_admin import credentials, firestore
import os

# --- Firebase Init (compatible con GOOGLE_APPLICATION_CREDENTIALS) ---
if not firebase_admin._apps:
    _sak_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "..", "serviceAccountKey.json"
    )
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        firebase_admin.initialize_app()
    elif os.path.exists(_sak_path):
        firebase_admin.initialize_app(credentials.Certificate(_sak_path))
    elif os.path.exists("serviceAccountKey.json"):
        firebase_admin.initialize_app(credentials.Certificate("serviceAccountKey.json"))
    else:
        firebase_admin.initialize_app()

db = firestore.client()
```

**Prioridad de resolución:**
1. `GOOGLE_APPLICATION_CREDENTIALS` → `initialize_app()` sin argumentos (SDK la usa automáticamente).
2. `../.. /serviceAccountKey.json` → fallback local relativo (compatibilidad temporal).
3. `./serviceAccountKey.json` → fallback directorio actual.
4. `initialize_app()` sin argumentos → credenciales por defecto (Cloud Functions, ADC).

**Variaciones por ubicación:**
- Scripts en `fp/scripts/fixes/`, `fp/scripts/sandbox/`: `_sak_path` sube 2 niveles → raíz repo.
- Scripts en `fp/scripts/` raíz: `_sak_path` sube 1 nivel.
- Scripts en `scripts/maintenance/`: `_sak_path` sube 1 nivel → raíz repo.
- Scripts en `scripts/` raíz: `_sak_path` sube 0 niveles.

---

## 4. Cambio Mínimo por Archivo

### Archivo 1: `check_sync_results.py`
```diff
-if not firebase_admin._apps:
-    cred = credentials.Certificate("serviceAccountKey.json")
-    firebase_admin.initialize_app(cred)
+if not firebase_admin._apps:
+    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
+        firebase_admin.initialize_app()
+    elif os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "serviceAccountKey.json")):
+        firebase_admin.initialize_app(credentials.Certificate(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "serviceAccountKey.json")))
+    else:
+        firebase_admin.initialize_app()
```

### Archivo 2: `fix_anomalies.py`
```diff
-KEY_PATH = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
 if not firebase_admin._apps:
-    if not os.path.exists(KEY_PATH):
-        raise FileNotFoundError(...)
-    cred = credentials.Certificate(KEY_PATH)
-    firebase_admin.initialize_app(cred)
+    _sak = os.path.join(PROJECT_ROOT, "serviceAccountKey.json")
+    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
+        firebase_admin.initialize_app()
+    elif os.path.exists(_sak):
+        firebase_admin.initialize_app(credentials.Certificate(_sak))
+    else:
+        firebase_admin.initialize_app()
```

### Archivos 3, 4: `analyze_db_categories.py`, `inspect_fund_debug.py`
Mismo patrón que #2 y #1 respectivamente.

### Archivo 5: `export_funds_to_csv.py`
```diff
-KEY_PATHS = [...]
-if not firebase_admin._apps:
-    for kp in KEY_PATHS:
-        ...
+if not firebase_admin._apps:
+    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
+        firebase_admin.initialize_app()
+    else:
+        _candidates = [
+            os.path.join(base_dir, "..", "serviceAccountKey.json"),
+            os.path.join(base_dir, "..", "..", "serviceAccountKey.json"),
+            "serviceAccountKey.json",
+        ]
+        _found = next((p for p in _candidates if os.path.exists(p)), None)
+        if _found:
+            firebase_admin.initialize_app(credentials.Certificate(_found))
+        else:
+            firebase_admin.initialize_app()
```
- ⚠️ Eliminar path absoluto hardcoded.

### Archivo 6: `aggressive_audit.py`
```diff
-cred_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
-cred = credentials.Certificate(cred_path)
-if not firebase_admin._apps:
-    firebase_admin.initialize_app(cred)
+if not firebase_admin._apps:
+    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
+        firebase_admin.initialize_app()
+    else:
+        _sak = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'serviceAccountKey.json'))
+        if os.path.exists(_sak):
+            firebase_admin.initialize_app(credentials.Certificate(_sak))
+        else:
+            firebase_admin.initialize_app()
```

### Archivo 7: `check_history.py`
```diff
-cred = credentials.Certificate('serviceAccountKey.json')
-firebase_admin.initialize_app(cred)
+if not firebase_admin._apps:
+    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
+        firebase_admin.initialize_app()
+    else:
+        _sak = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'serviceAccountKey.json')
+        if os.path.exists(_sak):
+            firebase_admin.initialize_app(credentials.Certificate(_sak))
+        else:
+            firebase_admin.initialize_app()
```
- Añade guard `_apps` que le faltaba.

---

## 5. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Error de sintaxis | Baja | Bajo | `python -m py_compile` |
| Path relativo incorrecto | Media | Bajo | Mantener fallback a `initialize_app()` |
| Script deja de funcionar | Baja | Bajo | Son todos solo lectura, no afectan producción |

---

## 6. Pruebas Seguras

1. **Validación sintáctica** (sin ejecutar, sin conectar a Firebase):
   ```powershell
   python -m py_compile <archivo>
   ```

2. **Import-only** (carga módulos pero no ejecuta `main`):
   - Solo si el script tiene `if __name__ == "__main__":` guard.
   - Verificar que la inicialización Firebase está dentro del guard.

3. **NO ejecutar** consultas Firestore ni llamar a `main()`.

---

## 7. Prompt Recomendado para Ejecutar 4B.3

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar FASE 4B.3 — refactorizar Lote 1 Python solo lectura.

REGLAS ESTRICTAS:
- Edita SOLO la inicialización Firebase.
- NO cambies lógica funcional.
- NO ejecutes scripts contra Firebase.
- NO toques credenciales.
- NO toques .env.
- NO hagas push.

OBJETIVO:
Refactorizar 7 scripts (NO 9 — create_zip.py y create_backup.py son falsos positivos):

1. functions_python/scripts/fixes/check_sync_results.py
2. functions_python/scripts/fixes/fix_anomalies.py
3. functions_python/scripts/sandbox/analyze_db_categories.py
4. functions_python/scripts/sandbox/inspect_fund_debug.py
5. functions_python/scripts/export_funds_to_csv.py
6. scripts/aggressive_audit.py
7. scripts/maintenance/check_history.py

Patrón destino:
  if not firebase_admin._apps:
      if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
          firebase_admin.initialize_app()
      elif os.path.exists(<relative_sak_path>):
          firebase_admin.initialize_app(credentials.Certificate(<path>))
      else:
          firebase_admin.initialize_app()

Seguir docs/CLEANUP_PHASE_4B3_PY_READONLY_REFACTOR_PLAN.md exactamente.

Después de editar:
  python -m py_compile <archivo> para cada uno.

Commit: "chore: refactor firebase init to support GOOGLE_APPLICATION_CREDENTIALS (batch 1 - py readonly)"
```

---

> [!IMPORTANT]
> **Confirmación:** Ningún archivo ha sido editado, movido ni ejecutado. Solo lectura y documentación.
