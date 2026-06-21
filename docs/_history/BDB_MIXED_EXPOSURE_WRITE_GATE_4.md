# BDB-MIXED-EXPOSURE-WRITE-GATE-4

**Fecha:** 2026-05-10  
**HEAD:** `fd503e8`  
**Estado:** Write gate preparado, pendiente aprobacion humana  
**Firestore writes:** 0

---

## Confirmaciones de Seguridad

- Firestore write: **NO** | Deploy: **NO** | Codigo runtime: **NO**
- optimizer_core.py: **NO** | suitability_engine.py: **NO** | Frontend: **NO**
- Solo lecturas de `funds_v3` para snapshots

---

## 1. Resumen Acumulado

| Fase | ISINs | Estado |
|------|-------|--------|
| Lote 1 (low-risk) | 5 | COMPLETADO |
| Lote 2 (low-risk) | 10 | COMPLETADO |
| Lote 3 (low-risk) | 15 | COMPLETADO |
| **Total low-risk** | **30/60** | **100% DONE** |
| Review audit | 29 | Clasificados en 4 grupos |
| **Lote 4 (este gate)** | **5** | **PENDIENTE APROBACION** |

## 2. Por que estos 5 ISINs

De los 29 review_required, la auditoria (BDB_MIXED_EXPOSURE_REVIEW_REQUIRED_AUDIT_0.md) clasifico:
- **Grupo C** (subtype-aligned, shift moderado): 5 fondos
- **Grupo D** (extremos): 2 APPROVE, 3 HOLD/REVIEW

Se seleccionan los 5 con:
- MS sum = 100.0 exacto (sin apalancamiento)
- Cambio explicable por la estrategia declarada del fondo
- Sin contradiccion entre subtype y exposicion MS
- Grupo C (3) + Grupo D con APPROVE claro (2)

## 3. Tabla por ISIN

| ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd | MS Sum |
|------|--------|---------|--------|--------|------|------|--------|
| ES0138930005 | Fonvalcem B FI | AGGRESSIVE | 80.0 | 91.8 | +11.8 | -20.0 | 100.0 |
| DE000DWS17J0 | DWS ESG Dynamic Opportunities | AGGRESSIVE | 80.0 | 68.8 | -11.2 | -1.2 | 100.0 |
| LU1868537090 | DWS Invest ESG Dynamic Opp | AGGRESSIVE | 80.0 | 69.0 | -11.0 | -1.2 | 100.0 |
| LU0048293368 | BL-Global 75 B | AGGRESSIVE | 80.0 | 59.1 | -20.9 | -11.8 | 100.0 |
| LU1697016365 | Sigma Selection Defensive A | CONSERVATIVE | 20.0 | 0.1 | -19.9 | +12.5 | 100.0 |

## 4. Rationale Individual

### ES0138930005 — Fonvalcem B FI
- **Cambio:** AGGRESSIVE 80% → 91.8% equity
- **Analisis:** MS confirma que es mas agresivo que el fallback 80/20. Fondo de RV concentrada.
- **Suitability:** Minimo impacto. Sigue en rango AGGRESSIVE.
- **Recomendacion:** **APPROVE**

### DE000DWS17J0 — DWS ESG Dynamic Opportunities LC
- **Cambio:** AGGRESSIVE 80% → 68.8% equity, other=9.2%
- **Analisis:** Multi-asset dinamico genuinamente diversificado. MS sum=100.0 exacto.
- **Suitability:** Moderado. Podria cambiar de bucket en perfiles P6-P8.
- **Recomendacion:** **APPROVE**

### LU1868537090 — DWS Invest ESG Dynamic Opportunities LC
- **Cambio:** AGGRESSIVE 80% → 69.0% equity, other=9.0%
- **Analisis:** Version "invest" del anterior. Mismo patron exacto.
- **Suitability:** Moderado. Mismo impacto que DE000DWS17J0.
- **Recomendacion:** **APPROVE**

### LU0048293368 — BL-Global 75 B EUR Acc
- **Cambio:** AGGRESSIVE 80% → 59.1% equity, other=22.6%
- **Analisis:** BL invierte significativamente en oro y commodities (22.6% other). Equity real = 59.1%. La estrategia de oro de BL es bien conocida.
- **Suitability:** Alto pero correcto. other=22.6% debe reflejarse en el solver.
- **Recomendacion:** **APPROVE**

### LU1697016365 — Sigma Selection Defensive A EUR
- **Cambio:** CONSERVATIVE 20% → 0.1% equity, bond=92.5%
- **Analisis:** El nombre "Defensive" confirma que es ultra-conservador. MS muestra 92.5% bond, 6.7% cash, 0.7% other.
- **Suitability:** Bajo. Sigue siendo CONSERVATIVE, incluso mas conservador.
- **Recomendacion:** **APPROVE**

## 5. Campos que se Tocarian

```
portfolio_exposure_v2.economic_exposure.{equity,bond,cash,other}
portfolio_exposure_v2.exposure_confidence  (0.45 -> 0.85)
portfolio_exposure_v2.warnings             (+ EXPOSURE_SOURCE_MS_PORTFOLIO)
portfolio_exposure_v2.computed_at
```

## 6. Campos que NO se Tocarian

```
manual, manual.costs, manual.costs.retrocession
classification_v2, ms, derived, std_perf
portfolio_exposure_v2.{asset_mix, equity_regions, equity_styles, sectors, risk_flags, ...}
```

## 7. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `write_gate_4/selection.json` | 5 ISINs con rationale |
| `write_gate_4/snapshots_before.json` | Snapshots Firestore read-only |
| `write_gate_4/diff_manifest.json` | Before/after + rationale + suitability impact |
| `write_gate_4/rollback_manifest.json` | Datos para restaurar |
| `write_gate_4/write_approval_manifest.json` | Gate (authorized=false) |

## 8. Approval Manifest

```json
{
  "authorized": false,
  "can_write": false,
  "requires_human_approval": true,
  "selected_count": 5
}
```

## 9. Recomendacion

**APROBAR** el lote 4 de 5 ISINs. Razones:

- Todos tienen MS sum = 100.0 (sin apalancamiento ni derivados complejos)
- Cada cambio es coherente con la estrategia declarada del fondo
- Los 3 fondos AGGRESSIVE (DWS x2 + BL) bajan equity porque diversifican en other (commodities, oro)
- Fonvalcem sube equity porque es mas agresivo que el 80/20 generico
- Sigma Defensive baja equity porque es genuinamente ultra-conservador
- Rollback completo disponible

## 10. Post-Lote 4: Hoja de Ruta

| Fase | ISINs | Estado |
|------|-------|--------|
| Low-risk (lotes 1-3) | 30 | COMPLETADO |
| **Lote 4 (este gate)** | **5** | **PENDIENTE** |
| Lote 5 — Grupo A (FLEX 50/50->RV alta) | 13 | Pendiente |
| Lote 6 — Grupo B (FLEX 50/50->RV baja) | 6 | Pendiente |
| REVIEW_MANUAL | 3 | Evaluar individualmente |
| HOLD | 2 | No escribir hasta investigar |
| Sin datos MS | 1 | Mantiene fallback |
