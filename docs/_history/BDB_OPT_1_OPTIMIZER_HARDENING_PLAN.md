# BDB-OPT-1 Optimizer Hardening Plan

Generated UTC: 2026-05-07T05:19:31.0011643Z

## Objetivo

Disenar el plan de hardening del optimizador despues de BDB-OPT-0, sin modificar runtime todavia. Este bloque es documental y de arquitectura: no hay Firestore write, rollback, deploy, CORE, `funds_core_v1`, parser PDF ni cambios funcionales.

## Inputs

- `artifacts/bdb_optimizer_audit/bdb_opt_0_summary.json`
- `artifacts/bdb_optimizer_audit/bdb_opt_0_findings.csv`
- `artifacts/bdb_optimizer_audit/bdb_opt_0_high_risk_findings.csv`
- `artifacts/bdb_optimizer_audit/bdb_opt_0_constraint_engine_review.json`
- `artifacts/bdb_optimizer_audit/bdb_opt_0_runtime_safety_review.json`

OPT-0 cerro con 14 findings:

- HIGH: 5
- MEDIUM: 7
- LOW: 2

## P0 Fixes

Total P0 fixes: 4.

1. `P0-01`: final validator post-solver/post-fallback.
2. `P0-02`: safe finite non-negative weight normalization.
3. `P0-03`: suitability guard para missing exposure.
4. `P0-04`: frontend gating para `fallback_non_compliant` y pesos display.

P0 bloquea corrupcion inmediata: carteras fallback no conformes, pesos negativos/no finitos, used_assets sin peso, suitability con exposure ausente y aplicacion frontend de resultados no aplicables.

## Invariantes Finales

Backend `result.weights`:

- escala decimal,
- suma `1.0 +/- 1e-6`,
- no negativos,
- no NaN/Infinity,
- cada `used_asset` tiene peso numerico explicito,
- ningun peso positivo fuera de `used_assets` sin marca explicita,
- constraints recalculadas despues de solver y fallback.

Frontend:

- escala porcentaje,
- suma `100.0` dentro de tolerancia de display,
- rounding/filtering no puede ocultar capital sin residual,
- `fallback_non_compliant` no puede abrir flujo de aplicar cartera.

Suitability:

- missing exposure no se interpreta como `0% equity` sin flag,
- perfiles 1-4 deben bloquear o mandar a review si falta exposure usable.

## Estados Finales

- `optimal_compliant`: solver OK y postcheck completo OK.
- `optimal_with_warnings`: solver OK, hard checks OK, warnings no criticos.
- `fallback_compliant`: fallback usado, pero hard checks OK y razon explicita.
- `fallback_non_compliant`: fallback usado y algun hard check falla. No aplicable.
- `infeasible_constraints`: constraints matematicamente imposibles.
- `infeasible_data`: datos/historia/exposure/mu/S insuficientes.
- `error`: excepcion o contrato invalido.

## Risk Matrix

La matriz completa esta en:

`artifacts/bdb_optimizer_audit/bdb_opt_1_risk_matrix.csv`

Cobertura HIGH:

- `OPT0-HIGH-001` -> P0 validator + frontend gating.
- `OPT0-HIGH-002` -> P1 vol_band compliance.
- `OPT0-HIGH-003` -> P1 max-attainable precheck.
- `OPT0-HIGH-004` -> P0 missing exposure guard.
- `OPT0-HIGH-005` -> P0 safe weight normalization + final validator.

## Test Plan

El test plan completo esta en:

`artifacts/bdb_optimizer_audit/bdb_opt_1_test_plan.csv`

Tests obligatorios:

- Fallback que incumple constraints debe salir `fallback_non_compliant`.
- Missing V2 exposure debe ser REVIEW/BLOCKED, no `0% equity`.
- Negative upstream weights deben bloquearse.
- Todos los `used_assets` deben aparecer en `weights`.
- Max-attainable precheck detecta infeasible antes de solver.
- Frontend no debe aplicar `fallback_non_compliant`.

## Rollout Order

P0:

1. `P0-01` final validator.
2. `P0-02` safe weight normalization.
3. `P0-03` missing exposure guard.
4. `P0-04` frontend fallback gating.

P1:

5. `P1-01` vol_band hard constraint o warning explicito.
6. `P1-02` max-attainable precheck.
7. `P1-03` relaxed constraints visibles y source diagnostics.

P2:

8. `P2-01` trazabilidad tactica y recomendaciones.
9. `P2-02` run_id/input hash/source stamps.
10. `P2-03` no-write/no-network audit mode.

## Reglas de Rollout

- Primero tests P0, despues patch P0.
- P0 no debe cambiar objetivo matematico salvo para rechazar o etiquetar resultados invalidos.
- P1 puede cambiar estados de compliance, por eso requiere comparativa sintetica antes/despues.
- P2 no deberia cambiar pesos; es trazabilidad, disclosure y reproducibilidad.

## Validacion

- No runtime modified.
- No Firestore write.
- No rollback.
- No deploy.
- No Firebase CLI deploy.
- No CORE.
- No `funds_core_v1`.
- No parser PDF.
- All HIGH findings mapped to tests and patches.

## Siguiente Bloque

Recomendado: `BDB-OPT-2`, tests-only para P0. El siguiente paso seguro es escribir pruebas que congelen el contrato de seguridad antes de tocar comportamiento productivo.
