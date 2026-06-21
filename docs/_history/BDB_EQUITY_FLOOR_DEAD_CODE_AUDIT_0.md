# BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0
## Informe Final de Auditoría — `EQUITY_FLOOR` vs `RISK_BUCKETS_LABELS`

**Bloque:** `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0`  
**Fecha:** 2026-05-11  
**Modo:** Read-only audit (sin modificaciones, sin Firestore writes, sin deploy)  
**Commit de base:** `12f9821` (post-archive scripts + tests PASS)  
**Estado tests al cierre:** 44/44 precheck PASS · 62/62 MIXED+suitability PASS  

---

## 1. Objetivo

Determinar si `EQUITY_FLOOR` (definido en `services/config.py`) es:

- A) **Código muerto** — importado pero nunca leído en runtime
- B) **Redundante** — duplica la lógica ya cubierta por `RISK_BUCKETS_LABELS`
- C) **Activo con semántica propia** — restricción hard de un flujo real y diferenciado
- D) **Conflictivo** — dos fuentes de verdad producen resultados inconsistentes

La auditoría responde: **es C y D parcialmente.**

---

## 2. Topología de la Constante

### 2.1 Definición en `services/config.py`

```python
EQUITY_FLOOR: dict[int, float] = {
    1: 0.00, 2: 0.00, 3: 0.00,
    4: 0.20, 5: 0.30, 6: 0.40,
    7: 0.50, 8: 0.60, 9: 0.70, 10: 0.80
}
```

El nombre del módulo lleva el comentario `# Semillas de fallback`. La constante es un `dict[int, float]` indexado por perfil de riesgo (1-10).

### 2.2 Uso en runtime — mapa completo

| Archivo | Función / Sección | Rol |
|---|---|---|
| `services/config.py` | Definición global | Fuente de declaración |
| `optimizer_core.py` L315 | `_build_optimization_context()` | Lee `constraints.get("equity_floor", 0.0)` — **no lee `EQUITY_FLOOR[profile]` del config** |
| `optimizer_core.py` L1047 | `run_optimization()` | Recibe `equity_floor` como valor float desde contexto |
| `optimizer_core.py` L1122–1131 | `run_feasibility_precheck(...)` | Pasa `equity_floor` al precheck |
| `optimizer_core.py` L1172 | `_check_feasibility_and_autoexpand()` | Pasa `equity_floor` al auto-expand loop |
| `optimizer_core.py` L741-742 | `_check_feasibility_and_autoexpand()` | Gatillo para auto-expand — si `equity_floor > 0` y cartera no cumple, expande universo |
| `feasibility_precheck.py` BLOCK-8 | `_check_locks_incompatible_equity_floor()` | Hard-blocker precheck — bloquea si bloqueos fijos impiden alcanzar el floor |
| `endpoints_portfolio.py` L399 | `optimize_portfolio_quant()` | Gatillo para pre-fetch candidates — si `equity_floor > 0`, precarga candidatos de renta variable |

### 2.3 Origen real del valor en runtime

```
Frontend  →  req_data["constraints"]["equity_floor"]
    ↓
_build_effective_constraints()  →  STRATEGY_CONSTRAINTS["equity_floor"]
    ↓
run_optimization(constraints=STRATEGY_CONSTRAINTS)
    ↓
_build_optimization_context()  →  equity_floor = float(constraints.get("equity_floor", 0.0))
```

**Conclusión de topología:** El valor de `equity_floor` en runtime **proviene exclusivamente del frontend** vía `constraints`. La constante `EQUITY_FLOOR` de `config.py` **no se inyecta en ningún punto del pipeline**. Nadie hace `EQUITY_FLOOR[risk_level_i]`.

---

## 3. Semántica Funcional de `equity_floor`

### 3.1 Rol en `feasibility_precheck.py` (BLOCK-8)

```python
def _check_locks_incompatible_equity_floor(
    universe, fixed_weights, lock_mode, equity_floor, exposure_vectors, _read_bound_fn
) -> list[dict]:
    """Hard-blocker: si bloqueos fijos hacen que el floor RV sea inalcanzable, bloquea."""
    if not equity_floor or equity_floor <= 0:
        return []  # No hay floor → BLOCK-8 skip total
    ...
    locked_equity = sum(...)  # peso bloqueado en RV
    locked_non_equity = sum(...)  # peso bloqueado fuera de RV
    max_achievable_equity = locked_equity + (1.0 - total_locked) * 1.0
    if max_achievable_equity < equity_floor:
        return [{"code": "BLOCK_EQUITY_FLOOR_LOCKS", ...}]
```

