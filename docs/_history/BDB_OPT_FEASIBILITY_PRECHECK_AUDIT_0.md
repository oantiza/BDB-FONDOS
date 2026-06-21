# BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0

## Resumen ejecutivo

Auditoría **read-only** de las validaciones de factibilidad existentes antes, durante y
después del solver de optimización de carteras. El objetivo es mapear todas las barreras
que pueden generar `infeasible`, identificar gaps no cubiertos, y proponer mejoras sin
implementar cambios.

**ESTADO: ✅ BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0_READY_FOR_REVIEW**

---

## Estado Git

| Campo | Valor |
|---|---|
| HEAD (local) | `caa2bd2` |
| origin/master | `3b07886` |
| Commit pendiente push | `caa2bd2 OPTIMIZER_CONTRACT: harden retry payload path` |
| Working tree | CLEAN (solo untracked preexistentes) |
| Código modificado | ❌ NO |

---

## Arquitectura de validaciones — Pipeline completo

```
Frontend (usePortfolioActions.ts)
  └─ buildOptimizationPayload()
      └─ optimizeFn(payload)
          └─ endpoints_portfolio.py :: optimize_portfolio_quant()
              ├─ FASE 0: Validaciones de entrada (assets, risk_level)
              ├─ FASE 1: build_constraints_v1() ─ constraints_builder_v1.py
              │   └─ Profile ≥ 8: force max_sharpe over efficient_risk
              ├─ FASE 2: _apply_suitability_filter()
              ├─ FASE 3-4: Data fetch & price matrix
              ├─ FASE 5: Delegation to run_optimization()
              │   ├─ FASE 5.5a: _build_optimization_context()
              │   │   └─ equity_floor, bond_cap, cash_cap extraction
              │   ├─ FASE 5.5b: ✅ run_feasibility_precheck() ← PHASE 1 PRECHECKS
              │   │   ├─ BLOCK-5: Empty universe
              │   │   ├─ BLOCK-1: Universe too small for max_weight
              │   │   ├─ BLOCK-4: Fixed weights exceed 100%
              │   │   ├─ BLOCK-2: Bucket mins exceed 100%
              │   │   ├─ BLOCK-3: Bucket maxs below 100%
              │   │   └─ BLOCK-6: Bucket not representable
              │   ├─ FASE 5.5c: _reconcile_bucket_vs_profile()
              │   ├─ FASE 6: _apply_standard_constraints() → CVXPY constraints
              │   ├─ FASE 7: _check_feasibility_and_autoexpand()
              │   │   └─ equity_floor check (greedy estimation)
              │   ├─ FASE 8: _run_solver() → EfficientFrontier
              │   │   ├─ Primary objective
              │   │   ├─ Fallback 1: Relaxed Sharpe
              │   │   ├─ Fallback 2: Min Volatility
              │   │   └─ Fallback 3: Equal-Weight degradation
              │   ├─ FASE 9: _postprocess_weights() → cutoff + normalize
              │   └─ FASE 10: _validate_optimizer_result() → compliance
              └─ Response → Frontend status handler
                  ├─ optimal_compliant → accept
                  ├─ fallback_compliant → accept with warning
                  ├─ infeasible → retry dialog (recovery_candidates)
                  ├─ infeasible_equity_floor → retry dialog (auto_expand)
                  ├─ fallback_no_history → retry dialog (auto_expand)
                  ├─ infeasible_constraints → toast error
                  ├─ auto_expand_failed → toast error
                  ├─ fallback_non_compliant → toast error (generic)
                  └─ error → toast error
```

---

## Qué valida hoy

### Fase Pre-Solver: `run_feasibility_precheck()` (Phase 1)

| Check | Code | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|---|
| **BLOCK-5** | `BLOCK_EMPTY_UNIVERSE` | Pre-solver | ✅ BLOCK | Universo vacío tras filtros |
| **BLOCK-1** | `BLOCK_UNIVERSE_TOO_SMALL` | Pre-solver | ✅ BLOCK | n × max_weight < 1.0 |
| **BLOCK-4** | `BLOCK_FIXED_WEIGHTS_EXCEED_100` | Pre-solver | ✅ BLOCK | Σ fixed_weights > 100% |
| **BLOCK-2** | `BLOCK_BUCKET_MINS_EXCEED_100` | Pre-solver | ✅ BLOCK | Σ bucket_min > 100% |
| **BLOCK-3** | `BLOCK_BUCKET_MAXS_BELOW_100` | Pre-solver | ✅ BLOCK | Σ bucket_max < 100% (all explicit) |
| **BLOCK-6** | `BLOCK_BUCKET_NOT_REPRESENTABLE` | Pre-solver | ✅ BLOCK | Bucket min > 0 pero 0 exposure en universo |

