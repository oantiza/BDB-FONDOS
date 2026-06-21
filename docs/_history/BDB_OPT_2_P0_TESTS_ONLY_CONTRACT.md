# BDB-OPT-2 P0 Tests-Only Contract

## Objetivo

Crear tests P0 que documenten el contrato objetivo del optimizador antes de modificar runtime productivo.

Este bloque es deliberadamente tests-only. Los tests nuevos pueden quedar como expected-failing cuando el comportamiento objetivo todavia no existe, pero no deben romper la suite completa.

## Alcance

Inputs leidos:

- `artifacts/bdb_optimizer_audit/bdb_opt_1_test_plan.csv`
- `artifacts/bdb_optimizer_audit/bdb_opt_1_patch_plan.json`

Archivos de test creados:

- `functions_python/tests/test_optimizer_p0_contracts.py`
- `frontend/src/__tests__/optimizerP0Contract.test.ts`

No se modifico ningun archivo runtime productivo.

## Tests Backend P0

### OPT1-T001 fallback_non_compliant

Contrato: si un fallback produce pesos que incumplen constraints hard, no puede considerarse aplicable.

Estado actual: `pytest.mark.xfail(strict=True)`.

Motivo: el runtime actual devuelve `fallback` generico sin final validator que recalifique a `fallback_non_compliant`.

### OPT1-T003 missing exposure guard

Contrato: un fondo sin `portfolio_exposure_v2` no debe tratarse silenciosamente como 0% equity.

Estado actual: `pytest.mark.xfail(strict=True)`.

Motivo: `is_fund_eligible_for_profile` puede aceptar un fondo de RF low-risk sin exposure V2 porque `real_eq` cae a 0.

### OPT1-T004 negative weights guard

Contrato: pesos negativos upstream deben rechazarse o bloquearse; nunca deben sobrevivir a normalizacion.

Estado actual: `pytest.mark.xfail(strict=True)`.

Motivo: `_normalize` calcula el denominador con `max(0, v)`, pero conserva el numerador original negativo.

### OPT1-T009 used_assets weights completeness

Contrato: todo `used_asset` con peso positivo debe estar representado en `weights`, incluyendo fondos auto-anadidos.

Estado actual: `pytest.mark.xfail(strict=True)`.

Motivo: `weights_full` se construye sobre assets solicitados, no necesariamente sobre todos los `used_assets`.

## Tests Frontend P0

### OPT1-T006A status table

Contrato: solo `optimal_compliant`, `optimal_with_warnings` y `fallback_compliant` pueden abrir flujo de aplicacion.

Estado actual: passing.

### OPT1-T006B runtime hook gating

Contrato: `fallback_non_compliant` debe bloquearse antes de `setProposedPortfolio` y antes de abrir review.

Estado actual: `test.fails`.

Motivo: `usePortfolioActions` todavia acepta los estados legacy `optimal`/`fallback` y no contiene gating explicito de `fallback_non_compliant`.

## Ejecucion

Backend:

```powershell
cd functions_python
$env:PYTHONDONTWRITEBYTECODE='1'
.\venv\Scripts\python.exe -m pytest tests\test_optimizer_p0_contracts.py tests\test_optimizer_core.py tests\test_suitability_v2.py -q -p no:cacheprovider
```

Resultado: `49 passed, 4 xfailed`.

Frontend:

```powershell
cd frontend
npm test -- --run src/__tests__/optimizerP0Contract.test.ts
```

Resultado: `1 file passed, 2 tests passed`, incluyendo un `test.fails` que representa contrato pendiente.

## Pendiente Para OPT-3

OPT-3 debe implementar el runtime P0 contra estos contratos:

- final validator post-solver/post-fallback
- estados `fallback_compliant` / `fallback_non_compliant`
- rechazo de pesos negativos/no finitos
- guard de missing V2 exposure
- completeness de `used_assets` en `weights`
- gating frontend para bloquear `fallback_non_compliant`

Cuando OPT-3 implemente el comportamiento, los `xfail(strict=True)` y `test.fails` deben convertirse en tests normales.

## Confirmacion No-Write

- No Firestore write.
- No rollback.
- No deploy.
- No Firebase CLI deploy.
- No CORE.
- No `funds_core_v1`.
- No parser PDF.
- No cambios runtime productivos.
