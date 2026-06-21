# FASE 1 — Plan de Ejecución de Limpieza Segura

**Fecha:** 2026-05-04
**Estado:** PLAN PREPARADO — No se han ejecutado borrados.
**Referencia:** `docs/CLEANUP_SECURITY_AUDIT_PLAN.md`

---

## Confirmación de Seguridad

> [!IMPORTANT]
> Este plan **NO toca** ninguno de los siguientes elementos:
> - `serviceAccountKey.json`
> - `.env` (raíz) ni `frontend/.env`
> - Código fuente: `frontend/src/`, `functions_python/api/`
> - Configuración Firebase: `firebase.json`, `firestore.rules`, `.firebaserc`, `storage.rules`
> - Manifiestos: `package.json`, `requirements.txt`

---

## 1. Archivos a BORRAR

Todos estos archivos han sido verificados individualmente. Ninguno está trackeado por Git. Ninguno es necesario para compilar, desplegar o ejecutar la aplicación.

### 1.1 ZIP en raíz

| Archivo | Tamaño | Riesgo | Justificación |
|---|---|---|---|
| `BDB-FONDOS-codigo-fuente.zip` | 246 MB | **CERO** | Snapshot generado por `zip_project_script.py` hace minutos. No es backup de producción, es regenerable en cualquier momento. No trackeado por Git. |

**Comando:**
```powershell
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\BDB-FONDOS-codigo-fuente.zip"
```

### 1.2 Logs de depuración

| Archivo | Tamaño | Riesgo | Justificación |
|---|---|---|---|
| `deploy_debug.log` | 303 KB | **CERO** | Log de despliegue anterior. Se regenera automáticamente en cada `firebase deploy`. No trackeado. |
| `firestore-debug.log` | 24 KB | **CERO** | Log del emulador de Firestore. Se regenera al arrancar el emulador. No trackeado. |
| `functions_python/firebase-debug.log` | 757 KB | **CERO** | Log de ejecución de Cloud Functions locales. Se regenera en cada sesión. No trackeado. |

**Comando:**
```powershell
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\deploy_debug.log"
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\firestore-debug.log"
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\functions_python\firebase-debug.log"
```

### 1.3 Script residual

| Archivo | Tamaño | Riesgo | Justificación |
|---|---|---|---|
| `zip_project_script.py` | 1 KB | **CERO** | Script de empaquetado de un solo uso creado en esta sesión. No forma parte del proyecto. No trackeado. |

**Comando:**
```powershell
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\zip_project_script.py"
```

### 1.4 Build log antiguo del frontend

| Archivo | Tamaño | Riesgo | Justificación |
|---|---|---|---|
| `frontend/build_log.txt` | 2 KB | **CERO** | Contiene un error de build de un proyecto diferente (`FinTrader_Quant`), no de BDB-FONDOS. Es un residuo de otro workspace. No trackeado. |

**Comando:**
```powershell
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\frontend\build_log.txt"
```

---

## 2. Archivos a CONSERVAR (no tocar)

| Archivo / Directorio | Razón |
|---|---|
| `serviceAccountKey.json` | Credencial activa de Firebase Admin. Necesaria para scripts locales y emulador. |
| `.env` (raíz) | API Key de Gemini usada por el backend. |
| `frontend/.env` | Configuración Firebase del frontend. Sin ella no arranca Vite. |
| `firebase.json`, `firestore.rules`, `storage.rules`, `.firebaserc` | Configuración de despliegue. |
| `package.json`, `package-lock.json`, `requirements.txt` | Definición de dependencias. |
| Toda `frontend/src/`, `functions_python/api/`, `functions_python/services/` | Código funcional activo. |
| `archive/` | **FASE 2** — se moverá a almacenamiento externo, no en esta fase. |
| `mingit/` | **FASE 2** — se eliminará, no en esta fase. |
| `data/` | **Proteger vía .gitignore** en esta fase, no borrar contenido. |
| `scripts/` | **FASE 3** — unificación de scripts, no en esta fase. |

---

## 3. Cambios en `.gitignore`

El `.gitignore` actual ya tiene buenas protecciones (`*.log`, `*.zip`, `serviceAccount*.json`, `.env`), pero le faltan estas entradas explícitas:

```diff
 ############################################
+# CACHE DE TESTS
+############################################
+.pytest_cache/
+.mypy_cache/
+
+############################################
+# DATOS LOCALES DE PROCESAMIENTO
+############################################
+data/
+
+############################################
+# SCRIPTS DESECHABLES
+############################################
+zip_project_script.py
+
 ############################################
 # ANTIGRAVITY / IA (opcional)
 ############################################
```

| Entrada nueva | Riesgo | Justificación |
|---|---|---|
| `.pytest_cache/` | **CERO** | Cache de pytest presente en raíz. Se regenera automáticamente al ejecutar tests. |
| `.mypy_cache/` | **CERO** | Cache de mypy si se usa type-checking en Python. Prevención. |
| `data/` | **BAJO** | Contiene ~3.680 archivos de procesamiento temporal (PDFs, textos raw, JSONs). No es código. Si algún script necesita leer ficheros procesados de aquí, seguirán estando en disco — `.gitignore` solo evita que se suban a Git. |
| `zip_project_script.py` | **CERO** | Previene que futuros scripts de empaquetado temporal se suban accidentalmente. |

---

## 4. Resumen de Riesgos por Acción

| Acción | Riesgo | Impacto si falla |
|---|---|---|
| Borrar `BDB-FONDOS-codigo-fuente.zip` | CERO | Ninguno. Regenerable con un script. |
| Borrar `deploy_debug.log` | CERO | Se regenera solo en el próximo deploy. |
| Borrar `firestore-debug.log` | CERO | Se regenera al arrancar el emulador. |
| Borrar `functions_python/firebase-debug.log` | CERO | Se regenera en la próxima ejecución local. |
| Borrar `zip_project_script.py` | CERO | Script de un solo uso, no referenciado por nadie. |
| Borrar `frontend/build_log.txt` | CERO | Residuo de otro proyecto, no referenciado. |
| Añadir `.pytest_cache/` a `.gitignore` | CERO | Solo afecta a Git, no al sistema de archivos. |
| Añadir `data/` a `.gitignore` | BAJO | `data/` seguirá existiendo en disco. Solo evita subir a Git. |

---

## 5. Secuencia de Ejecución Propuesta

Ejecutar en este orden exacto, esperando confirmación entre cada paso:

```powershell
# PASO 1: Borrar ZIP de raíz (246 MB recuperados)
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\BDB-FONDOS-codigo-fuente.zip"

# PASO 2: Borrar logs (1.08 MB recuperados)
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\deploy_debug.log"
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\firestore-debug.log"
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\functions_python\firebase-debug.log"

# PASO 3: Borrar scripts residuales
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\zip_project_script.py"
Remove-Item "c:\Users\oanti\Documents\BDB-FONDOS\frontend\build_log.txt"

# PASO 4: Actualizar .gitignore (ver sección 3 de este documento)
```

**Espacio total recuperado: ~247 MB**

---

## 6. Checklist de Verificación Posterior

Después de ejecutar la FASE 1, confirmar:

- [ ] `BDB-FONDOS-codigo-fuente.zip` ya no existe en raíz.
- [ ] No hay archivos `*.log` en raíz ni en `functions_python/`.
- [ ] `zip_project_script.py` ya no existe.
- [ ] `frontend/build_log.txt` ya no existe.
- [ ] `.gitignore` contiene `.pytest_cache/`, `data/` y `zip_project_script.py`.
- [ ] `git status` no muestra ningún archivo nuevo pendiente de add.
- [ ] `npm run dev` (frontend) sigue arrancando correctamente.
- [ ] Los archivos intocables siguen presentes:
  - [ ] `serviceAccountKey.json` ✓
  - [ ] `.env` ✓
  - [ ] `frontend/.env` ✓
  - [ ] `firebase.json` ✓
  - [ ] `firestore.rules` ✓

---

## 7. Qué NO se hace en esta fase

| Elemento | Fase planificada | Por qué no ahora |
|---|---|---|
| `archive/` (120+ MB de ZIPs y docs) | FASE 2 | Requiere mover a almacenamiento externo antes de borrar. |
| `mingit/` (instalación Git standalone) | FASE 2 | Requiere verificar que no hay hooks o config que dependan de él. |
| Unificación de `scripts/` | FASE 3 | Requiere comparación línea a línea de duplicados. |
| Rotación de credenciales | FASE 4 | Requiere coordinación con Firebase Console. |
| `data/` contenido interno | Fuera de alcance | Los ~3.680 archivos se protegen vía `.gitignore`, no se borran. |
