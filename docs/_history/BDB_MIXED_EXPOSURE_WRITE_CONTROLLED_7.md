# BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_7

**Fecha:** 2026-05-11
**Modo:** CONTROLLED WRITE — 9 fondos review_required APPROVE
**Firestore writes:** 9
**Post-verification:** 9/9 PASS
**Tests:** 62/62 PASS

---

## Confirmaciones de Seguridad

- Firestore write: **SÍ** (9 documentos, solo `portfolio_exposure_v2`)
- Deploy: **NO**
- Código runtime modificado: **NO**
- optimizer_core.py: **NO**
- suitability_engine.py: **NO**
- Frontend: **NO**
- firestore.rules: **NO**

---

## 1. ISINs escritos

| # | ISIN | Nombre | Subtype | Old eq% | New eq% | Δ eq | MS sum | Verificación |
|---|------|--------|---------|---------|---------|------|--------|-------------|
| 1 | ES0116848005 | Global Allocation R FI | FLEXIBLE | 50.0 | 0.0 | -50.0pp | 100.0 | ✅ PASS |
| 2 | LU0251119078 | Fidelity Target™ 2035 A-Acc-EUR | FLEXIBLE | 50.0 | 98.8 | +48.8pp | 100.0 | ✅ PASS |
| 3 | LU1899019175 | Sigma Smart Horizon A EUR | FLEXIBLE | 50.0 | 96.1 | +46.1pp | 99.99 | ✅ PASS |
| 4 | ES0162305033 | Merch-Oportunidades FI | FLEXIBLE | 50.0 | 93.3 | +43.3pp | 107.17 | ✅ PASS |
| 5 | ES0131462022 | GB V Robotics R FI | FLEXIBLE | 50.0 | 89.7 | +39.7pp | 100.01 | ✅ PASS |
| 6 | ES0110407006 | Gestión Boutique VI Argos FI | FLEXIBLE | 50.0 | 87.8 | +37.8pp | 100.01 | ✅ PASS |
| 7 | LU1697018064 | Sigma Best Morgan Stanley A EUR | FLEXIBLE | 50.0 | 86.6 | +36.6pp | 100.0 | ✅ PASS |
| 8 | LU1899018870 | Sigma Best M&G A EUR | FLEXIBLE | 50.0 | 14.8 | -35.2pp | 100.0 | ✅ PASS |
| 9 | FR0013219243 | EdR Equity Euro Solve A EUR | FLEXIBLE | 50.0 | 75.0 | +25.0pp | 100.55 | ✅ PASS |

---

## 2. Rationale por ISIN (todos HIGH-DELTA > 20pp)

### ES0116848005 — Global Allocation R FI (Δ = -50.0pp)
FLEXIBLE 50→0% equity. MS muestra 100% bond puro, sum=100.0. Posición defensiva total / RF pura. El fallback 50/50 no reflejaba la realidad del portfolio.

### LU0251119078 — Fidelity Target™ 2035 (Δ = +48.8pp)
FLEXIBLE 50→98.8% equity. Fondo target-date 2035, fase de acumulación = ~100% RV. Lógico y coherente con la estrategia.

### LU1899019175 — Sigma Smart Horizon (Δ = +46.1pp)
FLEXIBLE 50→96.1% equity. Horizonte largo, crecimiento. MS sum=99.99. Nombre confirma estrategia growth.

### ES0162305033 — Merch-Oportunidades FI (Δ = +43.3pp)
FLEXIBLE 50→93.3% equity. Oportunístico de RV. MS sum=107.17 normalizado. Nombre "Oportunidades" confirma RV activa.

### ES0131462022 — GB V Robotics R FI (Δ = +39.7pp)
FLEXIBLE 50→89.7% equity. Temático de robótica = RV sectorial de facto. MS sum=100.01.

### ES0110407006 — GB VI Argos FI (Δ = +37.8pp)
FLEXIBLE 50→87.8% equity. Alta convicción value, equity-focused. MS sum=100.01.

### LU1697018064 — Sigma Best Morgan Stanley (Δ = +36.6pp)
FLEXIBLE 50→86.6% equity. Feeder de fondos MS growth-oriented. MS sum=100.0.

### LU1899018870 — Sigma Best M&G (Δ = -35.2pp)
FLEXIBLE 50→14.8% equity. Feeder M&G con fuerte sesgo RF (74.1% bond). MS sum=100.0.

### FR0013219243 — EdR Equity Euro Solve (Δ = +25.0pp)
FLEXIBLE 50→75.0% equity. "Equity Euro Solve" = RV + 24.9% cash táctico. MS sum=100.55.

---

## 3. Guards ejecutados

| Guard | Resultado |
|-------|-----------|
| Approval manifest authorized=true, can_write=true | ✅ |
| selected_count=9, ISINs match | ✅ |
| No overlap con lotes 1-6 (45 ISINs previos) | ✅ |
| No REVIEW_MANUAL, HOLD/BLOCK, LU3038481936 | ✅ |
| Proposed values: no null/NaN/negative | ✅ |
| Proposed sums en [95,105] | ✅ |
| source_used = ms_portfolio_asset_allocation | ✅ |
| Pre-write drift check: 9/9 at 50/50 conf=0.45 | ✅ |
| Post-write verification: 9/9 PASS | ✅ |

---

## 4. Campos prohibidos — intactos

Para los 9 ISINs se verificó post-write:

| Campo | Intacto |
|-------|---------|
| manual | ✅ |
| manual.costs | ✅ |
| manual.costs.retrocession | ✅ |
| classification_v2 | ✅ |
| ms | ✅ |
| derived | ✅ |
| std_perf | ✅ |

---

## 5. Tests

```
62 passed in 1.68s

- test_mixed_exposure_ms_portfolio.py: 11/11 PASSED
- test_mixed_funds_lookthrough_contract.py: 4/4 PASSED
- test_suitability_v2.py: 47/47 PASSED
```

---

## 6. Progreso final

| Lote | Count | Tipo | Estado | Commit |
|------|-------|------|--------|--------|
| 1 | 10 | Low-risk | ✅ Complete | d9ca28f |
| 2 | 5 | Low-risk | ✅ Complete | fd383c2 |
| 3 | 15 | Low-risk | ✅ Complete | fd503e8 |
| 4 | 5 | Review-required | ✅ Complete | a17ff30 |
| 5 | 5 | Review-required | ✅ Complete | b044d20 |
| 6 | 5 | Review-required (high-delta) | ✅ Complete | 17e23fa |
| 7 | 9 | Review-required (ALL remaining APPROVE) | ✅ Complete | TBD |
| **Total** | **54/60** | | **90% complete** | |

### Restante (6 fondos):

| ISIN | Nombre | Estado |
|------|--------|--------|
| LU0121216526 | GS Patrimonial Aggressive X | REVIEW_MANUAL |
| FR0010306142 | Carmignac Patrimoine E | REVIEW_MANUAL |
| LU1548496022 | Allianz Dynamic MA SRI 15 AT | REVIEW_MANUAL |
| LU1594335520 | Allianz Dynamic MA SRI 75 AT | HOLD |
| LU0352312853 | Allianz Strategy 75 CT | HOLD |
| LU3038481936 | Hamco Global Value R | Sin datos MS |
