# BDB-SEM-4 Asset Mix Contract Hardening

Generated UTC: 2026-05-07T05:03:43.6070094Z

## Objetivo

Definir el contrato canonico de `portfolio_exposure_v2.asset_mix` y las guardas idempotentes necesarias antes de cualquier correccion futura. Este bloque es no-write: no corrige Firestore, no hace rollback, no despliega y no modifica runtime.

## Contexto Confirmado

SEM-0 detecto 450 fondos con `asset_mix` en escala 0-1. SEM-1 confirmo 450 candidatos `HIGH_CONFIDENCE_SCALE_FIX`. SEM-2 demostro que multiplicar por 100 seria determinista, pero que el optimizador acepta 0-1 y 0-100 y normaliza internamente. SEM-3 congelo la decision de no escribir por ahora.

La validacion de SEM-2 sigue coherente:

- Total candidatos: 450.
- Current sum: 0.9999 a 1.0093.
- Proposed sum: 99.99 a 100.93.
- `write_allowed=false` para todos.
- Impacto esperado en optimizador: neutral.

## Contrato Canonico

`canonical_storage_scale`: `0-100 percentage points`.

Ruta canonica futura:

`funds_v3/{isin}.portfolio_exposure_v2.asset_mix`

Claves canonicas minimas:

- `equity`
- `bond`
- `cash`
- `other`

Politica de alias:

- `bond` es la clave canonica para renta fija.
- `fixed_income` puede ser alias de lectura, pero no debe persistirse junto a `bond`.
- `alternatives` puede mapear a `alternative`.
- `real_estate` puede mapear a `real_asset`.
- Si se extiende el schema para `alternative` o `real_asset`, debe hacerse de forma explicita; si no, `other` sigue siendo el bucket residual canonico.

Rango valido de componente: `0..100`.

Rango valido de suma de storage: `95..105`, con objetivo operativo `100`.

## Reglas Runtime

El runtime interno del optimizador trabaja en escala `0-1`.

Escalas aceptadas por runtime:

- `0-1 decimal fractions`
- `0-100 percentage points`

Evidencia principal:

- `functions_python/services/portfolio/utils.py`: `_as_fraction` divide valores con `abs(value) > 1.5` entre 100 y clampa a `0..1`.
- `get_v2_asset_mix` lee primero `portfolio_exposure_v2.asset_mix`, despues `economic_exposure`/`v2_exposure`, convierte a fracciones y normaliza la suma a 1.0.
- `optimizer_core.py` construye vectores `eq/bond/cash/alternative/real_asset/other` en decimal y los usa en constraints.
- `frontend/src/utils/normalizer.ts` convierte valores `<=1.5` a porcentaje para UI.

## Reglas de Deteccion

`SCALE_0_1`:

- Todos los componentes son numericos, finitos y no negativos.
- Maximo componente `<=1.5`.
- `raw_sum` entre `0.95` y `1.05`.
- Accion futura posible: multiplicar por 100 solo si la suma propuesta queda entre `95` y `105`.

`SCALE_0_100`:

- Todos los componentes son numericos, finitos y no negativos.
- Componentes `<=100`.
- `raw_sum` entre `95` y `105`.
- Estado terminal: ya canonico; no se multiplica.

`AMBIGUOUS_SCALE`:

- `raw_sum` mayor de `1.05` y menor de `95`.
- No se puede demostrar escala 0-1 ni 0-100.
- Requiere review y bloquea write.

`MALFORMED_VECTOR`:

- Objeto ausente o invalido.
- Componente no numerico, negativo o mayor de 100.
- Suma cero/negativa o mayor de 105.
- Aliases conflictivos, por ejemplo `bond` y `fixed_income` con valores distintos.
- Requiere review y bloquea write.

## Funcion Propuesta

No se implemento en este bloque. El contrato propuesto es:

```text
normalize_asset_mix_scale(asset_mix) -> {
  normalized_asset_mix,
  detected_scale,
  confidence,
  requires_review,
  already_canonical
}
```

`normalized_asset_mix` debe devolverse en escala canonica `0-100`. La funcion no debe escribir, no debe leer Firestore y no debe usar normalizacion runtime como autorizacion de write. Primero clasifica el vector crudo por suma total; despues decide si es no-op, candidato determinista o review.

## Guardas Idempotentes

La estrategia idempotente es simple: solo se transforma `SCALE_0_1 -> SCALE_0_100` una vez. `SCALE_0_100` es terminal y no-op.

Guardas obligatorias antes de cualquier write futuro:

- Releer el documento actual de `funds_v3` justo antes de mutar.
- Operar solo sobre `portfolio_exposure_v2.asset_mix`.
- Abort si `raw_sum` esta entre `95` y `105`: ya esta canonico.
- Proceder solo si `raw_sum` esta entre `0.95` y `1.05`.
- Exigir componentes finitos, no negativos y `<=1.5` para escala 0-1.
- Multiplicar por 100 y exigir `proposed_sum` entre `95` y `105`.
- Abort ante aliases conflictivos, mixed-scale, sums absurdas o candidatos REVIEW/BLOCKED.
- Usar transaccion/read-check-write o hash exacto del `asset_mix` anterior para evitar reruns stale.
- Requerir aprobacion humana explicita en un bloque posterior.

## Riesgos

HIGH:

- Doble multiplicacion por script no idempotente.
- Mixed-scale vector enmascarado por conversion por componente.
- Vector malformado que contamine constraints o reporting.

MEDIUM:

- Fallback ambiguo a `economic_exposure`, `v2_exposure`, `metrics`, `classification_v2` o legacy.
- `derived` inconsistente con V2.
- Loader y overrides existentes todavia validan 0-1 en algunas rutas auxiliares.

LOW:

- Metadatos de escala/parser incompletos.

## Por Que No Se Ejecuta Write

No se escribe porque el impacto sobre el optimizador es neutral: el runtime acepta ambas escalas, convierte a 0-1 y normaliza. En cambio, un write masivo introduce riesgo operativo real si se repite sin guardas, especialmente doble multiplicacion sobre fondos ya canonicalizados.

## Confirmacion No-Write

- No Firestore write.
- No rollback.
- No deploy.
- No Firebase CLI deploy.
- No CORE.
- No `funds_core_v1`.
- No parser PDF.
- No batch update.
- No modificacion de runtime.

Solo se crearon artifacts locales de auditoria y este documento.

## Recomendaciones Futuras

Siguiente bloque recomendado: `BDB-SEM-5`, no-write, para planificar pruebas unitarias de `normalize_asset_mix_scale` y fixtures de guardas idempotentes. Cualquier write real debe venir despues, con aprobacion humana explicita, precondiciones transaccionales y abort automatico para fondos ya en 0-100.
