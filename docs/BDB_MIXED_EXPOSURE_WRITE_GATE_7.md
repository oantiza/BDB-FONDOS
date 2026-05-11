# BDB_MIXED_EXPOSURE_WRITE_GATE_7

## Summary

Write gate 7: ALL 9 remaining review-required APPROVE candidates.
**HIGH-DELTA BATCH**: All 9 funds have |Δ equity| > 20 pp.

- **Date**: 2026-05-11
- **ISINs selected**: 9
- **Mode**: DRY-RUN — NO WRITES EXECUTED
- **authorized**: false
- **can_write**: false

## Progress

| Batch | Count | Type | Status |
|-------|-------|------|--------|
| 1 | 10 | Low-risk | ✅ Complete |
| 2 | 5 | Low-risk | ✅ Complete |
| 3 | 15 | Low-risk | ✅ Complete |
| 4 | 5 | Review-required | ✅ Complete |
| 5 | 5 | Review-required | ✅ Complete |
| 6 | 5 | Review-required (high-delta) | ✅ Complete |
| **7** | **9** | **Review-required (ALL remaining APPROVE)** | **⏳ Pending approval** |
| **Total after gate 7** | **54/60** | | |

### After gate 7, remaining (6 funds):
- 3 REVIEW_MANUAL: LU0121216526, FR0010306142, LU1548496022
- 2 HOLD: LU1594335520, LU0352312853
- 1 sin MS: LU3038481936

## Selected ISINs — Full Table

| # | ISIN | Fund Name | Subtype | Old eq% | New eq% | Δ equity | MS sum | Group |
|---|------|-----------|---------|---------|---------|----------|--------|-------|
| 1 | ES0116848005 | Global Allocation R FI | FLEXIBLE | 50.0 | 0.0 | **-50.0pp** | 100.0 | B |
| 2 | LU0251119078 | Fidelity Target™ 2035 A-Acc-EUR | FLEXIBLE | 50.0 | 98.8 | **+48.8pp** | 100.0 | A |
| 3 | LU1899019175 | Sigma Smart Horizon A EUR | FLEXIBLE | 50.0 | 96.1 | **+46.1pp** | 99.99 | A |
| 4 | ES0162305033 | Merch-Oportunidades FI | FLEXIBLE | 50.0 | 93.3 | **+43.3pp** | 107.17 | A |
| 5 | ES0131462022 | Gestión Boutique V Robotics R FI | FLEXIBLE | 50.0 | 89.7 | **+39.7pp** | 100.01 | A |
| 6 | ES0110407006 | Gestión Boutique VI Argos FI | FLEXIBLE | 50.0 | 87.8 | **+37.8pp** | 100.01 | A |
| 7 | LU1697018064 | Sigma Best Morgan Stanley A EUR | FLEXIBLE | 50.0 | 86.6 | **+36.6pp** | 100.0 | A |
| 8 | LU1899018870 | Sigma Best M&G A EUR | FLEXIBLE | 50.0 | 14.8 | **-35.2pp** | 100.0 | B |
| 9 | FR0013219243 | EdR Equity Euro Solve A EUR | FLEXIBLE | 50.0 | 75.0 | **+25.0pp** | 100.55 | A |

## Rationale por ISIN

### ES0116848005 — Global Allocation R FI (Δ = -50.0pp)
FLEXIBLE con eq 50→0%. MS muestra 100% bond, sum=100.0. Posible posición defensiva total o fondo que opera vía derivados con exposición neta cero a RV. El dato MS es limpio (sum=100) y coherente con una posición de RF pura. **APPROVE** — el fallback 50/50 no refleja la realidad.

### LU0251119078 — Fidelity Target™ 2035 (Δ = +48.8pp)
FLEXIBLE con eq 50→98.8%. Fondo target-date con horizonte 2035, lógicamente casi 100% RV en la fase de acumulación. MS sum=100.0. **APPROVE** — coherente con la estrategia target-date.

### LU1899019175 — Sigma Smart Horizon (Δ = +46.1pp)
FLEXIBLE con eq 50→96.1%. Fondo con horizonte largo, MS sum=99.99. Predominio total de RV. **APPROVE** — coherente con "Smart Horizon" = crecimiento a largo plazo.

### ES0162305033 — Merch-Oportunidades FI (Δ = +43.3pp)
FLEXIBLE con eq 50→93.3%. MS sum=107.17 (ligero leverage). Fondo oportunístico de RV concentrado. Normalización razonable. **APPROVE** — el nombre "Oportunidades" confirma estrategia de RV activa.

