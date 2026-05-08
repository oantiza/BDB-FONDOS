# BDB-OPT-5 - Secret Cleanup, Commit Split, Regression Tests and Deploy Readiness

## Objetivo

Preparar el repositorio legacy real `C:\Users\oanti\Documents\BDB-FONDOS` para congelar los cambios buenos de hardening del optimizador, eliminando secretos, caches y ruido antes de separar los cambios en bloques revisables.

## Confirmaciones de alcance

- Ruta validada: `C:\Users\oanti\Documents\BDB-FONDOS`.
- No se hizo deploy.
- No se hizo push.
- No se escribio en Firestore.
- No se hizo rollback.
- No se uso Firebase CLI deploy.
- No se leyo ni se toco `C:\Users\oanti\Documents\BDB-FONDOS-CORE`.
- `firestore.rules` existe y quedo limpio en git; no se modifico.
- No se tocaron `.env` reales.

## SECRET_CANDIDATES_FOUND

Se detectaron candidatos sin imprimir valores:

- `serviceAccountKey.json` en raiz del repositorio: candidato de secreto local ignorado/untracked.
- JSON con campo `private_key`: limitado al service account local anterior.
- `.env` reales: presentes como archivos locales; no se tocaron y no se imprimieron.
- `functions_python/scripts/tests/test_gemini_models.py`: tenia una Gemini API key hardcodeada.
- `functions_python/scripts/tests/__pycache__/` y otros `__pycache__/` de codigo/app: candidatos a contener bytecode con valores antiguos.
- `.pytest_cache/` y `functions_python/.pytest_cache/`: caches de test no aptas para commit.
- `frontend/src/utils/fonts.ts`: match de patron tipo API key por contenido base64 embebido; clasificado como falso positivo visual, sin valor de secreto impreso.

## Limpieza realizada

- Eliminado `serviceAccountKey.json` del working tree local al estar ignorado/untracked.
- Eliminados `.pytest_cache/` y `functions_python/.pytest_cache/`.
- Eliminados `__pycache__/` de codigo/app fuera del virtualenv.
- No se eliminaron caches internos de `functions_python/venv/`; son dependencia local ignorada y no forman parte de commits.
- `functions_python/scripts/tests/test_gemini_models.py` fue saneado para leer `GEMINI_API_KEY` desde variable de entorno y salir sin fallo cuando no existe.
- `.gitignore` se reforzo para cubrir explicitamente:
  - `.env`
  - `.env.*`
  - `serviceAccount*.json`
  - `**/serviceAccount*.json`
  - `__pycache__/`
  - `*.pyc`
  - `.pytest_cache/`
  - `node_modules/`
  - `frontend/node_modules/`
  - `dist/`
  - `build/`

## Archivos que no deben commitearse

- `serviceAccountKey.json` o cualquier `serviceAccount*.json`.
- `.env` y `.env.*` reales.
- Cualquier clave API hardcodeada.
- `__pycache__/`, `*.pyc`, `.pytest_cache/`.
- `node_modules/`, `frontend/node_modules/`.
- `frontend/dist/`, `dist/`, `build/`.
- Dumps masivos bajo `artifacts/` o `data/` sin revision humana.

## Estado git despues de la limpieza

Cambios tracked pendientes:

- `.gitignore`
- `functions_python/scripts/tests/test_gemini_models.py`

Untracked relevantes:

- `frontend/src/__tests__/optimizerP0Contract.test.ts`
- `functions_python/tests/test_optimizer_p0_contracts.py`
- docs/artifacts de auditorias previas.
- scripts de mantenimiento SEM previos.

Archivos funcionales P0 listados para backend/frontend aparecen limpios frente a `HEAD` en este working tree. Por tanto, el split de commits de runtime debe verificarse contra el historial/branch actual; no hay diff runtime pendiente para incluir ahora desde el working tree.

## Verificacion final de higiene

- `serviceAccount*.json`: 0 encontrados tras limpieza.
- JSON con `"private_key"` fuera de dependencias/build: 0 encontrados tras limpieza.
- `.pytest_cache/`: 0 encontrados tras limpieza.
- `__pycache__/` de codigo/app fuera de `functions_python/venv/`: 0 encontrados tras limpieza.
- `frontend/dist/`: presente como salida ignorada del build; no debe incluirse en commit.

## Propuesta de commits separados

### COMMIT 0 - SECURITY_CLEANUP_PREP

Incluir:

- `.gitignore`
- `functions_python/scripts/tests/test_gemini_models.py`

No incluir:

- service account local eliminado.
- caches eliminadas.
- `.env` reales.

Estado: listo para revision.

### COMMIT A - P0_RUNTIME_HARDENING_PATCH

Incluir solo si hay diff pendiente o si se reconstruye desde branch/historial:

- `functions_python/services/portfolio/optimizer_core.py`
- `functions_python/services/portfolio/suitability_engine.py`
- `functions_python/services/portfolio/utils.py`
- `functions_python/services/portfolio/feasibility_precheck.py`
- `functions_python/tests/test_optimizer_core.py`
- `functions_python/tests/test_suitability_v2.py`
- `functions_python/tests/test_feasibility_precheck.py`
- `functions_python/tests/test_optimizer_p0_contracts.py`

Estado working tree: runtime limpio; test P0 backend untracked disponible.

