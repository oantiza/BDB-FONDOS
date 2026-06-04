# BDB-FONDOS - seguimientos post auditoria

**Fecha:** 2026-06-04
**Estado:** auditoria critica cerrada; quedan solo seguimientos de mantenimiento.

Este documento separa lo que ya quedo cerrado durante la auditoria de lo que conviene vigilar en adelante. Nada de lo siguiente reabre el lote critico salvo que aparezca una incidencia real en produccion.

## Cerrado

| Area | Estado | Evidencia |
| --- | --- | --- |
| Suite backend completa | Cerrado | `594 passed, 0 skipped, 0 xfailed` en local con el mismo alcance de CI; CI completa activa en `master`. |
| Paridad de suitability FE/BE | Cerrado para el estado actual | Comparacion live de los 671 fondos: divergencias `0`, incluidos los 521 fondos que usan fallback por no tener `compatible_profiles` persistido. |
| `compatible_profiles` persistido | Cobertura parcial controlada | 150 fondos poblados y 521 sin campo persistido; drift `0` entre los 150 poblados. El fallback actual tambien conserva paridad FE/BE. |
| Fondos `Otros` en perfiles conservadores | Cerrado para el estado actual | Revision `0`; commodities/keywords aptos P1-P2 `0`. |
| `risk_profiles` canonico | Cerrado | `risk_profiles` y `risk_profiles_staging` identicos; `Mixto` ausente en ambos. |
| Precheck de locks fraccionales (B6) | Cerrado en `master`; pendiente de despliegue | PR #8 corrige el conteo de exposiciones positivas fraccionales y mantiene regresiones focalizadas. |
| Credito FI cuantitativo | Contrato cerrado; cobertura live parcial | Lectura 2026-06-04: 20 documentos cuantitativos (19 validos, 1 invalido) y 130 placeholders legacy vacios; validador compartido y motor puro de avisos implementados. |
| Contratos tematicos commodities | Cerrado | Regresiones activas para exposicion real, clasificacion sectorial y tipo commodities; Option A no adoptada retirada. |
| Documentos de handoff junio | Cerrado en esta limpieza | Planes, PR handoff y specs intermedias archivados bajo `docs/audits/logic_2026_06_archive/`. |

## Pendientes no bloqueantes

### 1. Paridad entre `master` y la funcion desplegada

**Objetivo:** desplegar de forma controlada la cadena ya integrada en `master`, manteniendo una frontera clara entre integracion y activacion.

**Estado actual:** la funcion `optimize_portfolio_quant` desplegada corresponde exactamente al estado del PR #6 (`6542411`, revision `optimize-portfolio-quant-00038-tad`, actualizada el 2026-06-03). Los cambios integrados desde el PR #7, incluido B6 y los controles posteriores, todavia no estan desplegados.

**Gate previo mas reciente:** shadow/live read-only de 2026-06-04 sobre la muestra de rollout: 14 casos, 7 PASS, 7 EXPECTED, 0 FAIL y 0 INVESTIGATE. Manifest local: `artifacts/shadow/shadow_live_20260604T075344Z.json`.

**Criterio de cierre:** pruebas y CI verdes, shadow/live sin FAIL bloqueante, autorizacion explicita de despliegue y verificacion posterior. Este documento no autoriza el despliegue.

### 2. Calidad y cobertura live de credito FI

**Objetivo:** separar definitivamente los placeholders legacy de los documentos cuantitativos y decidir si se repara el unico documento canonico invalido.

**Estado actual:** la lectura estrictamente read-only de 2026-06-04 encontro 150 objetos `fi_credit`: 130 son `{}` vacios legacy y 20 tienen esquema cuantitativo. De estos ultimos, 19 validan y `LU0189895229` se rechaza correctamente porque el desglose contiene `A = -0.03`.

**Impacto actual:** no hay bloqueo ni cambio de suitability. El motor de avisos ignora de forma segura placeholders y documentos invalidos.

**Criterio de cierre:** nueva decision y write gate explicito para limpiar placeholders o reparar el documento invalido; no hacer escrituras automaticas.

### 3. Presentacion de avisos de credito FI

**Objetivo:** decidir si los avisos no bloqueantes de credito FI deben mostrarse en endpoints/frontend.

**Estado actual:** el dato cuantitativo, su esquema y el motor puro de avisos ya existen. Los avisos no modifican suitability ni `compatible_profiles` y todavia no se presentan al usuario.

**Criterio de cierre:** decision de negocio/compliance sobre copy, severidad y ubicacion visual; activacion separada y no bloqueante si se aprueba.

### 4. Revision periodica de `Otros`

**Objetivo:** evitar que la relajacion de `Otros` se convierta con el tiempo en una via permisiva para perfiles conservadores.

**Cuando repetir:** antes de relajar perfiles, despues de cargas masivas de fondos, o si aparece un fondo `Otros` dudoso en perfiles 1-2.

**Criterio de cierre recurrente:** revision `0`, commodities P1-P2 `0`, drift poblado `0`.

### 5. Shadow/live antes de cambios grandes

**Objetivo:** usar el comparador como gate antes de tocar perfiles, constraints u overrides.

**Cuando ejecutarlo:** cambios en `risk_profiles`, cambios de buckets, cambios relevantes en suitability o nuevos REMs.

**Criterio de cierre:** manifest shadow sin FAIL bloqueante, o decision explicita documentada.

### 6. Override legacy P4

**Objetivo:** mantener explicito que `allow_legacy_override` no forma parte del contrato vigente.

**Estado actual:** los skips documentales antiguos se retiraron, pero el modo legacy futuro sigue aplazado de forma intencional. No debe considerarse implementado ni resuelto por esa limpieza.

**Criterio de cierre:** decision contractual separada, implementacion explicita y pruebas propias si alguna vez se adopta.

### 7. Pulido UX visual

**Objetivo:** mejorar forma, copy y jerarquia visual de los flujos de recuperacion del optimizador.

**Alcance:** solo frontend/experiencia; no mezclar con cambios de motor o datos.

## Orden recomendado

1. Validar y desplegar de forma controlada la diferencia acumulada entre `master` y la funcion actual.
2. Dejar unos dias de uso real estable.
3. Hacer el pulido UX si el usuario lo prioriza.
4. Decidir por separado si se limpia/amplia la cobertura FI-credit y si se presentan sus avisos.
5. Mantener auditoria `Otros` y shadow/live como controles antes de futuros cambios.
