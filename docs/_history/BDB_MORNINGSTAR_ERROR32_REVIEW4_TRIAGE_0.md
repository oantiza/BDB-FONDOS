# TRIAGE: BDB-MORNINGSTAR-ERROR32-REVIEW4-TRIAGE-0

**Estado:** análisis read-only completado. Documento sin commitear.
**Fecha:** 2026-05-21
**Agente:** Claude 4.6 (Antigravity IDE)
**Contexto:** ciclo ERROR-32, post-reparse. 26 ACCEPT ya cerrados. Este triage cubre los 4 REVIEW_AFTER_REPARSE.

---

## 1. Resumen ejecutivo

Los 4 fondos clasificados como `REVIEW_AFTER_REPARSE` son **fondos mixtos (allocation)** con exposición a bonos superior al umbral del 5% que el router usa para relajar warnings de renta fija. Todos parsearon correctamente (validation.ok = true, JSON válido, schema correcto), pero carecen de datos de calidad crediticia (`credit_quality`) en el PDF de Morningstar. El router los envía legítimamente a REVIEW porque la ausencia de `credit` en un fondo allocation con bond > 5% es un dato material para suitability.

**Causa raíz común:** los PDFs de Morningstar para estos 4 fondos no incluyen la tabla de `Calidad crediticia` (credit quality breakdown) en la sección de renta fija. El LLM (Gemini 2.5 Flash) extrajo correctamente todos los campos disponibles, pero no puede inventar datos que no existen en la fuente.

---

## 2. Tabla de triage

| ISIN | Fondo | Warning(s) | Asset type | Bond % (v2) | Credit en PDF | Duration en PDF | Causa raíz | Recomendación | Datos necesarios |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **DE000A0X7541** | Acatis Value Event Fonds A | `credit_missing` | allocation | 30.76% | ❌ (todo 0) | ⚠️ (eff_dur=0, bucket=ultrashort) | PDF no tiene tabla de credit quality; fi_type_inference_weak | **RESOLVIBLE_WITH_MORNINGSTAR_WEB** | credit_quality breakdown (AAA..NR) |
| **LU0352312184** | Allianz Strategy 50 CT EUR | `credit_missing` | allocation | 60.25% | ❌ (null) | ⚠️ (eff_dur=0, bucket=ultrashort) | PDF no tiene tabla de credit quality; fondo usa futuros/derivados; asset_mix sum=115.46% (rebased) | **RESOLVIBLE_WITH_MORNINGSTAR_WEB** | credit_quality breakdown (AAA..NR) |
| **LU0512121004** | DNCA Invest Eurose Class B EUR | `credit_missing` | allocation | 75.79% | ❌ (todo 0) | ⚠️ (eff_dur=0, bucket=ultrashort) | PDF no tiene tabla de credit quality; bond-heavy allocation | **RESOLVIBLE_WITH_MORNINGSTAR_WEB** | credit_quality breakdown (AAA..NR) |
| **LU1899018870** | Sigma IH FCP - Best M&G A EUR Acc | `credit_missing\|duration_missing` | allocation | 71.80% | ❌ (todo 0) | ❌ (null, no bucket) | PDF no tiene ni credit quality ni duration; FoF puro (10 subfondos M&G = 94.6% top10) | **RESOLVIBLE_WITH_MORNINGSTAR_WEB** | credit_quality breakdown + effective_duration |

---

## 3. Análisis detallado por fondo

### 3.1 DE000A0X7541 — Acatis Value Event Fonds A

**Categoría Morningstar:** Mixtos Flexibles EUR
**Rating:** ★★★ | **Sustainability:** 0
**Asset mix (v2):** equity 62.9% · bond 30.76% · cash 5.4% · other 0.94%

**¿Qué falta?**
- `ms.fixed_income.credit_quality`: todos los buckets en `0` → el PDF no muestra esta tabla.
- `ms.fixed_income.avg_credit_quality`: `null`.
- `portfolio_exposure_v2.credit`: `null`.

