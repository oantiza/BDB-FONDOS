# BDB-OPT-4 P0 Regression Audit

## Objetivo

Auditar si los cambios de BDB-OPT-3 estan listos para produccion o si requieren acciones adicionales antes de deploy.

Este bloque fue read-only respecto a runtime: no se modifico codigo productivo, no hubo Firestore write y no hubo deploy.

## Que Se Audito

Diffs revisados:

- `functions_python/services/portfolio/optimizer_core.py`
- `functions_python/services/portfolio/suitability_engine.py`
- `functions_python/services/portfolio/utils.py`
- `frontend/src/hooks/usePortfolioActions.ts`
- `frontend/src/types/index.ts`

Artifacts revisados:

- `artifacts/bdb_optimizer_audit/bdb_opt_3_runtime_hardening_summary.json`
- `artifacts/bdb_optimizer_audit/bdb_opt_3_test_results.json`

Tambien se revisaron consumidores frontend/backend de `status` de optimizacion.

## Resultado P0

Los contratos P0 pasan:

- `fallback_non_compliant`: passed
- missing exposure guard: passed
- negative weights guard: passed
- `used_assets` completeness: passed
- frontend fallback gating: passed

Tests relevantes confirmados desde OPT-3:

- Backend P0/relevante: `53 passed`
- Backend optimizer/suitability/quant extendido: `84 passed`
- Frontend P0 contract: `2 passed`

## Scope Review

Los cambios son P0-only:

- No parser.
- No CSV.
- No CORE.
- No `funds_core_v1`.
- No refactor grande.
- No cambio UI amplio; solo gating minimo de resultado optimizer.
- No Firestore write agregado.

## Fallos Full-Suite

La suite completa no esta verde:

- Backend full: `122 passed, 24 failed, 1 error`
- Frontend full: `99 passed, 6 failed`

Clasificacion:

- Related to OPT-3 failures: `0`
- Known legacy/out-of-scope failures: `31`
- Release-level blockers: `2` suites completas rojas, salvo waiver explicita

Categorias principales:

- scripts e2e legacy recolectados por pytest sin fixture
- `FinancialEngine` legacy
- `services.optimizer` legacy patch path
- analyzer/frontier/backtester short-history expectations
- xray/backend app callable wrapper tests
- frontend analytics scale expectation
- frontend v2Helpers formatting expectations
- frontend rulesEngine fixtures sin `classification_v2.asset_type`

La matriz completa esta en:

- `artifacts/bdb_optimizer_audit/bdb_opt_4_regression_matrix.csv`

## Riesgo De Deploy

OPT-3 cambia el contrato de estados desde `optimal/fallback` hacia estados de compliance:

- `optimal_compliant`
- `optimal_with_warnings`
- `fallback_compliant`
- `fallback_non_compliant`

El frontend principal ya esta adaptado, pero esto exige deploy backend/frontend coordinado. Un deploy parcial podria dejar un frontend nuevo hablando con backend viejo, o backend nuevo con consumidores antiguos.

## Decision

`deploy_recommended = false`

Motivo: la implementacion P0 esta limpia en sus contratos, pero no se recomienda deploy productivo mientras:

- las suites completas sigan rojas sin waiver/quarantine formal
- no exista aprobacion explicita de deploy coordinado backend/frontend
- no se haya ejecutado smoke staging/emulator sobre payloads `fallback_compliant` y `fallback_non_compliant`

## Acciones Requeridas Antes De Deploy

1. Resolver, aislar o aprobar waiver formal para los fallos full-suite legacy.
2. Confirmar deploy backend/frontend atomico por el cambio de contrato de estados.
3. Re-ejecutar gates P0 inmediatamente antes de deploy.
4. Ejecutar smoke staging/emulator de `optimize_portfolio_quant` con caso compliant y non-compliant.

## Confirmacion Operativa

- No Firestore write.
- No rollback.
- No deploy.
- No Firebase CLI deploy.
- No CORE.
- No `funds_core_v1`.
- No parser PDF.
- No runtime change en OPT-4.