### ES0131462022 — GB V Robotics R FI (Δ = +39.7pp)
FLEXIBLE con eq 50→89.7%. Fondo temático de robótica, esencialmente un fondo de acciones tecnológicas. MS sum=100.01. **APPROVE** — "Robotics" = RV sectorial.

### ES0110407006 — GB VI Argos FI (Δ = +37.8pp)
FLEXIBLE con eq 50→87.8%. Fondo de alta convicción con enfoque value. MS sum=100.01. **APPROVE** — fondo equity-focused clasificado como flexible.

### LU1697018064 — Sigma Best Morgan Stanley (Δ = +36.6pp)
FLEXIBLE con eq 50→86.6%. Feeder de fondos Morgan Stanley, predominantemente equity. MS sum=100.0. **APPROVE** — coherente con cartera MS growth-oriented.

### LU1899018870 — Sigma Best M&G (Δ = -35.2pp)
FLEXIBLE con eq 50→14.8%. Feeder de fondos M&G, predominantemente RF (74.1% bond). MS sum=100.0. **APPROVE** — M&G tiene fuerte sesgo RF, coherente.

### FR0013219243 — EdR Equity Euro Solve A (Δ = +25.0pp)
FLEXIBLE con eq 50→75.0%. "Equity Euro Solve" — nombre confirma estrategia equity. MS sum=100.55 (negligible). 24.9% cash como colchón táctico. **APPROVE** — coherente.

## Por qué estos 9 y no los restantes 6

Los 6 restantes NO se incluyen por:

| ISIN | Nombre | Motivo exclusión |
|------|--------|------------------|
| LU1594335520 | Allianz Dynamic MA SRI 75 AT | **HOLD** — AGGRESSIVE con eq=0% según MS. Anomalía inexplicable. |
| LU0352312853 | Allianz Strategy 75 CT | **HOLD** — MS sum=170.8, apalancamiento extremo distorsiona normalización. |
| LU0121216526 | GS Patrimonial Aggressive X | **REVIEW_MANUAL** — AGGRESSIVE 80→56.5%, MS sum=107.2. |
| FR0010306142 | Carmignac Patrimoine E | **REVIEW_MANUAL** — MS sum=141.3, derivados pesados. |
| LU1548496022 | Allianz Dynamic MA SRI 15 AT | **REVIEW_MANUAL** — MS sum=112.5, normalización cuestionable. |
| LU3038481936 | Hamco Global Value R | **Sin datos MS** — mantiene fallback. |

## Campos que se actualizarían

Per ISIN (sólo si se aprueba):
- `portfolio_exposure_v2.economic_exposure` → valores MS-derived
- `portfolio_exposure_v2.exposure_confidence` → 0.85
- `portfolio_exposure_v2.warnings` → `["EXPOSURE_SOURCE_MS_PORTFOLIO"]`
- `portfolio_exposure_v2.computed_at` → timestamp del write

## Campos que NO se tocarían

- ❌ `manual` / `manual.costs` / `manual.costs.retrocession`
- ❌ `classification_v2`
- ❌ `ms`
- ❌ `derived`
- ❌ `std_perf`
- ❌ `firestore.rules`
- ❌ Código runtime (optimizer, suitability, frontend)

## Confirmación

- **Firestore writes**: 0
- **Deploy**: NO
- **Código modificado**: NO (solo scripts de mantenimiento y artifacts)

## Artifacts generados

```
artifacts/bdb_mixed_exposure_fix/write_gate_7/
├── selection.json              — ISINs seleccionados con rationale
├── snapshots_before.json       — Estado actual de Firestore (live)
├── diff_manifest.json          — Cambios propuestos con deltas
├── rollback_manifest.json      — Valores originales para rollback
└── write_approval_manifest.json — LOCKED (authorized=false, can_write=false)
```

## Recomendación

**APROBAR** — Los 9 fondos tienen:
- Source = `ms_portfolio_asset_allocation` con sums ~100%
- Cambios explicables por el nombre/estrategia del fondo
- Sin anomalías de escala (el mayor MS sum es 107.17, normalización razonable)
- Rationale documentada por ISIN
- Rollback disponible
- Todos los fondos del Grupo A (equity-heavy flexible) y Grupo B (defensive flexible) del audit original
