# BDB_OPTIMIZER_MIXED_CONSTRAINTS_TESTS

Fecha: 2026-05-08

Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`

Estado: `BDB_OPTIMIZER_MIXED_CONSTRAINTS_TESTS_READY_FOR_REVIEW`

## 1. Resumen Ejecutivo

Este bloque crea tests de contrato para blindar el tratamiento canonico de fondos Mixtos y constraints del optimizador.

No se implementan fixes de runtime. Los tests documentan el comportamiento actual y el contrato objetivo:

- Mixto es categoria comercial/reporting.
- Mixto no es hard constraint principal del solver.
- El solver usa exposure real/look-through.
- `bucket_bounds_v1.Mixto` o equivalentes no crean restricciones.
- `current_risk_buckets.Mixto` no debe duplicar constraints ni generar infeasibilidad.
- El fallback legacy 50/50 para Mixtos sin exposure queda identificado como riesgo pendiente.
- Status fallback y campos target/achieved volatility quedan cubiertos con mocks offline.

No hubo deploy, push, commit, Firestore writes, Gemini real, parser contra PDFs ni acceso a `BDB-FONDOS-CORE`.

## 2. Estado Base Git

HEAD base: `89f893f OPTIMIZER_PLAN: document mixed constraints fix strategy`

Rama: `master`

`HEAD = origin/master = 89f893f` al iniciar el bloque.

Working tree inicial:

- Sin staged.
- Sin modified tracked.
- Solo untracked locales conocidos fuera de scope.

## 3. Tests Creados/Modificados

Modificados:

- `functions_python/tests/test_bucket_constraints_dedup.py`

Creados:

- `functions_python/tests/test_mixed_funds_lookthrough_contract.py`
- `functions_python/tests/test_optimizer_fallback_status_contract.py`

No se crearon tests frontend nuevos porque ya existen suites relevantes y pasaron:

- `frontend/src/__tests__/mixedFunds.test.ts`
- `frontend/src/__tests__/optimizerP0Contract.test.ts`

## 4. Que Comportamiento Queda Blindado

Queda blindado:

- `_build_profile_bucket_vectors()` no expone key `"Mixto"`.
- `current_risk_buckets` con `"Mixto"` no crea constraints adicionales en `_apply_standard_constraints()`.
- `bucket_bounds_v1` con keys `"Mixto"` o `"mixed"` no crea vector solver.
- `_reconcile_bucket_vs_profile()` ajusta buckets reales y deja `"Mixto"` sin reconciliar.
- Perfiles 3, 4 y 5 no son infeasibles por minimos de Mixto porque el solver solo usa buckets economicos reales.
- `_validate_optimizer_result()` no reporta false violations para `"Mixto"`.
- Un fondo MIXED 50/50 contribuye a `RV` y `RF`, no a un bucket solver `"Mixto"`.
- `classification_v2.asset_type = MIXED` no sobreescribe `portfolio_exposure_v2.asset_mix`.
- Si hay asset mix valido, un Mixto no cae a `Otros`.
- El fallback legacy `label=Mixto` sin exposure conserva el 50/50 actual y queda documentado como pendiente.
- Un resultado fallback no se reporta como `optimal_compliant`.
- Si existe `target_vol`, se exponen `target_vol`, `achieved_vol` y `vol_deviation`.

## 5. Riesgos Pendientes

Pendientes no corregidos en este bloque:

- El fallback legacy 50/50 para Mixtos sin exposure sigue existiendo.
- La UI puede mostrar Mixto como bucket comercial mientras backend evalua look-through.
- No se anadio comentario inline en runtime sobre el gap Mixto; eso queda para un bloque de contract/docs si se desea.
- No se modifico Firestore ni `RISK_BUCKETS_LABELS`.
- No se cambio el comportamiento de solver ni suitability.

## 6. Tests Backend

Tests nuevos o ampliados:

- `test_mixto_bucket_bounds_are_ignored_as_solver_vector`
- `test_mixto_not_injected_even_when_profile_defines_bounds`
- `test_reconcile_skips_mixto_without_affecting_real_buckets`
- `test_profile_3_5_not_infeasible_due_to_mixto_minimums`
- `test_validator_skips_mixto_profile_bound_gracefully`
- `test_mixed_fund_asset_mix_50_50_contributes_to_equity_and_bond`
- `test_commercial_classification_does_not_override_solver_exposure`
- `test_mixed_fund_does_not_fall_to_otros_when_asset_mix_exists`
- `test_mixed_without_asset_mix_uses_documented_legacy_50_50_fallback`
- `test_fallback_status_is_not_reported_as_plain_optimal`
- `test_target_achieved_volatility_fields_are_present_when_available`

Todos son offline:

- Sin Firebase real.
- Sin Firestore real.
- Sin endpoints reales.
- Sin datos de produccion.

Nota de entorno:

- El Python global no tiene `pypfopt`.
- Los tests backend se ejecutaron con `functions_python/venv/Scripts/python.exe`.
- `test_optimizer_p0_contracts.py` requiere `PYTHONPATH=functions_python` si se lanza desde la raiz del repo.

## 7. Tests Frontend

No se modifico frontend.

Se ejecutaron suites existentes:

- `mixedFunds.test.ts`
  - Valida Mixto como categoria comercial/UI.
  - Valida look-through frontend para MIXED/ALLOCATION.
  - Valida que Mixtos sin exposure permanecen como Mixto y no se promueven silenciosamente.

- `optimizerP0Contract.test.ts`
  - Valida gating de `fallback_non_compliant`.
  - Valida que solo statuses aplicables abren el flujo de aplicar cartera.

## 8. Tests Omitidos Y Motivo

No se crearon tests frontend nuevos porque la cobertura existente ya valida el contrato comercial/UX relevante sin tocar runtime.

No se ejecuto full suite backend/frontend porque existen fallos legacy conocidos fuera de este bloque y el objetivo era crear contract tests focalizados.

No se ejecutaron optimizaciones contra produccion, endpoints reales, Firebase real ni Firestore real.

## 9. Resultados De Ejecucion

Backend:

- `functions_python/tests/test_bucket_constraints_dedup.py`: `14 passed`
- `functions_python/tests/test_mixed_funds_lookthrough_contract.py`: `4 passed`
- `functions_python/tests/test_optimizer_fallback_status_contract.py`: `2 passed`
- `functions_python/tests/test_suitability_v2.py`: `47 passed`
- `functions_python/tests/test_optimizer_p0_contracts.py`: `4 passed`

Frontend:

- `frontend/src/__tests__/mixedFunds.test.ts`: `19 passed`
- `frontend/src/__tests__/optimizerP0Contract.test.ts`: `2 passed`

Total focal ejecutado:

- Backend: `71 passed`
- Frontend: `21 passed`

## 10. Que NO Se Hizo

- No fixes de logica.
- No deploy.
- No push.
- No commit.
- No Firestore writes.
- No Gemini real.
- No parser contra PDFs.
- No `BDB-FONDOS-CORE`.
- No credenciales.
- No `.env`.
- No artifacts/raw/work dirs.
- No endpoints reales.
- No Firebase real.
- No Firestore rules.

## 11. Proximo Bloque Recomendado

Opcion recomendada:

- `BDB-OPT-MIXED-CONSTRAINTS-FIX-1`

Alcance sugerido:

- Documentar inline que Mixto no es vector solver.
- Mantener Mixto como reporting/comercial.
- Revisar si fallback 50/50 debe convertirse en warning/review o fallback prudente.
- No tocar UI salvo texto explicativo si se decide.

Alternativa:

- `BDB-OPT-MIXED-CONSTRAINTS-UX-0`

Alcance sugerido:

- Explicar en UI que Mixto se evalua por look-through.
- Mostrar target/achieved volatility de forma clara si ya llega del backend.

## 12. Decision

Estado: `BDB_OPTIMIZER_MIXED_CONSTRAINTS_TESTS_READY_FOR_REVIEW`

Los tests de contrato quedan listos para revision. El siguiente paso natural es commit limpio de tests/docs o pasar a un bloque de fix minimo y documentado.
