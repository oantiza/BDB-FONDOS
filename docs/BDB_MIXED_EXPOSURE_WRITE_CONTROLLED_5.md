# BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-5

**Fecha:** 2026-05-10  
**HEAD antes:** `a17ff30`  
**Estado:** Write ejecutado, 5/5 PASS, tests 62/62 PASS

---

## Confirmaciones de Seguridad

- Firestore write: **SI** (5 documentos, solo campos autorizados)
- Deploy: **NO** | optimizer_core.py: **NO** | suitability_engine.py: **NO**
- Frontend: **NO** | Firestore rules: **NO** | BDB-FONDOS-CORE: **NO**
- manual / classification_v2 / ms / derived / std_perf: **NO TOCADOS**

---

## 1. ISINs Escritos (5 — segundo sublote review_required)

| ISIN | Nombre | Old Eq | New Eq | d_Eq | Status |
|------|--------|--------|--------|------|--------|
| DE000A0X7541 | Acatis Value Event Fonds A | 50.0 | 63.9 | +13.9 | PASS |
| LU1095739733 | First Eagle Income Builder AE | 50.0 | 61.9 | +11.9 | PASS |
| LU1883330521 | Amundi Global MA Target Inc A2 | 20.0 | 31.7 | +11.7 | PASS |
| LU1883340322 | Amundi Pioneer Flexible Opp A | 50.0 | 61.6 | +11.6 | PASS |
| LU1894680757 | Amundi Income Opportunities A2 | 50.0 | 30.3 | -19.7 | PASS |

## 2. Post-Verification: 5/5 PASS

## 3. Tests: 62/62 PASS

## 4. Rollback: `artifacts/.../write_gate_5/rollback_manifest.json`

## 5. Progreso Global

| Fase | ISINs | Estado |
|------|-------|--------|
| Lote 1 (low-risk) | 5 | COMPLETADO |
| Lote 2 (low-risk) | 10 | COMPLETADO |
| Lote 3 (low-risk) | 15 | COMPLETADO |
| Lote 4 (review-req #1) | 5 | COMPLETADO |
| **Lote 5 (review-req #2)** | **5** | **COMPLETADO** |
| **Total corregidos** | **40/60** | **67%** |

### Quedan:
- **14 APPROVE** review_required pendientes
- **3 REVIEW_MANUAL** (MS sum alto)
- **2 HOLD/BLOCK** (anomalos)
- **1 sin datos MS** (mantiene fallback)
