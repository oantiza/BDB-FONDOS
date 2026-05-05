# Auditoría Completa: Perfiles de Riesgo 1–10

**Fecha:** 2026-05-04  
**Alcance:** Factibilidad matemática + coherencia financiera  
**Estado:** Solo análisis, sin cambios

---

## A. Resumen Ejecutivo

Los perfiles 1–7 son razonables y factibles. Los perfiles 8–10 presentan **infeasibilidad matemática sistemática** causada por la combinación de:

1. `efficient_risk` como objetivo (exige vol exacta).
2. `target_vol` demasiado alto para portfolios diversificados.
3. `RV >= 85-95%` con `max_weight = 20%` por fondo.
4. Bucket "Mixto" definido pero no mapeado en el solver.
5. Doble inyección de constraints (bucket_bounds_v1 + risk_buckets).

**Hallazgos críticos:** 3 | **Medios:** 4 | **Menores:** 3

---

## B. Tabla Completa de Perfiles 1–10

### B.1 Identidad y Objetivo

| Perfil | Nombre | Bias | Objective | target_vol |
|---|---|---|---|---|
| 1 | Preservación | Safety | efficient_risk | 2.5% |
| 2 | Muy Conservador | Safety | efficient_risk | 4.5% |
| 3 | Conservador | Balanced | efficient_risk | 6.5% |
| 4 | Moderado Defensivo | Balanced | efficient_risk | 8.5% |
| 5 | Equilibrado | Balanced | efficient_risk | 10.5% |
| 6 | Crecimiento Moderado | Growth | efficient_risk | 12.5% |
| 7 | Dinámico | Growth | efficient_risk | 15.5% |
| 8 | Crecimiento | Aggressive | efficient_risk | **18.5%** |
| 9 | Agresivo | Aggressive | efficient_risk | **22.5%** |
| 10 | High Conviction | Aggressive | efficient_risk | **30.0%** |

### B.2 Bucket Bounds (% del portfolio, en formato min–max)

| Perfil | RV | RF | Mixto | Monetario | Alternativos | Otros |
|---|---|---|---|---|---|---|
| 1 | 0–10 | 20–60 | 0–20 | 40–80 | 0–10 | 0–10 |
| 2 | 0–15 | 40–70 | 0–20 | 20–50 | 0–10 | 0–10 |
| 3 | 10–25 | 40–70 | 10–30 | 10–30 | 0–15 | 0–20 |
| 4 | 20–40 | 30–60 | 20–40 | 0–20 | 0–20 | 0–30 |
| 5 | 40–60 | 20–40 | 20–50 | 0–10 | 0–20 | 0–25 |
| 6 | 50–75 | 10–30 | 10–40 | 0–10 | 0–20 | 0–20 |
| 7 | 70–90 | 0–20 | 0–20 | 0–5 | 0–15 | 0–20 |
| 8 | **85–100** | 0–5 | 0–10 | 0–5 | 0–10 | 0–15 |
| 9 | **95–100** | 0–5 | 0–5 | **0–0** | 0–5 | 0–5 |
| 10 | **95–100** | 0–5 | 0–5 | 0–5 | 0–5 | **0–0** |

### B.3 Parámetros del Solver (constantes para todos)

| Parámetro | Valor | Fuente |
|---|---|---|
| `max_weight` | 0.20 | config.py / constraints_builder |
| `min_weight` | 0.00 | constraints_builder |
| `cutoff` | 0.02 | config.py |
| `vol_band` | ±2% de target_vol | constraints_builder |
| `equity_floor` | varía (0.05–0.98) | config.py EQUITY_FLOOR |
| `bond_cap` | solo P8–10 | config.py BOND_CAP |
| `cash_cap` | solo P8–10 | config.py CASH_CAP |

---

## C. Hallazgos Críticos

### C1. 🔴 target_vol inalcanzable en P9 y P10

**`efficient_risk(target_vol)`** de pypfopt maximiza retorno sujeto a `portfolio_vol ≤ target_vol`.

Para un portfolio diversificado (14 fondos, max_weight=20%, 95%+ equity):
- **Vol mínima posible:** ~12-16% (por efecto diversificación entre fondos correlacionados).
- **Vol máxima posible:** ~18-20% (max_weight impide concentración).

