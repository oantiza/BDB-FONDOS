# Fix: Fallback para efficient_risk infeasible

**Fecha:** 2026-05-04  
**Archivo:** `functions_python/services/portfolio/optimizer_core.py`  
**Perfiles afectados:** 8, 9, 10

---

## Cambio

### Antes (L753-767)
```python
except Exception as e1:
    if objective == "efficient_risk":
        ...
        return ef, None, "infeasible_efficient_risk", feasibility  # DEAD END
```

### Después
```python
except Exception as e1:
    if objective == "efficient_risk":
        ...
        logger.info(f"⚠️ ... Intentando fallbacks...")
    # Cae al fallback chain: max_sharpe → min_vol → equal_weight
```

- Se eliminó el `return` inmediato.
- Se mantiene el logging y la info de `feasibility`.
- Se conserva intacta la cadena de fallback existente (L768-800).
- No se cambiaron constraints, perfiles, target_vol ni max_weight.

---

## Flujo Resultante

```
efficient_risk(0.225) falla
  → log warning con target_vol
  → Fallback 1: max_sharpe (mismas constraints de perfil)
    → si funciona: status "fallback", solver_path "fallback_relaxed_sharpe"
    → si falla:
  → Fallback 2: min_vol (mismas constraints de perfil)
    → si funciona: status "fallback", solver_path "fallback_min_vol"
    → si falla:
  → Fallback 3: equal_weight filtrado
    → status "fallback", solver_path "fallback_equal_weight"
```

El frontend ya maneja `status: "fallback"` correctamente (L601).

---

## Verificaciones

| Check | Resultado |
|---|---|
| `py_compile` | ✅ exit 0 |
| No `return` en `efficient_risk` except | ✅ Eliminado |
| Fallback chain intacta | ✅ L768-800 |
| Constraints/perfiles/target_vol | ❌ No tocados |
| Frontend | ❌ No tocado |
| firestore.rules | ❌ No tocado |
| Credenciales | ❌ No tocadas |
| Commit | ❌ No |
| Deploy | ❌ No |

---

## Deploy Recomendado

```
git add + commit
git push
firebase deploy --only functions
```

Solo functions — el frontend no cambió.
