# BDB_MIXED_EXPOSURE_OFFICIAL_FACTSHEET_AUDIT_0

**Fecha:** 2026-05-11
**Modo:** AUDITORÍA / DRY-RUN — SIN WRITES
**Fuente primaria:** Fichas oficiales de gestora (31/03/2026)
**Firestore writes:** 0
**Deploy:** NO
**Código modificado:** NO

---

## A. Resumen ejecutivo

Se auditan los **5 fondos MIXED pendientes** usando fichas oficiales de gestora como fuente primaria de exposición económica, tras comprobar que los datos de Morningstar (`ms.portfolio.asset_allocation`) son **defectuosos o no fiables** para estos fondos.

| Métrica | Valor |
|---------|-------|
| Fondos auditados | 5 |
| Fuente | Fichas oficiales de gestora (Q1 2026) |
| Recomendación APPROVE | **5/5** |
| Writes ejecutados | **0** |
| Hamco (LU3038481936) | **Excluido** — fondo nuevo sin datos |

### Hallazgo principal
Los datos MS fueron la causa de que estos 5 fondos quedaran como REVIEW_MANUAL o HOLD en la remediación automática. La auditoría con fichas oficiales confirma que **los 5 tienen asignación clara y documentada** que permite una corrección segura.

> **Caso más grave:** LU1594335520 (Allianz SRI 75) — MS muestra equity=0%, bond=100%. La ficha oficial confirma **91.10% RV**. El dato MS está completamente invertido.

---

## B. Tabla resumen

| # | ISIN | Nombre | Estado previo | Actual eq% | Propuesta eq% | Δ eq | Fuente | Recomendación |
|---|------|--------|--------------|-----------|--------------|------|--------|--------------|
| 1 | FR0010306142 | Carmignac Patrimoine E | REVIEW_MANUAL | 50.0 | **35.4** | -14.6pp | Ficha Carmignac | ✅ APPROVE |
| 2 | LU0121216526 | GS Patrimonial Aggressive X | REVIEW_MANUAL | 80.0 | **75.2** | -4.8pp | Ficha GS | ✅ APPROVE |
| 3 | LU0352312853 | Allianz Strategy 75 CT | HOLD | 80.0 | **86.0** | +6.0pp | Ficha Allianz | ✅ APPROVE |
| 4 | LU1594335520 | Allianz Dynamic MA SRI 75 AT | HOLD | 80.0 | **79.1** | -0.9pp | Ficha Allianz | ✅ APPROVE |
| 5 | LU1548496022 | Allianz Dynamic MA SRI 15 AT | REVIEW_MANUAL | 20.0 | **24.6** | +4.6pp | Ficha Allianz | ✅ APPROVE |

---

## C. Análisis individual

### 1. FR0010306142 — Carmignac Patrimoine E EUR Acc

**Categoría:** MIXED / MODERATE_ALLOCATION
**Ficha:** MR_ES_es_FR0010306142_RES_2026-03-31.pdf

#### Datos ficha oficial
| Concepto | Valor |
|----------|-------|
| Exposición neta RV | 35.4% |
| Tasa de inversión RV | 38.8% |
| Renta fija | 46.8% |
| Monetario | 5.1% |
| Efectivo/tesorería/derivados | 9.3% |

#### Problema con datos MS
```
MS:    equity=41.17  bond=0.00   cash=100.00  other=0.09  sum=141.26
Ficha: equity=35.4   bond=46.8   cash=5.1     other=12.7
```
MS clasifica **toda la RF como cash** (cash=100). Esto produce bond=0, lo cual es absurdo para un fondo patrimonial que tiene 46.8% en renta fija según la gestora. La propuesta automática (eq=29.1, bond=0, cash=70.8) habría sido incorrecta.

#### Propuesta basada en ficha
```json
{"equity": 35.4, "bond": 46.8, "cash": 5.1, "other": 12.7}
```

#### Normalización
Se usa exposición neta de la ficha. La suma (96.6%) se completa asignando el residuo (efectivo/derivados) a `other` (instrumentos derivados y ajustes de cobertura). Total = 100.0.

#### Impacto suitability
eq 50.0 → 35.4 (-14.6pp). **Moderado.** El fondo pasa de perfil genérico 50/50 a perfil más defensivo, coherente con el carácter patrimonial de Carmignac Patrimoine.

#### Recomendación: **APPROVE_OFFICIAL_FACTSHEET**

---

### 2. LU0121216526 — Goldman Sachs Patrimonial Aggressive X Cap EUR

**Categoría:** MIXED / AGGRESSIVE_ALLOCATION
**Ficha:** MR_ES_es_LU0121216526_YES_2026-03-31.pdf

#### Datos ficha oficial
| Concepto | Valor |
|----------|-------|
| Renta variable | 75.15% |
| Renta fija | 24.89% |
| Liquidez | 1.88% |
| Efectivo sintético | -1.92% |
| Benchmark | 75% RV / 25% RF |