### Fase Pre-Solver: `_reconcile_bucket_vs_profile()`

| Check | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|
| v1 min > profile max | Pre-solver | ❌ RELAX | Auto-ajusta profile max al v1 min |
| v1 max < profile min | Pre-solver | ❌ RELAX | Auto-ajusta profile min al v1 max |

### Fase Pre-Solver: `_check_feasibility_and_autoexpand()` (equity_floor)

| Check | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|
| Greedy equity estimation | Pre-solver | CONDITIONAL | Si `achieved_equity < equity_floor`: devuelve `infeasible_equity_floor` |
| Auto-expand candidates | Pre-solver | CONDITIONAL | Si `auto_expand_universe=true` y hay candidatos, amplia universo |
| Expand failed | Pre-solver | ✅ BLOCK | No hay candidatos válidos: `auto_expand_failed` |

### Fase Solver: `_run_solver()`

| Check | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|
| CVXPY infeasibility | Solver | FALLBACK | Intenta Relaxed Sharpe → Min Vol → Equal-Weight |
| efficient_risk target_vol | Solver | FALLBACK | Si target_vol inalcanzable → `infeasible_efficient_risk` |

### Fase Post-Solver: `_validate_optimizer_result()`

| Check | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|
| Missing weight for used asset | Post-solver | VIOLATION | `MISSING_USED_ASSET_WEIGHT` |
| Non-numeric weight | Post-solver | VIOLATION | `NON_NUMERIC_WEIGHT` |
| Non-finite weight | Post-solver | VIOLATION | `NON_FINITE_WEIGHT` |
| Negative weight | Post-solver | VIOLATION | `NEGATIVE_WEIGHT` |
| Sum ≠ 1.0 | Post-solver | VIOLATION | `WEIGHT_SUM_NOT_ONE` |
| Bucket min violation | Post-solver | VIOLATION | `BUCKET_MIN_VIOLATION` |
| Bucket max violation | Post-solver | VIOLATION | `BUCKET_MAX_VIOLATION` |

### Fase Post-Solver: `_postprocess_weights()` (cutoff)

| Check | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|
| Non-finite weight | Post-process | ✅ RAISE | `NON_FINITE_WEIGHT:isin` |
| Negative weight | Post-process | ✅ RAISE | `NEGATIVE_WEIGHT:isin:value` |

### Constraints Builder: `constraints_builder_v1.py`

| Check | Tipo | ¿Bloquea? | Descripción |
|---|---|---|---|
| Profile ≥ 8 + efficient_risk | Builder | ❌ REDIRECT | Redirige a max_sharpe automáticamente |
| lock_mode validation | Builder | ❌ SANITIZE | Normaliza a keep_weight si inválido |
| _sanitize_01 | Builder | ❌ SANITIZE | Clamp a [0,1], auto-divide >1.0 por 100 |

---

## Qué NO valida hoy

### HIGH — Puede generar cartera inválida o error confuso

| Gap | Severidad | Explicación |
|---|---|---|
| **GAP-H1: Locks vs bucket compatibility** | 🔴 HIGH | Si un usuario bloquea 60% en RF (`keep_weight`) y el perfil exige RV min=85%, la precheck no detecta que los locks hacen imposible cumplir las bandas RV. El solver falla con un CVXPY infeasible que cae a fallback silencioso. |
| **GAP-H2: Fixed weights vs equity_floor** | 🔴 HIGH | `_check_feasibility_and_autoexpand` calcula equity alcanzable con greedy weights, pero NO descuenta el presupuesto fijo consumido por locks en RF/cash. Un usuario puede tener fixed_weights en RF que impiden alcanzar equity_floor, pero el check no lo detecta correctamente. |
| **GAP-H3: Post-cutoff compliance break** | 🔴 HIGH | `_postprocess_weights()` aplica `clean_weights(cutoff)` que elimina pesos < cutoff y redistribuye. Después, `_validate_optimizer_result()` verifica buckets. Si el cutoff eliminó un fondo clave (ej. el único con exposure cash), la validación post puede detectar violación PERO el status es `fallback_non_compliant` y NO se reintenta. El usuario recibe la cartera no-compliant sin explicación clara. |
| **GAP-H4: `infeasible_constraints` no distingue causa** | 🔴 HIGH | Cuando `efficient_risk` falla y los fallbacks también fallan, el status `infeasible_constraints` devuelve la excepción de CVXPY sin descomponer qué restricción específica lo causó. El frontend muestra un mensaje genérico. |

