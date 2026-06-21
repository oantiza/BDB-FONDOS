# BDB-MIXED-EXPOSURE-WRITE-GATE-0

**Fecha:** 2026-05-10  
**HEAD:** `1ed2447`  
**Estado:** Write gate preparado, pendiente aprobacion humana  
**Firestore writes:** 0

---

## Confirmaciones de Seguridad

- Firestore write ejecutado: **NO**
- Deploy ejecutado: **NO**
- optimizer_core.py modificado: **NO**
- suitability_engine.py modificado: **NO**
- Frontend modificado: **NO**
- Firestore rules modificado: **NO**
- BDB-FONDOS-CORE tocado: **NO**
- Solo lecturas de `funds_v3` para snapshots

---

## 1. Resumen del Dry-Run Real

| Metrica | Valor |
|---------|-------|
| Total MIXED en produccion | 60 |
| Con ms.portfolio.asset_allocation | 59 |
| Sin datos MS (fallback) | 1 |
| Write recommended | 59 |
| Review required (delta > 10pp) | 29 |
| Low risk (delta <= 10pp) | 30 |

## 2. Criterios de Seleccion del Primer Lote

```
write_recommended = true
review_required = false
source_used = ms_portfolio_asset_allocation
|delta_equity| <= 10 pp
|delta_bond| <= 10 pp
max_selected = 5
ordenados por |delta_equity| ascendente (mas seguro primero)
```

## 3. ISINs Seleccionados (5)

| ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd | MS Sum |
|------|--------|---------|--------|--------|------|------|--------|
| IE00BYYPF474 | Aegon Global Diversified Income | FLEXIBLE | 50.0 | 50.8 | +0.8 | -6.1 | 100.0 |
| ES0128067008 | Dux Mixto Variable FI | FLEXIBLE | 50.0 | 50.9 | +0.9 | -5.2 | 97.6 |
| LU0512121004 | DNCA Invest Eurose B | CONSERVATIVE | 20.0 | 19.1 | -0.9 | -3.1 | 100.0 |
| LU1883327816 | Amundi Global Multi-Asset A | FLEXIBLE | 50.0 | 51.1 | +1.1 | -6.7 | 100.0 |
| LU1961009468 | DWS Strategic Alloc Balance NC | FLEXIBLE | 50.0 | 51.1 | +1.1 | -7.0 | 99.99 |

**Riesgo:** BAJO. Todos los deltas equity son <= 1.1 pp. Los deltas bond son <= 7 pp. Los datos MS suman ~100%.

## 4. ISINs Excluidos

### Por review_required (delta > 10pp): 29 ISINs

Incluye casos como:
- LU1594335520 (d_eq = -80.0)
- ES0116848005 (d_eq = -50.0)
- LU0251119078 (d_eq = +48.8)
- ES0162305033 (d_eq = +43.3)
- ... y 25 mas

### Por ausencia de datos MS: 1 ISIN

- LU3038481936 — sin `ms.portfolio.asset_allocation`

### Low risk no seleccionados: 25 ISINs

Quedan para lotes futuros una vez validado el primer lote.

## 5. Campos que se Tocarian

```
portfolio_exposure_v2.economic_exposure.equity
portfolio_exposure_v2.economic_exposure.bond
portfolio_exposure_v2.economic_exposure.cash
portfolio_exposure_v2.economic_exposure.other
portfolio_exposure_v2.exposure_confidence  (0.45 -> 0.85)
portfolio_exposure_v2.warnings             (add EXPOSURE_SOURCE_MS_PORTFOLIO)
portfolio_exposure_v2.computed_at           (timestamp del write)
```

## 6. Campos que NO se Tocarian

```
manual                    (costes, retrocesiones)
manual.costs
manual.costs.retrocession
classification_v2         (asset_type, asset_subtype, etc.)
ms                        (datos Morningstar fuente)
derived                   (campos derivados legacy)
std_perf                  (metricas de rendimiento)
portfolio_exposure_v2.asset_mix
portfolio_exposure_v2.equity_regions
portfolio_exposure_v2.equity_styles
portfolio_exposure_v2.sectors
portfolio_exposure_v2.risk_flags
portfolio_exposure_v2.fi_credit
portfolio_exposure_v2.fi_duration
portfolio_exposure_v2.fi_types
portfolio_exposure_v2.alternatives
portfolio_exposure_v2.concentration_metrics
```

## 7. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `artifacts/bdb_mixed_exposure_fix/mixed_exposure_write_gate_selection_0.json` | Seleccion de ISINs con criterios |
| `artifacts/bdb_mixed_exposure_fix/write_gate_0/snapshots_before.json` | Snapshots read-only de los 5 docs |
| `artifacts/bdb_mixed_exposure_fix/write_gate_0/diff_manifest.json` | Before/after por ISIN con campos |
| `artifacts/bdb_mixed_exposure_fix/write_gate_0/rollback_manifest.json` | Datos para restaurar si hay problema |
| `artifacts/bdb_mixed_exposure_fix/write_gate_0/write_approval_manifest.json` | Gate de aprobacion (authorized=false) |

## 8. Estado del Approval Manifest

```json
{
  "authorized": false,
  "can_write": false,
  "requires_human_approval": true,
  "selected_count": 5,
  "approval_checklist": {
    "dry_run_reviewed": false,
    "diff_manifest_reviewed": false,
    "rollback_tested": false,
    "human_approved": false,
    "approved_by": null
  }
}
```

## 9. Instrucciones para el Siguiente Bloque (Write Controlado)

Si se aprueba el primer lote:

1. **Actualizar** `write_approval_manifest.json`:
   - `authorized: true`
   - `can_write: true`
   - `human_approved: true`
   - `approved_by: "<nombre>"`
   - `approved_at_utc: "<timestamp>"`

2. **Crear script de write** que:
   - Lee `write_approval_manifest.json`
   - Verifica `authorized == true`
   - Para cada ISIN en `selected_isins`:
     a. Re-lee doc actual de Firestore
     b. Verifica que `economic_exposure` coincide con `snapshots_before`
     c. Aplica update con los valores de `diff_manifest`
     d. Guarda log del write
   - Si cualquier guard falla, aborta todo el lote

3. **Validar** post-write:
   - Re-leer los 5 docs y confirmar nuevos valores
   - Verificar X-Ray de un portfolio que contenga alguno de estos fondos
   - Si hay problema, aplicar `rollback_manifest.json`

4. **Si OK**, proceder con Lote 2 (25 ISINs low-risk restantes)

5. **Lote 3** (29 ISINs review_required) solo tras revision manual individual

## 10. Recomendacion

**APROBAR** el primer lote de 5 ISINs. Razones:

- Los deltas equity son minimos (max 1.1 pp)
- Los datos MS suman ~100% (sin apalancamiento)
- Los fondos mantienen su perfil general (FLEXIBLE ~50% eq, CONSERVATIVE ~20% eq)
- Hay rollback completo preparado
- El impacto en el solver es minimo por la magnitud de los cambios
