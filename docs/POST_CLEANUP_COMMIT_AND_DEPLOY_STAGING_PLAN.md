# Plan de Cierre Post-Checklist: Commits y Deploy Staging

**Fecha:** 2026-05-04  
**Estado:** PLAN — solo documentación.  
**Prerrequisito:** `docs/PRE_PRODUCTION_READINESS_AFTER_CLEANUP.md` ✅

---

## 1. Inventario Completo de Pendientes

### 1A. Archivos Modificados (M) — 6 archivos

| # | Archivo | Categoría | Contenido del cambio |
|---|---|---|---|
| 1 | `firestore.rules` | 🔒 Security hardening | reads `true` → `isAuthenticated()`, catch-all cerrado |
| 2 | `frontend/src/components/xray/XRayReportGenerator.tsx` | 🖥️ Frontend auth | Añade `auth.getIdToken()` + header `Authorization` |
| 3 | `frontend/src/utils/retirementUtils.ts` | 🖥️ Frontend fiscal | Actualiza escala Bizkaia 2026, minoración 1583→1615 |
| 4 | `functions_python/api/endpoints_admin.py` | ⚙️ API security | Auth Bearer+email check en `force_weekly_research`, import fix |
| 5 | `functions_python/api/endpoints_macro.py` | ⚙️ API logging | `print()` → `logging.getLogger()` |
| 6 | `functions_python/api/endpoints_xray_comparador.py` | ⚙️ API XRay | CORS restringido, 2026 Letras rate, XIRR None handling |

### 1B. Archivos Eliminados (D) — 26 archivos

| # | Archivo | Categoría | Riesgo |
|---|---|---|---|
| 1 | `backend/app/tests/xray/test_compare_risk_free.py` | 🧪 Test duplicado | BAJO — copia en `functions_python/tests/xray/` |
| 2 | `backend/app/tests/xray/test_depositos.py` | 🧪 Test duplicado | BAJO — copia en `functions_python/tests/xray/` |
| 3 | `cargador_lotes_v_2.js` | 📋 Copia raíz | BAJO — canónico en `scripts/maintenance/` |
| 4 | `check_history.py` | 🗑️ Scratch | NINGUNO |
| 5 | `create_zip.py` | 🗑️ Scratch | NINGUNO |
| 6 | `examine_excel.py` | 🗑️ Scratch | NINGUNO |
| 7 | `examine_files.py` | 🗑️ Scratch | NINGUNO |
| 8 | `examine_files2.py` | 🗑️ Scratch | NINGUNO |
| 9 | `fondos.csv` | 📊 Data export | NINGUNO — regenerable |
| 10 | `fondos_absolutamente_todos_los_campos.csv` | 📊 Data export | NINGUNO — regenerable |
| 11 | `fondos_all_fields.csv` | 📊 Data export | NINGUNO — regenerable |
| 12 | `frontend/build_log.txt` | 🗑️ Build artifact | NINGUNO |
| 13 | `functions/get_report.js` | 🗑️ Legacy function | NINGUNO — migrado a Python |
| 14–20 | `functions_python/reports/batch_run_*.json` (×7) | 📊 Run artifacts | NINGUNO — outputs temporales |
| 21 | `functions_python/services/inspector.py` | 🗑️ Servicio obsoleto | BAJO — no importado |
| 22 | `functions_python/services/optimizer.py` | 🗑️ Servicio obsoleto | BAJO — no importado |
| 23 | `functions_python/utils/__init__.py` | 🗑️ Módulo vacío obsoleto | BAJO — no importado |
| 24 | `jon completo.html` | 🗑️ Archivo usuario | NINGUNO |
| 25 | `jon.xlsx` | 🗑️ Archivo usuario | NINGUNO |
| 26 | `limpieza_segura.bat` | 🗑️ Script temporal | NINGUNO |

### 1C. Archivos Nuevos (??) — 9 archivos

| # | Archivo | Categoría |
|---|---|---|
| 1 | `docs/CLEANUP_PHASE_4A_COMMIT_REPORT.md` | 📋 Report limpieza |
| 2 | `docs/CLEANUP_PHASE_4B5A_COMMIT_REPORT.md` | 📋 Report limpieza |
| 3 | `docs/CLEANUP_PHASE_4B5B_COMMIT_REPORT.md` | 📋 Report limpieza |
| 4 | `docs/CLEANUP_PHASE_4B5C1_COMMIT_REPORT.md` | 📋 Report limpieza |
| 5 | `docs/CLEANUP_PHASE_4B5C2_COMMIT_REPORT.md` | 📋 Report limpieza |
| 6 | `docs/CLEANUP_PHASE_4B5C3_COMMIT_REPORT.md` | 📋 Report limpieza |
| 7 | `docs/CLEANUP_PHASE_4B5C4A_HIGH_RISK_PURGE_DELETE_PLAN.md` | 📋 Plan pendiente |
| 8 | `docs/WORK_SESSION_FINAL_STATUS.md` | 📋 Informe sesión |
| 9 | `docs/PRE_PRODUCTION_READINESS_AFTER_CLEANUP.md` | 📋 Checklist |

