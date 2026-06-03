# BDB-FONDOS - seguimientos post auditoria

**Fecha:** 2026-06-03  
**Estado:** auditoria critica cerrada; quedan solo seguimientos de mantenimiento.

Este documento separa lo que ya quedo cerrado durante la auditoria de lo que conviene vigilar en adelante. Nada de lo siguiente reabre el lote critico salvo que aparezca una incidencia real en produccion.

## Cerrado

| Area | Estado | Evidencia |
| --- | --- | --- |
| Suite backend completa | Cerrado | `496 passed, 2 skipped, 8 xfailed, 32 xpassed` en local; CI verde en `0e847d7`. |
| `compatible_profiles` poblado | Cerrado | Write gate de 3 fondos FI emergentes; auditoria posterior con drift `0`. |
| Fondos `Otros` en perfiles conservadores | Cerrado para el estado actual | Revision `0`; commodities/keywords aptos P1-P2 `0`. |
| `risk_profiles` canonico | Cerrado | `risk_profiles` y `risk_profiles_staging` identicos; `Mixto` ausente en ambos. |
| Documentos de handoff junio | Cerrado en esta limpieza | Planes, PR handoff y specs intermedias archivados bajo `docs/audits/logic_2026_06_archive/`. |

## Pendientes no bloqueantes

### 1. Credito FI cuantitativo

**Objetivo:** decidir si se poblan campos cuantitativos de credito FI, especialmente `portfolio_exposure_v2.fi_credit.low_quality`, cobertura, escala y warnings FE-9.

**Por que queda:** la suite marca varios contratos futuros como `xfail`/`xpass`. No son regresiones de la auditoria; son una linea de mejora de datos.

**Criterio de cierre:** dry-run con impacto, decision de negocio sobre warning/bloqueo y, si hay escritura, gate con rollback.

### 2. Revision periodica de `Otros`

**Objetivo:** evitar que la relajacion de `Otros` se convierta con el tiempo en una via permisiva para perfiles conservadores.

**Cuando repetir:** antes de relajar perfiles, despues de cargas masivas de fondos, o si aparece un fondo `Otros` dudoso en perfiles 1-2.

**Criterio de cierre recurrente:** revision `0`, commodities P1-P2 `0`, drift poblado `0`.

### 3. Shadow/live antes de cambios grandes

**Objetivo:** usar el comparador como gate antes de tocar perfiles, constraints u overrides.

**Cuando ejecutarlo:** cambios en `risk_profiles`, cambios de buckets, cambios relevantes en suitability o nuevos REMs.

**Criterio de cierre:** manifest shadow sin FAIL bloqueante, o decision explicita documentada.

### 4. Pulido UX visual

**Objetivo:** mejorar forma, copy y jerarquia visual de los flujos de recuperacion del optimizador.

**Alcance:** solo frontend/experiencia; no mezclar con cambios de motor o datos.

## Orden recomendado

1. Dejar unos dias de uso real estable.
2. Hacer el pulido UX si el usuario lo prioriza.
3. Abrir credito FI cuantitativo como bloque independiente.
4. Mantener auditoria `Otros` y shadow/live como controles antes de futuros cambios.
