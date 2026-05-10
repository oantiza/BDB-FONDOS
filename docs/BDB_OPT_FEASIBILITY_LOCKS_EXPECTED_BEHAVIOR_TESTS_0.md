# BDB_OPT_FEASIBILITY_LOCKS_EXPECTED_BEHAVIOR_TESTS_0

## Resumen ejecutivo

Tests de comportamiento esperado para locks + feasibility precheck, basados
en las decisiones de usuario P1–P5 aprobadas en:

`docs/BDB_OPT_FEASIBILITY_LOCKS_USER_DECISIONS_0.md` (84d7246)

Estos tests NO implementan lógica de runtime. Definen el contrato futuro
de forma ejecutable. Los tests para lógica no implementada están marcados
como `xfail(strict=True)`. Los tests para comportamiento ya soportado
pasan (`PASSED`).

**ESTADO: `BDB_OPT_FEASIBILITY_LOCKS_EXPECTED_BEHAVIOR_TESTS_0_READY_FOR_REVIEW`**

---

## Archivos

| Archivo | Tipo | Estado |
|---|---|---|
| `functions_python/tests/test_feasibility_precheck_locks_expected_behavior.py` | Tests nuevos | ✅ Creado |
| `functions_python/tests/test_feasibility_precheck_locks_compatibility.py` | Tests previos | ✅ Sin cambios |
| Este documento | Documentación | ✅ Creado |

---

## Resultados de ejecución

### Nuevo archivo: test_feasibility_precheck_locks_expected_behavior.py

| Resultado | Cantidad |
|---|---|
| PASSED | 5 |
| SKIPPED | 2 |
| XFAILED | 8 |
| FAILED | 0 |
| UNEXPECTED PASS | 0 |

### Archivo previo: test_feasibility_precheck_locks_compatibility.py

| Resultado | Cantidad |
|---|---|
| PASSED | 5 |
| SKIPPED | 1 |
| XFAILED | 3 |
| FAILED | 0 |
| UNEXPECTED PASS | 0 |

---

## Mapa de cobertura por decisión

| Test | Decisión | Tipo | Estado | Descripción |
|---|---|---|---|---|
| A1 | P2 | PASSED | Ya soportado | keep_weight compatible, no BLOCK |
| A2 | P2 | XFAIL | No implementado | keep_weight excede bucket max → BLOCK |
| A3 | P1+P2 | XFAIL | No implementado | keep_weight impide equity_floor → BLOCK |
| A4 | P2 | XFAIL | No implementado | keep_money equivalente a keep_weight → BLOCK |
| B5 | P3 | PASSED | Ya soportado | min_keep compatible, no BLOCK |
| B6 | P3 | XFAIL | No implementado | min_keep excede bucket max → BLOCK |
| B7 | P3 | XFAIL | No implementado | min_keep reduce margen → WARNING |
| C8 | P4 | PASSED | Ya soportado | free nunca bloquea |
| C8b | P4 | PASSED | Ya soportado | free no cuenta para EXCEED_100 |
| D9 | P1 | XFAIL | No implementado | equity_floor HARD estándar → BLOCK |
| D10 | P1 | SKIP | No implementado | Modo heredado futuro (documental) |
| E11 | P5+P2 | XFAIL | No implementado | precheck usa bounds efectivos → BLOCK |
| E12 | P5 | SKIP | No implementado | No cross-source (documental) |
| F13a | P5 nota | XFAIL | No implementado | Mixto con bounds → BLOCK |
| F13b | P5 nota | PASSED | Ya soportado | Mixto open bounds → no incompatibilidad |

---

## Interpretación

### Tests que PASAN (5)

Estos validan comportamiento que el runtime **ya soporta** sin cambios:

- **A1, B5**: Locks compatibles no generan BLOCK (la ausencia de check = compatible).
- **C8, C8b**: `lock_mode="free"` correctamente excluido de cálculos.
- **F13b**: Bounds abiertos no pueden generar incompatibilidad.

### Tests XFAIL (8)

Estos representan comportamiento **aprobado pero no implementado**:

- **A2, A4, B6, E11, F13a**: `BLOCK_LOCKS_INCOMPATIBLE_BUCKET` (GAP-H1).
- **A3, D9**: `BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR` (GAP-H2).
- **B7**: `WARNING_LOCKS_HIGH_CONCENTRATION`.

Cuando se implemente cada check, el xfail correspondiente empezará a
pasar y deberá removerse el decorador.

### Tests SKIP (2)

Estos son **documentales** — no hay lógica testeable todavía:

- **D10**: Modo futuro de cartera heredada fuera de perfil.
- **E12**: Regla anti cross-source (validación de integración).

---

## Relación con tests previos

El archivo previo `test_feasibility_precheck_locks_compatibility.py`
contiene 9 tests que siguen intactos. Hay superposición intencional en
algunos escenarios (lock excede bucket max, equity_floor) para dar
cobertura desde dos ángulos:

- **Archivo previo**: Contrato de diseño original (GAP-H1, GAP-H2).
- **Archivo nuevo**: Comportamiento esperado por decisión de usuario (P1–P5).

Cuando se implemente el runtime, ambos conjuntos deben pasar.

---

## Qué NO se hizo

- ❌ NO runtime changes
- ❌ NO modificaciones a feasibility_precheck.py
- ❌ NO modificaciones a optimizer_core.py
- ❌ NO modificaciones a constraints_builder_v1.py
- ❌ NO modificaciones a endpoints_portfolio.py
- ❌ NO modificaciones a config.py
- ❌ NO modificaciones a frontend
- ❌ NO deploy
- ❌ NO commit (pendiente)
- ❌ NO push
- ❌ NO Firestore writes
- ❌ NO CORE

---

## Próximo bloque recomendado

`BDB-OPT-FEASIBILITY-LOCKS-RUNTIME-IMPL-0`:
Implementar `_check_locks_incompatible_bucket` y
`_check_locks_incompatible_equity_floor` en `feasibility_precheck.py`.

Fecha: 2026-05-10T05:50:00+02:00
