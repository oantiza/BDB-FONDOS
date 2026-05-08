# BDB_OPTIMIZER_MIXED_CONSTRAINTS_FIX_1

Fecha: 2026-05-08

Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`

Estado: `BDB_OPTIMIZER_MIXED_CONSTRAINTS_FIX_1_READY_FOR_REVIEW`

## 1. Resumen Ejecutivo

Este bloque aplica un fix minimo al fallback legacy de fondos Mixtos sin `portfolio_exposure_v2.asset_mix` ni exposure util.

No se cambia la politica principal del optimizador:

- Mixto sigue siendo categoria comercial/reporting.
- Mixto no se convierte en hard constraint del solver.
- El solver sigue usando exposure real/look-through.
- No se anade vector Mixto.
- No se cambian perfiles de riesgo.

El cambio convierte el fallback legacy 50/50 en un evento explicito y auditable mediante warning estructurado. El valor 50/50 se mantiene para no romper flujo productivo en este bloque.

## 2. Estado Base Git

HEAD base: `d99bcfc OPTIMIZER_TESTS: add mixed constraints contract coverage`

Rama: `master`

`HEAD = origin/master = d99bcfc` al iniciar el bloque.

Working tree inicial:

- Sin staged.
- Sin modified tracked.
- Solo untracked locales conocidos fuera de scope.

## 3. Problema Corregido

Problema:

- `get_effective_asset_mix()` podia llegar al fallback legacy `label = "Mixto"`.
- Si no habia `portfolio_exposure_v2.asset_mix`, `portfolio_exposure_v2.economic_exposure` ni `metrics`, devolvia:
  - `equity = 0.5`
  - `bond = 0.5`
  - resto = `0.0`
- Ese fallback estaba documentado como legacy/riesgo, pero no tenia warning especifico suficientemente auditable.

Riesgo:

- En perfiles conservadores, el 50% equity inferido puede consumir presupuesto RV.
- En perfiles agresivos, solo aportar 50% equity puede dificultar alcanzar floors altos.
- Aunque suitability ya bloquea muchos casos sin exposure, el fallback podia activarse en escenarios legacy o tests.

## 4. Politica Conservada

Se conserva:

- Mixto no hard constraint.
- Mixto comercial/reporting.
- Solver por look-through.
- Sin vector Mixto.
- Sin cambios en `RISK_BUCKETS_LABELS`.
- Sin cambios en `bucket_bounds_v1`.
- Sin cambios en `current_risk_buckets`.
- Sin cambios frontend productivo.

## 5. Cambios Realizados

Archivo runtime modificado:

- `functions_python/services/portfolio/utils.py`

Cambio:

- En la rama `label_override == "Mixto"` de `get_effective_asset_mix()`, se anade warning explicito:
  - `mixed_missing_asset_mix`
  - `mixed_legacy_50_50_fallback`
  - `requires_exposure_review`
  - `isin=<ISIN>` si esta disponible.

No se cambia el mix de salida:

- `equity = 0.5`
- `bond = 0.5`
- `cash = 0.0`
- `alternative = 0.0`
- `real_asset = 0.0`
- `other = 0.0`

Motivo:

- Es el cambio minimo para dejar el fallback controlado y auditable sin introducir una alteracion cuantitativa de produccion.

## 6. Tests Actualizados/Creados

Archivo de test actualizado:

- `functions_python/tests/test_mixed_funds_lookthrough_contract.py`

Test actualizado:

- `test_mixed_without_asset_mix_uses_documented_legacy_50_50_fallback_with_warning`

El test valida:

- El fallback legacy sigue siendo 50/50.
- No aparece bucket solver `"Mixto"`.
- Se emiten warnings explicitos:
  - `mixed_missing_asset_mix`
  - `mixed_legacy_50_50_fallback`
  - `requires_exposure_review`
  - ISIN del fondo.

## 7. Resultados De Tests

Backend:

- `functions_python/tests/test_mixed_funds_lookthrough_contract.py`: `4 passed`
- `functions_python/tests/test_bucket_constraints_dedup.py`: `14 passed`
- `functions_python/tests/test_optimizer_fallback_status_contract.py`: `2 passed`
- `functions_python/tests/test_suitability_v2.py`: `47 passed`
- `functions_python/tests/test_optimizer_p0_contracts.py`: `4 passed`

Frontend:

- `frontend/src/__tests__/mixedFunds.test.ts`: `19 passed`
- `frontend/src/__tests__/optimizerP0Contract.test.ts`: `2 passed`

Total focal ejecutado:

- Backend: `71 passed`
- Frontend: `21 passed`

## 8. Riesgos Restantes

Riesgos pendientes:

- El fallback 50/50 sigue existiendo para compatibilidad.
- No se ha cambiado a fallback conservador 25/50/25.
- No se bloquean automaticamente todos los Mixtos sin exposure en perfiles 5+.
- La UI sigue pudiendo mostrar Mixto como categoria comercial mientras backend evalua look-through.
- No se anadieron comentarios inline sobre el gap Mixto en `optimizer_core.py` o `config.py`.

Estos riesgos quedan para bloques posteriores, no para este fix minimo.

## 9. Que NO Se Hizo

- No deploy.
- No push.
- No commit.
- No Firestore writes.
- No Gemini real.
- No parser contra PDFs.
- No `BDB-FONDOS-CORE`.
- No credenciales.
- No `.env`.
- No raw work dirs.
- No perfiles de riesgo.
- No vector Mixto.
- No cambios en Firestore rules.
- No endpoints reales.
- No Firebase real.
- No cambios frontend productivo.

## 10. Proximo Bloque Recomendado

Opcion A:

- `BDB-OPT-MIXED-CONSTRAINTS-CONTRACT-0`

Alcance:

- Comentarios inline en `optimizer_core.py` y `config.py`.
- Documentar que Mixto es decorativo para solver y que el solver usa exposure real.

Opcion B:

- `BDB-OPT-MIXED-CONSTRAINTS-UX-0`

Alcance:

- Explicar en UI que Mixto se evalua por look-through.
- Mostrar mejor target/achieved volatility si ya llega del backend.

Opcion C:

- `BDB-OPT-MIXED-CONSTRAINTS-FALLBACK-2`

Alcance:

- Evaluar cambiar el fallback 50/50 a una politica prudente 25/50/25 o bloqueo/review para perfiles concretos.
- Requiere aprobacion explicita porque cambia comportamiento cuantitativo.

## 11. Decision

Estado: `BDB_OPTIMIZER_MIXED_CONSTRAINTS_FIX_1_READY_FOR_REVIEW`

El fallback legacy Mixto 50/50 deja de ser silencioso. Queda trazado con warning explicito, sin cambiar solver, perfiles ni politica Mixto.
