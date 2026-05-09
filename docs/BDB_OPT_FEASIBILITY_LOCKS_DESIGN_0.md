# BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0

## Resumen ejecutivo

Tests de diseño para dos futuros checks de compatibilidad de locks en
`feasibility_precheck.py`, sin cambios de runtime. Los tests definen el contrato
esperado para detectar configuraciones de locks que hacen imposible cumplir
restricciones de buckets o equity_floor.

**ESTADO: ✅ BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0_READY_FOR_REVIEW**

---

## Estado base

| Campo | Valor |
|---|---|
| HEAD | `742e289` |
| Commit | `OPTIMIZER_FEASIBILITY: document precheck audit` |
| Feasibility precheck audit | Cerrado (`BDB_OPT_FEASIBILITY_PRECHECK_AUDIT_0_READY_FOR_REVIEW`) |
| Design review | Completado en este bloque |
| Rama | `master` |

---

## Casos cubiertos

### BLOCK_LOCKS_INCOMPATIBLE_BUCKET (GAP-H1)

| Caso | Lock type | Bucket/Perfil | Resultado esperado futuro | Marcado | Razón |
|---|---|---|---|---|---|
| A | 60% RF (keep_weight) | equity.min=85% (agresivo) | ❌ Incompatible | `xfail(strict)` | Lock consume 60% en bond → solo 40% para equity < 85% |
| B | 30% equity (keep_weight) | equity.max=20% | ❌ Incompatible | `xfail(strict)` | Lock 30% > bucket max 20% |
| C | 10% RF (keep_weight) | equity.min=85% (agresivo) | ✅ Compatible | `passed` | 10% en bond → 90% para equity ≥ 85% |
| D | free mode | equity.min=85% | ✅ Compatible | `passed` | lock_mode=free no impone pesos |
| E | min_keep mode | — | ⏸️ Pendiente | `skip` | Semántica de min_keep no resuelta |

### BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR (GAP-H2)

| Caso | Lock type | equity_floor | Resultado esperado futuro | Marcado | Razón |
|---|---|---|---|---|---|
| A | 35% RF/cash (keep_weight) | 75% | ❌ Incompatible | `xfail(strict)` | max equity = 65% < 75% |
| B | 50% equity (keep_weight) | 75% | ✅ Compatible | `passed` | Equity ya en 50%, puede completar |
| C | 90% RF (keep_weight) | 0% | ✅ Compatible | `passed` | equity_floor=0 → siempre compatible |
| D | 75% equity (keep_weight) | 75% | ✅ Compatible | `passed` | Exactamente igual al floor |

---

## Nuevos BLOCK codes propuestos

### BLOCK_LOCKS_INCOMPATIBLE_BUCKET

Detecta cuando los pesos bloqueados en un bucket hacen imposible cumplir
el mínimo o máximo de otro bucket.

**Lógica propuesta:**
1. Calcular presupuesto consumido por locks en cada bucket.
2. Calcular presupuesto libre restante.
3. Verificar si el presupuesto libre puede satisfacer todos los bucket.min.
4. Verificar si los locks no exceden ningún bucket.max.

### BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR

Detecta cuando los pesos bloqueados en buckets no-equity consumen
suficiente presupuesto para hacer inalcanzable el equity_floor.

**Lógica propuesta:**
1. Sumar locks en non-equity buckets.
2. max_achievable_equity = 1.0 - sum_non_equity_locks.
3. Si max_achievable_equity < equity_floor → BLOCK.

**NOTA:** Requiere extender la API de `run_feasibility_precheck()` para
recibir `equity_floor` como parámetro adicional.

---

## Decisiones pendientes

| # | Decisión | Impacto | Estado |
|---|---|---|---|
| 1 | ¿`lock_mode="min_keep"` cuenta contra bucket max (ceiling) o solo como floor? | Determina si min_keep puede disparar BLOCK_LOCKS_INCOMPATIBLE_BUCKET | ⏸️ Pendiente |
| 2 | Tolerancia numérica para comparaciones (1e-6 vs 1e-4) | Consistencia con checks existentes | ⏸️ Pendiente (usar 1e-6 como checks actuales) |
| 3 | ¿BLOCK o WARNING para locks incompatibles? | BLOCK impide optimización; WARNING permite pero advierte | ⏸️ Pendiente (recomendación: BLOCK) |
| 4 | ¿Cómo mostrar mensaje de lock incompatible en UI? | UX del frontend | ⏸️ Pendiente (depende de GAP-L1) |
| 5 | ¿equity_floor como nuevo parámetro de `run_feasibility_precheck()`? | Cambio de contrato API | ⏸️ Pendiente (requerido para GAP-H2) |

---

## Resultados de validación

```
tests/test_feasibility_precheck_locks_compatibility.py

TestLocksIncompatibleBucket::test_case_a  XFAIL   (lock 60% RF vs equity.min=85%)
TestLocksIncompatibleBucket::test_case_b  XFAIL   (lock 30% equity vs equity.max=20%)
TestLocksIncompatibleBucket::test_case_c  PASSED   (lock 10% RF — compatible)
TestLocksIncompatibleBucket::test_case_d  PASSED   (lock_mode=free — compatible)
TestLocksIncompatibleBucket::test_case_e  SKIPPED  (min_keep — decision pending)
TestLocksIncompatibleEquityFloor::test_case_a  XFAIL   (35% RF vs floor=75%)
TestLocksIncompatibleEquityFloor::test_case_b  PASSED   (50% equity vs floor=75% — compatible)
TestLocksIncompatibleEquityFloor::test_case_c  PASSED   (floor=0 — always compatible)
TestLocksIncompatibleEquityFloor::test_case_d  PASSED   (equity=floor — compatible)

TOTAL: 5 passed, 1 skipped, 3 xfailed
```

---

## Qué NO se hizo

- ❌ NO runtime changes en `feasibility_precheck.py`
- ❌ NO frontend changes
- ❌ NO backend logic changes
- ❌ NO constraints changes en `constraints_builder_v1.py`
- ❌ NO cambios en `optimizer_core.py`
- ❌ NO cambios en `endpoints_portfolio.py`
- ❌ NO deploy
- ❌ NO commit
- ❌ NO push
- ❌ NO Firestore writes
- ❌ NO CORE (BDB-FONDOS-CORE no tocado)

---

## Próximo paso

Revisión con usuario antes de implementar runtime. Tras aprobación:

1. Resolver decisiones pendientes (especialmente #1 min_keep y #3 BLOCK vs WARNING).
2. Implementar `_check_locks_incompatible_bucket()` en `feasibility_precheck.py`.
3. Extender API de `run_feasibility_precheck()` con `equity_floor` param.
4. Implementar `_check_locks_incompatible_equity_floor()`.
5. Los 3 tests xfail deberían pasar → retirar xfail.
6. Resolver test skip de min_keep.

---

## Decisión

**ESTADO: `BDB_OPT_FEASIBILITY_LOCKS_DESIGN_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T23:45:00+02:00
