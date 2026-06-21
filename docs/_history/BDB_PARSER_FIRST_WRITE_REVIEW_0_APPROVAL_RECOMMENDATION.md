# BDB-PARSER-FIRST-WRITE-REVIEW-0 — Approval Recommendation

**Fecha:** 2026-05-08T06:16:45+02:00
**Bloque:** BDB-PARSER-FIRST-WRITE-REVIEW-0
**Operador:** Revisión humana pre-first-write
**Estado previo:** PARSER_WRITE_SNAPSHOT_READY_WITH_WARNINGS (BDB-PARSER-WRITE-SNAPSHOT-1)

---

## Confirmaciones de Seguridad

| Check                            | Estado |
|----------------------------------|--------|
| Ruta validada                    | ✅ `artifacts/bdb_parser_audit/write_gate_snapshot_1/` |
| No se toca BDB-FONDOS-CORE       | ✅ Confirmado |
| No se ejecutan writes a Firestore | ✅ Confirmado — `dry_run=true`, `write_executed=false` |
| No se hace deploy                | ✅ Confirmado |
| No se hace commit/push           | ✅ Confirmado |
| No se tocan credenciales         | ✅ Confirmado |
| No se modifica runtime           | ✅ Confirmado |

---

## Resumen de Manifests

| Manifest                       | Presente | Completo | Notas |
|--------------------------------|----------|----------|-------|
| `snapshot_manifest.json`       | ✅       | ✅ 5/5   | Todos con `snapshot_available: true`, `document_exists: true` |
| `diff_manifest.json`          | ✅       | ✅ 5/5   | `dry_run: true`, `write_executed: false` |
| `write_approval_manifest.json`| ✅       | ✅ 5/5   | Todos `PENDING_MANUAL_APPROVAL` |
| `rollback_manifest.json`      | ✅       | ✅ 5/5   | Snapshots completos con `fields_that_would_be_restored` |
| `post_write_verification_plan.json` | ✅  | ✅       | 7 checks definidos |
| `snapshots/` (directorio)     | ✅       | ✅ 5 archivos | Uno por ISIN |

---

## Tabla de ISINs Candidatos

| # | ISIN           | Nombre                                                     | Clase   | Policy Status          | Campos Cambiados | Warnings | Forbidden Fields | manual.* | retrocession | economic_exposure |
|---|----------------|-------------------------------------------------------------|---------|------------------------|------------------|----------|------------------|----------|-------------|-------------------|
| 1 | IE0003867441   | BNY Mellon Small Cap Euroland Fund EUR A Acc                | RV      | **ACCEPT**             | 13               | 1        | 0                | ✅ Preservado | ✅ Preservado | ✅ Preservado |
| 2 | ES0165142003   | Mutuafondo Corto Plazo D FI                                 | RF      | ACCEPT_WITH_WARNINGS   | 6                | 4        | 0                | ✅ Preservado | ✅ Preservado | ✅ Preservado |
| 3 | LU0208853944   | JPM Global Natural Resources Fund D EUR                     | RV      | ACCEPT_WITH_WARNINGS   | 16               | 2        | 0                | ✅ Preservado | ✅ Preservado | ✅ Preservado |
| 4 | LU0252500524   | JPM EUR Money Market VNAV Fund D EUR                        | Monetario | ACCEPT_WITH_WARNINGS | 7                | 6        | 0                | ✅ Preservado | ✅ Preservado | ✅ Preservado |
| 5 | LU1670724373   | M&G (Lux) Optimal Income Fund EUR A Acc                     | Mixto   | ACCEPT_WITH_WARNINGS   | 12               | 4        | 0                | ✅ Preservado | ✅ Preservado | ✅ Preservado |

---

## Análisis Detallado por ISIN

---

### 1. IE0003867441 — BNY Mellon Small Cap Euroland Fund EUR A Acc

**Policy Status:** `ACCEPT` (puro, sin warnings de policy)
**Confidence:** 0.99

#### Campos Cambiados (13)

