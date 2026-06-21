# BDB-MIXED-EXPOSURE-WRITE-CONTROLLED-3

**Fecha:** 2026-05-10  
**HEAD antes:** `fd383c2`  
**Estado:** Write ejecutado, 15/15 PASS, tests 62/62 PASS

---

## Confirmaciones de Seguridad

- Firestore write: **SI** (15 documentos, solo campos autorizados)
- Deploy: **NO** | optimizer_core.py: **NO** | suitability_engine.py: **NO**
- Frontend: **NO** | Firestore rules: **NO** | BDB-FONDOS-CORE: **NO**
- manual / classification_v2 / ms / derived / std_perf: **NO TOCADOS**

---

## 1. ISINs Escritos (15)

| ISIN | Nombre | Old Eq | New Eq | d_Eq | Status |
|------|--------|--------|--------|------|--------|
| DE0005318406 | DWS ESG Stiftungsfonds LD | 20.0 | 25.2 | +5.2 | PASS |
| ES0142046038 | Gesem Agresivo Flexible FI | 50.0 | 58.8 | +8.8 | PASS |
| ES0148181003 | Indexa RV mixta int. 75 | 80.0 | 74.8 | -5.2 | PASS |
| ES0162946034 | Abante Seleccion FI | 50.0 | 41.2 | -8.8 | PASS |
| ES0173323009 | Renta 4 Wertefinder FI | 50.0 | 46.3 | -3.7 | PASS |
| ES0175604034 | Gesconsult Leon Valores Mixto A | 50.0 | 45.4 | -4.6 | PASS |
| LU0171283459 | BlackRock Global Allocation A2 | 50.0 | 55.8 | +5.8 | PASS |
| LU0251131362 | Fidelity Target 2030 A | 50.0 | 44.8 | -5.2 | PASS |
| LU0404220724 | JPM Global Income D | 50.0 | 44.4 | -5.6 | PASS |
| LU1245470593 | Flossbach Multi Asset Defensive | 20.0 | 24.6 | +4.6 | PASS |
| LU1697017256 | Sigma Selection Moderate A | 50.0 | 41.9 | -8.1 | PASS |
| LU1697018494 | Sigma Best JP Morgan A | 50.0 | 59.6 | +9.6 | PASS |
| LU1882475392 | Amundi Euro Multi-Asset Target Inc | 20.0 | 29.8 | +9.8 | PASS |
| LU1899018953 | Sigma Best Blackrock A | 50.0 | 43.6 | -6.4 | PASS |
| LU2278574715 | B&H Flexible Class 2 | 50.0 | 40.0 | -10.0 | PASS |

## 2. Post-Verification: 15/15 PASS

## 3. Tests: 62/62 PASS

## 4. Rollback: `artifacts/.../write_gate_3/rollback_manifest.json`

## 5. Resumen Final: Todos los Low-Risk Completados

| Lote | ISINs | Estado | Commit |
|------|-------|--------|--------|
| Lote 1 | 5 | COMPLETADO | d9ca28f |
| Lote 2 | 10 | COMPLETADO | fd383c2 |
| **Lote 3** | **15** | **COMPLETADO** | **(este commit)** |
| **Total low-risk** | **30/60** | **100% low-risk** | |

### Quedan:
- **29 fondos** review_required (delta > 10pp) — requieren revision manual individual
- **1 fondo** sin datos MS (LU3038481936) — mantiene fallback