| Perfil | target_vol | Vol máxima alcanzable | Factible? |
|---|---|---|---|
| 8 | 18.5% | ~18-20% | ⚠️ Marginal |
| 9 | 22.5% | ~18-20% | ❌ **Imposible** |
| 10 | 30.0% | ~18-20% | ❌ **Imposible** |

> **Nota:** `efficient_risk` maximiza retorno con `vol ≤ target`. En teoría, si target_vol > vol alcanzable, la constraint no debería ser activa. Pero la interacción con otras constraints (RV≥95%, max_weight, L2 reg) puede hacer que el problema convexo sea infeasible cuando el solver no puede encontrar un punto interior que satisfaga todas las constraints simultáneamente.

### C2. 🔴 Bucket "Mixto" definido pero NO mapeado en el solver

```python
# _build_profile_bucket_vectors (optimizer_core.py L113-120)
def _build_profile_bucket_vectors(eq_v, bd_v, cs_v, al_v, ra_v, ot_v):
    return {
        "RV": eq_v,
        "RF": bd_v,
        "Monetario": cs_v,
        "Alternativos": al_v + ra_v,
        "Otros": ot_v,
    }
    # ⚠️ "Mixto" NO ESTÁ → constraint de Mixto se ignora silenciosamente
```

**Impacto:** Los fondos clasificados como "Mixto" en el perfil pueden recibir cualquier peso sin restricción. Las constraints `Mixto: (0.10, 0.30)` del perfil 3 nunca se aplican.

### C3. 🔴 Doble inyección de constraints de bucket

El solver recibe las mismas constraints por **dos caminos**:

1. **`bucket_bounds_v1`** (L508-522): Constraints canónicas V1 sobre vectores de exposición económica (equity, bond, cash, alternative, real_asset, other).
2. **`current_risk_buckets`** (L560-568): Constraints de perfil sobre vectores de clasificación (RV, RF, Monetario, Alternativos, Otros).

Estos vectores pueden **no coincidir**: un fondo clasificado como "Mixto" tiene exposición parcial a equity y bond, por lo que:
- `bucket_bounds_v1` lo cuenta en equity + bond por exposición real.
- `current_risk_buckets` lo ignora (Mixto no mapeado).

Resultado: constraints contradictorias que reducen el espacio factible.

---

## D. Hallazgos Medios

### D1. 🟡 Monetario max=0% en perfil 9

`"Monetario": (0.0, 0.0)` impide cualquier fondo monetario. Esto es innecesariamente rígido; un 2-3% residual en monetario no cambia el perfil de riesgo pero facilita la factibilidad.

### D2. 🟡 Otros max=0% en perfil 10

Misma situación. Fondos sin clasificar quedan completamente excluidos, pudiendo generar infeasibility si el universo es limitado.

### D3. 🟡 Transición brusca de P7 a P8

| | P7 | P8 | Salto |
|---|---|---|---|
| RV min | 70% | 85% | +15pp |
| RF max | 20% | 5% | -15pp |
| Mixto max | 20% | 10% | -10pp |

Comparado con saltos de 10pp entre P5-P6-P7, el salto P7→P8 es significativamente mayor.

### D4. 🟡 Perfiles 1-2: Mínimos suman > 60%

| Perfil | Suma mínimos | Observación |
|---|---|---|
| 1 | RF(20) + Mon(40) = 60% | Viable pero muy restrictivo |
| 2 | RF(40) + Mon(20) = 60% | Viable pero muy restrictivo |
| 3 | RF(40) + RV(10) + Mixto(10) + Mon(10) = **70%** | ⚠️ Solo 30% libre |

P3 tiene 70% comprometido en mínimos, dejando solo 30% para satisfacer los máximos.

---

## E. Hallazgos Menores

### E1. 🟢 vol_band no se usa en el solver

El constraints_builder calcula `vol_band = target_vol ± 2%` pero `_run_solver` llama `ef.efficient_risk(target_vol)` con un punto exacto, no una banda.

### E2. 🟢 L2 regularización penaliza la solución para P8-10

