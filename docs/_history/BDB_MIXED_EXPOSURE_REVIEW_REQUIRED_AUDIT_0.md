# BDB-MIXED-EXPOSURE-REVIEW-REQUIRED-AUDIT-0

**Fecha:** 2026-05-10  
**HEAD:** `fd503e8`  
**Estado:** Auditoria read-only, NO write ejecutado  
**Firestore writes:** 0

---

## Confirmaciones de Seguridad

- Firestore write: **NO** | Deploy: **NO** | Codigo modificado: **NO**
- optimizer_core.py: **NO** | suitability_engine.py: **NO** | Frontend: **NO**
- Solo analisis del artifact dry-run existente

---

## 1. Resumen Low-Risk Completado

| Lote | ISINs | Estado | Commit |
|------|-------|--------|--------|
| Lote 1 | 5 | COMPLETADO | d9ca28f |
| Lote 2 | 10 | COMPLETADO | fd383c2 |
| Lote 3 | 15 | COMPLETADO | fd503e8 |
| **Total low-risk** | **30/60** | **100% low-risk DONE** | |

## 2. Los 29 Fondos Review Required

Ordenados por |delta_equity| descendente:

| # | ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd | MS Sum | Grupo |
|---|------|--------|---------|--------|--------|------|------|--------|-------|
| 1 | LU1594335520 | Allianz Dynamic MA SRI 75 AT | AGGRESSIVE | 80.0 | 0.0 | **-80.0** | +79.6 | 100.0 | D |
| 2 | ES0116848005 | Global Allocation R FI | FLEXIBLE | 50.0 | 0.0 | **-50.0** | +50.0 | 100.0 | B |
| 3 | LU0251119078 | Fidelity Target 2035 A | FLEXIBLE | 50.0 | 98.8 | **+48.8** | -49.9 | 100.0 | A |
| 4 | LU1899019175 | Sigma Smart Horizon A | FLEXIBLE | 50.0 | 96.1 | **+46.1** | -48.3 | 100.0 | A |
| 5 | ES0162305033 | Merch-Oportunidades FI | FLEXIBLE | 50.0 | 93.3 | **+43.3** | -50.0 | 107.2 | A |
| 6 | ES0131462022 | GB V Robotics R FI | FLEXIBLE | 50.0 | 89.7 | **+39.7** | -50.0 | 100.0 | A |
| 7 | ES0110407006 | GB VI Argos FI | FLEXIBLE | 50.0 | 87.8 | **+37.8** | -45.5 | 100.0 | A |
| 8 | LU1697018064 | Sigma Best Morgan Stanley A | FLEXIBLE | 50.0 | 86.6 | **+36.6** | -43.1 | 100.0 | A |
| 9 | ES0114904008 | Brightgate Focus A FI | FLEXIBLE | 50.0 | 85.6 | **+35.6** | -50.0 | 100.0 | A |
| 10 | LU1899018870 | Sigma Best M&G A | FLEXIBLE | 50.0 | 14.8 | **-35.2** | +24.1 | 100.0 | B |
| 11 | ES0118537002 | Olea Neutral FI | MODERATE | 50.0 | 15.5 | **-34.5** | +14.9 | 100.0 | B |
| 12 | LU2050544563 | DWS ESG Multi Asset Dynamic | FLEXIBLE | 50.0 | 76.1 | +26.1 | -32.1 | 100.0 | A |
| 13 | FR0013219243 | EdR Equity Euro Solve A | FLEXIBLE | 50.0 | 75.0 | +25.0 | -50.0 | 100.5 | A |
| 14 | LU0121216526 | GS Patrimonial Aggressive X | AGGRESSIVE | 80.0 | 56.5 | -23.5 | +3.9 | 107.2 | D |
| 15 | LU0284394821 | DNCA Invest Evolutif B | FLEXIBLE | 50.0 | 71.5 | +21.5 | -21.5 | 106.4 | A |
| 16 | LU0352312853 | Allianz Strategy 75 CT | AGGRESSIVE | 80.0 | 58.5 | -21.5 | +21.5 | 170.8 | D |
| 17 | FR0010306142 | Carmignac Patrimoine E | MODERATE | 50.0 | 29.1 | -20.9 | -50.0 | 141.3 | B |
| 18 | LU0048293368 | BL-Global 75 B | AGGRESSIVE | 80.0 | 59.1 | -20.9 | -11.8 | 100.0 | D |
| 19 | LU1697016365 | Sigma Selection Defensive A | CONSERVATIVE | 20.0 | 0.1 | -19.9 | +12.5 | 100.0 | D |
| 20 | LU1894680757 | Amundi Income Opportunities A2 | MODERATE | 50.0 | 30.3 | -19.7 | -12.7 | 100.0 | B |
| 21 | DE000A0X7541 | Acatis Value Event Fonds A | FLEXIBLE | 50.0 | 63.9 | +13.9 | -30.4 | 100.0 | A |
| 22 | LU1095739733 | First Eagle Amundi Income Builder | MODERATE | 50.0 | 61.9 | +11.9 | -29.1 | 100.0 | A |
| 23 | ES0138930005 | Fonvalcem B FI | AGGRESSIVE | 80.0 | 91.8 | +11.8 | -20.0 | 100.0 | C |
| 24 | LU1883330521 | Amundi Global Multi-Asset Target Inc | CONSERVATIVE | 20.0 | 31.7 | +11.7 | -29.5 | 101.0 | C |
| 25 | LU1883340322 | Amundi Pioneer Flexible Opp A | FLEXIBLE | 50.0 | 61.6 | +11.6 | -26.7 | 100.0 | A |
| 26 | LU0119195963 | GS Patrimonial Balanced P | MODERATE | 50.0 | 38.7 | -11.3 | -0.8 | 108.7 | B |
| 27 | DE000DWS17J0 | DWS ESG Dynamic Opportunities | AGGRESSIVE | 80.0 | 68.8 | -11.2 | -1.2 | 100.0 | C |
| 28 | LU1868537090 | DWS Invest ESG Dynamic Opp | AGGRESSIVE | 80.0 | 69.0 | -11.0 | -1.2 | 100.0 | C |
| 29 | LU1548496022 | Allianz Dynamic MA SRI 15 AT | CONSERVATIVE | 20.0 | 30.9 | +10.9 | -11.7 | 112.5 | C |

