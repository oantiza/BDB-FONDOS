# BDB_MIXED_EXPOSURE_WRITE_GATE_8_OFFICIAL_FACTSHEET

**Fecha:** 2026-05-11
**Modo:** GATE PREPARATION — SIN WRITES
**Fuente:** Fichas oficiales de gestora (Q1 2026)
**Firestore writes:** 0
**Deploy:** NO
**Código modificado:** NO
**authorized:** false
**can_write:** false

---

## Resumen

Gate 8 preparado para **5 fondos MIXED pendientes** cuya exposición económica se ha auditado con fichas oficiales de gestora en lugar de datos Morningstar (defectuosos para estos fondos).

### Por qué NO se usa Morningstar para estos 5

| ISIN | Problema MS | Detalle |
|------|------------|---------|
| FR0010306142 | RF clasificada como cash | MS: bond=0, cash=100 — real: bond=46.8 |
| LU0121216526 | Equity infraestimado | MS: eq=60.5 — real: eq=75.2 (21% en 'other') |
| LU0352312853 | Apalancamiento extremo | MS sum=170.81 → normalización inservible |
| LU1594335520 | **Inversión completa** | MS: eq=0, bond=100 — real: eq=91.1% RV |
| LU1548496022 | Equity sobreestimado | MS: eq=34.8 — real: eq=25.9 |

**Fuente fiable:** fichas oficiales de Carmignac, Goldman Sachs y Allianz a 31/03/2026.

---

## Propuestas

| # | ISIN | Nombre | Actual | Propuesta | Δ eq | Source |
|---|------|--------|--------|-----------|------|--------|
| 1 | FR0010306142 | Carmignac Patrimoine E | eq=50 bd=50 | eq=35.4 bd=46.8 ca=5.1 ot=12.7 | -14.6pp | Ficha Carmignac |
| 2 | LU0121216526 | GS Patrimonial Aggressive X | eq=80 bd=20 | eq=75.2 bd=24.9 ca=0 ot=0 | -4.8pp | Ficha GS |
| 3 | LU0352312853 | Allianz Strategy 75 CT | eq=80 bd=20 | eq=86.0 bd=14.0 ca=0 ot=0 | +6.0pp | Ficha Allianz |
| 4 | LU1594335520 | Allianz Dynamic MA SRI 75 | eq=80 bd=20 | eq=79.1 bd=10.2 ca=0 ot=10.7 | -0.9pp | Ficha Allianz |
| 5 | LU1548496022 | Allianz Dynamic MA SRI 15 | eq=20 bd=80 | eq=24.6 bd=64.4 ca=0 ot=11.0 | +4.6pp | Ficha Allianz |

---

## Campos que se actualizarían (si se aprueba)

| Campo | Operación |
|-------|-----------|
| `portfolio_exposure_v2.economic_exposure.equity` | update() |
| `portfolio_exposure_v2.economic_exposure.bond` | update() |
| `portfolio_exposure_v2.economic_exposure.cash` | update() |
| `portfolio_exposure_v2.economic_exposure.other` | update() |
| `portfolio_exposure_v2.exposure_confidence` | 0.45 → **0.90** |
| `portfolio_exposure_v2.warnings` | `["EXPOSURE_SOURCE_OFFICIAL_FACTSHEET"]` |
| `portfolio_exposure_v2.computed_at` | timestamp del write |

## Campos que NO se tocarán

| Campo | Protección |
|-------|-----------|
| `manual` | ❌ NO TOCAR |
| `manual.costs` | ❌ NO TOCAR |
| `manual.costs.retrocession` | ❌ NO TOCAR |
| `classification_v2` | ❌ NO TOCAR |
| `ms` | ❌ NO TOCAR |
| `derived` | ❌ NO TOCAR |
| `std_perf` | ❌ NO TOCAR |

---

## Artifacts generados

| Artifact | Path |
|----------|------|
| selection.json | `write_gate_8_official_factsheet/selection.json` |
| snapshots_before.json | `write_gate_8_official_factsheet/snapshots_before.json` |
| diff_manifest.json | `write_gate_8_official_factsheet/diff_manifest.json` |
| rollback_manifest.json | `write_gate_8_official_factsheet/rollback_manifest.json` |
| write_approval_manifest.json | `write_gate_8_official_factsheet/write_approval_manifest.json` |

---

## Snapshots capturados (live Firestore)

| ISIN | eq actual | bd actual | conf actual |
|------|----------|----------|------------|
| FR0010306142 | 50.0 | 50.0 | 0.45 |
| LU0121216526 | 80.0 | 20.0 | 0.45 |
| LU0352312853 | 80.0 | 20.0 | 0.45 |
| LU1594335520 | 80.0 | 20.0 | 0.45 |
| LU1548496022 | 20.0 | 80.0 | 0.45 |

---

## Exclusiones

| ISIN | Nombre | Motivo |
|------|--------|--------|
| LU3038481936 | Hamco Global Value R | Fondo nuevo, sin datos MS ni ficha oficial disponible |

---

## Confirmaciones

| Check | Estado |
|-------|--------|
| Firestore writes | **0** |
| Deploy | **NO** |
| Código modificado | **NO** |
| authorized | **false** |
| can_write | **false** |
| Hamco excluido | ✅ |
| Rollback disponible | ✅ |
| Snapshots live capturados | ✅ 5/5 |

---

## Recomendación

**APROBAR** el write de los 5 ISINs. Los deltas son moderados (máximo -14.6pp), las fuentes son fichas oficiales de gestora, y los datos MS han demostrado ser no fiables para estos fondos específicos.

Tras aprobación:
1. Actualizar `write_approval_manifest.json`: `authorized=true`, `can_write=true`
2. Ejecutar write controlado con `docRef.update()`
3. Post-verification
4. Resultado esperado: **59/60 MIXED corregidos** (98.3%)