---

## 2. Archivos que NO Deben Entrar en Ningún Commit

| Archivo | Razón |
|---|---|
| `.env` | Credenciales locales |
| `frontend/.env` | Credenciales frontend |
| `serviceAccountKey.json` | Clave de servicio |
| `functions_python/venv/` | Entorno virtual |
| `frontend/node_modules/` | Dependencias |
| `frontend/dist/` | Build output |
| `*.pyc` / `__pycache__/` | Bytecode |

> Todos están en `.gitignore`. Verificación adicional: ninguno aparece en `git status`.

---

## 3. Propuesta de Commits Separados

### Commit A: Housekeeping — Docs + Eliminaciones

**Mensaje:** `chore: add cleanup reports and remove obsolete files`

**Incluir:**

```
git add docs/CLEANUP_PHASE_4A_COMMIT_REPORT.md
git add docs/CLEANUP_PHASE_4B5A_COMMIT_REPORT.md
git add docs/CLEANUP_PHASE_4B5B_COMMIT_REPORT.md
git add docs/CLEANUP_PHASE_4B5C1_COMMIT_REPORT.md
git add docs/CLEANUP_PHASE_4B5C2_COMMIT_REPORT.md
git add docs/CLEANUP_PHASE_4B5C3_COMMIT_REPORT.md
git add docs/CLEANUP_PHASE_4B5C4A_HIGH_RISK_PURGE_DELETE_PLAN.md
git add docs/WORK_SESSION_FINAL_STATUS.md
git add docs/PRE_PRODUCTION_READINESS_AFTER_CLEANUP.md
git add docs/POST_CLEANUP_COMMIT_AND_DEPLOY_STAGING_PLAN.md

git add backend/app/tests/xray/test_compare_risk_free.py
git add backend/app/tests/xray/test_depositos.py
git add cargador_lotes_v_2.js
git add check_history.py create_zip.py
git add examine_excel.py examine_files.py examine_files2.py
git add fondos.csv fondos_absolutamente_todos_los_campos.csv fondos_all_fields.csv
git add frontend/build_log.txt
git add functions/get_report.js
git add functions_python/reports/batch_run_*.json
git add functions_python/services/inspector.py
git add functions_python/services/optimizer.py
git add functions_python/utils/__init__.py
git add "jon completo.html" jon.xlsx
git add limpieza_segura.bat
```

**Total:** ~36 archivos (9 new + 26 deleted + 1 este plan).  
**Riesgo:** NINGUNO — solo docs + eliminación de obsoletos.  
**Bloqueo:** NINGUNO.

---

### Commit B: Cambios Dev Funcionales (API + Frontend + Fiscal)

**Mensaje:** `feat: harden API auth, update Bizkaia 2026 fiscal tables, improve XRay engine`

**Incluir:**

```
git add functions_python/api/endpoints_admin.py
git add functions_python/api/endpoints_macro.py
git add functions_python/api/endpoints_xray_comparador.py
git add frontend/src/components/xray/XRayReportGenerator.tsx
git add frontend/src/utils/retirementUtils.ts
```

**Detalle de cambios:**

| Archivo | Cambio | Impacto |
|---|---|---|
| `endpoints_admin.py` | Auth Bearer en `force_weekly_research`, email check | ⚠️ Requiere token en llamadas admin |
| `endpoints_macro.py` | `print()` → `logger.error()` | 🟢 Bajo — solo logging |
| `endpoints_xray_comparador.py` | CORS restringido, Letras 2026, XIRR None | ⚠️ CORS afecta orígenes permitidos |
| `XRayReportGenerator.tsx` | `auth.getIdToken()` + `Authorization` header | ⚠️ Requiere usuario autenticado |
| `retirementUtils.ts` | Escala fiscal Bizkaia 2026 | 🟢 Bajo — solo constantes fiscales |

**Riesgo:** MEDIO — los cambios de auth/CORS afectan funcionalidad.  
**Bloqueo:** Verificar que auth funciona end-to-end antes de deploy.