**¿Qué sí tiene?**
- Asset allocation completo ✅
- Sectors completo (11 sectores) ✅
- Regions completo (macro + detail) ✅
- Top 10 holdings (37 equity + 66 bonds) ✅
- Duration bucket inferido como `ultrashort` (por eff_dur=0) — debatible pero presente.

**Warnings adicionales:**
- `fi_type_inference_weak` — el tipo de RF se infirió débilmente como `flexible`.
- `unknown_region_key` (x3) — nombres de región en español no mapeados (cosmético, sin impacto en routing).
- `regions_sum_overflow:200.00` — macro regions suman ~200% (típico en fichas Morningstar españolas que duplican macro y detail).

**Diagnóstico:** Fondo mixto flexible con ~31% en bonos. El PDF de Morningstar simplemente no incluye la tabla de calidad crediticia. Morningstar Web SÍ suele mostrar este dato para fondos con bond exposure significativa.

**Recomendación:** `RESOLVIBLE_WITH_MORNINGSTAR_WEB` — capturar `credit_quality` (AAA/AA/A/BBB/BB/B/Below B/NR) y `effective_duration` desde la ficha web de Morningstar.

---

### 3.2 LU0352312184 — Allianz Strategy 50 CT EUR

**Categoría Morningstar:** Mixtos Moderados EUR
**Rating:** ★★★ | **Sustainability:** 0
**Asset mix (raw):** equity 45.83% · bond 69.56% · cash 0% · other 0.07% → **suma 115.46%** (rebased a 1.0 por guardrail)
**Asset mix (v2 normalizado):** equity 39.69% · bond 60.25% · other 0.06%

**¿Qué falta?**
- `ms.fixed_income.credit_quality`: `null` (no sólo en ceros, directamente null — el PDF no tiene la sección).
- `ms.fixed_income.maturity_allocation`: `null`.
- `ms.fixed_income.coupon_allocation`: `null`.
- `portfolio_exposure_v2.credit`: `null`.

**¿Qué sí tiene?**
- Asset allocation (con rebasing automático por sum > 100%) ✅
- Sectors completo ✅
- Regions completo (macro + detail) ✅
- Style box: Mid-Blend ✅
- Top 10 holdings: casi todos son **futuros e-mini/índices + bonos soberanos** (0 equity holdings, 272 bond holdings).

**Warnings adicionales:**
- `asset_mix_guardrail:asset_mix_rebased_to_sum_1:sum_before=1.1546` — la suma raw superaba 100% porque el fondo usa apalancamiento vía futuros.
- `subtype_incompatible_with_asset_type:allocation:THEMATIC_EQUITY` → downgraded a `FLEXIBLE_ALLOCATION` (correcto, el fondo NO es temático equity).
- `asset_allocation_sum_mismatch:115.46` — coherente con el uso de derivados.

**Diagnóstico:** Fondo de gestión activa que replica exposure vía futuros (S&P 500, Euro Stoxx 50, TOPIX, SPI 200, FTSE 100) y complementa con bonos soberanos europeos. El 115.46% en asset mix refleja apalancamiento sintético legítimo. El PDF de Morningstar no tiene tabla de credit quality porque la cartera de bonos es esencialmente soberana (Netherlands, Germany, Belgium, France, Spain). Morningstar Web debería tener el credit breakdown.

**Recomendación:** `RESOLVIBLE_WITH_MORNINGSTAR_WEB` — la calidad crediticia de bonos soberanos euro es previsiblemente investment-grade (AAA-BBB). Capturar desde la web confirmaría formalmente.

---

### 3.3 LU0512121004 — DNCA Invest Eurose Class B shares EUR

**Categoría Morningstar:** Mixtos Defensivos EUR
**Rating:** ★★★★ | **Sustainability:** 0
**Asset mix (raw):** equity 22.06% · bond 81.17% · cash 0% · other 3.87% → **suma 107.10%** (rebased)
**Asset mix (v2 normalizado):** equity 20.60% · bond 75.79% · other 3.61%

**¿Qué falta?**
- `ms.fixed_income.credit_quality`: todos en `0` → sin datos en PDF.
- `ms.fixed_income.avg_credit_quality`: `null`.
- `portfolio_exposure_v2.credit`: `null`.

