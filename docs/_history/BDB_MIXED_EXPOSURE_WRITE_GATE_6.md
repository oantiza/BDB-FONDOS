# BDB-MIXED-EXPOSURE-WRITE-GATE-6

**Fecha:** 2026-05-10  
**HEAD:** `b044d20`  
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
| Lotes 1-3 (low-risk) | 30 | COMPLETADO |
| Lote 4 (review-req #1) | 5 | COMPLETADO |
| Lote 5 (review-req #2) | 5 | COMPLETADO |
| **Total corregidos** | **40/60** | **67%** |
| **Lote 6 (este gate)** | **5** | **PENDIENTE** |

## 2. Por que estos 5 y no los restantes

De los 14 APPROVE review_required restantes, se seleccionan 5 con:
- MS sum = 100.0 (3 fondos) o ~106-109 (2 fondos con derivados menores, normalizacion fiable)
- Cambio explicable por estrategia declarada del fondo
- Mezcla de perfiles: 2 defensivos (eq baja) + 3 agresivos (eq sube)
- Incluye los casos emblematicos de la auditoria (Brightgate Focus, Olea Neutral)

**No seleccionados (9 restantes):** fondos con deltas muy altos (36-50pp) que se dejarian para lotes 7-8 con revision mas detallada. Tambien se excluyen los 2 HOLD, 3 REVIEW_MANUAL, 1 sin MS.

## 3. ISINs Seleccionados (5)

| # | ISIN | Nombre | Subtype | Old Eq | New Eq | d_Eq | d_Bd | MS Sum |
|---|------|--------|---------|--------|--------|------|------|--------|
| 1 | LU0119195963 | GS Patrimonial Balanced P | MODERATE | 50.0 | 38.7 | -11.3 | -0.8 | 108.7 |
| 2 | ES0118537002 | Olea Neutral FI | MODERATE | 50.0 | 15.5 | -34.5 | +14.9 | 100.0 |
| 3 | LU2050544563 | DWS ESG Multi Asset Dynamic | FLEXIBLE | 50.0 | 76.1 | +26.1 | -32.1 | 100.0 |
| 4 | LU0284394821 | DNCA Invest Evolutif B | FLEXIBLE | 50.0 | 71.5 | +21.5 | -21.5 | 106.4 |
| 5 | ES0114904008 | Brightgate Focus A FI | FLEXIBLE | 50.0 | 85.6 | +35.6 | -50.0 | 100.0 |

## 4. Rationale Individual

### LU0119195963 — GS Patrimonial Balanced P
- **Cambio:** MODERATE 50% -> 38.7% equity
- **MS sum:** 108.7 (ligero apalancamiento via derivados, normalizacion fiable)
- **Analisis:** Genuinamente mas defensivo que 50/50. Bond=49.2%, other=12.1% (alternatives).
- **Suitability:** Moderado. Se vuelve mas defensivo, beneficia conservadores.
- **Recomendacion:** **APPROVE**

### ES0118537002 — Olea Neutral FI
- **Cambio:** MODERATE 50% -> 15.5% equity
- **MS sum:** 100.0 exacto
- **Analisis:** Estrategia market-neutral. Exposicion neta a RV muy baja. El nombre "Neutral" lo confirma. Bond=64.9%, cash=19.6%.
- **Suitability:** Alto pero correcto. Suitability debe reflejar la exposicion neutral real.
- **Recomendacion:** **APPROVE**

### LU2050544563 — DWS ESG Multi Asset Dynamic LC
- **Cambio:** FLEXIBLE 50% -> 76.1% equity
- **MS sum:** 100.0 exacto
- **Analisis:** "Dynamic" en el nombre indica tilt agresivo. eq=76.1% coherente con estrategia dinamica.
- **Suitability:** Moderado. De balanced a dinamico, podria cambiar bucket.
- **Recomendacion:** **APPROVE**

### LU0284394821 — DNCA Invest Evolutif B EUR
- **Cambio:** FLEXIBLE 50% -> 71.5% equity
- **MS sum:** 106.4 (derivados menores, normalizacion fiable)
- **Analisis:** Fondo flexible con sesgo equity. "Evolutif" indica gestion activa con tilt RV.
- **Suitability:** Moderado. De balanced a growth-tilted.
- **Recomendacion:** **APPROVE**

### ES0114904008 — Brightgate Focus A FI
- **Cambio:** FLEXIBLE 50% -> 85.6% equity
- **MS sum:** 100.0 exacto
- **Analisis:** Fondo de acciones concentrado (focus). Conocido como fondo high-conviction equity. El fallback 50/50 era muy incorrecto.
- **Suitability:** Alto pero correcto. Suitability debe reflejar que es esencialmente un fondo de RV.
- **Recomendacion:** **APPROVE**

## 5. Campos que se Tocarian / NO se Tocarian

**SI:** `portfolio_exposure_v2.economic_exposure.{equity,bond,cash,other}`, `exposure_confidence` (0.45->0.85), `warnings`, `computed_at`

**NO:** `manual`, `manual.costs`, `manual.costs.retrocession`, `classification_v2`, `ms`, `derived`, `std_perf`

## 6. Artifacts Generados

| Archivo | Contenido |
|---------|-----------|
| `write_gate_6/selection.json` | 5 ISINs con rationale |
| `write_gate_6/snapshots_before.json` | Snapshots Firestore read-only |
| `write_gate_6/diff_manifest.json` | Before/after + rationale + suitability |
| `write_gate_6/rollback_manifest.json` | Datos para restaurar |
| `write_gate_6/write_approval_manifest.json` | Gate (authorized=false) |

## 7. Approval Manifest

```json
{
  "authorized": false,
  "can_write": false,
  "requires_human_approval": true,
  "selected_count": 5
}
```

## 8. Recomendacion

**APROBAR** el lote 6. Razones:

- MS sum = 100.0 en 3 fondos, ~106-109 en 2 (normalizacion fiable)
- Todos los cambios son coherentes con la estrategia declarada
- Casos emblematicos: Brightgate Focus (equity concentrado), Olea Neutral (market-neutral)
- Lotes 1-5 (40 fondos) completados sin incidencias
- Rollback completo disponible

## 9. Post-Lote 6: Estado

| Categoria | ISINs | Estado |
|-----------|-------|--------|
| Completado (lotes 1-5) | 40 | DONE |
| **Lote 6 (este gate)** | **5** | **PENDIENTE** |
| APPROVE restantes | 9 | Pendiente lotes 7+ |
| REVIEW_MANUAL | 3 | Evaluar individualmente |
| HOLD/BLOCK | 2 | No escribir |
| Sin datos MS | 1 | Mantiene fallback |