**Coherencia interna:**
- `XRayReportGenerator.tsx` envía `Authorization: Bearer <token>`.
- `endpoints_xray_comparador.py` restringe CORS.
- `endpoints_admin.py` valida el token.
- **Son un conjunto coherente de hardening de seguridad.** ✅

---

### Commit C: Firestore Rules — SEPARADO

**Mensaje:** `security: restrict Firestore reads to authenticated users`

**Incluir:**

```
git add firestore.rules
```

**Cambios exactos:**

| Colección | Antes | Después |
|---|---|---|
| `funds_v3` | `allow read: if true` | `allow read: if isAuthenticated()` |
| `historico_vl_v2` | `allow read: if true` | `allow read: if isAuthenticated()` |
| `analysis_results` | `allow read: if true` | `allow read: if isAuthenticated()` |
| `synthetic_benchmarks` | `allow read: if true` | `allow read: if isAuthenticated()` |
| `reports` | `allow read: if true` | `allow read: if isAuthenticated()` |
| **Default catch-all** | `read: true, write: false` | `read, write: false` |

**Riesgo:** 🔴 ALTO si auth no está implementada en frontend.  
**Bloqueo:** Verificar ANTES de deploy que:
1. Frontend envía token en todas las llamadas Firestore.
2. Usuario se autentica al cargar la app.
3. No hay lecturas anónimas necesarias (splash, landing, etc.).

> ⚠️ **ESTE COMMIT NO DEBE DESPLEGARSE hasta validar auth end-to-end.**

---

## 4. Análisis de Firestore Rules

### ¿Qué cambia?
- **5 colecciones** pasan de lectura pública (`true`) a lectura autenticada (`isAuthenticated()`).
- **Regla catch-all** pasa de `read: true, write: false` a `read, write: false`.

### ¿Qué riesgo tiene?
- Si el frontend no envía tokens Firebase Auth, **todas las lecturas fallarán**.
- Si hay usuarios no logueados (visitantes), **no verán datos**.
- El catch-all `read, write: false` bloquea CUALQUIER colección no listada explícitamente.

### ¿Qué debe probarse antes de deploy?
1. Login en frontend → ¿se obtiene token Firebase Auth?
2. Navegación principal → ¿cargan fondos, históricos, benchmarks?
3. XRay Comparador → ¿funciona con token?
4. Modo no logueado → ¿se redirige a login?
5. Admin endpoints → ¿rechazan sin token?

---

## 5. Secuencia Recomendada

```
PASO 1: Commit A — Housekeeping
  git add [docs + eliminaciones]
  git commit -m "chore: add cleanup reports and remove obsolete files"
  Riesgo: NINGUNO
  Bloqueo: NINGUNO

PASO 2: Commit B — Dev funcional
  git add [API + frontend]
  git commit -m "feat: harden API auth, update Bizkaia 2026 fiscal tables, improve XRay engine"
  Riesgo: MEDIO
  Bloqueo: NINGUNO (son cambios ya desarrollados)

PASO 3: Commit C — Firestore rules
  git add firestore.rules
  git commit -m "security: restrict Firestore reads to authenticated users"
  Riesgo: ALTO
  Bloqueo: NO desplegar rules sin validar auth

PASO 4: Push
  git push origin master
  Riesgo: BAJO (push no despliega nada)

PASO 5: Validar auth end-to-end
  - Verificar frontend login.
  - Verificar lecturas con token.
  - Verificar rechazo sin token.
  - Puede hacerse en local o staging.

PASO 6: Deploy incremental
  a) firebase deploy --only functions  (API Python)
  b) firebase deploy --only hosting    (Frontend)
  c) Validar que todo funciona.
  d) firebase deploy --only firestore:rules  (SOLO al final)
```

---

## 6. Prompt Recomendado para Ejecutar Paso 1

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Ejecutar Commit A — housekeeping docs + eliminaciones.

REGLAS:
- NO incluir .env, frontend/.env, serviceAccountKey.json.
- NO incluir firestore.rules.
- NO incluir archivos de API/frontend dev.
- NO hacer push.

OBJETIVO:
git add selectivo de:
- 10 docs nuevos (reports + planes + este plan).
- 26 archivos eliminados.
Verificar staged. Commit con:
  chore: add cleanup reports and remove obsolete files
```

---

## 7. Confirmaciones

- ✅ No se modificó ningún archivo de código.
- ✅ No se hizo commit.
- ✅ No se hizo push.
- ✅ No se desplegó nada.
- ✅ No se tocaron credenciales.
- ✅ Solo análisis y documentación.
