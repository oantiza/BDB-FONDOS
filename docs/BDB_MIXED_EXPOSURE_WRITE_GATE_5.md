# BDB-MIXED-EXPOSURE-WRITE-GATE-5

**Fecha:** 2026-05-10  
**HEAD:** `a17ff30`  
**Estado:** Write gate preparado, pendiente aprobacion humana  
**Firestore writes:** 0

---

## Confirmaciones de Seguridad

- Firestore write: **NO** | Deploy: **NO** | Codigo runtime: **NO**
- optimizer_core.py: **NO** | suitability_engine.py: **NO** | Frontend: **NO**
- Solo lecturas de `funds_v3` para snapshots

---

## 1. Progreso Acumulado

| Fase | ISINs | Estado |
|------|-------|--------|
| Lote 1 (low-risk) | 5 | COMPLETADO |
| Lote 2 (low-risk) | 10 | COMPLETADO |
| Lote 3 (low-risk) | 15 | COMPLETADO |
| Lote 4 (review-req #1) | 5 | COMPLETADO |
| **Total corregidos** | **35/60** | **58%** |
| **Lote 5 (este gate)** | **5** | **PENDIENTE** |

## 2. Por que estos 5 ISINs y no los restantes

De los 24 review_required restantes:
- **2 HOLD/BLOCK:** LU1594335520 (eq 80->0, anomalo), LU0352312853 (MS sum=170.8)
- **3 REVIEW_MANUAL:** LU0121216526 (sum=107.2), FR0010306142 (sum=141.3), LU1548496022 (sum=112.5)
- **19 APPROVE:** candidatos validos

Se seleccionan estos 5 porque:
- MS sum = 100.0 o ~101.0 (sin ambiguedad de escala)
- Cambios explicables por la estrategia del fondo
- Deltas moderados (11-20pp, rango inferior de review_required)
- Mezcla de Grupo B (defensivo) + Grupo C (subtype-aligned) + Grupo A (menor delta)
- Abarcan subtypes variados (CONSERVATIVE, FLEXIBLE, MODERATE)

## 3. ISINs Seleccionados (5)

| # | ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd | MS Sum |
|---|------|--------|---------|--------|--------|------|------|--------|
| 1 | LU1883330521 | Amundi Global Multi-Asset Target Inc A2 | CONSERVATIVE | 20.0 | 31.7 | +11.7 | -29.5 | 101.0 |
| 2 | LU1883340322 | Amundi Pioneer Flexible Opp A | FLEXIBLE | 50.0 | 61.6 | +11.6 | -26.7 | 100.0 |
| 3 | LU1095739733 | First Eagle Amundi Income Builder AE | MODERATE | 50.0 | 61.9 | +11.9 | -29.1 | 100.0 |
| 4 | DE000A0X7541 | Acatis Value Event Fonds A | FLEXIBLE | 50.0 | 63.9 | +13.9 | -30.4 | 100.0 |
| 5 | LU1894680757 | Amundi Income Opportunities A2 | MODERATE | 50.0 | 30.3 | -19.7 | -12.7 | 100.0 |

## 4. Rationale Individual

### LU1883330521 — Amundi Global Multi-Asset Target Income A2
- **Cambio:** CONSERVATIVE 20% -> 31.7% equity
- **Analisis:** MS sum=101.0. Ligeramente mas RV que el conservador tipico. Bond+cash sigue dominando (68.3%).
- **Suitability:** Bajo. Sigue CONSERVATIVE. Perfil no cambia.
- **Recomendacion:** **APPROVE**

### LU1883340322 — Amundi Pioneer Flexible Opportunities A
- **Cambio:** FLEXIBLE 50% -> 61.6% equity
- **Analisis:** MS sum=100.0. Flexible que invierte moderadamente mas en RV. Coherente.
- **Suitability:** Bajo-moderado. Podria afectar bucket en perfiles P4-P5.
- **Recomendacion:** **APPROVE**

### LU1095739733 — First Eagle Amundi Income Builder AE
- **Cambio:** MODERATE 50% -> 61.9% equity
- **Analisis:** MS sum=100.0. Fondo de income que genera rendimiento via RV. Bond baja de 50 a 20.9, cash=8.2, other=9.0.
- **Suitability:** Moderado. Podria afectar clasificacion de agresividad.
- **Recomendacion:** **APPROVE**

### DE000A0X7541 — Acatis Value Event Fonds A
- **Cambio:** FLEXIBLE 50% -> 63.9% equity, other=16.5%
- **Analisis:** MS sum=100.0. Fondo value/event-driven con sesgo natural a RV. other=16.5% son commodities/alternatives, tipico de Acatis.
- **Suitability:** Moderado. Other alto, pero coherente con la estrategia value/event.
- **Recomendacion:** **APPROVE**

### LU1894680757 — Amundi Income Opportunities A2
- **Cambio:** MODERATE 50% -> 30.3% equity
- **Analisis:** MS sum=100.0. Fondo de income puro, mas defensivo que 50/50. Bond=37.0, cash=22.3, other=10.4.
- **Suitability:** Moderado positivo. Se vuelve mas defensivo, mejora suitability para conservadores.
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
portfolio_exposure_v2.{asset_mix, equity_regions, equity_styles, sectors, ...}
```

## 7. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `write_gate_5/selection.json` | 5 ISINs con rationale |
| `write_gate_5/snapshots_before.json` | Snapshots Firestore read-only |
| `write_gate_5/diff_manifest.json` | Before/after + rationale + suitability |
| `write_gate_5/rollback_manifest.json` | Datos para restaurar |
| `write_gate_5/write_approval_manifest.json` | Gate (authorized=false) |

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

**APROBAR** el lote 5 de 5 ISINs. Razones:

- MS sum = 100.0 (4 fondos) o 101.0 (1 fondo) — sin apalancamiento
- Todos los cambios son coherentes con la estrategia declarada
- Deltas en rango 11-20pp, los mas bajos del grupo review_required restante
- Lotes 1-4 (35 fondos) completados sin incidencias confirman la fiabilidad del proceso
- Rollback completo disponible

## 10. Post-Lote 5: Estado

| Categoria | ISINs | Estado |
|-----------|-------|--------|
| Completado (lotes 1-4) | 35 | DONE |
| **Lote 5 (este gate)** | **5** | **PENDIENTE** |
| APPROVE restantes | 14 | Pendiente lotes 6+ |
| REVIEW_MANUAL | 3 | Evaluar individualmente |
| HOLD/BLOCK | 2 | No escribir hasta investigar |
| Sin datos MS | 1 | Mantiene fallback |