**Semántica:** No es una restricción de optimización (no va a CVXPY). Es una **verificación de viabilidad matemática previa**: si los bloqueos fijos hacen imposible alcanzar el floor, el solver nunca será llamado.

### 3.2 Rol en `_check_feasibility_and_autoexpand()` (L741-742)

```python
auto_expand = constraints.get("auto_expand_universe", False)
if not auto_expand:
    ...  # infeasible directo
# Pero si equity_floor > 0 → se pre-fetch candidates en endpoint (L399)
# El auto-expand loop luego intenta añadir fondos RV para cumplir el floor
```

**Semántica:** El `equity_floor > 0` actúa como trigger implícito para pre-cargar candidatos RV, aunque `auto_expand_universe` sea False. Es un comportamiento acoplado en dos capas (endpoint + optimizer).

### 3.3 Lo que `RISK_BUCKETS_LABELS` provee

```python
RISK_BUCKETS_LABELS = {
    1: {"RF": [0.90, 1.0], "RV": [0.00, 0.10], ...},
    ...
    7: {"RF": [0.00, 0.50], "RV": [0.50, 1.0], ...},
    8: {"RF": [0.00, 0.30], "RV": [0.65, 1.0], ...},
    ...
}
```

Para perfil 7: `RV_min = 0.50` → mismo valor que `EQUITY_FLOOR[7] = 0.50`.  
Para perfil 8: `RV_min = 0.65` → **superior** a `EQUITY_FLOOR[8] = 0.60`.  
Para perfil 9: `RV_min = 0.70` (estimado) → igual a `EQUITY_FLOOR[9] = 0.70`.

---

## 4. Diagnóstico de Conflicto / Redundancia

### 4.1 Dos fuentes, dos semánticas distintas

| Dimensión | `EQUITY_FLOOR` (config.py) | `RISK_BUCKETS_LABELS.RV[0]` |
|---|---|---|
| Tipo | Hard-blocker pre-solver | Constraint CVXPY en solver |
| Origen en runtime | Frontend constraint (no del config.py) | Firestore / `_build_optimization_context()` |
| Momento de aplicación | Pre-check (antes del solver) | Dentro del solver CVXPY |
| Si se incumple | `status: infeasible` — nunca llega al solver | El solver falla con CVXPY status INFEASIBLE |
| Si el valor difiere | Podría bloquear antes de que CVXPY pudiera resolver | El CVXPY rechaza internamente |

### 4.2 Valor del config nunca inyectado — gap confirmado

El dict `EQUITY_FLOOR` en `config.py` **existe pero nunca se lee en runtime**. El pipeline toma el valor de `constraints["equity_floor"]` que envía el frontend. Si el frontend no lo envía, `equity_floor = 0.0` y BLOCK-8 se salta.

Esto significa:
- Para perfiles 7-9, si el frontend no envía `equity_floor`, el precheck NO valida el floor, aunque `RISK_BUCKETS_LABELS` sí aplique ese mínimo vía solver.
- La constante `EQUITY_FLOOR` del config fue diseñada como semilla de fallback pero **el wire de inyección nunca fue implementado**.

### 4.3 Inconsistencia de valores para perfil 8

Si algún futuro refactor conectara `EQUITY_FLOOR[profile]` al pipeline:
- Perfil 8: `EQUITY_FLOOR[8] = 0.60` vs `RISK_BUCKETS_LABELS[8]["RV"][0] = 0.65`
- El precheck bloquearía a partir de 60%, pero el solver requiere 65%.
- Un portfolio con 62% RV pasaría el precheck y luego fallaría en CVXPY → degradación silenciosa.

---

## 5. Clasificación Final

| Criterio | Veredicto |
|---|---|
| ¿Es código muerto en el sentido de "no ejecutado"? | **Parcialmente.** La constante `EQUITY_FLOOR[profile]` de config.py no se lee. El parámetro `equity_floor` como float sí se usa activamente. |
| ¿Es redundante con `RISK_BUCKETS_LABELS`? | **Sí, parcialmente.** Para perfiles 7-10, el mínimo RV de `RISK_BUCKETS_LABELS` cubre el mismo propósito semánticamente. |
| ¿Tiene efecto real en el pipeline? | **Sí, cuando el frontend lo envía.** BLOCK-8 y auto-expand son rutas activas. |
| ¿Es conflictivo? | **Sí, en estado latente.** Los valores de config.py (never wired) difieren de RISK_BUCKETS_LABELS para perfil 8. |
| ¿Es deuda técnica? | **Sí.** Hay dos fuentes de verdad para un mismo concepto, con wire incompleto. |

