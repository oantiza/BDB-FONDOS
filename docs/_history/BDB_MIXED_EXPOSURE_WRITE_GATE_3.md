# BDB-MIXED-EXPOSURE-WRITE-GATE-3

**Fecha:** 2026-05-10  
**HEAD:** `fd383c2`  
**Estado:** Write gate preparado, pendiente aprobacion humana  
**Firestore writes:** 0

---

## Confirmaciones de Seguridad

- Firestore write ejecutado: **NO**
- Deploy: **NO** | optimizer_core.py: **NO** | suitability_engine.py: **NO**
- Frontend: **NO** | Firestore rules: **NO** | BDB-FONDOS-CORE: **NO**
- Solo lecturas de `funds_v3` para snapshots

---

## 1. Resumen Lotes Anteriores

| Lote | ISINs | Max |d_eq| | Estado | Commit |
|------|-------|-------------|--------|--------|
| Lote 1 | 5 | 1.1 pp | COMPLETADO | d9ca28f |
| Lote 2 | 10 | 3.3 pp | COMPLETADO | fd383c2 |
| **Total corregidos** | **15/60** | | **25%** | |

## 2. Criterios de Seleccion Lote 3

```
write_recommended = true
review_required = false
source_used = ms_portfolio_asset_allocation
NOT IN lotes 1+2 (15 ISINs)
= todos los low-risk restantes (no hay max_selected)
```

## 3. ISINs Seleccionados Lote 3 (15)

| # | ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd |
|---|------|--------|---------|--------|--------|------|------|
| 1 | ES0173323009 | Renta 4 Wertefinder FI | FLEXIBLE | 50.0 | 46.3 | -3.7 | -1.6 |
| 2 | ES0175604034 | Gesconsult Leon Valores Mixto A | MODERATE | 50.0 | 45.4 | -4.6 | -2.7 |
| 3 | LU1245470593 | Flossbach von Storch Multi Asset Def | CONSERVATIVE | 20.0 | 24.6 | +4.6 | -22.6 |
| 4 | DE0005318406 | DWS ESG Stiftungsfonds LD | CONSERVATIVE | 20.0 | 25.2 | +5.2 | -9.5 |
| 5 | ES0148181003 | Indexa RV mixta internacional 75 | AGGRESSIVE | 80.0 | 74.8 | -5.2 | +2.7 |
| 6 | LU0251131362 | Fidelity Target 2030 A | FLEXIBLE | 50.0 | 44.8 | -5.2 | -7.8 |
| 7 | LU0404220724 | JPM Global Income D | MODERATE | 50.0 | 44.4 | -5.6 | +0.3 |
| 8 | LU0171283459 | BlackRock Global Allocation A2 | MODERATE | 50.0 | 55.8 | +5.8 | -9.2 |
| 9 | LU1899018953 | Sigma Best Blackrock A | FLEXIBLE | 50.0 | 43.6 | -6.4 | -4.8 |
| 10 | LU1697017256 | Sigma Selection Moderate A | MODERATE | 50.0 | 41.9 | -8.1 | +0.3 |
| 11 | ES0142046038 | Gesem Agresivo Flexible FI | MODERATE | 50.0 | 58.8 | +8.8 | -38.0 |
| 12 | ES0162946034 | Abante Seleccion FI | MODERATE | 50.0 | 41.2 | -8.8 | -2.9 |
| 13 | LU1697018494 | Sigma Best JP Morgan A | FLEXIBLE | 50.0 | 59.6 | +9.6 | -14.4 |
| 14 | LU1882475392 | Amundi Euro Multi-Asset Target Inc A2 | CONSERVATIVE | 20.0 | 29.8 | +9.8 | -37.7 |
| 15 | LU2278574715 | B&H Flexible Class 2 | FLEXIBLE | 50.0 | 40.0 | -10.0 | +3.0 |

**Max |d_eq|: 10.0 pp** (LU2278574715). Todos por debajo del umbral de review_required.

## 4. Observaciones

- **LU1245470593** (Flossbach Defensive): d_bd=-22.6 porque MS muestra cash=11.1% y other=6.9% que no estaban en el fallback 20/80. El equity sube solo 4.6 pp. Coherente.
- **ES0142046038** (Gesem Agresivo): d_bd=-38.0 porque MS muestra other=25.1% (real estate/alternatives). Equity sube 8.8 pp. El fondo es realmente mas agresivo que 50/50.
- **LU1882475392** (Amundi Target Income): d_bd=-37.7 por cash=21.2% y other=6.7%. Equity sube 9.8 pp. Coherente con un fondo de income que usa multiples clases de activo.
- Todos los demas tienen deltas moderados y coherentes con sus estrategias.

## 5. Campos que se Tocarian

```
portfolio_exposure_v2.economic_exposure.{equity,bond,cash,other}
portfolio_exposure_v2.exposure_confidence  (0.45 -> 0.85)
portfolio_exposure_v2.warnings             (+ EXPOSURE_SOURCE_MS_PORTFOLIO)
portfolio_exposure_v2.computed_at
```

## 6. Campos que NO se Tocarian

```
manual, manual.costs, manual.costs.retrocession, classification_v2, ms, derived, std_perf
portfolio_exposure_v2.{asset_mix, equity_regions, equity_styles, sectors, risk_flags,
                       fi_credit, fi_duration, fi_types, alternatives, concentration_metrics}
```

## 7. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `write_gate_3/selection.json` | 15 ISINs con criterios |
| `write_gate_3/snapshots_before.json` | Snapshots Firestore read-only |
| `write_gate_3/diff_manifest.json` | Before/after por ISIN |
| `write_gate_3/rollback_manifest.json` | Datos para restaurar |
| `write_gate_3/write_approval_manifest.json` | Gate (authorized=false) |

## 8. Approval Manifest

```json
{
  "authorized": false,
  "can_write": false,
  "requires_human_approval": true,
  "selected_count": 15
}
```

## 9. Recomendacion

**APROBAR** el lote 3 de 15 ISINs. Razones:

- Max |d_eq| = 10.0 pp, dentro del umbral aceptable
- Lotes 1 y 2 (15 fondos) ya completados sin incidencias
- Todos los datos MS suman ~100%
- Los deltas bond grandes se explican por redistribucion hacia cash/other, no por datos erroneos
- Rollback completo disponible
- Con este lote se completan todos los fondos low-risk (30/60)

## 10. Post-Lote 3: Hoja de Ruta

| Lote | ISINs | Estado |
|------|-------|--------|
| Lote 1 | 5 | COMPLETADO |
| Lote 2 | 10 | COMPLETADO |
| **Lote 3** | **15** | **PENDIENTE APROBACION** |
| Lote 4 | 29 review_required | Pendiente revision manual individual |
| Lote 5 | 1 sin MS data | Mantiene fallback |
| **Total tras lote 3** | **30/60** | **50%** |