### MEDIUM — Puede producir fallback innecesario

| Gap | Severidad | Explicación |
|---|---|---|
| **GAP-M1: max_weight incompatible con perfiles agresivos** | 🟡 MEDIUM | Con `max_weight=0.20` y perfil 9 (RV min=95%), se necesitan al menos 5 fondos de pura RV. Si el universo tiene 4 equity + 2 bond, el precheck `BLOCK_UNIVERSE_TOO_SMALL` pasa (6 × 0.20 = 1.20 ≥ 1.0) pero el solver no puede satisfacer RV min con solo 4 equity × 0.20 = 80%. |
| **GAP-M2: Mixto asignado a bucket "Otros" sin exposición real** | 🟡 MEDIUM | Fondos Mixto (60%RV/40%RF) se clasifican con `portfolio_exposure_v2` como equity=0.6 + bond=0.4. Pero si el asset_type legacy era "Mixto" y se usa el bucket legacy (sin v1 bounds), el bucket "Mixto" tiene restricciones que no se mapean a ningún vector de exposición real en la precheck. |
| **GAP-M3: Geographic constraints no pre-verificadas** | 🟡 MEDIUM | Si `constraints.europe=0.80` pero el universo no tiene ningún fondo con exposure europea, el solver falla sin diagnóstico previo. No hay BLOCK check para esto. |
| **GAP-M4: No precheck de `equity_floor` vs `bucket_bounds_v1`** | 🟡 MEDIUM | equity_floor y RV-min del bucket son conceptos paralelos. Si `equity_floor=0.85` pero `bucket_bounds_v1.equity.max=0.60`, hay contradicción. `_reconcile` solo compara v1 vs profile, no equity_floor vs v1. |

### LOW — Mejora de UX/explainability

| Gap | Severidad | Explicación |
|---|---|---|
| **GAP-L1: `feasibility_precheck` result no llega al frontend** | 🟢 LOW | El resultado de `run_feasibility_precheck` se incluye en `feasibility_precheck` del response, pero el frontend no lo inspecciona para mostrar mensajes específicos por BLOCK code. Siempre muestra el status genérico `infeasible`. |
| **GAP-L2: No precheck para min_assets** | 🟢 LOW | `MIN_ASSETS_DEFAULT=8` existe en config pero no se usa como BLOCK. Si el universo tiene 6 fondos, el solver procede y puede producir una cartera poco diversificada. |
| **GAP-L3: `warnings` y `info` arrays vacíos en precheck** | 🟢 LOW | `run_feasibility_precheck` define `warnings` y `info` en su return contract pero nunca los puebla. Phase 2 del precheck está diseñado pero no implementado. |
| **GAP-L4: Solver fallback cascade no reporta nivel alcanzado** | 🟢 LOW | Cuando cae a Fallback 2 (min_vol) o Fallback 3 (equal-weight), `solver_path` lo indica pero no hay explicación de POR QUÉ cada nivel falló. Solo el primer error se registra. |
| **GAP-L5: `fallback_non_compliant` no es accionable** | 🟢 LOW | Cuando el resultado final no cumple las bandas, el usuario recibe un toast error genérico sin saber QUÉ banda se violó ni por cuánto. `violations` están en la response pero el frontend no las muestra. |

---

## Riesgos detectados

### Riesgo sistémico: Cadena de fallbacks silenciosos

El pipeline tiene una cascada de 7 niveles de fallback:

```
efficient_risk(target_vol) FAIL
  → Fallback 1: max_sharpe(relaxed) FAIL
    → Fallback 2: min_vol(relaxed) FAIL
      → Fallback 3: equal-weight(bucket-filtered) SUCCESS
        → _validate → violations
          → status: fallback_non_compliant
            → Frontend: toast.error("Error en la optimización")
```