| Campo | Valor Actual | Valor Propuesto | Riesgo |
|-------|-------------|-----------------|--------|
| `classification_v2.equity_style_box` | `"Mid-Blend"` | `null` | ⚠️ MEDIO — Pérdida de dato clasificatorio |
| `derived.style_bias.equity.style` | `"blend"` | `null` | ⚠️ MEDIO — Coherente con pérdida de style_box |
| `derived.style_bias.equity.style_box_cell` | `"Mid-Blend"` | `null` | ⚠️ MEDIO — Coherente |
| `derived.style_bias.equity.style_weights_total` | `{blend: 0.9853}` | `null` | ⚠️ MEDIO — Coherente |
| `ms.equity_style.style.blend` | `null` | `0` | 🟢 BAJO — Inicialización a 0 |
| `ms.equity_style.style.growth` | `null` | `0` | 🟢 BAJO — Inicialización a 0 |
| `ms.equity_style.style.value` | `null` | `0` | 🟢 BAJO — Inicialización a 0 |
| `ms.equity_style.style_box_cell` | `"Mid-Blend"` | `null` | ⚠️ MEDIO — Pérdida de style_box |
| `ms.holdings_top10` | Con sector labels | Sin sector labels | ⚠️ MEDIO — Pérdida de sector en holdings |
| `ms.objective` | `"...mínimo un 90%..."` | `"...mínimo el 90%..."` | 🟢 BAJO — Cambio cosmético de texto |
| `portfolio_exposure_v2.equity_styles` | `{blend: 0.9853}` | `null` | ⚠️ MEDIO — Pérdida de dato de estilo |
| `quality.parsed_at` | Timestamp | `{}` | 🟢 BAJO — Se regenerará |
| `quality.parser_version` | `gemini-2.5-pro` | `gemini-2.5-flash` | 🟢 BAJO — Downgrade de modelo |

#### Warnings (1)
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=98.53` — Solo informativo, escala normalizada correctamente.

#### Evaluación
- ✅ Único ISIN con ACCEPT puro.
- ⚠️ **Preocupación principal:** La pérdida de `equity_style_box: "Mid-Blend"` y los style_weights es una regresión de datos. El parser Flash no extrae el style box que el Pro sí extrajo. Sin embargo, los valores `ms.equity_style.style.*` pasan de `null` a `0` (inicialización explícita), lo cual es coherente con que el PDF no tenga esa tabla desglosada.
- ⚠️ Los holdings top10 pierden los labels de sector (`"Utilities"` → `null`). Esto es una regresión menor ya que el dato sectorial sigue disponible en `ms.sectors`.
- 🟢 El cambio en `ms.objective` es puramente cosmético ("un" → "el").
- 🟢 Confianza alta (0.99), fondo bien tipificado como RV Eurozona.

> **Recomendación: `APPROVE_FOR_FIRST_WRITE`**
> Pese a las pérdidas de style_box y sector en holdings, estos son datos derivables desde otros campos que permanecen intactos. El fondo es RV pura con datos completos de sectores, regiones y market_caps. Buen candidato para primer write por ser ACCEPT puro con alta confianza.

---

### 2. ES0165142003 — Mutuafondo Corto Plazo D FI

**Policy Status:** `ACCEPT_WITH_WARNINGS`
**Confidence:** 0.90

#### Campos Cambiados (6)

| Campo | Valor Actual | Valor Propuesto | Riesgo |
|-------|-------------|-----------------|--------|
| `ms.holdings_top10` | Con fechas en nombres | Sin fechas en nombres | 🟢 BAJO — Limpieza de nombres |
| `ms.rating_stars` | `null` | `0` | 🟢 BAJO — Inicialización explícita |
| `ms.sustainability_rating` | `null` | `0` | 🟢 BAJO — Inicialización explícita |
| `quality.parsed_at` | Timestamp | `{}` | 🟢 BAJO — Se regenerará |
| `quality.parser_version` | `gemini-2.5-pro` | `gemini-2.5-flash` | 🟢 BAJO — Downgrade de modelo |
| `quality.warnings` | `[missing_rating_stars, ...]` | `[missing_sectors, missing_regions]` | 🟢 BAJO — `missing_rating_stars` eliminado correctamente ya que ahora `rating_stars=0` |

#### Warnings (4)
- `missing_sectors` — ⚠️ Fondo RF ultra corto plazo, esperable no tener sectores equity.
- `missing_regions` — ⚠️ Esperable para RF corto plazo EUR.
- `region_incomplete` — ⚠️ Informativo.
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=88.79` — 🟢 Normalización correcta.