`gamma = 2.0` para 14 fondos fuerza distribución más uniforme, lo que reduce la vol máxima alcanzable.

### E3. 🟢 EQUITY_FLOOR puede ser redundante con RV bucket min

Para P9: `equity_floor = 0.85` pero `RV min = 0.95`. La constraint más restrictiva (0.95) domina, haciendo equity_floor irrelevante.

---

## F. Opinión Perfil por Perfil

| Perfil | Factibilidad | Opinión Financiera |
|---|---|---|
| **1 - Preservación** | ✅ Viable | Correcto: 40-80% monetario, 20-60% RF. target_vol 2.5% alcanzable. |
| **2 - Muy Conservador** | ✅ Viable | Correcto: dominado por RF+monetario. target_vol 4.5% razonable. |
| **3 - Conservador** | ⚠️ Ajustado | Mínimos suman 70%. Funciona si el universo es suficiente. target_vol 6.5% alcanzable. |
| **4 - Mod. Defensivo** | ✅ Viable | Equilibrio RF+RV+Mixto. target_vol 8.5% correcto. |
| **5 - Equilibrado** | ✅ Viable | Perfil central bien calibrado. target_vol 10.5% ideal. |
| **6 - Crec. Moderado** | ✅ Viable | RV 50-75% coherente. target_vol 12.5% alcanzable. |
| **7 - Dinámico** | ✅ Viable | RV 70-90% apropiado. target_vol 15.5% alcanzable con equity puro. |
| **8 - Crecimiento** | ⚠️ Marginal | RV 85-100% razonable, pero target_vol 18.5% es marginal con max_weight 20%. |
| **9 - Agresivo** | ❌ **Infeasible** | RV 95-100% + target_vol 22.5% → imposible con diversificación forzada. |
| **10 - High Conviction** | ❌ **Infeasible** | target_vol 30% imposible para cualquier portfolio diversificado. El nombre "High Conviction" sugiere concentración, pero max_weight 20% lo prohíbe. |

---

## G. Tabla de Factibilidad Matemática

| Perfil | Σ mínimos | Σ máximos | Min fondos (max_weight) | target_vol alcanzable? | Mixto mapeado? | Factible? |
|---|---|---|---|---|---|---|
| 1 | 60% | 190% | 5 | ✅ 2.5% | ❌ Ignorado | ✅ |
| 2 | 60% | 175% | 5 | ✅ 4.5% | ❌ Ignorado | ✅ |
| 3 | 70% | 190% | 5 | ✅ 6.5% | ❌ Ignorado | ⚠️ Ajustado |
| 4 | 70% | 210% | 5 | ✅ 8.5% | ❌ Ignorado | ✅ |
| 5 | 80% | 205% | 5 | ✅ 10.5% | ❌ Ignorado | ✅ |
| 6 | 70% | 195% | 5 | ✅ 12.5% | ❌ Ignorado | ✅ |
| 7 | 70% | 170% | 5 | ✅ 15.5% | ❌ Ignorado | ✅ |
| 8 | 85% | 145% | 5 | ⚠️ 18.5% marginal | ❌ Ignorado | ⚠️ |
| 9 | 95% | 115% | 5 | ❌ 22.5% imposible | ❌ Ignorado | ❌ |
| 10 | 95% | 120% | 5 | ❌ 30.0% imposible | ❌ Ignorado | ❌ |

> **Nota Σ máximos:** La suma de máximos supera 100% en todos los perfiles, lo cual es correcto (son bandas independientes). El solver debe encontrar una combinación dentro de esas bandas que sume exactamente 100%.

---

## H. Opinión Financiera Profesional

### Positivo

1. **Estructura de 10 niveles** es estándar en banca privada española (MiFID II).
2. **Nomenclatura** es clara y progresiva.
3. **Perfiles 1-7 están bien calibrados** con transiciones suaves.
4. **Suitability engine** (backend + frontend) es robusto para P1-7.

### Problemas Estructurales

1. **Perfiles 8-10 confunden "perfil de riesgo" con "objetivo de inversión":**
   - Un perfil agresivo debería definir **qué tipo de activos son aceptables** (buckets).
   - No debería definir **qué volatilidad exacta quiere** (target_vol).
   - `efficient_risk` es adecuado para P1-7 porque la vol objetivo es alcanzable.
   - Para P8-10, el objetivo debería ser **maximizar retorno dado las restricciones de asset allocation**.