El problema es que cada nivel pierde información diagnóstica y el usuario final no
entiende por qué la cartera resultante no cumple sus restricciones o qué debe cambiar.

### Riesgo concreto: Perfiles 8-10

Los perfiles agresivos (8-10) son especialmente propensos a infeasibility porque:

1. **RV min muy alto** (85-98%) requiere muchos fondos de pura RV
2. **max_weight=20%** requiere ≥5 fondos de RV para cubrir 95%
3. **equity_floor** puede contradictar bucket bounds
4. **constraints_builder** ya fuerza `max_sharpe` para evitar target_vol inalcanzable
5. Pero **no hay precheck** que verifique si el universo tiene suficiente RV *concentrada*

---

## Casos típicos

### Caso 1: Locks suman más de 100%

```
fixed_weights = {"EQ0": 0.40, "EQ1": 0.40, "EQ2": 0.30}  → Σ = 110%
lock_mode = "keep_weight"
```

**Hoy:** ✅ Detectado por `BLOCK_FIXED_WEIGHTS_EXCEED_100` → `infeasible` precheck

### Caso 2: Locks RF incompatibles con perfil agresivo

```
Perfil 9: RV min = 95%
Locks: BD0=20%, BD1=15%, BD2=10%  → RF locked = 45%
```

**Hoy:** ❌ No detectado. Precheck pasa (locks < 100%), solver falla con CVXPY infeasible,
cae a fallback, produce cartera non-compliant.

### Caso 3: max_weight demasiado bajo para universo pequeño

```
universe = ["A", "B", "C", "D"]  → 4 fondos
max_weight = 0.20 → 4 × 0.20 = 0.80 < 1.0
```

**Hoy:** ✅ Detectado por `BLOCK_UNIVERSE_TOO_SMALL`

### Caso 4: Bucket min/max contradictorios

```
bucket_bounds_v1.equity.min = 0.60
bucket_bounds_v1.bond.min = 0.50
→ Σ min = 110%
```

**Hoy:** ✅ Detectado por `BLOCK_BUCKET_MINS_EXCEED_100`

### Caso 5: Post-cutoff rompe banda final

```
Solver: equity=58%, pero 2 fondos de equity pesan 1.5% cada uno
Cutoff = 2% → esos 2 fondos se eliminan → equity = 55%
Perfil 6: RV min = 50% → ✅ ok en este caso
Perfil 7: RV min = 70% → ❌ violation post-cutoff
```

**Hoy:** ❌ Parcialmente detectado. `_validate_optimizer_result` lo marca como violation,
status final es `fallback_non_compliant`, pero el frontend no explica al usuario qué pasó.

### Caso 6: equity_floor vs locks en RF

```
Perfil 8: equity_floor = 0.75
Locks: 3 fondos RF locked a 35% total
Budget libre = 65% → todo a equity = 65% < 75% = equity_floor
```

**Hoy:** ❌ `_check_feasibility_and_autoexpand` hace greedy estimation con max_weight,
pero no descuenta locks en RF del presupuesto disponible para RV correctamente.

---

## Recomendación de diseño

### Phase 2 de feasibility_precheck.py (propuesta, sin implementar)

Añadir checks de tipo WARNING (no BLOCK) para detectar riesgos que hoy caen al solver:

```python
# WARNING-1: Locks vs bucket compatibility
# WARNING-2: equity_floor vs available equity budget after locks
# WARNING-3: Geographic constraints achievability
# WARNING-4: equity_floor vs bucket_bounds_v1 contradiction
# WARNING-5: Post-cutoff risk estimation
```

### Frontend: Inspeccionar `feasibility_precheck` y `violations`

```typescript
// Hoy: solo mira result.status
// Propuesta: inspeccionar result.feasibility_precheck.blocks[] y result.violations[]
// para mostrar mensajes específicos al usuario
```

### Diagnóstico de fallbacks

Cada nivel de fallback debería registrar POR QUÉ falló el nivel anterior en
`explainability.fallback_reasons[]`, para que el frontend pueda mostrar una
explicación escalonada al usuario.

---

## Cambios que requerirían discusión previa

