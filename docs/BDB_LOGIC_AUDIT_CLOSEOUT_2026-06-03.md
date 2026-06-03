# BDB-FONDOS - cierre de auditoria logica

**Fecha:** 2026-06-03  
**Repositorio:** `oantiza/BDB-FONDOS`  
**Estado:** cerrado operativamente.

## Resumen ejecutivo

La remediacion principal derivada de la auditoria logica queda integrada, desplegada, probada manualmente en produccion y cerrada tambien en sus pendientes de datos/configuracion.

El sistema ya tiene:

- CI activo para el lote de remediacion.
- Paridad backend/frontend de suitability reforzada.
- Restricciones unificadas detras de contrato canonico.
- `Mixto` retirado del vocabulario de restriccion y conservado solo como lectura/display cuando aplica.
- `UNIFIED_CONSTRAINTS` activado y observado sin errores bloqueantes.
- UX de recuperacion del optimizador estabilizada tras pruebas reales.
- `compatible_profiles` sin deriva poblada frente al motor vivo.
- `risk_profiles` canonico alineado con `risk_profiles_staging`; `Mixto` retirado de ambos.
- Suite backend completa verde en local y CI verde en `master`.

La situacion actual permite considerar cerrada la auditoria critica. Lo que queda son mejoras futuras: calidad de datos FI, revisiones periodicas y pulido UX.

## Estado de integracion

Commits principales en `master`:

| Commit | Contenido |
| --- | --- |
| `5b57423` | Merge PR #1: lote base de remediacion de auditoria. |
| `88f6188` | Cierre de gaps contractuales de restricciones unificadas. |
| `95f4c91` / `2cd41ac` | REM-5B shadow comparator y gate reforzado. |
| `ba3cfc1` | Shadow live read-only. |
| `2490179` | Explainability preservada en `infeasible_equity_floor`. |
| `fbdef7b` | REM-3: retirada de `Mixto` del vocabulario de constraints. |
| `5573d3d` | Hotfix UX frontend para recuperacion del optimizador. |
| `e7fdda7` | Merge PR #5 en `master`. |
| `6542411` | Suitability conservadora endurecida para deuda emergente/frontier/high yield. |
| `806b1ad` | Write gate y cierre de deriva `compatible_profiles` en 3 fondos FI emergentes. |
| `0e847d7` | Suite backend completa alineada con contratos actuales. |
| `62280ef` | Gate de promocion canonico/staging de `risk_profiles` 8-10. |

## Estado de despliegue

- Hosting live: `https://bdb-fondos.web.app`
- Rama desplegada: `master`
- PR #5 y PR #6 mergeados y sincronizados en local.
- Pruebas manuales de usuario: OK.
- Logs recientes revisados durante el rollout: sin errores bloqueantes observados.
- Warnings conocidos no bloqueantes:
  - cold starts/autoscaling normales;
  - mensajes de despiking por varianza diaria alta en algun activo;
  - logs informativos de backtesting.

## Decisiones ya cerradas

1. **Restricciones canonicas**
   - La base canonica viene de Firestore/seed.
   - Los overrides de peticion solo pueden estrechar, no ampliar silenciosamente.
   - Los intentos de ampliacion quedan en `ignored_overrides`.

2. **Equity floor**
   - `EQUITY_FLOOR` hardcodeado queda deprecado.
   - El suelo de RV deriva de los bounds efectivos.

3. **Mixto**
   - `Mixto` deja de ser bucket de restriccion.
   - Su tratamiento operativo pasa a exposiciones reales/canonicas.
   - En frontend puede sobrevivir como display/reporting cuando sea informativo.
   - Firestore `risk_profiles` y `risk_profiles_staging` ya no contienen `Mixto`.

4. **Otros**
   - Se ha relajado el maximo de `Otros` donde era necesario para factibilidad.
   - Sigue siendo un bucket vigilado: no debe convertirse en via libre para commodities u otros fondos de riesgo alto en perfiles conservadores.

5. **UX de recuperacion**
   - Cuando una cartera no es optimizable, el usuario tiene salida clara:
     - modificar la cartera actual;
     - ver donde actuar;
     - reintentar con universo ampliado cuando procede.
   - El frontend ya no reintenta con el mismo universo sin cambios.

## Evidencia de validacion

Validaciones realizadas durante el proceso:

- CI de PR #1 verde.
- CI de PR #5 verde.
- CI de commits post-auditoria verde (`806b1ad`, `0e847d7`, `62280ef`).
- Tests frontend completos tras hotfix: `632 passed`.
- Suite backend completa local: `496 passed, 2 skipped, 8 xfailed, 32 xpassed`.
- Build frontend correcto.
- Hosting desplegado correctamente.
- Smoke de produccion con HTTP 200.
- Shadow/live sin FAIL bloqueante en los manifests revisados.
- Auditoria `Otros`/suitability conservadora: revision `0`, drift poblado `0`, commodities aptos P1-P2 `0`.
- Prueba manual real del usuario: OK.

## Riesgos residuales

Estos puntos no bloquean el estado actual, pero conviene mantenerlos visibles.

### 1. Calidad de datos en fondos `Otros`

El maximo de `Otros` se relajo por factibilidad, pero el bucket debe seguir controlado semanticamente.

Recomendacion:

- revisar periodicamente fondos clasificados como `Otros`;
- evitar que commodities, tematicos agresivos o activos de riesgo alto sean aptos para perfiles 1-2 si no hay justificacion;
- mantener tests de suitability para commodities/tematicos.

### 2. Credito FI cuantitativo

Hay contratos futuros marcados como `xfail`/`xpass` relacionados con `portfolio_exposure_v2.fi_credit.low_quality`, cobertura, escala y warning FE-9.

Recomendacion: tratarlo como bloque independiente de calidad de dato FI, con dry-run y write gate si se decide poblar campos cuantitativos.

### 3. Shadow/live como monitor recurrente

El shadow comparator ya existe. Conviene mantenerlo como herramienta de control antes de futuros cambios de constraints.

Recomendacion: ejecutarlo tras cambios de perfiles, overrides o taxonomias.

## Siguiente paso recomendado

Mantener el sistema en fase de mantenimiento controlado:

1. Revisar periodicamente fondos `Otros` y suitability conservadora.
2. Abrir, cuando toque, el bloque de credito FI cuantitativo.
3. Usar shadow/live antes de cambios futuros de perfiles, buckets u overrides.
4. Pulir UX visual del optimizador sin mezclarlo con cambios de motor.

## Veredicto

La auditoria logica queda **cerrada en su parte critica y operativa**.

El proyecto esta en mejor estado que antes de la auditoria: tiene mas contrato, mas tests, menos duplicacion semantica y una UX mas robusta cuando el optimizador no puede cumplir las restricciones.

Queda trabajo de mantenimiento, pero no hay un bloqueante operativo pendiente asociado al lote principal.
