# BDB-OPT-3 P0 Runtime Hardening Patch

## Objetivo

Implementar solo los fixes P0 necesarios para convertir los contratos expected-failing de BDB-OPT-2 en tests normales passing.

## Fixes Aplicados

### 1. fallback_non_compliant

Archivo: `functions_python/services/portfolio/optimizer_core.py`

Se anadio un validador final puro que revisa:

- pesos finitos
- pesos no negativos
- suma de pesos igual a 1
- presencia de pesos para todos los `used_assets`
- cumplimiento de `bucket_bounds_v1` o perfil activo

Si un fallback incumple constraints finales, el resultado devuelve:

- `status = fallback_non_compliant`
- `applicable = false`
- `usable = false`
- `constraint_violations`
- `violations`

Los fallbacks compliant devuelven `fallback_compliant`.

### 2. Missing Exposure Guard

Archivo: `functions_python/services/portfolio/suitability_engine.py`

Para perfiles 1-4, un fondo con `classification_v2` pero sin `portfolio_exposure_v2` usable queda bloqueado con razon explicita. Ya no se interpreta la ausencia como 0% equity.

Para perfiles superiores se deja warning en la ruta de suitability, evitando que el caso sea silencioso en P0.

### 3. Negative Weights Guard

Archivos:

- `functions_python/services/portfolio/utils.py`
- `functions_python/services/portfolio/optimizer_core.py`

`_normalize` ya no preserva pesos negativos ni no finitos. Los convierte a cero antes de calcular el denominador.

El post-processing del solver rechaza pesos significativamente negativos o no finitos antes de normalizar.

### 4. used_assets Completeness

Archivo: `functions_python/services/portfolio/optimizer_core.py`

`weights` de salida ahora incluye todos los `used_assets`, ademas de los assets solicitados originalmente. Esto evita perder pesos de fondos auto-anadidos.

### 5. Frontend Fallback Gating

Archivos:

- `frontend/src/hooks/usePortfolioActions.ts`
- `frontend/src/types/index.ts`

Se anadio `isOptimizerResultApplicable`.

Solo son aplicables:

- `optimal_compliant`
- `optimal_with_warnings`
- `fallback_compliant`

Si llega `fallback_non_compliant` o `usable/applicable=false`, el frontend guarda explainability, muestra error y retorna antes de `setProposedPortfolio`.

## Tests

Backend P0/relevante:

```powershell
cd functions_python
$env:PYTHONDONTWRITEBYTECODE='1'
.\venv\Scripts\python.exe -m pytest tests\test_optimizer_p0_contracts.py tests\test_optimizer_core.py tests\test_suitability_v2.py -q -p no:cacheprovider
```

Resultado: `53 passed`.

Backend extendido relevante:

```powershell
.\venv\Scripts\python.exe -m pytest tests\test_optimizer_p0_contracts.py tests\test_optimizer_core.py tests\test_feasibility_precheck.py tests\test_suitability_v2.py tests\test_quant_core.py tests\test_optimizer_invariants.py -q -p no:cacheprovider
```

Resultado: `84 passed`.

Frontend P0:

```powershell
cd frontend
npm test -- optimizerP0Contract --run
```

Resultado: `1 file passed, 2 tests passed`.

## Full Repo Test Note

Se ejecuto tambien la suite completa pedida.

Backend full:

- `122 passed`
- `24 failed`
- `1 error`

Los fallos estan fuera del contrato P0 OPT-3: scripts e2e recolectados por pytest, xray backend app, FinancialEngine legacy, y expectativas historicas de analyzer/frontier/backtester.

Frontend full:

- `99 passed`
- `6 failed`

Los fallos estan fuera del gating P0: analytics scale, v2Helpers formatting y rulesEngine fixtures sin `classification_v2.asset_type`.

## Riesgos y Compatibilidad

El cambio introduce estados finales mas estrictos para el optimizador. Consumidores que esperen solo `optimal` o `fallback` deben migrar a:

- `optimal_compliant`
- `optimal_with_warnings`
- `fallback_compliant`
- `fallback_non_compliant`

El frontend principal ya queda protegido para no aplicar resultados no compliant.

## Confirmacion Operativa

- No Firestore write ejecutado.
- No rollback.
- No deploy.
- No Firebase CLI deploy.
- No CORE.
- No `funds_core_v1`.
- No parser PDF.
- No refactor grande.
