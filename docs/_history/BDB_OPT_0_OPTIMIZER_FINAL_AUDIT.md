# BDB-OPT-0 Optimizer Final Audit

Generated UTC: 2026-05-07T05:12:29.5457345Z

## Objetivo

Auditar el pipeline real del optimizador en modo read-only, despues de SEM-0..4. El foco ya no es corregir `asset_mix`, sino revisar pesos, fallbacks, constraints, tactical layer, suitability, recomendaciones, seguridad numerica y auditabilidad.

## Confirmacion Read-Only

- No Firestore write ejecutado.
- No rollback.
- No deploy.
- No Firebase CLI deploy.
- No CORE.
- No `funds_core_v1`.
- No parser PDF.
- No modificacion de codigo runtime.
- No cambios funcionales.

Solo se crearon artifacts/docs locales de auditoria.

## Metodologia

Se leyo el runtime backend y frontend relacionado con:

- `optimizer_core.py`
- `utils.py`
- `constraints_builder_v1.py`
- `feasibility_precheck.py`
- `suitability_engine.py`
- `quant_core.py`
- `data_fetcher.py`
- `endpoints_portfolio.py`
- `usePortfolioActions.ts`
- `usePortfolioStats.ts`
- `rulesEngine.ts`
- `fundSwapper.ts`
- `directSearch.ts`

Validacion ejecutada:

```powershell
cd C:\Users\oanti\Documents\BDB-FONDOS\functions_python
$env:PYTHONDONTWRITEBYTECODE='1'
.\venv\Scripts\python.exe -m pytest tests\test_optimizer_core.py tests\test_feasibility_precheck.py tests\test_suitability_v2.py tests\test_quant_core.py -q -p no:cacheprovider
```

Resultado: `72 passed`.

## Resumen

Total findings: 14.

- HIGH: 5.
- MEDIUM: 7.
- LOW: 2.

El optimizador tiene buenas bases numericas: Ledoit-Wolf, PSD fix, prechecks deterministicos, ffill limitado, circuito de spikes y tests sinteticos. El riesgo principal esta en la degradacion operativa: cuando el solver falla o una capa hace fallback, varias decisiones quedan en logs/explainability parcial, pero no siempre en `warnings` accionables ni en un modo estricto que bloquee carteras degradadas.

## HIGH Findings

1. `OPT0-HIGH-001`: fallback del solver puede devolver una cartera aplicable perdiendo constraints superiores.

Evidencia: `optimizer_core.py:811-886`, `optimizer_core.py:1175-1220`, `usePortfolioActions.ts:623-646`.

Impacto: puede producir una cartera propuesta que ya no respeta constraints geo/group/tactical/objective, aunque el frontend la deje aplicar como `fallback`.

2. `OPT0-HIGH-002`: `vol_band`/risk budget se modela pero no se aplica como hard constraint.

Evidencia: `constraints_builder_v1.py:158-175`, `optimizer_core.py:739-745`, `optimizer_core.py:1179-1193`.

Impacto: perfiles con banda de volatilidad pueden parecer capados aunque solo se reporte desviacion target/achieved.

3. `OPT0-HIGH-003`: precheck no calcula exposicion maxima alcanzable por bucket bajo `max_weight` y locks.

Evidencia: `feasibility_precheck.py:146-175`.

Impacto: restricciones imposibles pueden llegar al solver y terminar en fallback.

4. `OPT0-HIGH-004`: exposicion V2 ausente puede entrar como `real_eq=0` en suitability.

Evidencia: `suitability_engine.py:15-19`, `suitability_engine.py:27-39`.

Impacto: un fondo con exposicion incompleta puede pasar perfiles conservadores si los flags no compensan.

5. `OPT0-HIGH-005`: `_normalize` puede preservar pesos negativos si aparecen aguas arriba.

Evidencia: `utils.py:27-31`, `optimizer_core.py:821-824`.

Impacto: un peso negativo tiny o invalido podria salir en `weights` si falla la garantia long-only.

## Fallback Map

El mapa completo esta en:

`artifacts/bdb_optimizer_audit/bdb_opt_0_fallback_map.json`

Resumen:

- `asset_mix`: V2 primero, luego `v2_exposure/economic_exposure`, luego `metrics`, luego `classification_v2`, luego legacy label.
- Grupos: V2 primero, luego identidad, `derived`, `ms` y legacy maps.
- Solver: objetivo principal, `fallback_relaxed_sharpe`, `fallback_min_vol`, `fallback_equal_weight`.
- Frontend: acepta `optimal` y `fallback` como propuesta aplicable.
- Recomendaciones: strict match, relaxed match, asset-class-only, universal fallback y ranking comercial/retrocession.

## Constraint Engine

El precheck actual bloquea:

- universo vacio,
- universo demasiado pequeno para `max_weight`,
- fixed weights > 100%,
- minimos por bucket > 100%,
- maximos por bucket < 100%,
- buckets no representables cuando exposicion maxima es cero.

Huecos principales:

- No calcula maximo alcanzable real por bucket.
- No aplica `vol_band`.
- `strict_feasibility` existe en contrato pero no cambia la degradacion.
- Geo/group constraint failures se loguean y se saltan.
- Fallback postprocess puede perder constraints superiores.

## Runtime Safety

Controles encontrados:

- limpieza de historia con `ffill(limit=5)` y `dropna`,
- bloqueo de spikes diarios >40%,
- despiking >15%,
- Ledoit-Wolf + sample covariance fallback + PSD fix + simetria,
- metricas con varianza floor a cero,
- tests sinteticos pasados.

Issues:

- falta assertion final de pesos finitos/no negativos/suma 1,
- faltan checks explicitos `np.isfinite(mu/S)`,
- RF rate tiene red/cache/Firestore side effect,
- helper frontend de volatilidad no clampa varianza negativa,
- helper sintetico podria no ser determinista si se reusa sin seed.

## Recomendacion

No ejecutar write ni cambios funcionales en este bloque.

Siguiente bloque recomendado: `BDB-OPT-1`, tambien no-write, para preparar hardening plan y tests antes de tocar runtime:

- invariant final de pesos,
- warning propagation para fallbacks,
- strict feasibility semantics,
- max-attainable precheck,
- tactical applied/dropped diagnostics,
- no-write/dry-run mode para RF cache/snapshots.