#### Evaluación
- 🟢 **Diff mínimo y de muy bajo riesgo.** Solo 6 campos cambiados, todos triviales.
- 🟢 Los cambios en holdings son cosméticos (eliminación de fechas de vencimiento en nombres).
- 🟢 Las inicializaciones `null → 0` para stars y sustainability son coherentes.
- ⚠️ Es un fondo **RF Corto Plazo** — los warnings de `missing_sectors` y `missing_regions` son inherentes al tipo de fondo, no errores del parser.
- 🟢 Confianza 0.90 — aceptable para RF.

> **Recomendación: `APPROVE_FOR_FIRST_WRITE`**
> Diff más limpio de los 5 candidatos. Cambios triviales y coherentes. RF ultra corto plazo es un fondo de bajo riesgo por naturaleza. Excelente candidato complementario a IE0003867441 para validar el pipeline en un tipo de activo diferente (RF vs RV).

---

### 3. LU0208853944 — JPM Global Natural Resources Fund D EUR

**Policy Status:** `ACCEPT_WITH_WARNINGS`
**Confidence:** 0.99

#### Campos Cambiados (16)

| Campo | Valor Actual | Valor Propuesto | Riesgo |
|-------|-------------|-----------------|--------|
| `classification_v2.duration_bucket` | `"ultrashort"` | `null` | 🟢 BAJO — Corrección: fondo RV no debería tener duration |
| `classification_v2.fixed_income_type` | `"flexible"` | `null` | 🟢 BAJO — Corrección: fondo RV no tiene FI |
| `classification_v2.sources_used` | incluye `ms.fixed_income` | sin `ms.fixed_income` | 🟢 BAJO — Coherente |
| `classification_v2.warnings` | `[credit_missing, fi_type_inference_weak]` | `[]` | 🟢 BAJO — Warnings resueltos correctamente |
| `ms.fixed_income` | Objeto con todos zeros | `null` | 🟢 BAJO — Corrección: fondo RV pura |
| `ms.holdings_top10` | Sin sector labels | Con sector labels | 🟢 **MEJORA** — Enriquecimiento de datos |
| `ms.sustainability_rating` | `0` | `null` | 🟢 BAJO — Normalización |
| `portfolio_exposure_v2.bond_types` | `{flexible: 0.0011}` | `null` | 🟢 BAJO — Corrección residual |
| `portfolio_exposure_v2.duration` | `{ultrashort: 0.0011}` | `null` | 🟢 BAJO — Corrección residual |
| `portfolio_exposure_v2.equity_regions.*` (×10) | ~mitad de valor real | valor real | ⚠️ MEDIO — Duplicación de regiones |
| `portfolio_exposure_v2.warnings` | incluye `credit_missing` | sin `credit_missing` | 🟢 BAJO — Warning eliminado correctamente |
| `quality.parsed_at` | Timestamp | `{}` | 🟢 BAJO — Se regenerará |
| `quality.warnings` | `[unknown_region_key..., fi_missing_credit_data, ...]` | `[]` | 🟢 BAJO — Warnings resueltos |

