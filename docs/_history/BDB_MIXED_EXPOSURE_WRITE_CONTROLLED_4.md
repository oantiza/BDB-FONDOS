# BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-4

**Fecha:** 2026-05-10  
**HEAD antes:** `fd503e8`  
**Estado:** Write ejecutado, 5/5 PASS, tests 62/62 PASS

---

## Confirmaciones de Seguridad

- Firestore write: **SI** (5 documentos, solo campos autorizados)
- Deploy: **NO** | optimizer_core.py: **NO** | suitability_engine.py: **NO**
- Frontend: **NO** | Firestore rules: **NO** | BDB-FONDOS-CORE: **NO**
- manual / classification_v2 / ms / derived / std_perf: **NO TOCADOS**

---

## 1. ISINs Escritos (5 — primer sublote review_required)

| ISIN | Nombre | Old Eq | New Eq | d_Eq | Status |
|------|--------|--------|--------|------|--------|
| DE000DWS17J0 | DWS ESG Dynamic Opportunities | 80.0 | 68.8 | -11.2 | PASS |
| ES0138930005 | Fonvalcem B FI | 80.0 | 91.8 | +11.8 | PASS |
| LU0048293368 | BL-Global 75 B | 80.0 | 59.1 | -20.9 | PASS |
| LU1697016365 | Sigma Selection Defensive A | 20.0 | 0.1 | -19.9 | PASS |
| LU1868537090 | DWS Invest ESG Dynamic Opp | 80.0 | 69.0 | -11.0 | PASS |

## 2. Post-Verification: 5/5 PASS

## 3. Tests: 62/62 PASS

## 4. Rollback: `artifacts/.../write_gate_4/rollback_manifest.json`

## 5. Progreso Global

| Fase | ISINs | Estado |
|------|-------|--------|
| Lote 1 (low-risk) | 5 | COMPLETADO |
| Lote 2 (low-risk) | 10 | COMPLETADO |
| Lote 3 (low-risk) | 15 | COMPLETADO |
| **Lote 4 (review-req)** | **5** | **COMPLETADO** |
| **Total corregidos** | **35/60** | **58%** |
| Quedan review_required | 24 | Pendiente |
| Sin datos MS | 1 | Mantiene fallback |
