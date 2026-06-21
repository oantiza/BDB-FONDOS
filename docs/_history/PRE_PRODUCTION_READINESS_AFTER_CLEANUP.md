# Checklist Pre-Producción — Tras Limpieza Fases 1–4B

**Fecha:** 2026-05-04  
**Evaluación:** Verificación post-limpieza, pre-deploy.

---

## Veredicto Global

| Área | Estado |
|---|---|
| **Seguridad de credenciales** | ✅ PASA |
| **Frontend build** | ✅ PASA |
| **Python API syntax** | ✅ PASA |
| **Firestore rules syntax** | ✅ PASA |
| **Orphan imports** | ✅ PASA |
| **Cambios dev no commiteados** | ⚠️ REQUIERE DECISIÓN |
| **Archivos eliminados no commiteados** | ⚠️ REQUIERE DECISIÓN |
| **Push pendiente** | ⚠️ 14 commits locales sin push |

### Resultado: ⚠️ PASA CON CONDICIONES

> Los cambios de limpieza (Fases 1–4B) son seguros para push. Los cambios de desarrollo pendientes (firestore.rules, API, frontend XRay) deben evaluarse por separado.

---

## 1. Seguridad de Credenciales — ✅ PASA

| Check | Resultado |
|---|---|
| `serviceAccountKey.json` en Git tracked | ❌ No — ✅ |
| `.env` en Git tracked | ❌ No — ✅ |
| `frontend/.env` en Git tracked | ❌ No — ✅ |
| `.gitignore` cubre SAK | ✅ |
| `.gitignore` cubre .env (10+ variantes) | ✅ |

---

## 2. Frontend Build — ✅ PASA

| Check | Resultado |
|---|---|
| `npm run build` | ✅ Built in 7.82s |
| Errores de compilación | 0 |
| Warnings | 1 chunk size warning (pre-existente, no bloqueante) |
| Output | `dist/` generado correctamente |

---

## 3. Python API Syntax — ✅ PASA

| Archivo | py_compile |
|---|---|
| `endpoints_admin.py` | ✅ OK |
| `endpoints_macro.py` | ✅ OK |
| `endpoints_xray_comparador.py` | ✅ OK |

---

## 4. Firestore Rules — ✅ PASA (syntax)

| Check | Resultado |
|---|---|
| Brace balance | ✅ 24/24 |
| Syntax básica | ✅ |

### ⚠️ Cambios Pendientes en firestore.rules

Los cambios son de **endurecimiento de seguridad** (no de limpieza):

```diff
- allow read: if true; // Temporarily public for verification
+ allow read: if isAuthenticated();

- allow read: if true; // Temporarily allow for deep verification
- allow write: if false;
+ allow read, write: if false;
```

**Colecciones afectadas:**
- `funds_v3` — read: `true` → `isAuthenticated()`
- `historico_vl_v2` — read: `true` → `isAuthenticated()`
- `analysis_results` — read: `true` → `isAuthenticated()`
- `synthetic_benchmarks` — read: `true` → `isAuthenticated()`
- `reports` — read: `true` → `isAuthenticated()`
- Default catch-all — `read: true, write: false` → `read, write: false`

> ⚠️ **IMPACTO:** Si se despliegan estas reglas, TODA lectura requerirá autenticación. Verificar que el frontend gestiona auth correctamente antes de desplegar.

---

## 5. Orphan Imports — ✅ PASA

| Import eliminado | ¿Sigue referenciado? |
|---|---|
| `from services.inspector` | ❌ No — ✅ |
| `from services.optimizer` | ❌ No — ✅ |
| `from utils import` | ❌ No — ✅ |

Los 3 archivos eliminados (`inspector.py`, `optimizer.py`, `utils/__init__.py`) no son importados por ningún módulo activo.

---

## 6. Cambios Pendientes No Commiteados

### 6A. Cambios de Desarrollo (M) — 6 archivos