---

## 3. Clasificacion por Grupos

### Grupo A — FLEXIBLE 50/50 -> RV alta (>60%): 13 fondos

Fondos clasificados como FLEXIBLE_ALLOCATION con fallback 50/50, pero que segun Morningstar son predominantemente de renta variable (60-99%).

**Interpretacion:** El fallback 50/50 infravalora significativamente la exposicion a RV. Estos fondos invierten mayoritariamente en acciones. La correccion alinea la exposicion con la realidad del portfolio.

**Casos destacados:**
- **Fidelity Target 2035** (eq 50->98.8): Fondo target-date con horizonte largo, logicamente casi 100% RV
- **Sigma Smart Horizon** (eq 50->96.1): Mismo patron, horizonte largo
- **Merch-Oportunidades** (eq 50->93.3): Fondo oportunistico de RV
- **Brightgate Focus** (eq 50->85.6): Fondo de acciones concentrado

**Recomendacion: APPROVE** — Los datos MS son coherentes con las estrategias declaradas. La correccion mejora la precision del solver.

---

### Grupo B — FLEXIBLE/MODERATE 50/50 -> RV baja (<40%): 6 fondos

Fondos con fallback 50/50 que segun Morningstar son predominantemente de renta fija o mixtos defensivos.

**Casos destacados:**
- **Global Allocation R FI** (eq 50->0): Segun MS, 100% renta fija. Posible posicion defensiva temporal o fondo que cambio de estrategia.
- **Sigma Best M&G** (eq 50->14.8): Fondo que invierte via M&G, mayoritariamente RF
- **Olea Neutral** (eq 50->15.5): Fondo market-neutral, logicamente baja exposicion neta a RV
- **Carmignac Patrimoine** (eq 50->29.1): Patrimonio mixto defensivo, MS sum=141.3 (derivados). La normalizacion produce eq=29.1%

**Recomendacion: APPROVE** — Coherente con estrategias defensivas/neutral. Solo ES0116848005 (eq->0) merece atencion extra.

---

### Grupo C — Subtype-aligned o shift moderado: 5 fondos

Fondos donde el cambio es consistente con el subtype, solo que la magnitud supera 10pp.

- **Fonvalcem B** (AGGRESSIVE: 80->91.8): MS confirma mas agresivo de lo que indica 80/20
- **Amundi Global MA Target Inc** (CONSERVATIVE: 20->31.7): Algo mas de RV que el conservador tipico
- **DWS ESG Dynamic Opportunities** (AGGRESSIVE: 80->68.8): Ligeramente menos agresivo
- **DWS Invest ESG Dynamic Opp** (AGGRESSIVE: 80->69.0): Idem, version invest
- **Allianz Dynamic MA SRI 15** (CONSERVATIVE: 20->30.9): MS sum=112.5 (derivados), normalizado

**Recomendacion: APPROVE** — Todos coherentes.

---

### Grupo D — Extremos/anomalos: 5 fondos — REQUIEREN REVISION MANUAL

| ISIN | Nombre | Cambio | Problema | Recomendacion |
|------|--------|--------|----------|---------------|
| LU1594335520 | Allianz Dynamic MA SRI 75 AT | 80->0 | AGGRESSIVE con 0% equity segun MS. Posible posicion sintetica via derivados o error de datos MS. | **HOLD** |
| LU0121216526 | GS Patrimonial Aggressive X | 80->56.5 | AGGRESSIVE que baja a 56.5%. MS sum=107.2. Posible fondo multi-asset genuinamente diversificado. | **REVIEW_MANUAL** |
| LU0352312853 | Allianz Strategy 75 CT | 80->58.5 | MS sum=170.8 — fuerte apalancamiento. Normalizacion a 58.5/41.5. Coherente con estrategia 75 de Allianz pero la escala distorsiona. | **REVIEW_MANUAL** |
| LU0048293368 | BL-Global 75 B | 80->59.1 | AGGRESSIVE que baja a 59.1%. MS muestra other=22.6% (oro/commodities). Coherente con BL que invierte en oro. | **APPROVE** |
| LU1697016365 | Sigma Selection Defensive A | 20->0.1 | CONSERVATIVE con 0.1% equity. MS confirma 92.5% bond. Coherente con "Defensive". | **APPROVE** |