> **REGLA ESPECIAL:** Antes de tocar cualquier lógica de restricciones, perfiles,
> buckets, locks, equity_floor, max_weight, min_assets, Mixto, solver o postprocess,
> hay que explicar exactamente el cambio propuesto y discutirlo con el usuario.

Los siguientes cambios están **propuestos pero NO implementados**.
Cada uno requiere discusión antes de proceder:

### 1. equity_floor vs RV bucket

**Problema:** equity_floor y bucket RV min son conceptos superpuestos.
`equity_floor` es un check greedy pre-solver; RV min es una constraint inyectada al CVXPY.
Si difieren, pueden producir resultados confusos.

**Propuesta:** Unificar: que equity_floor se derive del bucket RV min, o eliminar uno.

**Riesgo:** Cambiar la semántica del equity_floor afecta perfiles 1-10.

### 2. max_weight dinámico

**Problema:** Con 6 fondos y max_weight=20%, la cartera solo puede invertir 6×20%=120%.
Si el perfil exige 95% en RV y solo 4 de los 6 son equity, max equity = 80%.

**Propuesta:** Calcular max_weight dinámico como `max(0.20, 1.0/n_equity_assets)`
para perfiles agresivos, o al menos emitir WARNING.

**Riesgo:** Cambiar max_weight altera la diversificación de toda la cartera.

### 3. min_assets dinámico

**Problema:** `MIN_ASSETS_DEFAULT=8` no se usa como BLOCK.

**Propuesta:** Añadir WARNING (no BLOCK) en precheck si `len(universe) < MIN_ASSETS_DEFAULT`.

**Riesgo:** Muy bajo, es solo informativo.

### 4. Soft constraints

**Problema:** Todas las constraints del solver son hard (CVXPY equality/inequality).
Si una constraint es matemáticamente imposible, CVXPY falla sin diagnóstico.

**Propuesta:** Implementar un modo "soft" para constraints no-críticas,
usando penalización en la función objetivo en vez de hard constraints.

**Riesgo:** Cambio arquitectónico significativo en el motor. Requiere rediseño del solver.

### 5. Post-cutoff redistribución

**Problema:** Después del cutoff, los pesos eliminados se redistribuyen por normalización,
pero no se re-verifican las bucket constraints.

**Propuesta:** Añadir un re-check o redistribución inteligente post-cutoff que
respete las bandas. Alternativamente, bajar cutoff para perfiles con bandas estrechas.

**Riesgo:** Cambiar la normalización post-solver puede alterar resultados existentes.

### 6. Mensajes UX

**Problema:** El frontend muestra mensajes genéricos para todos los estados de error.

**Propuesta:** Mapear `feasibility_precheck.blocks[].code` y `violations[].code`
a mensajes específicos en español con acciones sugeridas.

**Riesgo:** Bajo, solo afecta UX. No cambia lógica.

---

## Tests existentes

| Test file | Tests | Cobertura |
|---|---|---|
| `test_feasibility_precheck.py` | 27+ tests | BLOCK-1 a BLOCK-6 + valid cases + edge cases |
| `test_bucket_constraints_dedup.py` | ~30 tests | `_reconcile_bucket_vs_profile` + Mixto dedup |
| `test_optimizer_invariants.py` | ~15 tests | Portfolio invariants (sum=1, non-negative, etc.) |
| `test_optimizer_core.py` | ~10 tests | End-to-end solver with mocks |
| `test_regression_coverage.py` | ~10 tests | INFEASIBLE_HISTORY + edge cases |
| `test_optimizer_payload_contract_static.py` | 43 tests | Payload contract static analysis |

---

## Próximo bloque propuesto

**Opción A:** `BDB-OPT-FEASIBILITY-PRECHECK-DESIGN-REVIEW-0`
- Discusión de diseño con el usuario sobre qué gaps cerrar primero
- Priorización: HIGH gaps primero
- Definir si WARNING o BLOCK
- Definir UX impact
- NO implementar

**Opción B:** `BDB-OPT-FEASIBILITY-PRECHECK-PHASE2-0`
- Implementar WARNING checks en `feasibility_precheck.py`
- Solo warnings (no blocks) para no alterar comportamiento actual
- Tests unitarios
- Sin cambio de frontend aún

**Recomendación:** Opción A primero → luego B tras aprobación.

---

## Decisión

**ESTADO: `BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T18:47:00+02:00
