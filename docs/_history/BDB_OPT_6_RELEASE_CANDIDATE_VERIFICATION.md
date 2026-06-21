# BDB-OPT-6 — Release Candidate Verification

## 1. Ruta Validada

- **Directorio activo**: `C:\Users\oanti\Documents\BDB-FONDOS`
- **BDB-FONDOS-CORE**: No tocado, no leído, no referenciado como dependencia activa.
- **Firestore**: Sin writes. `firestore.rules` sin modificar (diff vacío contra HEAD).

---

## 2. Resumen de OPT-5

OPT-5 realizó:
- Eliminación física de `serviceAccountKey.json` (confirmado: ya no existe en disco).
- Limpieza de caches (`__pycache__/`, `.pytest_cache/`).
- Sanitización de `test_gemini_models.py` para usar variable de entorno.
- Refuerzo de `.gitignore` (`.pyc`, `serviceAccount*.json`, `frontend/node_modules/`).
- Ejecución de suites P0 y full con clasificación de fallos.
- Decisión: `DEPLOYABLE_WITH_WARNINGS`.

---

## 3. Estado Git Actual

### Branch y Commits
```
Branch: master
Ahead of origin/master by: 1 commit

HEAD (da89700): P0_RUNTIME_HARDENING_PATCH
  ├── frontend/src/hooks/usePortfolioActions.ts
  ├── frontend/src/types/index.ts
  ├── functions_python/services/portfolio/optimizer_core.py
  ├── functions_python/services/portfolio/suitability_engine.py
  ├── functions_python/services/portfolio/utils.py
  ├── functions_python/tests/test_optimizer_core.py
  └── functions_python/tests/test_suitability_v2.py

Commits previos relevantes ya en HEAD:
  1f200d0  feat(frontend): improve optimizer messages ux and modals
  273c8d8  feat(optimizer): add feasibility precheck before solver
  9f852c3  fix(optimizer): guard float conversion for missing target volatility
  48ba511  fix(tests): update test_optimizer_core fixtures
  5663eae  fix(optimizer): avoid duplicate bucket constraints
  cb510dd  fix(frontend): add warning toast type
  5439b3d  fix(frontend): improve fallback ux and display volatility deviation
  8e4464e  fix(frontend): normalize fund taxonomy filters
```

### Working Tree — Cambios Pendientes (Unstaged)

| Archivo | Tipo | Contenido |
|---------|------|-----------|
| `.gitignore` | modified | Añade `*.pyc`, `frontend/node_modules/`, fix trailing newline |
| `functions_python/scripts/tests/test_gemini_models.py` | modified | Reemplaza API key hardcodeada por `os.environ.get("GEMINI_API_KEY")` |

### Untracked Files

| Archivo | Clasificación | Acción |
|---------|--------------|--------|
| `functions_python/tests/test_optimizer_p0_contracts.py` | **TEST P0 backend** | Debe commitearse |
| `frontend/src/__tests__/optimizerP0Contract.test.ts` | **TEST P0 frontend** | Debe commitearse |
| `docs/BDB_OPT_*` (6 archivos) | Docs auditoría | Opcional, commit docs |
| `docs/BDB_SEM_*` (4 archivos) | Docs auditoría | Opcional, commit docs |
| `docs/BDB_CSV_*` (2 archivos) | Docs auditoría | Opcional, commit docs |
| `docs/OPTIMIZATION_PAYLOAD_CONTRACT_AUDIT.md` | Docs auditoría | Opcional |
| `docs/OPTIMIZER_MESSAGES_UX_FINAL_QA_AND_DEPLOY_REPORT.md` | Docs auditoría | Opcional |
| `artifacts/` | Dumps JSON diagnósticos | NO commitear |
| `scripts/maintenance/bdb_sem_*` (3 archivos) | Scripts readonly | NO commitear (contienen refs a funds_core_v1 en exclusiones) |

---

## 4. Verificación de Secretos