#### Problema con datos MS
```
MS:    equity=60.49  bond=25.62  cash=0.00  other=21.04  sum=107.15
Ficha: equity=75.15  bond=24.89  cash=0.0   other=0.0
```
MS infravalora equity en 15pp (60.49 vs 75.15) y asigna 21% a `other` sin justificación clara. Probablemente MS clasifica parte de las posiciones en equity (fondos indexados, ETFs) como "other".

#### Propuesta basada en ficha
```json
{"equity": 75.2, "bond": 24.9, "cash": 0.0, "other": 0.0}
```

#### Normalización
Efectivo sintético (-1.92%) se netea con liquidez (1.88%), resultado ≈ 0%. Equity 75.15 + Bond 24.89 = 100.04, redondeado a 75.2/24.9.

#### Impacto suitability
eq 80.0 → 75.2 (-4.8pp). **Bajo.** El fondo se confirma como agresivo, alineado con su benchmark 75/25. El fallback 80/20 era cercano pero ligeramente alto.

#### Recomendación: **APPROVE_OFFICIAL_FACTSHEET**

---

### 3. LU0352312853 — Allianz Strategy 75 CT EUR

**Categoría:** MIXED / AGGRESSIVE_ALLOCATION
**Ficha:** MR_ES_en_LU0352312853_RES_2026-03-31.pdf

#### Datos ficha oficial
| Concepto | Valor |
|----------|-------|
| Global Equity | 86.12% |
| Euroland Fixed Income | 14.03% |
| Objetivo | ~75% acciones internacionales / 25% bonos euro |

#### Problema con datos MS — EL MÁS GRAVE
```
MS:    equity=100.00  bond=70.81  cash=0.00  other=0.00  sum=170.81
Ficha: equity=86.12   bond=14.03  cash=0.0   other=0.0
```
MS sum=170.81: **apalancamiento extremo.** MS parece capturar exposición bruta (equity 100% + bond 70.81%) en lugar de neta. La normalización automática (58.5/41.5) era incorrecta. La ficha confirma 86/14 neto, coherente con un fondo que sobre-pondera equity vs su objetivo del 75%.

#### Propuesta basada en ficha
```json
{"equity": 86.0, "bond": 14.0, "cash": 0.0, "other": 0.0}
```

#### Normalización
Ficha 86.12 + 14.03 = 100.15. Redondeado a 86.0/14.0 = 100.0.

#### Impacto suitability
eq 80.0 → 86.0 (+6.0pp). **Bajo.** El fondo se confirma como más agresivo de lo que sugiere el fallback 80/20, coherente con la sobre-ponderación actual de equity.

#### Recomendación: **APPROVE_OFFICIAL_FACTSHEET**

---

### 4. LU1594335520 — Allianz Dynamic Multi Asset Strategy SRI 75 AT EUR

**Categoría:** MIXED / AGGRESSIVE_ALLOCATION
**Ficha:** MR_ES_es_LU1594335520_YES_2026-03-31.pdf

#### Datos ficha oficial
| Concepto | Valor |
|----------|-------|
| Renta variable | 91.10% |
| Bonos | 11.71% |
| Materias primas | 10.19% |
| Alternativos | 2.16% |
| Suma bruta | 115.16% |
| Objetivo | 75% acciones / 25% bonos cubiertos EUR |

#### Problema con datos MS — ERROR DE INVERSIÓN COMPLETA
```
MS:    equity=0.00   bond=99.59  cash=0.41  other=0.00  sum=100.00
Ficha: equity=91.10  bond=11.71  cash=0.0   other=12.35
```
**MS muestra equity=0% y bond=100%. La ficha oficial confirma 91.10% RV.** Esto es un error de clasificación severo de Morningstar: MS clasifica los derivados de equity (futuros, swaps) como instrumentos de renta fija por su estructura legal. La propuesta automática anterior (eq=0, bond=99.6) habría sido **catastrófica para suitability** — convertiría un fondo agresivo en uno ultraconservador.

#### Propuesta basada en ficha
```json
{"equity": 79.1, "bond": 10.2, "cash": 0.0, "other": 10.7}
```

#### Normalización
Suma bruta = 115.16%. Se normaliza proporcionalmente:
- equity: 91.10 / 115.16 × 100 = 79.1
- bond: 11.71 / 115.16 × 100 = 10.2
- other: (10.19 + 2.16) / 115.16 × 100 = 10.7

#### Impacto suitability
eq 80.0 → 79.1 (-0.9pp). **Mínimo.** El dato más importante es que este fondo **NO** es bond-dominated como sugiere MS. Es equity-dominated, confirmado por la ficha oficial. El fallback 80/20 era casi correcto.

#### Recomendación: **APPROVE_OFFICIAL_FACTSHEET**

---

### 5. LU1548496022 — Allianz Dynamic Multi Asset Strategy SRI 15 AT EUR

**Categoría:** MIXED / CONSERVATIVE_ALLOCATION
**Ficha:** MR_ES_es_LU1548496022_YES_2026-03-31.pdf

#### Datos ficha oficial
| Concepto | Valor |
|----------|-------|
| Renta variable | 25.89% |
| Bonos | 67.79% |
| Materias primas | 8.76% |
| Alternativos | 2.77% |
| Suma bruta | 105.21% |
| Objetivo | 15% acciones / 85% bonos |

