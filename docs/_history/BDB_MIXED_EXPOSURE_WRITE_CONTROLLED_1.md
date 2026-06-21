# BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-1

**Fecha:** 2026-05-10  
**HEAD antes:** `1ed2447`  
**Estado:** Write ejecutado, 5/5 PASS, tests 62/62 PASS

---

## Confirmaciones de Seguridad

- Firestore write ejecutado: **SI** (5 documentos, solo campos autorizados)
- Deploy ejecutado: **NO**
- optimizer_core.py modificado: **NO**
- suitability_engine.py modificado: **NO**
- Frontend modificado: **NO**
- Firestore rules modificado: **NO**
- BDB-FONDOS-CORE tocado: **NO**
- manual / manual.costs / retrocession: **NO TOCADOS**
- classification_v2: **NO TOCADO**
- ms: **NO TOCADO**
- derived: **NO TOCADO**
- std_perf: **NO TOCADO**

---

## 1. Precondiciones Verificadas

| Guard | Estado |
|-------|--------|
| write_approval_manifest.json authorized=true | PASS |
| write_approval_manifest.json can_write=true | PASS |
| selected_isins = 5 ISINs exactos | PASS |
| fields_to_update solo contiene allowed fields | PASS |
| No forbidden fields en payload | PASS |
| Snapshot actual matches snapshot_before | PASS (5/5) |

## 2. ISINs Escritos

| ISIN | Nombre | Old Eq | New Eq | Old Bd | New Bd | d_Eq | Conf |
|------|--------|--------|--------|--------|--------|------|------|
| ES0128067008 | Dux Mixto Variable FI | 50.0 | 50.9 | 50.0 | 44.8 | +0.9 | 0.85 |
| IE00BYYPF474 | Aegon Global Diversified Income | 50.0 | 50.8 | 50.0 | 43.9 | +0.8 | 0.85 |
| LU0512121004 | DNCA Invest Eurose B | 20.0 | 19.1 | 80.0 | 76.9 | -0.9 | 0.85 |
| LU1883327816 | Amundi Global Multi-Asset A | 50.0 | 51.1 | 50.0 | 43.3 | +1.1 | 0.85 |
| LU1961009468 | DWS Strategic Alloc Balance NC | 50.0 | 51.1 | 50.0 | 43.0 | +1.1 | 0.85 |

## 3. Campos Modificados

```
portfolio_exposure_v2.economic_exposure.equity
portfolio_exposure_v2.economic_exposure.bond
portfolio_exposure_v2.economic_exposure.cash
portfolio_exposure_v2.economic_exposure.other
portfolio_exposure_v2.exposure_confidence  (0.45 -> 0.85)
portfolio_exposure_v2.warnings             (+ EXPOSURE_SOURCE_MS_PORTFOLIO)
portfolio_exposure_v2.computed_at           (timestamp del write)
```

## 4. Campos NO Tocados (Confirmado)

```
manual, manual.costs, manual.costs.retrocession
classification_v2
ms
derived
std_perf
portfolio_exposure_v2.asset_mix
portfolio_exposure_v2.equity_regions
portfolio_exposure_v2.equity_styles
portfolio_exposure_v2.sectors
portfolio_exposure_v2.risk_flags
portfolio_exposure_v2.fi_credit / fi_duration / fi_types
portfolio_exposure_v2.alternatives
portfolio_exposure_v2.concentration_metrics
```

## 5. Post-Verification

| ISIN | eq OK | bd OK | ca OK | ot OK | conf OK | Status |
|------|-------|-------|-------|-------|---------|--------|
| ES0128067008 | 50.9 | 44.8 | 4.2 | 0.0 | 0.85 | **PASS** |
| IE00BYYPF474 | 50.8 | 43.9 | 2.7 | 2.6 | 0.85 | **PASS** |
| LU0512121004 | 19.1 | 76.9 | 0.0 | 4.0 | 0.85 | **PASS** |
| LU1883327816 | 51.1 | 43.3 | 4.7 | 0.9 | 0.85 | **PASS** |
| LU1961009468 | 51.1 | 43.0 | 3.6 | 2.3 | 0.85 | **PASS** |

**Resultado: 5/5 PASS**

## 6. Tests de Regresion

| Suite | Tests | Resultado |
|-------|-------|-----------|
| test_mixed_exposure_ms_portfolio.py | 11 | 11 passed |
| test_mixed_funds_lookthrough_contract.py | 4 | 4 passed |
| test_suitability_v2.py | 47 | 47 passed |
| **Total** | **62** | **62 passed** |

## 7. Rollback Disponible

**Archivo:** `artifacts/bdb_mixed_exposure_fix/write_gate_0/rollback_manifest.json`

Contiene los valores exactos de economic_exposure, confidence y warnings anteriores al write. En caso de problema, restaurar con:

```python
# Para cada entry en rollback_manifest.rollback_entries:
db.collection("funds_v3").document(entry["isin"]).update(entry["restore_fields"])
```

## 8. Comandos Ejecutados

```powershell
# 1. Aprobar write gate
# Editado write_approval_manifest.json: authorized=true, can_write=true

# 2. Ejecutar write controlado
$env:GOOGLE_APPLICATION_CREDENTIALS = "...\serviceAccountKey.json"
python scripts/maintenance/bdb_mixed_exposure_write_controlled_1.py

# 3. Tests de regresion
python -m pytest tests/test_mixed_exposure_ms_portfolio.py tests/test_mixed_funds_lookthrough_contract.py tests/test_suitability_v2.py -v
```

## 9. Siguiente Paso

1. **Lote 2:** 25 ISINs low-risk restantes (review_required=false, no seleccionados en lote 1)
2. **Lote 3:** 29 ISINs review_required=true (delta > 10pp, requieren revision individual)
3. **Lote 4:** LU3038481936 (sin datos MS, mantiene fallback)
