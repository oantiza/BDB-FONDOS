# BDB - FIX H1: locks por encima de max_weight (auditoria 2026-06-09)

**Fecha:** 2026-06-09
**Origen:** AUDITORIA_BDB-FONDOS_LOGICA_2026-06-09.pdf, hallazgo H1 (ALTA).
**Estado:** aplicado en working tree; pendiente de commit/PR, shadow/live y deploy.

## Problema

Caso cotidiano: bloquear una posicion del 25-30% (el frontend no envia
max_weight, rige MAX_WEIGHT_DEFAULT=0.20) y optimizar.

- El precheck modelaba los locks como excepcion del bound por activo y devolvia
  factible.
- El solver construia EfficientFrontier con weight_bounds=(min, 0.20) y anadia
  w[i]==0.30: contradiccion dura -> OptimizationError (reproducido en la
  auditoria).
- Los DOS fallbacks re-aplicaban la misma contradiccion y fallaban tambien.
- Resultado: degradacion silenciosa a equal-weight (fallback_equal_weight),
  presentada como "propuesta alternativa" sin explicar la causa real.

Tres capas con tres semanticas distintas para el mismo caso (precheck: lock pisa
el bound; solver: contradiccion; validacion final: no lo mira).

## Cambio (solo optimizer_core.py)

Nuevo helper `_resolve_weight_bounds(universe, min_weight, max_weight,
lock_mode, locked_assets, fixed_weights)`: para los ISIN bloqueados con peso
fijado (modos keep_weight/keep_money/min_keep) el techo por activo pasa a
`max(max_weight, fw)` y el suelo a `min(min_weight, fw)`, de modo que la
igualdad/el minimo del lock son siempre interiores a las cotas. pypfopt acepta
weight_bounds por activo (lista de tuplas). Si no hay ajuste alguno se devuelve
la tupla escalar original: comportamiento bit a bit identico sin locks o con
locks dentro de max_weight.

Aplicado en las 4 instanciaciones del solver: EF principal (FASE 8), EF tras
auto-expand (FASE 7) y los dos fallbacks de _run_solver (relaxed sharpe y
min vol). La semantica queda unificada con la del precheck
(_maximum_achievable_exposure), que ya trataba los locks asi.

## Decision documentada: validacion final per-asset NO anadida

El informe sugeria opcionalmente un check per-asset en
`_validate_optimizer_result`. Se descarta en este lote: la renormalizacion
posterior al cutoff puede elevar legitimamente pesos unos puntos basicos por
encima de max_weight (p.ej. eliminar 2% de polvo escala un 20% a ~20.4%), y un
check duro generaria falsos non_compliant en resultados hoy validos. La causa
raiz (degradacion silenciosa) desaparece con las cotas por activo.

## Cambio de comportamiento a vigilar

Carteras con posiciones bloqueadas > max_weight que antes degradaban a
equal-weight ahora se resuelven de forma OPTIMA (status optimal_*). Es una
mejora, pero los pesos propuestos cambiaran respecto a ejecuciones anteriores
del mismo caso: pasar el gate shadow/live antes del deploy.

## Evidencia

`tests/test_optimizer_locks_above_max_weight.py` (9 tests): unidad del helper
(escalar sin ajustes, techo elevado, modo free, suelo para fw<min_weight) y
end-to-end con run_optimization real (pypfopt/cvxpy): lock 30% con max 20%
resuelve optimal_compliant sin fallback, con y sin perfil (bandas del perfil 5
respetadas), min_keep 25% idem, y lock 15% conserva el contrato previo.
Suite de motor completa: 349 passed (28 ficheros de tests, incluye H1-H4).
