# Auditoria de fondos `Otros` y suitability conservadora

**Fecha:** 2026-06-03
**Modo:** solo lectura
**Proyecto:** `bdb-fondos`
**Coleccion:** `funds_v3`

## Resumen

- Fondos revisados: **671**
- Fondos dentro del alcance `Otros`/alternativos/commodities/unknown: **313**
- Fondos con revision recomendada: **0**
- Fondos en vigilancia: **73**
- Deriva `compatible_profiles` poblado vs motor vivo: **0**
- Fondos sin cache `compatible_profiles` poblado: **521**
- Fondos con `Otros` >= 10%: **21**
- Fondos con `Otros` >= 50%: **2**
- Fondos con keywords commodities: **29**
- Commodities/keywords aptos para perfiles 1-2 segun motor auditado: **0**

## Lectura ejecutiva

El objetivo de esta auditoria es confirmar que la relajacion de `Otros` no abre una puerta peligrosa para perfiles conservadores.

Un fondo pasa a **revision** si el motor auditado lo permite en perfiles 1-2 y ademas presenta senales de riesgo material: tipo `other`/`unknown`, `Otros` >= 10%, keywords reales de commodities, tematicas agresivas, bucket HIGH, sector fund, subtipo de riesgo alto o RV real >30%.

Un fondo pasa a **vigilancia** si hay drift poblado, falta clasificacion/exposicion o senales menores, aunque no sea apto para perfiles 1-2.

## Fondos en revision

| ISIN | Nombre | Tipo | Otros | Alternativos | Perfiles auditados | Motivo |
| --- | --- | --- | ---: | ---: | --- | --- |
| - | - | - | - | - | - | - |

## Drift poblado de `compatible_profiles`

Estos fondos tienen cache almacenado y difieren de la regla local auditada. No se ha escrito nada.

| ISIN | Nombre | Tipo | Cache actual | Motor auditado | Motivo |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - |

## Artefactos

- JSON: `artifacts\suitability\other_bucket_audit_20260603T165116Z.json`
- CSV: `artifacts\suitability\other_bucket_audit_20260603T165116Z.csv`

## Recomendacion

1. Si **revision = 0**, no hay bloqueo semantico inmediato en perfiles 1-2.
2. Si hay fondos en revision, revisar primero esos ISINs antes de tocar perfiles.
3. Si hay drift de `compatible_profiles`, regenerar solo con dry-run + manifest + write gate.
4. Mantener esta auditoria como control antes de volver a relajar `Otros`.