| Archivo | Tipo | Relación con limpieza |
|---|---|---|
| `firestore.rules` | Security hardening | ❌ No es limpieza 4B |
| `frontend/src/components/xray/XRayReportGenerator.tsx` | Feature XRay | ❌ No es limpieza 4B |
| `frontend/src/utils/retirementUtils.ts` | Feature XRay | ❌ No es limpieza 4B |
| `functions_python/api/endpoints_admin.py` | API enhancement | ❌ No es limpieza 4B |
| `functions_python/api/endpoints_macro.py` | API enhancement | ❌ No es limpieza 4B |
| `functions_python/api/endpoints_xray_comparador.py` | API enhancement | ❌ No es limpieza 4B |

> **Decisión requerida:** Estos cambios son de desarrollo previo (XRay Comparador, seguridad). Deben commitearse en un commit separado con su propio mensaje, o descartarse si son WIP.

### 6B. Archivos Eliminados (D) — 26 archivos

| Categoría | Archivos | Acción sugerida |
|---|---|---|
| **Archivos scratch/temporales** | `check_history.py`, `create_zip.py`, `examine_*.py`, `jon.*`, `limpieza_segura.bat` | Commitear eliminación |
| **CSVs de datos** | `fondos.csv`, `fondos_*.csv` | Commitear eliminación |
| **Reports batch** | `batch_run_*.json` (×7) | Commitear eliminación |
| **Servicios obsoletos** | `inspector.py`, `optimizer.py`, `utils/__init__.py` | Commitear eliminación |
| **Frontend artifacts** | `build_log.txt` | Commitear eliminación |
| **Tests duplicados** | `backend/app/tests/xray/test_*.py` (×2) | Verificar que existen en `functions_python/tests/` antes de eliminar |
| **Copia raíz** | `cargador_lotes_v_2.js` | Commitear (la versión canónica está en `scripts/maintenance/`) |
| **Functions legacy** | `functions/get_report.js` | Commitear eliminación |

### 6C. Archivos Nuevos Sin Commit (??) — 8 docs

| Archivo | Contenido |
|---|---|
| `docs/CLEANUP_PHASE_4A_COMMIT_REPORT.md` | Report 4A |
| `docs/CLEANUP_PHASE_4B5A_COMMIT_REPORT.md` | Report 4B.5A |
| `docs/CLEANUP_PHASE_4B5B_COMMIT_REPORT.md` | Report 4B.5B |
| `docs/CLEANUP_PHASE_4B5C1_COMMIT_REPORT.md` | Report 4B.5C.1 |
| `docs/CLEANUP_PHASE_4B5C2_COMMIT_REPORT.md` | Report 4B.5C.2 |
| `docs/CLEANUP_PHASE_4B5C3_COMMIT_REPORT.md` | Report 4B.5C.3 |
| `docs/CLEANUP_PHASE_4B5C4A_HIGH_RISK_PURGE_DELETE_PLAN.md` | Plan 4B.5C.4a |
| `docs/WORK_SESSION_FINAL_STATUS.md` | Informe final sesión |

> **Acción:** Commitear todos en un commit de housekeeping.

---

## 7. Commits Pendientes de Push — 14

```
23099da chore: support env-based Firebase init in medium-risk mutating tools
8f0f027 chore: support env-based Firebase init in scoped mutating tools
9b0beee chore: support env-based Firebase init in readonly snapshot tools
0654592 chore: support env-based Firebase init in dry-run mutating tools
e2f687a chore: support env-based Firebase init in residual read-only Python tools
42f16ed chore: support env-based Firebase init in read-only JS tools
64bb990 chore: document credential setup and support env-based Firebase init
18e86e3 chore: add credential safety examples and gitignore hardening
8b095ab chore: consolidate repository cleanup phases 1-3
6058a2a Clean up macro data sources text and remove logo from annexe
1681d18 Move macro annexe to a separate PDF page
20768a2 Add YoY inflation data to the macro annexe table
cca9cc2 Add Anexo: Letras del Tesoro rates per year with source in report
4bc29fb Add start year selector to Comparador Patrimonial
```

