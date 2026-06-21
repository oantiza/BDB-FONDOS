# BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_8_OFFICIAL_FACTSHEET

**Fecha:** 2026-05-11
**Modo:** CONTROLLED WRITE — 5 fondos con ficha oficial de gestora
**Fuente:** official_factsheet (Q1 2026)
**Firestore writes:** 5
**Post-verification:** 5/5 PASS
**Tests:** 62/62 PASS
**Deploy:** NO
**Código modificado:** NO

---

## ISINs escritos

| # | ISIN | Nombre | Old eq% | New eq% | Δ eq | Fuente | Verificación |
|---|------|--------|---------|---------|------|--------|-------------|
| 1 | FR0010306142 | Carmignac Patrimoine E | 50.0 | 35.4 | -14.6pp | Ficha Carmignac | ✅ PASS |
| 2 | LU0121216526 | GS Patrimonial Aggressive X | 80.0 | 75.2 | -4.8pp | Ficha GS | ✅ PASS |
| 3 | LU0352312853 | Allianz Strategy 75 CT | 80.0 | 86.0 | +6.0pp | Ficha Allianz | ✅ PASS |
| 4 | LU1594335520 | Allianz Dynamic MA SRI 75 AT | 80.0 | 79.1 | -0.9pp | Ficha Allianz | ✅ PASS |
| 5 | LU1548496022 | Allianz Dynamic MA SRI 15 AT | 20.0 | 24.6 | +4.6pp | Ficha Allianz | ✅ PASS |

---

## Valores escritos completos

| ISIN | equity | bond | cash | other | conf | warning |
|------|--------|------|------|-------|------|---------|
| FR0010306142 | 35.4 | 46.8 | 5.1 | 12.7 | 0.90 | EXPOSURE_SOURCE_OFFICIAL_FACTSHEET |
| LU0121216526 | 75.2 | 24.9 | 0.0 | 0.0 | 0.90 | EXPOSURE_SOURCE_OFFICIAL_FACTSHEET |
| LU0352312853 | 86.0 | 14.0 | 0.0 | 0.0 | 0.90 | EXPOSURE_SOURCE_OFFICIAL_FACTSHEET |
| LU1594335520 | 79.1 | 10.2 | 0.0 | 10.7 | 0.90 | EXPOSURE_SOURCE_OFFICIAL_FACTSHEET |
| LU1548496022 | 24.6 | 64.4 | 0.0 | 11.0 | 0.90 | EXPOSURE_SOURCE_OFFICIAL_FACTSHEET |

---

## Por qué ficha oficial y no Morningstar

Estos 5 fondos fueron excluidos de los lotes automáticos (1-7) porque los datos MS eran defectuosos:

| ISIN | Error MS |
|------|---------|
| FR0010306142 | bond=0, cash=100 (real: bond=46.8) |
| LU0121216526 | eq=60.5, other=21 (real: eq=75.2) |
| LU0352312853 | sum=170.81, normalización inservible |
| LU1594335520 | eq=0, bond=100 (real: eq=91.1 → **inversión completa**) |
| LU1548496022 | eq=34.8 (real: eq=25.9), commodities no capturadas |

---

## Campos prohibidos — intactos

| Campo | 5/5 intacto |
|-------|------------|
| manual | ✅ |
| manual.costs | ✅ |
| manual.costs.retrocession | ✅ |
| classification_v2 | ✅ |
| ms | ✅ |
| derived | ✅ |
| std_perf | ✅ |

---

## Tests

```
62 passed in 1.80s

- test_mixed_exposure_ms_portfolio.py: 11/11 PASSED
- test_mixed_funds_lookthrough_contract.py: 4/4 PASSED
- test_suitability_v2.py: 47/47 PASSED
```

---

## Excluido

| ISIN | Nombre | Motivo |
|------|--------|--------|
| LU3038481936 | Hamco Global Value R | Fondo nuevo, sin datos MS ni ficha oficial |

---

## Progreso final

| Lote | Count | Tipo | Fuente | Commit |
|------|-------|------|--------|--------|
| 1 | 10 | Low-risk | MS portfolio | d9ca28f |
| 2 | 5 | Low-risk | MS portfolio | fd383c2 |
| 3 | 15 | Low-risk | MS portfolio | fd503e8 |
| 4 | 5 | Review-required | MS portfolio | a17ff30 |
| 5 | 5 | Review-required | MS portfolio | b044d20 |
| 6 | 5 | Review-required (high-delta) | MS portfolio | 17e23fa |
| 7 | 9 | Review-required (ALL APPROVE) | MS portfolio | 84c9ec4 |
| 8 | 5 | Official factsheet | Fichas gestora | TBD |
| **Total** | **59/60** | | | **98.3%** |

### Pendiente (1 fondo)

| ISIN | Nombre | Estado |
|------|--------|--------|
| LU3038481936 | Hamco Global Value R | Sin datos — fondo nuevo |

---

## Rollback

Disponible en `write_gate_8_official_factsheet/rollback_manifest.json` para los 5 fondos.