#### Problema con datos MS
```
MS:    equity=34.78  bond=76.91  cash=0.00  other=0.85  sum=112.54
Ficha: equity=25.89  bond=67.79  cash=0.0   other=11.53
```
MS sobreestima equity (+9pp) y bond (+9pp), y no captura commodities/alternativos (other=0.85 vs 11.53 real). El sesgo es moderado pero suficiente para distorsionar la propuesta automática (eq=30.9 vs 25.89 real).

#### Propuesta basada en ficha
```json
{"equity": 24.6, "bond": 64.4, "cash": 0.0, "other": 11.0}
```

#### Normalización
Suma bruta = 105.21%. Se normaliza proporcionalmente:
- equity: 25.89 / 105.21 × 100 = 24.6
- bond: 67.79 / 105.21 × 100 = 64.4
- other: (8.76 + 2.77) / 105.21 × 100 = 11.0

#### Impacto suitability
eq 20.0 → 24.6 (+4.6pp). **Bajo.** El fondo se confirma como conservador, ligeramente sobre-ponderado en RV vs su objetivo del 15%, pero dentro de rangos normales de gestión activa.

#### Recomendación: **APPROVE_OFFICIAL_FACTSHEET**

---

## D. Diferencias críticas: MS vs Ficha Oficial

### Casos donde MS automático era ERRÓNEO

| ISIN | Fondo | MS equity | Ficha equity | Error MS | Gravedad |
|------|-------|-----------|-------------|----------|----------|
| LU1594335520 | Allianz SRI 75 | **0.0%** | **91.10%** | -91.1pp | 🔴 **CRÍTICO** — inversión completa |
| FR0010306142 | Carmignac Patrimoine | 41.17% | 35.4% | +5.8pp | 🟡 Moderado — pero bond=0 es grave |
| LU0352312853 | Allianz Strategy 75 | 100.0% | 86.12% | +13.9pp | 🟡 sum=170 hace normalización inservible |
| LU0121216526 | GS Aggressive | 60.49% | 75.15% | -14.7pp | 🟡 Infravalora equity significativamente |
| LU1548496022 | Allianz SRI 15 | 34.78% | 25.89% | +8.9pp | 🟡 Sobreestima equity |

### Tipos de error MS detectados

1. **Inversión completa** (LU1594335520): MS clasifica derivados de equity como RF → equity=0 cuando debería ser ~91%.
2. **RF como cash** (FR0010306142): MS clasifica toda la RF (46.8%) como cash → bond=0, cash=100.
3. **Apalancamiento no normalizable** (LU0352312853): MS sum=170.81 → normalización mecánica produce resultado sin sentido (58.5/41.5 vs 86/14 real).
4. **Infraestimación de equity** (LU0121216526): MS coloca 21% en `other` que debería ser equity.
5. **Distorsión moderada** (LU1548496022): MS sobreestima ambos equity y bond, no captura commodities.

### Conclusión
Para estos 5 fondos, **la ficha oficial de gestora es la única fuente fiable**. Los datos MS son defectuosos por la naturaleza de los instrumentos (derivados, futuros, swaps) que Morningstar no clasifica correctamente en su schema de asset allocation.

---

## E. Recomendación de siguiente fase

### Gate 8 propuesto
Los 5 fondos tienen recomendación **APPROVE_OFFICIAL_FACTSHEET** con deltas controlados:

| ISIN | Δ equity | Riesgo |
|------|---------|--------|
| FR0010306142 | -14.6pp | Moderado |
| LU0121216526 | -4.8pp | Bajo |
| LU0352312853 | +6.0pp | Bajo |
| LU1594335520 | -0.9pp | Mínimo |
| LU1548496022 | +4.6pp | Bajo |

**Recomendación:**
1. **Preparar gate 8** con los 5 ISINs, usando `source_used: official_factsheet`.
2. **Confidence propuesta: 0.90** (superior a 0.85 de MS porque la ficha oficial es fuente primaria del gestor).
3. **Warning: `EXPOSURE_SOURCE_OFFICIAL_FACTSHEET`** en lugar de `EXPOSURE_SOURCE_MS_PORTFOLIO`.
4. Ejecutar write controlado con las mismas garantías de lotes anteriores.
5. **Mantener LU3038481936 (Hamco) excluido** — sin datos de ninguna fuente.

### Resultado esperado post-gate-8
- **59/60 MIXED corregidos** (98.3%)
- Solo LU3038481936 Hamco pendiente (sin datos)
- Remediación completa a efectos prácticos

---

## F. Confirmaciones

| Check | Estado |
|-------|--------|
| Firestore writes | **0** — solo lectura |
| Deploy | **NO** |
| Código modificado | **NO** |
| Campos prohibidos | **NO TOCADOS** |
| Hamco LU3038481936 | **EXCLUIDO** |
| Fichas oficiales consultadas | 5/5 |
| Propuestas documentadas | 5/5 |
| Recomendaciones APPROVE | 5/5 |