### COMMIT B - OPTIMIZER_FALLBACK_UX

Incluir solo si hay diff pendiente o si se reconstruye desde branch/historial:

- `frontend/src/hooks/usePortfolioActions.ts`
- `frontend/src/types/index.ts`
- `frontend/src/components/modals/OptimizationReviewModal.tsx`
- `frontend/src/components/common/Toast.tsx`
- `frontend/src/context/ToastContext.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/modals/ConfirmModal.tsx` si aparece en diff real.
- `frontend/src/__tests__/optimizerP0Contract.test.ts`

Estado working tree: archivos runtime/UX limpios; test P0 frontend untracked disponible.

### COMMIT C - MIXED_FUNDS_FRONTEND_TREATMENT

Incluir solo si hay diff pendiente o si se reconstruye desde branch/historial:

- `frontend/src/utils/rulesEngine.ts`
- `frontend/src/utils/directSearch.ts`
- `frontend/src/components/FundSwapModal.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/comparator/FundComparator.tsx`
- `frontend/src/components/modals/SharpeMaximizerModal.tsx`
- `frontend/src/__tests__/mixedFunds.test.ts` si aparece como nuevo/modificado.

Estado working tree: archivos listados limpios frente a `HEAD`.

### COMMIT D - AUDIT_DOCS_OPTIONAL

Incluir solo docs/artifacts pequenos y trazables:

- `docs/BDB_OPT_5_CLEAN_RELEASE_AND_DEPLOY_READINESS.md`
- docs OPT/SEM necesarios para auditoria.
- artifacts JSON/CSV pequenos si aportan trazabilidad.

No incluir dumps masivos ni datos sensibles.

## Tests ejecutados

### Backend minimo P0/relevante

Comando:

`cd functions_python; python -m pytest tests/test_optimizer_core.py tests/test_suitability_v2.py tests/test_feasibility_precheck.py tests/test_optimizer_p0_contracts.py -q -p no:cacheprovider`

Resultado: PASS, `73 passed`.

### Frontend minimo P0/mixed

Comando:

`cd frontend; npm test -- --run src/__tests__/optimizerP0Contract.test.ts src/__tests__/mixedFunds.test.ts`

Resultado: PASS, `21 passed`.

### Frontend build

Comando:

`cd frontend; npm run build`

Resultado: PASS.

Warnings: chunk grande y dynamic imports que no se separan en chunk. No bloquean build.

### Backend full suite

Comando:

`cd functions_python; python -m pytest tests -q -p no:cacheprovider`

Resultado: FAIL_EXPECTED_LEGACY / OUT_OF_SCOPE, `117 passed`, `22 failed`.

Fallos clasificados:

- `tests/test_backtester_history_fallback.py::test_compute_metrics_still_fails_with_too_few_observations`: cambio/expectativa legacy de historia insuficiente.
- `tests/test_regression_coverage.py::test_analyzer_insufficient_history`: analyzer devuelve success excluyendo activos, test espera error.
- `tests/test_regression_coverage.py::test_frontier_short_history`: frontier devuelve success, test espera error.
- `tests/xray/test_compare_risk_free.py`: wrappers legacy XRay fallan por request mock sin `headers`.
- `tests/xray/test_depositos.py`: mismos wrappers legacy XRay fallan por request mock sin `headers`.

No se clasifican como regresion nueva de OPT-5.

### Frontend full suite

Comando:

`cd frontend; npm test -- --run`

Resultado: FAIL_EXPECTED_LEGACY / OUT_OF_SCOPE, `99 passed`, `6 failed`.

Fallos clasificados:

- `src/utils/analytics.test.ts`: mismatch legacy de escala retorno esperado porcentaje vs decimal.
- `src/utils/rulesEngine.test.ts`: expectativas legacy incompatibles con degradacion defensiva por ausencia de `classification_v2.asset_type`.
- `src/__tests__/v2Helpers.test.ts`: expectativas legacy de subtipo/label frente a normalizacion actual.

No se clasifican como regresion nueva de OPT-5.

## Clasificacion de resultados

- Limpieza de secretos: PASS.
- Tests P0 backend/frontend: PASS.
- Build frontend: PASS.
- Full backend: FAIL_EXPECTED_LEGACY.
- Full frontend: FAIL_EXPECTED_LEGACY.
- Regresiones nuevas atribuibles a OPT-5: ninguna observada.
- Blockers tecnicos de seguridad para commit: ninguno observado tras limpieza.
- Blockers de deploy repo-wide: full suites rojas sin waiver formal.

## Decision final

Decision: `DEPLOYABLE_WITH_WARNINGS`.

Alcance exacto de la decision:

- El paquete P0/hardening y la limpieza de secretos estan listos para revision y split de commits.
- No se recomienda deploy automatico desde este estado.
- Antes de cualquier deploy debe haber aprobacion humana explicita para aceptar/waive los fallos legacy, o bien un bloque separado que los corrija.

## Recomendacion siguiente

Siguiente bloque recomendado: crear una rama `codex/bdb-opt-5-clean-release`, hacer `COMMIT 0` de seguridad, luego reconstruir/validar el split A/B/C contra el historial real del branch. Despues, abrir un bloque de waiver/correccion para las suites legacy antes de deploy.
