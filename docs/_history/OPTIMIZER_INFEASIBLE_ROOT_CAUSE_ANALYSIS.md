# Análisis de Causa Raíz: Optimizer Infeasible

**Fecha:** 2026-05-04  
**Escenario observado:** Perfil 9, 14 fondos, ~415k EUR  
**Error:** `Solver status: infeasible` → mensaje español en producción

---

## 1. Flujo Completo

```
Frontend (usePortfolioActions.ts)
  → buildOptimizationPayload()
    → optimization_mode: "rebalance_to_profile"
    → risk_level: 9
    → profile_id: "9"
    → apply_profile: true
  → httpsCallable("optimize_portfolio_quant")

Backend (endpoints_portfolio.py)
  → build_constraints_v1()
    → objective: "efficient_risk" (por rebalance_to_profile)
    → target_vol: 0.225 (perfil 9)
    → bucket_bounds: RV (0.95, 1.0), RF (0.0, 0.05), etc.
  → run_optimization() (optimizer_core.py)
    → FASE 1: _build_optimization_context → loads risk_profiles from Firestore
    → FASE 6: _apply_standard_constraints → inyecta ALL constraints al solver
    → FASE 8: _run_solver → ef.efficient_risk(0.225)
    → EXCEPTION → "infeasible_efficient_risk" → return INMEDIATO sin fallback
```

---

## 2. Constraints Activas para Perfil 9

### 2.1 Risk Buckets (SEED / Firestore)

| Bucket | Min | Max |
|---|---|---|
| **RV** | **0.95** | **1.00** |
| RF | 0.00 | 0.05 |
| Mixto | 0.00 | 0.05 |
| Monetario | 0.00 | **0.00** |
| Alternativos | 0.00 | 0.05 |
| Otros | 0.00 | 0.05 |

### 2.2 Solver Parameters

| Parámetro | Valor |
|---|---|
| `max_weight` | 0.20 (20% por fondo) |
| `min_weight` | 0.00 |
| `cutoff` | 0.02 |
| `target_vol` | 0.225 (22.5% anual) |
| `objective` | `efficient_risk` |

### 2.3 Constraints adicionales

- Bucket bounds de `constraints_v1` (duplican Risk Buckets via otro path)
- Possible geographic constraints (europe, emerging)
- L2 regularization (`gamma=2.0` para 14 activos)

---

## 3. Causa Raíz: Doble Estrangulamiento Matemático

### Problema A: `efficient_risk(0.225)` + `RV >= 0.95` + `max_weight = 0.20`

Para cumplir `RV >= 0.95` con `max_weight = 0.20`:
- Se necesitan **al menos 5 fondos puros de equity** (5 × 0.20 = 1.00, de los cuales 0.95 sería RV).
- Pero `efficient_risk(0.225)` exige que la volatilidad del portfolio sea **exactamente 22.5%**.
- Si la volatilidad natural del portfolio de 14 fondos de RV está por encima o por debajo de 22.5%, **el solver no puede encontrar pesos que simultáneamente cumplan**:
  1. `w @ eq_vec >= 0.95` (95% equity)
  2. `portfolio_vol == 0.225` (target vol)
  3. `w[i] <= 0.20` para todo i
  4. `sum(w) == 1.0`

### Problema B: Sin Fallback para `efficient_risk`

```python
# optimizer_core.py L753-767
except Exception as e1:
    if objective == "efficient_risk":
        # RETURN INMEDIATO — NO intenta max_sharpe ni min_vol
        return ef, None, "infeasible_efficient_risk", feasibility
```

Esto es **intencional** según el comentario: *"No degradación silenciosa a max_sharpe si falla efficient_risk."*

Pero el efecto es que **el perfil 9 nunca llega a los fallbacks** (Relaxed Sharpe → Min Vol → Equal Weight) que sí existen para otros objetivos.

### Problema C: Posible sobreconstraining por doble inyección

El código inyecta bucket constraints **DOS VECES**:
1. `bucket_bounds_v1` de constraints_builder (L508-522)
2. `current_risk_buckets` del perfil de Firestore (L560-568)

Ambos aplican las mismas bandas (RV 0.95-1.0, etc.) pero como constraints separadas. Aunque matemáticamente redundante, puede interferir con la resolución del solver.

---

## 4. ¿Bug o Comportamiento Esperado?

**Es un defecto de diseño**, no un bug de código:

- El perfil 9 con `target_vol=0.225` y `RV>=0.95` crea un espacio de soluciones **extremadamente estrecho**.
- La decisión de **no tener fallback para `efficient_risk`** es correcta en filosofía (no queremos dar una solución con vol=5% a un perfil 9), pero no debería ser un dead-end sin explicación.
- El portfolio del usuario probablemente tiene fondos con volatilidad individual que no permite ensamblar exactamente 22.5% agregado bajo las restricciones dadas.

---

## 5. Ordenado por Probabilidad

| # | Causa | Probabilidad | Evidencia |
|---|---|---|---|
| 1 | **`efficient_risk(0.225)` imposible con las constraints de RV>=0.95 + max_weight=0.20** | **Alta** | Espacio de soluciones es un punto casi singular |
| 2 | **Sin fallback para `efficient_risk` fallo** | **Confirmado** | L753-767: return directo sin intentar otros objetivos |
| 3 | Doble inyección de bucket constraints | Media | L508-522 + L560-568 |
| 4 | Fondos mixtos en cartera reducen equity exposure disponible | Media | Si hay fondos con equity<100%, necesita más fondos puros |
| 5 | Vol band demasiado estrecha (±2%) | Baja | `vol_band = 0.205-0.245` |
| 6 | Bug en mapping de asset class/exposure | Baja | V2 taxonomy parece correcto |

---

## 6. Riesgos de Cada Opción de Solución

### Opción 1: Solo mejorar mensaje ✅ (ya hecho)
- **Riesgo:** Ninguno. Pero el usuario sigue sin poder optimizar.

### Opción 2: Relajar constraints del perfil 9
- **Riesgo:** Cambia la política de negocio. RV de 0.95→0.85 permitiría soluciones pero no corresponde a un perfil "muy agresivo".

### Opción 3: Fallback automático para `efficient_risk` ⭐ Recomendada
- **Riesgo:** Bajo. Si `efficient_risk(0.225)` falla, intentar `max_sharpe` con las mismas constraints de perfil.
  - Si `max_sharpe` también falla → intentar `min_vol`.
  - Si todo falla → equal weight filtrado.
- El resultado será una cartera que cumple RV>=0.95 pero con vol diferente a 0.225.
- El frontend ya maneja `status: "fallback"` correctamente.
- Se debe indicar en `solver_path` y `warnings` que se usó degradación.

### Opción 4: Cambiar target_vol del perfil 9
- **Riesgo:** Puede resolver el caso pero depende de la volatilidad real del universo.

### Opción 5: Validar universo antes del solver
- **Riesgo:** Bajo. Pre-check rápido de si equity>=95% es posible con max_weight y el universo.
- No resuelve el vol target pero da mejor diagnóstico.

---

## 7. Recomendación Concreta

**Opción 3: Eliminar el early-return de `efficient_risk` y permitir degradación a la cadena de fallback existente.**

### Cambio mínimo en `optimizer_core.py` L753-767:

```python
# ANTES:
except Exception as e1:
    if objective == "efficient_risk":
        return ef, None, "infeasible_efficient_risk", feasibility  # DEAD END

# DESPUÉS:
except Exception as e1:
    if objective == "efficient_risk":
        logger.info(f"⚠️ Efficient Risk infeasible: {e1}. Intentando fallbacks...")
        # CAER AL FALLBACK CHAIN (max_sharpe → min_vol → equal_weight)
```

Esto permite que el solver intente `max_sharpe` y `min_vol` con las mismas constraints de perfil. El resultado será una cartera viable con status `"fallback"` en vez de un error.

---

## 8. Prompt Recomendado (NO ejecutar todavía)

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Permitir fallback del solver cuando efficient_risk falla.

REGLAS:
- Solo modificar optimizer_core.py.
- NO cambiar constraints, perfiles ni algoritmo.
- NO tocar frontend.
- Solo eliminar el early-return de efficient_risk para que caiga
  al fallback chain existente (max_sharpe → min_vol → equal_weight).

ARCHIVO:
functions_python/services/portfolio/optimizer_core.py

CAMBIO:
En _run_solver(), L753-767:
- Eliminar el bloque "if objective == efficient_risk: return ..."
- Dejar que el except caiga al fallback chain de L769-801.
- Mantener el log de warning.
- Mantener feasibility info en el resultado final si usó fallback.

VERIFICAR:
- python -m py_compile
- No commit, no deploy.
```

---

## 9. Confirmaciones

- ✅ No se modificó código.
- ✅ No se hizo deploy.
- ✅ No se hizo push.
- ✅ No se tocaron rules ni credenciales.
- ✅ Solo diagnóstico y documentación.
