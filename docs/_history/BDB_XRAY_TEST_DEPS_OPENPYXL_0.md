# BDB_XRAY_TEST_DEPS_OPENPYXL_0

**Fecha:** 2026-05-11  
**Ejecutado por:** Antigravity Agent (Claude Sonnet 4.6 Thinking)  
**Sesión:** BDB-XRAY-TEST-DEPS-OPENPYXL-0  
**Tipo:** Corrección de harness de tests — sin deploy, sin escritura Firestore

---

## 1. Incidencia original

En el smoke test post-MIXED (sesión `BDB-POST-MIXED-REMEDIATION-SMOKE-TEST-0`, commit `e8ee803`), la suite X-Ray arrojó 19 fallos con dos causas diferentes que se desvelaron secuencialmente:

### Causa primaria: `ModuleNotFoundError: No module named 'openpyxl'`
`openpyxl` estaba declarado en `functions_python/requirements.txt:30` (`openpyxl>=3.1.0`) pero **no estaba instalado en el venv local**. Los tests de harness que generan workbooks Excel en memoria para simular uploads lo necesitaban.

### Causa secundaria (descubierta al instalar openpyxl): Auth guard JWT
El endpoint `compare_risk_free` añadió un guard de autenticación JWT en producción (`req.headers.get("Authorization")`, línea 390 del endpoint). El `_Request` mock de los tests de harness no tenía atributo `headers`, causando `AttributeError`. Adicionalmente, `EXPECTED_RESPONSE_KEYS` no incluía `xirr_warnings`, un campo añadido al response del endpoint en una iteración posterior.

---

## 2. Acciones realizadas

### 2.1 Script temporal eliminado

```
scripts/smoke_test_readonly.py  →  ELIMINADO (untracked, generado en sesión anterior)
```

### 2.2 Dependencia openpyxl

**No fue necesario modificar `requirements.txt`** — `openpyxl>=3.1.0` ya estaba declarado en la línea 30.

Solo se instaló en el venv:

```powershell
.\functions_python\venv\Scripts\pip.exe install openpyxl
# Resultado: openpyxl 3.1.5 instalado
```

**venv afectado:** `functions_python/venv` (único venv de tests del proyecto).

### 2.3 Corrección de harness: `test_compare_risk_free.py`

Cambios realizados (solo test harness, sin tocar lógica de negocio):

1. **`_Request` mock:** añadido `headers: dict[str, str] = {"Authorization": "Bearer test-token-bypass"}` para satisfacer el guard JWT.
2. **`_bypass_auth` fixture (autouse):** nuevo fixture que parchea `firebase_admin.auth.verify_id_token` con un lambda que retorna un decoded token falso — mismo patrón ya existente para los fixtures de macro data (`get_ine_inflation_map`, `get_bde_tbills_series`).
3. **`EXPECTED_RESPONSE_KEYS`:** añadido `"xirr_warnings"` para alinear con el response actual del endpoint.

### 2.4 Corrección de harness: `test_depositos.py`

Cambios idénticos:

1. **`_Request` mock:** añadido `headers: dict = {"Authorization": "Bearer test-token-bypass"}`.
2. **`_bypass_auth` fixture (autouse):** nuevo fixture que parchea `firebase_admin.auth.verify_id_token`.

---

## 3. Ficheros modificados

| Fichero | Tipo de cambio | Descripción |
|---|---|---|
| `tests/xray/test_compare_risk_free.py` | Test harness | headers en `_Request`, fixture `_bypass_auth`, `xirr_warnings` en expected keys |
| `tests/xray/test_depositos.py` | Test harness | headers en `_Request`, fixture `_bypass_auth` |
| `functions_python/requirements.txt` | **Sin cambios** | `openpyxl>=3.1.0` ya declarado en línea 30 |

---

## 4. Tests ejecutados y resultado

### X-Ray suite (30 tests)

```
tests/xray/test_compare_risk_free.py   13 passed
tests/xray/test_depositos.py           17 passed
------------------------------------------------------
TOTAL: 30 passed, 0 failed — 1.42s
```

**Resultado: VERDE** — de 19 fallos a 0.

### Regresión mínima post-cambio (62 tests)

```
tests/test_mixed_exposure_ms_portfolio.py      11 passed
tests/test_mixed_funds_lookthrough_contract.py  4 passed
tests/test_suitability_v2.py                   47 passed
------------------------------------------------------
TOTAL: 62 passed, 0 failed — 1.72s
```

**Resultado: VERDE** — sin regresiones introducidas.

---

## 5. Confirmaciones de seguridad

| Item | Confirmación |
|---|---|
| No writes a Firestore | **CONFIRMADO** |
| No deploy | **CONFIRMADO** |
| No lógica de negocio modificada | **CONFIRMADO** — solo test harness |
| No optimizer_core.py tocado | **CONFIRMADO** |
| No suitability_engine.py tocado | **CONFIRMADO** |
| No firestore.rules tocado | **CONFIRMADO** |
| No BDB-FONDOS-CORE tocado | **CONFIRMADO** |
| No mixed remediation tocada | **CONFIRMADO** |
| Script temporal eliminado | **CONFIRMADO** |

---

## 6. Pendiente fuera de scope (documentado, no corregido)

- **`test_regression_coverage.py` — 2 fallos preexistentes**: `test_analyzer_insufficient_history` y `test_frontier_short_history` fallan porque el `analyzer` y `frontier_engine` ahora retornan `success` al excluir activos con historial insuficiente, en vez de `error`. Esta corrección de tests queda para un bloque dedicado independiente.

---

*Documento generado automáticamente por Antigravity Agent — BDB-XRAY-TEST-DEPS-OPENPYXL-0*
