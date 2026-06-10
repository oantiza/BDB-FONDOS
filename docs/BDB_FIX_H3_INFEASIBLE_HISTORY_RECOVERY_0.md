# BDB - FIX H3: ruta de recuperacion INFEASIBLE_HISTORY (auditoria 2026-06-09)

**Fecha:** 2026-06-09
**Origen:** AUDITORIA_BDB-FONDOS_LOGICA_2026-06-09.pdf, hallazgo H3 (ALTA).
**Estado:** aplicado en working tree; pendiente de commit/PR y deploy controlado.

## Problema

`_build_candidate_universe` lanzaba `ValueError("INFEASIBLE_HISTORY:<isins>")` para
activar la recuperacion con candidatos, pero el catch-all de `run_optimization`
la convertia en `{"status": "error", "message": "INFEASIBLE_HISTORY:..."}`:

- El branch del endpoint que parseaba el prefijo y construia `recovery_candidates`
  (endpoints_portfolio.py) era inalcanzable (la excepcion nunca llegaba).
- El frontend caia en el `else` generico y mostraba el toast crudo
  `Error en la optimizacion: INFEASIBLE_HISTORY:LU03...`.
- El branch FE `result.status === 'fallback_no_history'` referenciaba un status
  que el backend no emite en ningun punto (segundo tramo muerto).

## Cambio

1. **optimizer_core.py (FASE 3):** la `ValueError` con prefijo `INFEASIBLE_HISTORY:`
   se captura en el punto de llamada y se devuelve un resultado estructurado:
   `status: "infeasible"`, `solver_path: "blocked_insufficient_history"`,
   `recovery_candidates: [...]`, mensaje apto para usuario, `weights/metrics` vacios,
   `applicable/usable: false`, warning `insufficient_history` y explainability con
   `history_blocked: true`. Otras `ValueError` siguen cayendo al catch-all como antes.
2. **endpoints_portfolio.py:** eliminado el branch muerto que parseaba el prefijo.
3. **usePortfolioActions.ts:** eliminado el branch muerto `fallback_no_history`.
   El caso lo gestiona el branch existente de `status === 'infeasible'`
   (dialogo "Universo insuficiente para optimizar" + reintento con
   `auto_expand_universe: true`), que ya lee `result.recovery_candidates`.

## Contrato resultante

Historial insuficiente (sin auto_expand) -> `run_optimization` devuelve:

    status: "infeasible"
    solver_path: "blocked_insufficient_history"
    recovery_candidates: [<=5 ISINs (candidate_funds o FALLBACK_CANDIDATES_DEFAULT)]
    message: texto de usuario (sin prefijo tecnico)

## Evidencia

- Nuevo `tests/test_optimizer_infeasible_history_contract.py` (6 tests):
  contrato estructurado, candidatos por defecto y provistos, mensaje sin prefijo,
  regresion del catch-all para otras ValueError y check estatico de que el endpoint
  ya no contiene el parser muerto.
- Suite de motor: `288 passed` en local (incluye los 6 nuevos; el resto de la suite
  de endpoints corre en CI por dependencia de firebase_functions).
- Sintaxis FE verificada con typescript.transpileModule (0 diagnosticos).

## Notas operativas

- El status emitido cambia de `error` a `infeasible` para este caso: revisar
  dashboards/telemetria que cuenten status de optimizacion, y pasar el gate
  shadow/live habitual antes del deploy.
- `fallback_no_history` queda retirado del vocabulario de status del FE.