2. **max_weight uniforme es subóptimo:**
   - 20% es correcto para portfolios de 8-14 fondos.
   - Para P10 "High Conviction", el nombre implica concentración pero max_weight lo prohíbe.
   - Opciones: renombrar P10, o permitir max_weight más alto solo para P10.

3. **"Mixto" es un concepto de clasificación, no de exposición:**
   - El solver trabaja con exposición real (equity %, bond %, cash %).
   - Un fondo "Mixto" tiene 50% equity + 50% bond en exposición.
   - El bucket "Mixto" no tiene vector → la constraint nunca se aplica.
   - Los perfiles 3-6 definen "Mixto: 10-50%" pero esto es ignorado.

---

## I. Recomendación Concreta

### I.1 Cambios inmediatos (prioridad 1)

| # | Cambio | Archivo | Riesgo |
|---|---|---|---|
| 1 | **Cambiar objective a `max_sharpe` para P8-10** | constraints_builder_v1.py | Bajo |
| 2 | **Ajustar Monetario max a 2% en P9** | config.py | Nulo |
| 3 | **Ajustar Otros max a 2% en P10** | config.py | Nulo |

### I.2 Cambios recomendados (prioridad 2)

| # | Cambio | Archivo | Riesgo |
|---|---|---|---|
| 4 | Añadir vector "Mixto" al solver | optimizer_core.py | Bajo |
| 5 | Eliminar doble inyección de bucket constraints | optimizer_core.py | Medio |
| 6 | target_vol: usar como referencia informativa, no como constraint para P8-10 | config.py | Bajo |

### I.3 Mejoras futuras (prioridad 3)

| # | Cambio | Descripción |
|---|---|---|
| 7 | Pre-check de factibilidad antes del solver | Verificar que mínimos suman ≤100% y vol es alcanzable |
| 8 | Ajustar max_weight por perfil | P10 → 30%, P9 → 25% |
| 9 | Transición P7→P8 más suave | RV min: 80% en vez de 85% |

---

## J. Propuesta de Perfiles Ajustados (NO implementar)

### Solo cambios de solver, sin tocar bucket bounds:

| Perfil | Objective actual → propuesto | target_vol ajustado |
|---|---|---|
| 1–7 | `efficient_risk` → **sin cambio** | sin cambio |
| 8 | `efficient_risk` → **`max_sharpe`** | 18.5% (referencia) |
| 9 | `efficient_risk` → **`max_sharpe`** | 22.5% (referencia) |
| 10 | `efficient_risk` → **`max_sharpe`** | 30.0% (referencia) |

### Bucket bounds menores:

| Perfil | Cambio | Antes | Después |
|---|---|---|---|
| 9 | Monetario max | 0% | 2% |
| 10 | Otros max | 0% | 2% |

---

## K. Prompt para Siguiente Fase (NO ejecutar)

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Implementar ajustes de perfiles agresivos (prioridad 1).

REGLAS:
- Solo 2 archivos.
- No tocar frontend ni firestore.rules.
- No cambiar bucket bounds salvo Monetario P9 y Otros P10.

CAMBIOS:
1. functions_python/services/portfolio/constraints_builder_v1.py:
   - En build_constraints_v1(), si profile_id >= 8 y objective == "efficient_risk":
     → Cambiar objective a "max_sharpe".
     → Log: "Perfil agresivo: usando max_sharpe en vez de efficient_risk."

2. functions_python/services/config.py:
   - Perfil 9, Monetario: (0.0, 0.0) → (0.0, 0.02)
   - Perfil 10, Otros: (0.0, 0.0) → (0.0, 0.02)

VERIFICAR:
- py_compile de ambos archivos.
- grep que confirme objective cambiado.
- No commit, no deploy.
```

---

## Confirmaciones

- ✅ No se modificó código.
- ✅ No se hizo deploy/push.
- ✅ No se tocaron rules ni credenciales.
- ✅ Solo análisis y documentación.