| Check | Resultado |
|-------|-----------|
| `git ls-files serviceAccountKey.json` | **Vacío** ✅ No trackeado |
| `git ls-files "*.env"` | **Vacío** ✅ No trackeado |
| `git ls-files "*serviceAccount*"` | **Vacío** ✅ No trackeado |
| `git ls-files "__pycache__"` | **Vacío** ✅ |
| `git ls-files "*.pyc"` | **Vacío** ✅ |
| `serviceAccountKey.json` en disco | **False** ✅ Eliminado por OPT-5 |
| `firestore.rules` modificado | **No** ✅ diff vacío |
| `allow read, write: if true` en rules | **No encontrado** ✅ |

> [!WARNING]
> **Hallazgo Crítico**: La versión commiteada en HEAD de `functions_python/scripts/tests/test_gemini_models.py` todavía contiene la API key hardcodeada `AIzaSy...wV4`. La sanitización de OPT-5 está solo en el working tree (unstaged). **El COMMIT 0 de seguridad debe realizarse antes de cualquier push.**

---

## 5. Confirmación de Hardening en HEAD

Verificación línea por línea sobre el contenido de HEAD (no del working tree):

### Backend — optimizer_core.py ✅
- `_validate_optimizer_result`: **PRESENTE** en HEAD
- `fallback_non_compliant` / `fallback_compliant` / `optimal_compliant`: **PRESENTE**
- `applicable` y `usable` fields: **PRESENTE**
- `violations` / `constraint_violations`: **PRESENTE**
- `final_warnings`: **PRESENTE** (reemplaza `"warnings": []` vacío)

### Backend — suitability_engine.py ✅
- `has_v2_exposure = bool(exposure)`: **PRESENTE** en HEAD
- Guard `Missing portfolio_exposure_v2`: **PRESENTE**
- Block para `risk_profile <= 4` sin exposure: **PRESENTE**

### Backend — utils.py ✅
- `np.isfinite` guard: **PRESENTE** en HEAD
- `cleaned` dict con sanitización de negativos: **PRESENTE**

### Backend — feasibility_precheck.py ✅
- Committed en `273c8d8`: **PRESENTE** en HEAD

### Frontend — usePortfolioActions.ts ✅
- `APPLICABLE_OPTIMIZER_STATUSES` set: **PRESENTE** en HEAD
- `isOptimizerResultApplicable()` function: **PRESENTE**
- `fallback_non_compliant` → return false gate: **PRESENTE**
- Doble gate en `processOptimizationResult`: **PRESENTE**

### Frontend — types/index.ts ✅
- `applicable?: boolean`: **PRESENTE** en HEAD

### Frontend — UX modals/toast ✅
- `OptimizationReviewModal.tsx`: committed en `1f200d0`
- `Toast.tsx` warning type: committed en `cb510dd`
- `DashboardPage.tsx`: committed en `1f200d0`

### Frontend — rulesEngine / taxonomy ✅
- `rulesEngine.ts`: committed en `8e4464e`
- `directSearch.ts`: committed en `8e4464e`

---

## 6. Tests P0 — Ejecución de Verificación

### Backend P0 (53 tests)
```
pytest test_optimizer_core.py test_suitability_v2.py test_optimizer_p0_contracts.py
Result: 53 passed in 1.77s ✅
```

Tests específicos verificados:
- `test_opt1_t001_fallback_that_violates_bucket_bounds_is_non_compliant` ✅
- `test_opt1_t003_missing_v2_exposure_is_not_silent_zero_equity` ✅
- `test_opt1_t004_negative_upstream_weights_do_not_survive_normalization` ✅
- `test_opt1_t009_used_assets_weights_are_complete_when_universe_expands` ✅

### Frontend P0 (2 tests)
```
npm test -- optimizerP0Contract
Result: 2 passed ✅
```

Tests específicos verificados:
- `OPT1-T006 status table only allows compliant results` ✅
- `OPT1-T006 runtime hook blocks fallback_non_compliant` ✅

---

## 7. Fallos Legacy / Out-of-Scope (Waiver Required)

### Backend (22 failed — sin cambio respecto a OPT-4B y OPT-5)

