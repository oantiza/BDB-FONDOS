# BDB_REGRESSION_COVERAGE_SHORT_HISTORY_CONTRACT_0

**Fecha:** 2026-05-11  
**Ejecutado por:** Antigravity Agent (Claude Sonnet 4.6 Thinking)  
**Sesión:** BDB-REGRESSION-COVERAGE-SHORT-HISTORY-CONTRACT-0  
**Tipo:** Auditoría de contrato + alineación de tests — sin deploy, sin escritura Firestore, sin tocar lógica productiva

---

## 1. Incidencia original — 2 fallos preexistentes

### 1.1 `test_analyzer_insufficient_history`

```
FAILED tests/test_regression_coverage.py::test_analyzer_insufficient_history
AssertionError: assert 'success' == 'error'
```

**Expected:** `status=error`  
**Actual:** `status=success`  
**Log emitido:** `WARNING  services.portfolio.analyzer:analyzer.py:47 ⚠️ [Analyzer] Excluyendo activos por historial insuficiente (<60 obs): ['B']`

### 1.2 `test_frontier_short_history`

```
FAILED tests/test_regression_coverage.py::test_frontier_short_history
AssertionError: assert 'success' == 'error'
```

**Expected:** `status=error`  
**Actual:** `status=success`

---

## 2. Fixture implicado

```python
@pytest.fixture
def short_history_fetcher():
    dates_A = pd.date_range("2023-01-01", periods=100, freq="B")  # 100 obs — suficiente
    dates_B = pd.date_range("2023-03-01", periods=55,  freq="B")  # 55 obs  — insuficiente
    ...
```

- Activo A: 100 observaciones hábiles (> 60, válido)
- Activo B: 55 observaciones hábiles (< 60, insuficiente)

---

## 3. Código productivo implicado

### 3.1 `services/portfolio/analyzer.py` — guard de exclusión parcial (líneas 42–50)

```python
# Hardening: Exclude unviable assets before finding common window (P1)
min_obs = 60
valid_counts = df.count()
to_drop = valid_counts[valid_counts < min_obs].index
if not to_drop.empty:
    logger.warning(f"⚠️ [Analyzer] Excluyendo activos por historial insuficiente (<{min_obs} obs): {list(to_drop)}")
    df = df.drop(columns=to_drop)
    if df.empty:
        return {"status": "error", ...}  # ← error solo si TODOS son insuficientes
```

### 3.2 `services/portfolio/frontier_engine.py` — guard de ventana mínima (líneas 69–84)

```python
if df.empty or len(df) < 30:
    return {"status": "error", ...}
```

Con el fixture, el tramo común (ffill + dropna) produce **~55 días hábiles** → supera el umbral de 30 → **`success`**.

---

## 4. Origen del desajuste — commit `9198e63`

```
9198e63  Harden historical series alignment and filtering   (2026-03-25)
3400f13  chore(test): add and fix regression test suite...  (anterior)
```

El commit `9198e63` ("Harden historical series alignment and filtering") introdujo deliberadamente la lógica de **exclusión parcial de activos** (`to_drop`). Los tests de regresión en `3400f13` fueron escritos **antes** de este hardening, documentando el contrato antiguo (`error` para cualquier activo corto).

El hardening fue **intencional y explícito**: su objetivo era mejorar la resiliencia del sistema al proveer análisis parcial cuando al menos un activo es viable, en lugar de rechazar toda la solicitud.

---

## 5. Auditoría de contrato

| Pregunta | Respuesta |
|---|---|
| ¿Historial corto impide calcular completamente? | **No.** Solo B es excluido; A tiene 100 obs válidas. El cálculo es completo. |
| ¿Se devuelve resultado parcial útil? | **Sí.** Métricas reales calculadas sobre el activo A superviviente. |
| ¿Hay warning explícito? | **Sí.** Log WARNING en `analyzer.py:47` identifica el activo excluido. |
| ¿El frontend puede manejar `success`? | **Sí.** El campo `opinion_text` puede incorporar la advertencia si se propaga. |
| ¿Riesgo de que `success` oculte error crítico? | **Bajo.** El caso totalmente inviable (todos los activos insuficientes) sigue retornando `status=error` correctamente (línea 50 del analyzer). |
| ¿El comportamiento fue introducido deliberadamente? | **Sí.** Commit `9198e63` con mensaje explícito sobre "hardening". |
| ¿El optimizer mantiene `error` para historial corto? | **Sí.** `test_optimizer_short_history` PASA: el optimizer tiene una lógica diferente y retorna `error`. |