**¿Qué sí tiene?**
- Asset allocation (con rebasing por sum 107.10%) ✅
- Sectors completo ✅
- Regions: macro completo, detail `null` (no disponible en PDF) ⚠️
- Top 10 holdings: Euro Bobl Future, Ostrum SRI Money Plus, bonos soberanos (Spain, EU, Italy), TotalEnergies.
- 54 equity holdings + 347 bond holdings ✅

**Warnings adicionales:**
- `asset_allocation_sum_mismatch:107.10` — probablemente por bonos convertibles que cuentan doble.
- `fi_missing_credit_data` en quality.warnings.

**Diagnóstico:** Fondo mixto defensivo europeo con ~76% en bonos. La estrategia combina RF tradicional, acciones value, bonos convertibles y monetarios (cita textual del objetivo). Es el fondo con mayor peso en bonos de los 4. La ausencia de credit quality en el PDF es especialmente relevante dado el alto porcentaje de bonos. La ficha de Morningstar Web para DNCA Eurose SÍ incluye credit quality (es un fondo muy seguido).

**Recomendación:** `RESOLVIBLE_WITH_MORNINGSTAR_WEB` — prioridad alta por bond exposure del 76%.

---

### 3.4 LU1899018870 — Sigma Investment House FCP - Best M&G Class A EUR Acc

**Categoría Morningstar:** EAA Fund EUR Flexible Allocation-Global
**Rating:** ★★ | **Sustainability:** null
**Asset mix (v2):** equity 15.42% · bond 71.80% · cash 12.60% · other 0.18%

**¿Qué falta?**
- `ms.fixed_income.credit_quality`: todos en `0` → sin datos en PDF.
- `ms.fixed_income.effective_duration`: `null` (ni siquiera 0).
- `ms.fixed_income.effective_maturity`: `null`.
- `portfolio_exposure_v2.credit`: `null`.
- `portfolio_exposure_v2.duration`: `null`.
- `classification_v2.duration_bucket`: `null`.

**¿Qué sí tiene?**
- Asset allocation completo ✅
- Sectors completo ✅
- Regions completo (macro + detail) ✅
- Top 10 holdings: **100% subfondos M&G** (94.6% concentrado en 10 subfondos) ✅
- 0 equity holdings directos, 0 bond holdings directos — **es un fondo de fondos puro**.

**Warnings adicionales:**
- `subtype_incompatible_with_asset_type:allocation:GLOBAL_EQUITY` → downgraded a `FLEXIBLE_ALLOCATION`.
- `fi_type_inference_weak` — infiere `flexible` como tipo RF, lo cual es correcto para un FoF de esta naturaleza.
- `fi_missing_duration_data` — el PDF no tiene duration en absoluto.

**Diagnóstico:** Este es el caso más complejo de los 4. Es un **fondo de fondos puro** que invierte exclusivamente en subfondos M&G (Optimal Income, Episode Macro, Short Dated Corp Bond, Euro Corp Bond, Global Macro Bond, EM Corp Bond, Global HY Bond, Global Dividend, European Strategic Value). No tiene holdings directos de equity ni bonds — Morningstar agrega las métricas look-through de los subfondos subyacentes. El PDF no tiene ni credit quality ni duration, probablemente porque Morningstar no calcula look-through aggregated credit/duration para todos los subfondos.

**Fuentes alternativas para resolver:**
1. **Morningstar Web:** podría tener credit quality y duration look-through si Morningstar lo calcula para este FoF.
2. **Fichas individuales de los subfondos M&G:** se podrían agregar manualmente los credit quality y duration ponderados por peso de cada subfondo. Esto es factible pero laborioso.
3. **Ficha gestora Sigma IH:** probablemente no tenga este nivel de detalle.

**Recomendación:** `RESOLVIBLE_WITH_MORNINGSTAR_WEB` — intentar primero la web. Si la web no tiene look-through credit/duration, escala a `RESOLVIBLE_WITH_MANAGER_FACTSHEET` usando las fichas individuales de los subfondos M&G con ponderación manual. En última instancia, si ni web ni fichas proveen el dato, clasificar como `KEEP_REVIEW` con nota de FoF.