| Suite | Count | Root Cause | Impacto en Optimizador |
|-------|-------|------------|----------------------|
| `test_backtester_history_fallback` | 1 | Expectativa legacy de error vs success path | Ninguno |
| `test_regression_coverage` | 2 | Analyzer/frontier devuelve success, test espera error | Ninguno |
| `xray/test_compare_risk_free` | 8 | Request mock sin `.headers` attribute | Ninguno (XRay, no optimizer) |
| `xray/test_depositos` | 11 | Request mock sin `.headers` attribute | Ninguno (XRay, no optimizer) |

### Frontend (6 failed — sin cambio respecto a OPT-4B y OPT-5)

| Suite | Count | Root Cause | Impacto en Optimizador |
|-------|-------|------------|----------------------|
| `analytics.test.ts` | 1 | Escala % vs decimal en weighted return | Ninguno |
| `rulesEngine.test.ts` | 3 | Mock data sin `classification_v2.asset_type` | Ninguno (UI draft, no optimizer) |
| `v2Helpers.test.ts` | 2 | Capitalización de strings legacy | Ninguno |

> [!IMPORTANT]
> Los 28 fallos legacy son idénticos en identidad y causa raíz a los reportados en OPT-4B y OPT-5. No hay regresiones nuevas. Ninguno de ellos afecta al flujo crítico OPTIMIZAR → VALIDAR → APLICAR. Requieren waiver humano formal para proceder con deploy, o un bloque correctivo separado.

---

## 8. Plan de Commits Pendientes

### COMMIT 0 — SECURITY_CLEANUP (BLOCKER para push)

```
git add .gitignore functions_python/scripts/tests/test_gemini_models.py
git commit -m "SECURITY_CLEANUP: remove hardcoded API key, harden .gitignore"
```

> [!CAUTION]
> Este commit es **obligatorio antes de cualquier push**. Sin él, la API key `AIzaSy...` queda expuesta en el historial público del remoto.

### COMMIT TESTS — P0_REGRESSION_TESTS

```
git add functions_python/tests/test_optimizer_p0_contracts.py
git add frontend/src/__tests__/optimizerP0Contract.test.ts
git commit -m "P0_REGRESSION_TESTS: add optimizer contract test suites"
```

### COMMIT DOCS — AUDIT_DOCUMENTATION (opcional)

```
git add docs/BDB_OPT_4B_HARDENING_FREEZE_AND_REGRESSION.md
git add docs/BDB_OPT_5_CLEAN_RELEASE_AND_DEPLOY_READINESS.md
git add docs/BDB_OPT_6_RELEASE_CANDIDATE_VERIFICATION.md
git commit -m "AUDIT_DOCS: OPT-4B/5/6 verification and freeze reports"
```

---

## 9. Riesgos Restantes

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| API key hardcodeada en HEAD (pre-COMMIT 0) | **HIGH** | COMMIT 0 obligatorio antes de push |
| API key en historial Git antiguo (commit `11a6913`) | **MEDIUM** | Revocar key en Google Cloud Console post-push |
| 28 tests legacy rotos | **LOW** | No afectan flujo optimizador. Waiver o fix separado |
| Tests P0 no commiteados | **MEDIUM** | COMMIT TESTS los fija como guardia de regresión |

---

## 10. Recomendación Final

### Veredicto: **DEPLOYABLE_WITH_WARNINGS**

### Opción Recomendada: **A — "Puede prepararse commit y deploy manual con waiver"**

**Secuencia precisa recomendada:**

1. **COMMIT 0** — Security cleanup (`.gitignore` + `test_gemini_models.py`). **OBLIGATORIO.**
2. **COMMIT TESTS** — Tests P0 (backend + frontend).
3. **COMMIT DOCS** — Documentación de auditoría (opcional).
4. **Waiver humano** de los 28 fallos legacy clasificados como out-of-scope.
5. **Revocar** la Gemini API key `AIzaSy...wV4` en Google Cloud Console (ya está en historial Git).
6. **Push** a origin.
7. **Deploy** manual con supervisión.

### Condiciones para deploy:
- ✅ Hardening P0 integrado en HEAD y verificado.
- ✅ Frontend build limpio.
- ✅ 55 tests P0 passing.
- ⚠️ COMMIT 0 pendiente de ejecución (blocker para push, no para deploy local).
- ⚠️ 28 fallos legacy requieren waiver formal.
- ⚠️ API key requiere revocación post-push.