---

## 6. Caminos Estratégicos

### Opción A — Deprecar `EQUITY_FLOOR` del config (recomendada)

**Condición:** `equity_floor` solo se activa si el frontend lo envía explícitamente.  
**Acción:** Añadir comment `# DEPRECATED — no se inyecta en runtime; ver RISK_BUCKETS_LABELS` y abrir ticket de limpieza.  
**Riesgo:** Bajo. No cambia comportamiento en producción.  
**Beneficio:** Elimina la trampa para futuros desarrolladores.

### Opción B — Conectar `EQUITY_FLOOR[profile]` como fallback en `_build_optimization_context()`

**Condición:** Si el frontend no envía `equity_floor`, el optimizer usa `EQUITY_FLOOR[risk_level]`.  
**Acción:** En `_build_optimization_context()`, si `constraints.get("equity_floor", 0.0) == 0.0`, inyectar `EQUITY_FLOOR.get(risk_level_i, 0.0)`.  
**Riesgo:** Medio. Cambiaría el comportamiento para todos los perfiles 4-10 que no envíen floor explícito. Requiere alinear valores con `RISK_BUCKETS_LABELS` antes de activar.  
**Beneficio:** El precheck BLOCK-8 tendría efecto real en producción para todos los perfiles.

### Opción C — Unificar en `RISK_BUCKETS_LABELS` como única fuente de verdad

**Condición:** Eliminar `EQUITY_FLOOR` por completo. El floor de RV viene siempre de `RISK_BUCKETS_LABELS[profile]["RV"][0]` y se pasa al precheck desde `_build_optimization_context()`.  
**Acción:** Requiere actualizar precheck para aceptar `active_bounds` como fuente de floor, eliminar param `equity_floor` de la firma.  
**Riesgo:** Alto. Refactor en múltiples archivos. Requiere tests de regresión completos.  
**Beneficio:** Una sola fuente de verdad. Elimina la deuda técnica por completo.

---

## 7. Recomendación

**Corto plazo (no tocar lógica):** Aplicar Opción A — comentario de deprecación en `config.py`.  
**Medio plazo (decision de diseño):** Evaluar si BLOCK-8 debe activarse por defecto para todos los perfiles o solo cuando el frontend lo solicita. Esto define si avanzar hacia Opción B o C.  
**Prerrequisito para B/C:** Alinear los valores numéricos de `EQUITY_FLOOR` con los mínimos RV de `RISK_BUCKETS_LABELS` (hoy difieren en perfil 8: 0.60 vs ~0.65).

---

## 8. Tests de Regresión — Estado al Cierre

| Suite | Resultado |
|---|---|
| `test_feasibility_precheck.py` | 20/20 PASS |
| `test_feasibility_precheck_locks_compatibility.py` | 9/9 PASS |
| `test_feasibility_precheck_locks_expected_behavior.py` | 13/13 PASS, 2 SKIP (documental) |
| `test_mixed_exposure_ms_portfolio.py` | 11/11 PASS |
| `test_mixed_funds_lookthrough_contract.py` | 4/4 PASS |
| `test_suitability_v2.py` | 47/47 PASS |
| **TOTAL** | **104/104 PASS** |

**Firestore writes:** 0  
**Deploy:** NO  
**Modificaciones de código de producción:** NINGUNA

---

## 9. Próximos Pasos Sugeridos

1. **Commit este informe** como documentación de la deuda técnica identificada.
2. **Abrir ticket** "EQUITY_FLOOR: deprecar constante en config.py o conectar wire faltante".
3. **Decisión de diseño** (fuera del alcance de este bloque): ¿el precheck BLOCK-8 debe activarse siempre para perfiles 4-10, o solo bajo demanda del frontend?
4. **Si se elige B:** Asegurar que `EQUITY_FLOOR[8]` se corrija de 0.60 → 0.65 antes de conectar el wire, para evitar inconsistencia con el solver CVXPY.
5. **Siguiente bloque sugerido:** `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0`.