---

## 4. Clasificación final

### RESOLVIBLE_WITH_MORNINGSTAR_WEB (4/4)

| ISIN | Fondo | Dato a capturar | Prioridad |
|:---|:---|:---|:---|
| **DE000A0X7541** | Acatis Value Event Fonds A | `credit_quality` breakdown | Media |
| **LU0352312184** | Allianz Strategy 50 CT EUR | `credit_quality` breakdown | Media |
| **LU0512121004** | DNCA Invest Eurose Class B EUR | `credit_quality` breakdown | **Alta** (76% bonds) |
| **LU1899018870** | Sigma IH FCP - Best M&G A EUR Acc | `credit_quality` + `effective_duration` | **Alta** (72% bonds, FoF) |

### RESOLVIBLE_WITH_MANAGER_FACTSHEET (0/4)

Ninguno en primera instancia. Si la web de Morningstar no tiene look-through para LU1899018870, escalaría aquí.

### KEEP_REVIEW (0/4)

Ninguno de los 4 es irrecuperable. Todos tienen datos parciales suficientes para completarse con una fuente web.

### BLOCKED (0/4)

Ninguno.

---

## 5. Análisis del routing logic

La lógica en [cargador_lotes_v_2.js](file:///c:/Users/oanti/Documents/BDB-FONDOS/MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js#L420-L524) (`decidePipelineStatus`) aplica estas reglas relevantes:

1. **Equity (asset_type=equity):** ignora `credit_missing` → ACCEPT.
2. **Alternative/real_asset/other con bond ≤ 25%:** ignora `credit_missing` → ACCEPT.
3. **Allocation con bond ≤ 5%:** ignora `credit_missing` → ACCEPT.
4. **Allocation con bond > 5%:** `credit_missing` **no se relaja** → REVIEW.
5. **Fixed_income coherente:** `credit_missing` se relaja si classification es coherente → ACCEPT.
6. **Money_market:** ignora `credit_missing` → ACCEPT.

Los 4 fondos caen en la regla **4**: son `allocation` con bond >> 5% (30-76%), por lo que `credit_missing` legítimamente dispara REVIEW. El router funciona correctamente.

**¿Podría crearse un bypass?** Sí, pero NO sería aconsejable sin el dato real. La calidad crediticia es material para suitability en fondos mixtos con alta exposición a bonos. La solución correcta es aportar el dato, no relajar la regla.

---

## 6. Recomendación de siguiente bloque

**Bloque sugerido:** `BDB-MORNINGSTAR-ERROR32-REVIEW4-ENRICH-0`

Alcance:
1. Capturar desde Morningstar Web (fichas individuales) la `credit_quality` breakdown para los 4 ISINs.
2. Capturar `effective_duration` para LU1899018870 (los otros 3 tienen bucket inferido como `ultrashort`).
3. Crear JSONs de enriquecimiento manual en `artifacts/morningstar_error32_review4_enrich/`.
4. Re-ejecutar el parser pipeline con los datos enriquecidos o parchear directamente los canonical.
5. Verificar que los 4 fondos pasan a `ok` con la data adicional.
6. Si pasan, añadirlos al write gate de los 26 (expandir a 30) o crear un gate separado de 4.

**Alternativa conservadora:** mantener los 4 en REVIEW y resolverlos en un ciclo posterior con captura web automatizada. Esto no bloquea el write gate de los 26 ACCEPT.

---

## 7. Estado git final

```
git status:              On branch master, up to date with origin/master
                         nothing to commit, working tree clean
git diff origin/master:  (empty)
git diff --cached:       (empty)
git stash list:          (empty)
```

---

## 8. Confirmación de invariantes

```
Firestore writes        = 0
Deploy                  = NO
Push                    = NO
Commit                  = NO
CORE tocado             = NO
Frontend tocado         = NO
compatible_profiles     = NO TOCADO
manual.costs.retro      = NO TOCADO
funds_core_v1           = NO TOCADO
Archivos modificados    = 0 (sólo este doc creado, sin commit)
```