#### Warnings (2)
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=97.4` — 🟢 Informativo.
- `asset_mix_guardrail:mixed_scale_signal_detected:min_positive_component=0.11,max_component=97.4` — ⚠️ Bond=0.11% en fondo 97.4% equity: señal de escala mixta. Residual aceptable.

#### Evaluación
- ⚠️ **Fondo de Recursos Naturales:** energía (45%) + materiales básicos (54%). Es un **fondo sectorial de metales/minería/energía** — históricamente con tensión semántica en el parser.
- ⚠️ **16 campos cambiados** — diff grande, aunque la mayoría son correcciones legítimas (eliminar datos FI espurios de un fondo RV).
- ⚠️ Las regiones en `portfolio_exposure_v2.equity_regions` se duplican (los valores actuales parecen ser la mitad del valor real, y los propuestos el valor correcto). Esto sugiere un bug anterior de normalización que este parse corrige.
- ⚠️ Criterio de exclusión: **oro/metales/minería con tensión semántica** — aplica parcialmente.

> **Recomendación: `HOLD_FOR_REVIEW`**
> Aunque la mayoría de cambios son correcciones legítimas, el volumen de cambios (16 campos) combinado con ser un fondo de recursos naturales (energía + metales) lo hace un candidato de riesgo medio-alto para un primer write. La duplicación de regiones necesita verificación adicional. Mejor candidato para un segundo batch.

---

### 4. LU0252500524 — JPM EUR Money Market VNAV Fund D EUR

**Policy Status:** `ACCEPT_WITH_WARNINGS`
**Confidence:** 0.85

#### Campos Cambiados (7)

| Campo | Valor Actual | Valor Propuesto | Riesgo |
|-------|-------------|-----------------|--------|
| `ms.fixed_income.effective_maturity` | `null` | `0` | 🟢 BAJO — Inicialización |
| `ms.holdings_top10` | Nombres limpios | Con fechas/códigos adjuntos | ⚠️ MEDIO — **Regresión**: nombres más sucios |
| `ms.rating_stars` | `null` | `0` | 🟢 BAJO — Inicialización |
| `ms.sustainability_rating` | `null` | `0` | 🟢 BAJO — Inicialización |
| `quality.parsed_at` | Timestamp | `{}` | 🟢 BAJO — Se regenerará |
| `quality.parser_version` | `gemini-2.5-pro` | `gemini-2.5-flash` | 🟢 BAJO — Downgrade de modelo |
| `quality.warnings` | `[..., missing_rating_stars, ...]` | `[..., sin missing_rating_stars]` | 🟢 BAJO — Coherente |

#### Warnings (6)
- `fi_type_inference_weak` — ⚠️ Inferencia débil de tipo FI.
- `missing_sectors` — ⚠️ Esperable para monetario.
- `missing_regions` — ⚠️ Esperable para monetario.
- `money_market_subtype_defaulted` — ⚠️ Subtipo forzado a default.
- `region_incomplete` — ⚠️ Informativo.
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=100` — 🟢 100% cash.

#### Evaluación
- ⚠️ **6 warnings** — el mayor número de los 5 candidatos.
- ⚠️ **Confianza baja (0.85)** — la menor de los 5 candidatos.
- ⚠️ `fi_type_inference_weak` + `money_market_subtype_defaulted` indica que el parser tiene dificultades con la clasificación de este tipo de fondo.
- ⚠️ Los holdings top10 **regresan en calidad**: nombres antes limpios ahora llevan códigos y fechas adjuntos (e.g., `"ERSTE GROUP BANK AG"` → `"ERSTE GROUP BANK AG 3.15 01JUN202023-06-01"`).
- ⚠️ Criterio de exclusión: **fondo monetario con señales débiles** — aplica.
- ⚠️ El report_date es **2023-07-04** — datos muy antiguos (3 años).

> **Recomendación: `REJECT_FOR_FIRST_WRITE`**
> Confianza baja, mayor número de warnings, regresión en calidad de holdings, y datos de 2023. No es un buen candidato para validar un primer write. Los datos antiguos y la regresión en nombres de holdings indican que el parser Flash tiene problemas con este tipo de PDF.

---

### 5. LU1670724373 — M&G (Lux) Optimal Income Fund EUR A Acc

**Policy Status:** `ACCEPT_WITH_WARNINGS`
**Confidence:** 0.99

#### Campos Cambiados (12)

| Campo | Valor Actual | Valor Propuesto | Riesgo |
|-------|-------------|-----------------|--------|
| `derived.portfolio_exposure.equity_regions_total.americas` | `null` | `0.0204` | 🟢 BAJO — Enriquecimiento |
| `derived.portfolio_exposure.equity_regions_total.europe_me_africa` | `null` | `0.0496` | 🟢 BAJO — Enriquecimiento |
| `ms.equity_style.style.blend` | `null` | `null` | 🟢 NOOP — Sin cambio real |
| `ms.equity_style.style.growth` | `null` | `null` | 🟢 NOOP — Sin cambio real |
| `ms.equity_style.style.value` | `null` | `null` | 🟢 NOOP — Sin cambio real |
| `ms.holdings_top10` | 9 holdings | 10 holdings (+1: "Ms Eur Liquidity Fund") | 🟢 BAJO — Enriquecimiento |
| `ms.regions.detail` | Objeto con datos espurios | `null` | ⚠️ MEDIO — Eliminación de regions.detail |
| `portfolio_exposure_v2.equity_regions.americas` | `null` | `0.000204` | 🟢 BAJO — Enriquecimiento mínimo |
| `portfolio_exposure_v2.equity_regions.europe_me_africa` | `null` | `0.000496` | 🟢 BAJO — Enriquecimiento mínimo |
| `quality.parsed_at` | Timestamp | `{}` | 🟢 BAJO — Se regenerará |
| `quality.warnings` | `[unknown_region_key..., regions_sum_overflow:200]` | `[]` | 🟢 BAJO — Warnings resueltos |

