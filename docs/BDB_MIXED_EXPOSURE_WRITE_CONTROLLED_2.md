# BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-2

**Fecha:** 2026-05-10  
**HEAD antes:** `d9ca28f`  
**Estado:** Write ejecutado, 10/10 PASS, tests 62/62 PASS

---

## Confirmaciones de Seguridad

- Firestore write ejecutado: **SI** (10 documentos, solo campos autorizados)
- Deploy: **NO**
- optimizer_core.py: **NO TOCADO**
- suitability_engine.py: **NO TOCADO**
- Frontend: **NO TOCADO**
- Firestore rules: **NO TOCADO**
- BDB-FONDOS-CORE: **NO TOCADO**
- manual / manual.costs / retrocession: **NO TOCADOS**
- classification_v2: **NO TOCADO**
- ms: **NO TOCADO**
- derived / std_perf: **NO TOCADOS**

---

## 1. ISINs Escritos (10)

| ISIN | Nombre | Old Eq | New Eq | d_Eq | Status |
|------|--------|--------|--------|------|--------|
| ES0116567035 | Cartesio X FI | 20.0 | 23.3 | +3.3 | PASS |
| ES0162949012 | Abante Indice Seleccion A FI | 50.0 | 47.3 | -2.7 | PASS |
| FR0010041822 | EdR Patrimoine A | 20.0 | 17.7 | -2.3 | PASS |
| LU0093503737 | BlackRock ESG Multi-Asset E2 | 50.0 | 51.2 | +1.2 | PASS |
| LU0352312184 | Allianz Strategy 50 CT | 50.0 | 47.7 | -2.3 | PASS |
| LU0565136552 | First Eagle Amundi International | 80.0 | 80.5 | +0.5 | PASS |
| LU1276000236 | EdR Income Europe R | 20.0 | 17.5 | -2.5 | PASS |
| LU1298174530 | CT Global Multi Asset Income AE | 50.0 | 52.5 | +2.5 | PASS |
| LU1304666057 | Allianz Dynamic MA SRI 50 AT | 80.0 | 81.2 | +1.2 | PASS |
| LU1740985814 | DWS Strategic Alloc Dynamic LD | 80.0 | 78.7 | -1.3 | PASS |

## 2. Post-Verification: 10/10 PASS

Artifact: `artifacts/bdb_mixed_exposure_fix/write_gate_2/post_write_verification.json`

## 3. Tests: 62/62 PASS

| Suite | Tests | Result |
|-------|-------|--------|
| test_mixed_exposure_ms_portfolio.py | 11 | 11 passed |
| test_mixed_funds_lookthrough_contract.py | 4 | 4 passed |
| test_suitability_v2.py | 47 | 47 passed |

## 4. Rollback Disponible

`artifacts/bdb_mixed_exposure_fix/write_gate_2/rollback_manifest.json`

## 5. Progreso Global

| Lote | ISINs | Estado |
|------|-------|--------|
| Lote 1 | 5 | COMPLETADO (d9ca28f) |
| **Lote 2** | **10** | **COMPLETADO** |
| Lote 3 | 15 low-risk restantes | Pendiente |
| Lote 4 | 29 review_required | Pendiente revision manual |
| Lote 5 | 1 sin MS data | Mantiene fallback |
| **Total corregidos** | **15/60** | **25%** |

## 6. Push

Previo al write se ejecuto: `git push origin master` (7529a23..d9ca28f)  
Post-write commit y push pendientes.
