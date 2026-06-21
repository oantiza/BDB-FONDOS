# Fix Report: Optimizer Fallback Metrics `float(None)` Crash

**Fecha:** 2026-05-05  
**Commit previo:** `48ba511`  
**Estado:** Implementado — pendiente commit/push.

---

## A. Causa Raíz

**Archivo:** `functions_python/services/portfolio/utils.py`, línea 18/24  
**Función:** `_to_float(x, default=0.0)`

La función `_to_float` asumía que el parámetro `default` siempre sería un valor numérico convertible a `float()`. Cuando `optimizer_core.py` la invocaba con `default=None`:

```python
# optimizer_core.py L1141
_target_vol = _to_float(risk_budget_v1.get("target_vol"), None)
```

Si `risk_budget_v1` no contenía `target_vol` (caso normal cuando el frontend no envía `constraints_v1.risk_budget.target_vol`), el flujo era:

1. `risk_budget_v1.get("target_vol")` → `None`
2. `_to_float(None, None)` → L18: `float(None)` → **`TypeError`**
3. La excepción se propagaba hasta el `except` de L1184
4. El optimizer devolvía `status: "error"` en lugar de `status: "fallback"`

**Impacto:** Cualquier optimización sin `target_vol` explícito que entrara en el path de transparencia de volatilidad (L1141) crasheaba silenciosamente. El usuario recibía un error genérico en lugar de una cartera fallback válida.

---

## B. Archivos y Líneas Afectadas

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `functions_python/services/portfolio/utils.py` | 18, 24 | `float(default)` → `float(default) if default is not None else None` |
| `functions_python/tests/test_optimizer_core.py` | 85-99, 122-126 | Tests endurecidos: ya no aceptan `"error"` como status válido |

---

## C. Cambio Aplicado

### `utils.py` — `_to_float()`

```diff
 def _to_float(x, default=0.0):
     try:
         if x is None:
-            return float(default)
+            return float(default) if default is not None else None
         ...
     except Exception:
-        return float(default)
+        return float(default) if default is not None else None
```

### `test_optimizer_core.py` — Tests endurecidos

```diff
-    assert res_agg["status"] in ["optimal", "fallback", "error"]
-    if res_agg["status"] != "error":
-        assert abs(sum(res_agg["weights"].values()) - 1.0) < 1e-4
+    assert res_agg["status"] in ["optimal", "fallback"]
+    assert abs(sum(res_agg["weights"].values()) - 1.0) < 1e-4
```

---

## D. Por Qué No Altera Política de Inversión

- `_to_float` es una función de utilidad pura que convierte strings/None a float.
- El cambio solo afecta al caso `default=None`, que antes crasheaba.
- Ahora devuelve `None` (que es lo que el caller esperaba, ya que L1141-1145 checkea `if _target_vol is not None`).
- No se toca: asset allocation, perfiles, objectives, constraints, solver, fallback chain, frontend, Firestore.

---

## E. Resultado de Tests

| Suite | Resultado |
|-------|-----------|
| `test_optimizer_core.py` | **2/2 ✅** (hardened: no `"error"` aceptado) |
| `test_optimizer_invariants.py` | **8/8 ✅** |
| `test_bucket_constraints_dedup.py` | **9/9 ✅** |
| **Total** | **19/19 ✅** |

---

## F. Riesgos Pendientes

1. **Otros callers de `_to_float` con default=None:** Solo hay 1 (`optimizer_core.py:1141`). Verificado con grep.
2. **Futuras llamadas:** Cualquier nuevo caller con `default=None` ahora recibirá `None` en vez de crash, que es el comportamiento correcto.

---

## G. Reversión

Para revertir: en `utils.py` L18 y L24, cambiar:
```python
return float(default) if default is not None else None
```
de vuelta a:
```python
return float(default)
```

---

## H. Confirmación

| Regla | Cumplida |
|-------|----------|
| NO frontend modificado | ✅ |
| NO firestore.rules tocado | ✅ |
| NO credenciales tocadas | ✅ |
| NO deploy realizado | ✅ |
| NO push realizado | ✅ |
| NO política de inversión alterada | ✅ |
| NO perfiles 1-10 cambiados | ✅ |
| NO objective/fallback chain cambiado | ✅ |
| Cambios mínimos (2 líneas en utils.py + tests) | ✅ |
