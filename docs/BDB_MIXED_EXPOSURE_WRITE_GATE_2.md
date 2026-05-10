# BDB-MIXED-EXPOSURE-WRITE-GATE-2

**Fecha:** 2026-05-10  
**HEAD:** `d9ca28f`  
**Estado:** Write gate preparado, pendiente aprobacion humana  
**Firestore writes:** 0

---

## Confirmaciones de Seguridad

- Firestore write ejecutado: **NO**
- Deploy ejecutado: **NO**
- optimizer_core.py modificado: **NO**
- suitability_engine.py modificado: **NO**
- Frontend modificado: **NO**
- Firestore rules: **NO**
- BDB-FONDOS-CORE: **NO**
- Solo lecturas de `funds_v3` para snapshots

---

## 1. Resumen Lote 1 (completado)

| Metrica | Valor |
|---------|-------|
| ISINs escritos | 5 |
| Post-verification | 5/5 PASS |
| Tests regresion | 62/62 PASS |
| Commit | d9ca28f |
| Push | No (2 commits pendientes) |

ISINs lote 1: ES0128067008, IE00BYYPF474, LU0512121004, LU1883327816, LU1961009468

## 2. Estado Global Post-Lote-1

| Categoria | Count |
|-----------|-------|
| Total MIXED | 60 |
| Ya escritos (lote 1) | 5 |
| Seleccionados lote 2 | **10** |
| Review required (delta > 10pp) | 29 |
| Sin datos MS | 1 |
| Low-risk restantes post-lote 2 | 15 |

## 3. Criterios de Seleccion Lote 2

```
write_recommended = true
review_required = false
source_used = ms_portfolio_asset_allocation
NOT IN lote 1
|delta_equity| <= 10 pp
max_selected = 10
ordenados por |delta_equity| ascendente
```

## 4. ISINs Seleccionados Lote 2 (10)

| # | ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd |
|---|------|--------|---------|--------|--------|------|------|
| 1 | LU0565136552 | First Eagle Amundi International FE-C | AGGRESSIVE | 80.0 | 80.5 | +0.5 | -18.5 |
| 2 | LU0093503737 | BlackRock ESG Multi-Asset E2 | FLEXIBLE | 50.0 | 51.2 | +1.2 | -13.0 |
| 3 | LU1304666057 | Allianz Dynamic MA SRI 50 AT | AGGRESSIVE | 80.0 | 81.2 | +1.2 | -2.4 |
| 4 | LU1740985814 | DWS Strategic Alloc Dynamic LD | AGGRESSIVE | 80.0 | 78.7 | -1.3 | -1.9 |
| 5 | FR0010041822 | EdR Patrimoine A | CONSERVATIVE | 20.0 | 17.7 | -2.3 | -11.4 |
| 6 | LU0352312184 | Allianz Strategy 50 CT | FLEXIBLE | 50.0 | 47.7 | -2.3 | +2.3 |
| 7 | LU1276000236 | EdR Income Europe R | CONSERVATIVE | 20.0 | 17.5 | -2.5 | -10.7 |
| 8 | LU1298174530 | CT Global Multi Asset Income AE | FLEXIBLE | 50.0 | 52.5 | +2.5 | -8.0 |
| 9 | ES0162949012 | Abante Indice Seleccion A FI | MODERATE | 50.0 | 47.3 | -2.7 | -5.8 |
| 10 | ES0116567035 | Cartesio X FI | CONSERVATIVE | 20.0 | 23.3 | +3.3 | -3.3 |

**Max |delta_equity|: 3.3 pp** — todos muy seguros.

## 5. Observaciones

- **LU0565136552** (First Eagle): d_eq=+0.5 pero d_bd=-18.5 — el bond baja porque MS muestra mas cash (10.1%) y other (22.6%) que el fallback 80/20. El equity apenas cambia. Coherente con un fondo de oro/commodities.
- **Fondos CONSERVATIVE** (FR0010041822, LU1276000236, ES0116567035): todos tienen d_eq < 3.3 pp. Los datos MS confirman que son efectivamente conservadores.
- **Fondos AGGRESSIVE** (LU0565136552, LU1304666057, LU1740985814): d_eq < 1.3 pp. Los datos MS confirman el sesgo agresivo.

## 6. Campos que se Tocarian

```
portfolio_exposure_v2.economic_exposure.equity
portfolio_exposure_v2.economic_exposure.bond
portfolio_exposure_v2.economic_exposure.cash
portfolio_exposure_v2.economic_exposure.other
portfolio_exposure_v2.exposure_confidence  (0.45 -> 0.85)
portfolio_exposure_v2.warnings             (+ EXPOSURE_SOURCE_MS_PORTFOLIO)
portfolio_exposure_v2.computed_at           (timestamp del write)
```

## 7. Campos que NO se Tocarian

```
manual, manual.costs, manual.costs.retrocession
classification_v2
ms
derived
std_perf
portfolio_exposure_v2.asset_mix / equity_regions / equity_styles / sectors
portfolio_exposure_v2.risk_flags / fi_credit / fi_duration / fi_types
portfolio_exposure_v2.alternatives / concentration_metrics
```

## 8. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `artifacts/.../write_gate_2/selection.json` | 10 ISINs con criterios |
| `artifacts/.../write_gate_2/snapshots_before.json` | Snapshots Firestore read-only |
| `artifacts/.../write_gate_2/diff_manifest.json` | Before/after por ISIN |
| `artifacts/.../write_gate_2/rollback_manifest.json` | Datos para restaurar |
| `artifacts/.../write_gate_2/write_approval_manifest.json` | Gate (authorized=false) |

## 9. Estado del Approval Manifest

```json
{
  "authorized": false,
  "can_write": false,
  "requires_human_approval": true,
  "selected_count": 10
}
```

## 10. Recomendacion

**APROBAR** el lote 2 de 10 ISINs. Razones:

- Max |delta_equity| = 3.3 pp (menor que lote 1 max = 1.1 pp, pero aun muy bajo)
- Todos los fondos mantienen su perfil general
- Datos MS suman ~100% en todos los casos
- Lote 1 ya ejecutado sin problemas confirma que el proceso es seguro
- Rollback completo disponible

## 11. Post-Lote 2: Hoja de Ruta

| Lote | ISINs | Criterio | Estado |
|------|-------|----------|--------|
| Lote 1 | 5 | d_eq <= 1.1 pp | COMPLETADO |
| **Lote 2** | **10** | **d_eq <= 3.3 pp** | **PENDIENTE APROBACION** |
| Lote 3 | 15 | d_eq <= 10 pp (low-risk restante) | Pendiente |
| Lote 4 | 29 | d_eq > 10 pp (review required) | Pendiente revision manual |
| Lote 5 | 1 | Sin datos MS | Mantiene fallback |