---

## 6. Decisión de contrato

**→ OPCIÓN A elegida: Mantener comportamiento actual `success+warning` y alinear tests.**

**Justificación:**

1. El hardening fue deliberado y mejora la UX (resultado parcial > error total).
2. El path crítico de error sigue existiendo y está cubierto (cuando **todos** los activos son insuficientes).
3. El optimizer mantiene una semántica diferente (strict, `error` para historial corto) que tiene sentido: el optimizer necesita coherencia entre activos para las restricciones de optimización.
4. El analyzer y frontier son más tolerantes porque pueden operar con subconjuntos.

**Invariantes preservadas (no se modificaron):**
- Caso vacío (`{}`) → `error` ✅
- Caso sin datos (`missing=True`) → `error` ✅  
- Caso todos-activos-insuficientes → `error` ✅ (nuevo test añadido)
- Optimizer con historial corto → `error` ✅

---

## 7. Cambios realizados

### 7.1 `tests/test_regression_coverage.py`

**Solo tests modificados. Cero cambios en código productivo.**

| Test | Cambio |
|---|---|
| `test_analyzer_insufficient_history` | `status=error` → `status=success` + verifica métricas reales del activo superviviente |
| `test_frontier_short_history` | `status=error` + empty frontier → `status=success` + verifica `math_data`, `assets`, `observations > 0` |
| `test_analyzer_all_assets_insufficient_history` | **NUEVO** — cubre el path de error crítico (todos insuficientes) con fixture `all_short_history_fetcher` |

**Fixture añadido:** `all_short_history_fetcher` — activo A (45 obs) y B (50 obs), ambos < 60.

### 7.2 Ningún otro fichero modificado

- `services/portfolio/analyzer.py` — **SIN CAMBIOS**
- `services/portfolio/frontier_engine.py` — **SIN CAMBIOS**
- `services/portfolio/optimizer_core.py` — **SIN CAMBIOS**
- `firestore.rules` — **SIN CAMBIOS**
- Frontend — **SIN CAMBIOS**

---

## 8. Tests ejecutados y resultado

### Suite `test_regression_coverage.py` (7 tests)

```
test_analyzer_empty_portfolio               PASSED
test_analyzer_insufficient_history         PASSED  ← anteriormente FAILED
test_analyzer_all_assets_insufficient_history PASSED  ← NUEVO
test_analyzer_missing_data                 PASSED
test_optimizer_short_history               PASSED
test_frontier_short_history                PASSED  ← anteriormente FAILED
test_classify_asset_fallback               PASSED
--------------------------------------------------
7 passed, 0 failed — 1.98s
```

### Suite completa de regresión (99 tests)

```
tests/xray/                    30 passed
tests/test_mixed_exposure...   11 passed
tests/test_mixed_funds...       4 passed
tests/test_suitability_v2      47 passed
tests/test_regression_coverage  7 passed
--------------------------------------------------
99 passed, 0 failed — 2.75s
```

---

## 9. Confirmaciones de seguridad

| Item | Confirmación |
|---|---|
| No writes a Firestore | **CONFIRMADO** |
| No deploy | **CONFIRMADO** |
| No lógica de negocio modificada | **CONFIRMADO** — solo tests |
| No optimizer_core.py tocado | **CONFIRMADO** |
| No suitability_engine.py tocado | **CONFIRMADO** |
| No firestore.rules tocado | **CONFIRMADO** |
| No BDB-FONDOS-CORE tocado | **CONFIRMADO** |
| No MIXED remediation tocada | **CONFIRMADO** |
| No frontend modificado | **CONFIRMADO** |

---

## 10. Commit

```
git commit -m "TESTS: align short-history regression contract"
```

*Documento generado automáticamente por Antigravity Agent — BDB-REGRESSION-COVERAGE-SHORT-HISTORY-CONTRACT-0*