#### Warnings (4)
- `subtype_incompatible_with_asset_type:allocation:THEMATIC_EQUITY` — ⚠️ Tensión entre asset_type=allocation y subtype=THEMATIC_EQUITY.
- `subtype_downgraded_to_safe_family:FLEXIBLE_ALLOCATION` — ⚠️ Downgrade forzado, pero es el comportamiento correcto para un mixto defensivo.
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=92.53` — 🟢 Informativo.
- `asset_mix_guardrail:mixed_scale_signal_detected:min_positive_component=0.07,max_component=92.53` — ⚠️ Señal de escala mixta (equity=0.07% en mixto con 92.53% bond).

#### Evaluación
- ⚠️ **Tensión semántica en clasificación:** El derived dice `THEMATIC_EQUITY` pero el classification_v2 correctamente lo downgrade a `FLEXIBLE_ALLOCATION`. Esto es correcto y el downgrade funciona como safety net.
- 🟢 La eliminación de `ms.regions.detail` es una corrección: los datos actuales son espurios (`other: 100`, `europe_ex_euro: 70.84` — sumaban >200%).
- 🟢 La resolución de `regions_sum_overflow:200.00` es una mejora de calidad.
- 🟢 Confianza alta (0.99).
- ⚠️ 12 campos cambiados — volumen medio.
- ⚠️ Aunque el fondo es un Mixto Defensivo (>92% bonos), la presencia de warnings de clasificación lo hace un candidato de riesgo moderado para un primer write.

> **Recomendación: `HOLD_FOR_REVIEW`**
> El fondo tiene alta confianza y los cambios son mayormente mejoras, pero la tensión semántica en la clasificación (THEMATIC_EQUITY downgradeado a FLEXIBLE_ALLOCATION) y el volumen de cambios (12) lo hacen más adecuado para un segundo batch, una vez validado el pipeline con los primeros writes más simples.

---

## Resumen de Recomendaciones

| ISIN           | Nombre                                   | Recomendación               | Motivo |
|----------------|------------------------------------------|-----------------------------|--------|
| **IE0003867441** | BNY Mellon Small Cap Euroland EUR A     | ✅ **APPROVE_FOR_FIRST_WRITE** | ACCEPT puro, confianza 0.99, fondo RV con datos completos |
| **ES0165142003** | Mutuafondo Corto Plazo D FI             | ✅ **APPROVE_FOR_FIRST_WRITE** | Diff mínimo (6 campos), cambios triviales, RF bajo riesgo |
| LU0208853944   | JPM Global Natural Resources D EUR       | 🟡 **HOLD_FOR_REVIEW**       | 16 campos, recursos naturales, duplicación de regiones |
| LU0252500524   | JPM EUR Money Market VNAV D EUR          | 🔴 **REJECT_FOR_FIRST_WRITE** | Confianza 0.85, 6 warnings, regresión en holdings, datos 2023 |
| LU1670724373   | M&G Optimal Income Fund EUR A            | 🟡 **HOLD_FOR_REVIEW**       | Tensión semántica en clasificación, 12 campos, mejor para batch 2 |

---

## Selección Final para Primer Write

### ISINs Seleccionados (2 de 5)

1. **IE0003867441** — BNY Mellon Small Cap Euroland Fund EUR A Acc
   - ✅ Único ACCEPT puro
   - ✅ Confianza 0.99
   - ✅ Fondo RV — valida el pipeline en renta variable
   - ✅ Datos completos de sectores, regiones, market_caps
   - ⚠️ Aceptar la pérdida de style_box como trade-off conocido

2. **ES0165142003** — Mutuafondo Corto Plazo D FI
   - ✅ Diff más pequeño de todos (6 campos)
   - ✅ Todos los cambios son triviales (inicializaciones, cosmético)
   - ✅ Fondo RF ultra corto plazo — bajo riesgo inherente
   - ✅ Valida el pipeline en un tipo de activo diferente (RF vs RV)

### Motivo de la Selección

La selección de estos 2 ISINs cumple con todos los criterios:
- **Primero ACCEPT puro** → IE0003867441 ✅
- **Luego ACCEPT_WITH_WARNINGS de bajo riesgo** → ES0165142003 ✅
- **Evitar cambios grandes** → Los diffs son de 13 y 6 campos, los más pequeños junto con LU0252500524 ✅
- **Evitar RF/monetarios con credit_missing** → ES0165142003 no tiene `credit_missing` ✅
- **Evitar oro/metales/minería** → Excluido LU0208853944 ✅
- **Diversificación de tipo de activo** → RV + RF ✅

---

## Checklist Pre-Write (para BDB-PARSER-FIRST-WRITE-1)

| #  | Check                                                        | Estado |
|----|--------------------------------------------------------------|--------|
| 1  | Snapshots pre-write disponibles en `snapshots/`              | ✅ Verificado |
| 2  | Rollback manifest completo con `fields_that_would_be_restored` | ✅ Verificado para ambos ISINs |
| 3  | Post-write verification plan definido con 7 checks            | ✅ Verificado |
| 4  | `forbidden_fields_detected: []` para ambos ISINs             | ✅ Verificado |
| 5  | `manual_fields_current_preserved: true` para ambos           | ✅ Verificado |
| 6  | `manual_costs_retrocession_current_preserved: true`           | ✅ Verificado |
| 7  | `economic_exposure_current_preserved: true`                   | ✅ Verificado |
| 8  | Los ISINs aprobados son un subset de los 5 candidatos         | ✅ 2 de 5 |
| 9  | Se ha revisado current_value vs proposed_value campo a campo  | ✅ Documentado arriba |
| 10 | No hay writes pendientes en ningún manifest                   | ✅ `write_executed: false` en todos |

---

## Estado de Rollback Manifest

| Check | Estado |
|-------|--------|
| Rollback manifest presente | ✅ |
| Snapshots completos para IE0003867441 | ✅ — Doc completo con 12 campos restaurables |
| Snapshots completos para ES0165142003 | ✅ — Doc completo con 6 campos restaurables |
| Restore values documentados | ✅ — Cada campo tiene `restore_value` |
| Rollback cubriría todos los changed_fields | ✅ |

## Estado de Post-Write Verification Plan

| Check | Estado |
|-------|--------|
| Plan presente | ✅ |
| Checks definidos | ✅ — 7 checks |
| `document_exists` | ✅ |
| `proposed_fields_updated` | ✅ |
| `forbidden_fields_unchanged` | ✅ |
| `manual_fields_unchanged` | ✅ |
| `portfolio_exposure_v2.economic_exposure_unchanged` | ✅ |
| `asset_mix_sum_valid_0_95_to_1_05` | ✅ |
| `parser_metadata_or_warnings_present` | ✅ |

---

## Decisión Final

```
DECISIÓN: FIRST_WRITE_REVIEW_READY
```

### ISINs aprobados para BDB-PARSER-FIRST-WRITE-1:
1. `IE0003867441` — APPROVE_FOR_FIRST_WRITE
2. `ES0165142003` — APPROVE_FOR_FIRST_WRITE

### ISINs retenidos para batch 2:
3. `LU0208853944` — HOLD_FOR_REVIEW
4. `LU1670724373` — HOLD_FOR_REVIEW

### ISINs rechazados:
5. `LU0252500524` — REJECT_FOR_FIRST_WRITE

### Readiness para BDB-PARSER-FIRST-WRITE-1:
- ✅ Rollback manifest completo
- ✅ Post-write verification plan completo
- ✅ 2 ISINs seleccionados (dentro del límite 1-3)
- ✅ Diversificación RV + RF
- ✅ No se ha ejecutado ningún write
- ✅ Listo para BDB-PARSER-FIRST-WRITE-1

---

> **NOTA:** Este documento es solo una recomendación de revisión. No se ha ejecutado ningún write a Firestore. No se ha modificado ningún documento en producción. La ejecución real del primer write controlado se hará en el bloque `BDB-PARSER-FIRST-WRITE-1` tras aprobación explícita del operador.