> Los 9 commits superiores (limpieza) y los 5 inferiores (features XRay) son independientes. Push seguro.

---

## 8. Tests Disponibles

| Suite | Archivos | Estado |
|---|---|---|
| Frontend (vitest) | 0 test files in `src/` | ⚪ No hay tests frontend |
| Python project tests | 13 archivos en `functions_python/tests/` | ⚠️ No ejecutados (requieren Firestore) |
| Python scripts tests | 5 archivos en `functions_python/scripts/tests/` | ⚠️ No ejecutados |

> **Nota:** Los tests Python requieren conexión a Firestore y no fueron ejecutados por seguridad. Deben validarse en entorno de staging.

---

## 9. Tests Eliminados

| Archivo eliminado | ¿Existe copia? |
|---|---|
| `backend/app/tests/xray/test_compare_risk_free.py` | ✅ `functions_python/tests/xray/test_compare_risk_free.py` |
| `backend/app/tests/xray/test_depositos.py` | ✅ `functions_python/tests/xray/test_depositos.py` |

> Las versiones canónicas existen en `functions_python/tests/`. Eliminación de `backend/app/tests/` es segura.

---

## 10. Bloqueos para Deploy

| # | Bloqueo | Severidad | Acción |
|---|---|---|---|
| 1 | 6 archivos de desarrollo sin commit (firestore.rules, API, frontend) | ⚠️ MEDIO | Decidir: commit o stash antes de push |
| 2 | 26 archivos eliminados sin commit | ⚠️ MEDIO | Commitear eliminación en batch |
| 3 | 8 docs sin commit | 🟡 BAJO | Commitear en housekeeping |
| 4 | firestore.rules cambia reads de `true` a `isAuthenticated()` | ⚠️ MEDIO | Verificar que frontend tiene auth antes de deploy de rules |
| 5 | Tests Python no ejecutados | 🟡 BAJO | Ejecutar en staging con Firestore conectado |

---

## 11. Qué Falta Antes de Deploy

### Obligatorio:
1. **Decidir sobre cambios de desarrollo (6 archivos M).** Commitear o stash.
2. **Commitear eliminaciones (26 archivos D).** Son seguras, artefactos obsoletos.
3. **Commitear docs pendientes (8 archivos ??).** Housekeeping.
4. **Verificar auth frontend** antes de desplegar `firestore.rules` endurecido.

### Recomendado:
5. Push a remote para backup.
6. Ejecutar tests Python en staging con Firestore.
7. Deploy incremental: primero functions, luego rules, luego hosting.

### Opcional (fase futura):
8. Ejecutar FASE 4B.5C.4a (2 scripts purge/delete — init refactor).
9. Documentar FASE 4B.5C.4b (3 scripts bloqueados).
10. Migrar API key EODHD a variable de entorno.
11. Rotar serviceAccountKey.json tras validar GAC en todos los entornos.

---

## 12. Secuencia Recomendada Pre-Deploy

```
1. git add + commit de eliminaciones (26 D files)
   → "chore: remove obsolete scratch files, CSVs, and legacy services"

2. git add + commit de docs pendientes (8 ?? files)
   → "docs: add cleanup phase reports and pre-production checklist"

3. Evaluar 6 archivos M de desarrollo:
   a. Si son listos → commit separado con mensaje descriptivo.
   b. Si son WIP → stash y deploy sin ellos.

4. git push origin master

5. Verificar auth frontend con firestore.rules actual.

6. Si auth OK → deploy rules endurecido.
   Si auth NO OK → NO desplegar firestore.rules hasta arreglar.

7. firebase deploy --only functions (Python API).

8. firebase deploy --only hosting (frontend).
```

---

*Generado el 2026-05-04 a las 17:00 CEST. No se desplegó. No se hizo push.*
