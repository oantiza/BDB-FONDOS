# Fix: Quick Wins Técnicos del Optimizador

**Fecha:** 2026-05-04  
**Archivos modificados:**
- `functions_python/services/portfolio/constraints_builder_v1.py`
- `functions_python/services/portfolio/optimizer_core.py`

---

## Cambio 1: Objective max_sharpe para P8–P10

**Archivo:** `constraints_builder_v1.py`

```python
# Después de resolver objective:
profile_id_i = _as_int(profile_id)
if profile_id_i is not None and profile_id_i >= 8 and objective == "efficient_risk":
    _logger.info(f"⚠️ Perfil agresivo ({profile_id}): usando max_sharpe ...")
    objective = "max_sharpe"
```

**Efecto:** P8/P9/P10 ya no intentan `efficient_risk(target_vol)` con volatilidad inalcanzable. Usan `max_sharpe` que maximiza retorno/riesgo respetando las bandas de RV/RF/etc.

---

## Cambio 2: Status fallback honesto

**Archivo:** `optimizer_core.py` (resultado final)

```python
# Antes:
"status": "optimal" if raw_weights is not None else "fallback"

# Después:
is_fallback = (solver_path or "").startswith("fallback_")
final_status = "fallback" if is_fallback else ("optimal" if raw_weights is not None else "fallback")
```

**Efecto:** Si el solver cayó a `fallback_relaxed_sharpe` o `fallback_min_vol`, el status es `"fallback"` en vez de `"optimal"`.

---

## Cambio 3: target_vol vs achieved_vol

**Archivo:** `optimizer_core.py` (métricas)

```python
result_metrics["target_vol"] = round(_target_vol, 6)
result_metrics["achieved_vol"] = round(_achieved_vol, 6)
result_metrics["vol_deviation"] = round(_achieved_vol - _target_vol, 6)
```

**Efecto:** El resultado ahora incluye transparencia completa sobre volatilidad objetivo vs alcanzada. Solo se incluye si `target_vol > 0`.

---

## Verificaciones

| Check | Resultado |
|---|---|
| `py_compile constraints_builder_v1.py` | ✅ exit 0 |
| `py_compile optimizer_core.py` | ✅ exit 0 |
| config.py modificado | ❌ No |
| firestore.rules modificado | ❌ No |
| frontend/ modificado | ❌ No |
| .env/credenciales modificados | ❌ No |
| bucket bounds modificados | ❌ No |
| RV/RF/Monetario/Otros modificados | ❌ No |
| max_weight modificado | ❌ No |
| Archivos modificados | Solo 2 (constraints_builder_v1.py + optimizer_core.py) |
| Líneas cambiadas | +36 -5 |

---

## Deploy recomendado

```
git add + commit
git push
firebase deploy --only functions
```

Solo functions. Frontend no cambió.
