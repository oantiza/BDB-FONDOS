# BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_TESTS

Fecha: 2026-05-08

Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`

Estado: `BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_TESTS_READY_FOR_REVIEW`

## 1. Resumen ejecutivo

Este bloque crea tests de contrato para blindar la jerarquia canonica de constraints del optimizador antes de implementar cualquier cleanup.

No se implementa cleanup, no se cambia runtime y no se modifica la logica matematica del optimizador. Los tests documentan el comportamiento actual y fijan el contrato esperado entre estas capas:

- Investment Policy.
- Suitability.
- Solver Constraints.
- Reporting / Explanation.

## 2. Estado base Git

HEAD base: `404e0d1 OPTIMIZER_PLAN: document canonical constraints cleanup`

Rama: `master`

`HEAD = origin/master = 404e0d1` al iniciar el bloque.

Working tree inicial:

- Sin staged.
- Sin modified tracked.
- Solo untracked locales conocidos fuera de scope.

## 3. Objetivo de los tests

El objetivo es crear una red de seguridad antes de limpiar duplicidades de payload y constraints.

Los tests cubren:

- `profile_id` como identificador canonico del perfil, manteniendo `risk_level` como compatibilidad.
- Cascada actual de `optimization_mode`.
- Prioridad de `locked_positions` sobre `constraints.fixed_weights`.
- Compatibilidad legacy de `fixed_weights` cuando no hay `locked_positions`.
- `bucket_bounds_v1` como fuente solver cuando hay bounds activos.
- `current_risk_buckets` como fallback legacy, sin duplicar constraints cuando v1 esta activo.
- Separacion de `classification_v2` y `portfolio_exposure_v2`.
- Preferencia de `asset_mix` frente a `economic_exposure` cuando ambos existen.
- Diagnostics de response: `status`, `solver_path`, `target_vol`, `achieved_vol`, `vol_deviation`, `warnings`.

## 4. Tests backend creados/modificados

Archivo creado:

- `functions_python/tests/test_constraints_canonical_contract.py`

Tests creados:

- `test_profile_id_is_canonical_over_profile_risk_level_when_both_present`
- `test_optimization_mode_priority_is_documented`
- `test_locked_positions_supersede_legacy_fixed_weights_contract`
- `test_legacy_fixed_weights_are_compatibility_fallback_only`
- `test_bucket_bounds_v1_is_solver_constraint_source_and_ignores_mixto_keys`
- `test_current_risk_buckets_is_not_duplicate_solver_constraint_when_v1_active`
- `test_portfolio_exposure_v2_asset_mix_overrides_classification_for_solver`
- `test_classification_v2_remains_reporting_or_suitability_metadata_not_solver_bucket`
- `test_economic_exposure_is_fallback_not_primary_when_asset_mix_exists`

Todos son offline:

- Sin Firebase real.
- Sin Firestore real.
- Sin endpoints reales.
- Sin datos de produccion.

## 5. Tests frontend creados/modificados

Archivo modificado:

- `frontend/src/__tests__/optimizerP0Contract.test.ts`

Tests anadidos:

- `payload preserves profile_id and risk_level compatibility during cleanup period`
- `payload keeps optimization_mode deterministic across root and legacy constraints`
- `payload keeps locked_positions canonical while preserving legacy fixed_weights compatibility`
- `response mapping preserves status, solver path, volatility diagnostics and warnings`
- `frontend optimization metadata remains minimal and does not merge classification with exposure`

Los tests son estaticos de contrato sobre el source local. No ejecutan endpoints ni Firebase real.

## 6. Que comportamiento queda blindado

### profile_id / risk_level

- `profile_id` se usa como valor canonico en `build_constraints_v1`.
- `risk_level` sigue existiendo como compatibilidad de payload.
- El frontend sigue enviando `risk_level` y `profile_id: String(riskLevel)` durante el periodo de cleanup.

### optimization_mode

- El builder documenta la prioridad actual: parametro directo antes de override.
- El frontend mantiene `optimization_mode: 'rebalance_to_profile'` en raiz y en constraints legacy.

### locks / fixed_weights

- `locked_positions` es el canal canonico cuando existe.
- `constraints.fixed_weights` queda cubierto como fallback legacy.
- `lock_mode` legacy se conserva como compatibilidad cuando no hay modo canonico.

### bucket_bounds_v1 / current_risk_buckets

- `bucket_bounds_v1` es fuente solver cuando contiene bounds activos.
- `current_risk_buckets` no duplica constraints cuando v1 esta activo.
- Keys comerciales como `Mixto` o `mixed` no crean vector solver.

### classification_v2 / portfolio_exposure_v2

- `classification_v2` queda como metadata de identity, reporting y suitability.
- `portfolio_exposure_v2.asset_mix` alimenta los vectores economicos del solver.
- Si existen `asset_mix` y `economic_exposure`, `asset_mix` manda.

### volatility diagnostics

- El contrato frontend conserva `target_vol`, `achieved_vol`, `vol_deviation`, `solver_path` y `warnings`.
- La suite backend existente `test_optimizer_fallback_status_contract.py` cubre que los diagnostics aparecen cuando estan disponibles.

### fallback status

- Los tests existentes siguen blindando que un fallback no se muestra como `optimal` plano.
- `fallback_compliant` puede abrir flujo aplicable.
- `fallback_non_compliant` queda bloqueado.

## 7. Que NO se cambio

- No cleanup implementado.
- No runtime fixes.
- No cambios en `optimizer_core.py`.
- No cambios en `constraints_builder_v1.py`.
- No cambios en perfiles/config.
- No cambios frontend productivo.
- No deploy.
- No push.
- No commit.
- No Firestore writes.
- No Gemini real.
- No parser contra PDFs.
- No `BDB-FONDOS-CORE`.
- No `scripts/scratch/`.
- No `.playwright-mcp/`.

## 8. Resultados de tests

Backend:

- `functions_python/tests/test_constraints_canonical_contract.py`: `9 passed`
- `functions_python/tests/test_bucket_constraints_dedup.py`: `14 passed`
- `functions_python/tests/test_mixed_funds_lookthrough_contract.py`: `4 passed`
- `functions_python/tests/test_optimizer_fallback_status_contract.py`: `2 passed`
- `functions_python/tests/test_optimizer_p0_contracts.py`: `4 passed`

Frontend:

- `frontend/src/__tests__/optimizerP0Contract.test.ts`: `8 passed`
- `frontend/src/__tests__/mixedFunds.test.ts`: `19 passed`
- `frontend/src/__tests__/v2Helpers.test.ts`: `32 passed`

Total focal ejecutado:

- Backend: `33 passed`
- Frontend: `59 passed`

## 9. Riesgos pendientes

Pendiente para bloques posteriores:

- El payload sigue duplicando `risk_level/profile_id`.
- El payload sigue duplicando `optimization_mode`.
- `locked_positions` y `constraints.fixed_weights` siguen coexistiendo.
- `current_risk_buckets` sigue existiendo como fallback legacy y puede contener `Mixto` decorativo.
- No se ha limpiado el contrato frontend/backend.
- No se ha simplificado el solver ni el endpoint.
- No se ha tocado feasibility precheck.

Estos riesgos quedan intencionadamente fuera de este bloque porque aqui solo se crean tests de contrato.

## 10. Proximo bloque recomendado

Opcion recomendada:

- `BDB-OPT-CONSTRAINTS-CANONICAL-FIX-1`

Alcance sugerido:

- Documentacion inline de precedencias.
- Cleanup pequeno y compatible de payload si se aprueba.
- Mantener backward compatibility mientras exista frontend desplegado con campos legacy.

Alternativa:

- `BDB-OPT-PAYLOAD-CONTRACT-CLEANUP-0`

Alcance sugerido:

- Normalizar schema frontend/backend.
- Eliminar duplicidades de payload por fases.
- Mantener tests de contrato como red de seguridad.

## 11. Decision

Estado: `BDB_OPTIMIZER_CONSTRAINTS_CANONICAL_TESTS_READY_FOR_REVIEW`

Los tests de contrato quedan listos para revision. El siguiente paso natural es un commit limpio de tests/docs o pasar a un bloque de cleanup minimo y controlado.