---

## 4. Top 10 por |delta_equity|

| # | ISIN | Nombre | d_Eq | Tipo Cambio | Recomendacion |
|---|------|--------|------|-------------|---------------|
| 1 | LU1594335520 | Allianz Dynamic MA SRI 75 | -80.0 | AGGRESSIVE->100% RF | **HOLD** |
| 2 | ES0116848005 | Global Allocation R FI | -50.0 | FLEXIBLE->100% RF | APPROVE |
| 3 | LU0251119078 | Fidelity Target 2035 | +48.8 | FLEXIBLE->~100% RV | APPROVE |
| 4 | LU1899019175 | Sigma Smart Horizon | +46.1 | FLEXIBLE->96% RV | APPROVE |
| 5 | ES0162305033 | Merch-Oportunidades | +43.3 | FLEXIBLE->93% RV | APPROVE |
| 6 | ES0131462022 | GB V Robotics R FI | +39.7 | FLEXIBLE->90% RV | APPROVE |
| 7 | ES0110407006 | GB VI Argos FI | +37.8 | FLEXIBLE->88% RV | APPROVE |
| 8 | LU1697018064 | Sigma Best Morgan Stanley | +36.6 | FLEXIBLE->87% RV | APPROVE |
| 9 | ES0114904008 | Brightgate Focus A FI | +35.6 | FLEXIBLE->86% RV | APPROVE |
| 10 | LU1899018870 | Sigma Best M&G | -35.2 | FLEXIBLE->15% RV | APPROVE |

---

## 5. Propuesta de Lote 4 (Primer Sublote Review Required)

Seleccion de **5 ISINs** del Grupo C (shift moderado, subtype-aligned) + 2 del Grupo D con APPROVE claro:

| # | ISIN | Nombre | d_Eq | MS Sum | Justificacion |
|---|------|--------|------|--------|---------------|
| 1 | ES0138930005 | Fonvalcem B FI | +11.8 | 100.0 | AGGRESSIVE 80->91.8, MS confirma mas agresivo |
| 2 | DE000DWS17J0 | DWS ESG Dynamic Opp | -11.2 | 100.0 | AGGRESSIVE 80->68.8, MS sum=100 exacto |
| 3 | LU1868537090 | DWS Invest ESG Dynamic Opp | -11.0 | 100.0 | AGGRESSIVE 80->69.0, MS sum=100 exacto |
| 4 | LU0048293368 | BL-Global 75 B | -20.9 | 100.0 | AGGRESSIVE 80->59.1, other=22.6% (oro) explicado |
| 5 | LU1697016365 | Sigma Selection Defensive | -19.9 | 100.0 | CONSERVATIVE 20->0.1, MS confirma 92.5% bond |

**Criterios:**
- MS sum = 100.0 (sin ambiguedad de escala/apalancamiento)
- El cambio es explicable por la estrategia declarada del fondo
- No hay contradiccion entre subtype y exposicion MS

---

## 6. ISINs en HOLD (no incluir en lote 4)

| ISIN | Nombre | Motivo |
|------|--------|--------|
| LU1594335520 | Allianz Dynamic MA SRI 75 AT | AGGRESSIVE con eq=0% segun MS. Anomalo. |
| LU0352312853 | Allianz Strategy 75 CT | MS sum=170.8. Apalancamiento extremo distorsiona. |

## 7. ISINs en REVIEW_MANUAL (evaluar para lote 5)

| ISIN | Nombre | Motivo |
|------|--------|--------|
| LU0121216526 | GS Patrimonial Aggressive X | AGGRESSIVE 80->56.5, MS sum=107.2 |
| FR0010306142 | Carmignac Patrimoine E | MS sum=141.3, derivados pesados |
| LU1548496022 | Allianz Dynamic MA SRI 15 AT | MS sum=112.5, normalizacion necesaria |

---

## 8. Confirmacion

- **0 Firestore writes**
- **0 lineas de codigo modificadas**
- Solo lectura del artifact dry-run y analisis

## 9. Recomendacion Final

| Accion | ISINs | Estado |
|--------|-------|--------|
| **Lote 4 (propuesto)** | 5 | APPROVE claro, listo para write gate |
| Lote 5 (Grupo A) | 13 | APPROVE, requiere gate separado |
| Lote 6 (Grupo B) | 6 | APPROVE, requiere gate separado |
| REVIEW_MANUAL | 3 | Evaluar individualmente |
| HOLD | 2 | No escribir hasta investigar |
| Sin datos MS | 1 | LU3038481936, mantiene fallback |
