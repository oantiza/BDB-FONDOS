# Diagnóstico: "Error en la optimización: Desconocido"

**Fecha:** 2026-05-04  
**Entorno:** Producción (https://bdb-fondos.web.app)  
**Post-deploy:** functions + hosting + firestore:rules

---

## 1. Localización del Error

### Frontend
**Archivo:** `frontend/src/hooks/usePortfolioActions.ts`  
**Línea:** 692-695

```tsx
} else {
    const msg = result.message || result.error || "Desconocido";
    const obsStr = result.observations ? ` (${result.observations} días comunes)` : '';
    toast.error(`Error en la optimización: ${msg}${obsStr}`);
}
```

Este bloque es el **catch-all** de `processOptimizationResult`. Se ejecuta cuando `result.status` no es ninguno de los 5 estados manejados.

### Estados manejados por el frontend:
| Estado | Línea | Manejado |
|---|---|---|
| `optimal` | L601 | ✅ |
| `fallback` | L601 | ✅ |
| `infeasible` | L617 | ✅ |
| `infeasible_equity_floor` | L645 | ✅ |
| `fallback_no_history` | L670 | ✅ |

### Estados devueltos por el backend NO manejados:
| Estado | Línea backend | Tiene `message`? | Tiene `error`? | Resultado en frontend |
|---|---|---|---|---|
| `infeasible_constraints` | optimizer_core.py L1028 | ❌ No | ❌ No | **"Desconocido"** |
| `auto_expand_failed` | optimizer_core.py L643 | ❌ No | ❌ No | **"Desconocido"** |
| `error` | optimizer_core.py L944, L1159 | ✅ Sí | ✅ Sí | Se muestra mensaje correcto |

---

## 2. Causa Probable

El backend devuelve `status: "infeasible_constraints"` cuando el solver `efficient_risk` falla (líneas 1025-1033 de `optimizer_core.py`). Este status tiene un campo `feasibility` con `reason`, pero **NO tiene `message` ni `error`**, por lo que el frontend muestra "Desconocido".

```python
# optimizer_core.py L1026-1033
return {
    "api_version": "optimizer_v4",
    "status": "infeasible_constraints",  # NOT handled by frontend
    "solver_path": solver_path,
    "feasibility": solver_feasibility,   # Has 'reason' but not 'message'
    "weights": {},
    "warnings": [solver_feasibility.get("reason", ...)],
}
```

---

## 3. Verificación de Logs Backend

```
gcloud logging read ... optimize-portfolio-quant ... severity>=ERROR → []
```

**No hay errores del optimizer en Cloud Run.** Esto confirma que:
- La función SÍ se ejecuta correctamente.
- La función SÍ devuelve una respuesta.
- La respuesta tiene un `status` no manejado por el frontend.

### Hallazgo adicional: `get_economic_calendar` OOM
- `get_economic_calendar` (us-central1) falla con **"Memory limit of 256 MiB exceeded"**.
- Esto es un problema separado, no relacionado con la optimización.

---

## 4. ¿Es un bloqueo por Firestore Rules?

**NO.** Las funciones Cloud usan Admin SDK que bypasea rules completamente. El error existía **antes** del deploy de rules. Es un gap entre los status codes del backend y el frontend.

---

## 5. Propuesta de Fix Mínima

### Opción A: Fix en el frontend (3 líneas)

Añadir manejo de `infeasible_constraints` al bloque `processOptimizationResult`:

```diff
  } else if (result.status === 'fallback_no_history') {
      ...
+ } else if (result.status === 'infeasible_constraints' || result.status === 'auto_expand_failed') {
+     const msg = result.warnings?.[0] || result.feasibility?.reason || "Las restricciones del perfil no permiten encontrar una solución. Prueba a cambiar el perfil o los fondos.";
+     toast.error(`Error en la optimización: ${msg}`);
  } else {
      const msg = result.message || result.error || "Desconocido";
```

### Opción B: Fix en el backend (1 línea)

Añadir `message` al return de `infeasible_constraints`:

```diff
  return {
      "api_version": "optimizer_v4",
      "status": "infeasible_constraints",
+     "message": solver_feasibility.get("reason", "El perfil de riesgo no permite optimizar con los activos seleccionados."),
      ...
```

### Recomendación: **Ambos fixes** — Backend debería siempre devolver `message`, y frontend debería manejar todos los status posibles.

---

## 6. Fix para `get_economic_calendar` OOM

Problema separado. La función tiene solo 256 MiB y necesita más.

**Fix:** Aumentar memoria en la definición de la función:

```python
@https_fn.on_call(
    region="us-central1",
    memory=options.MemoryOption.MB_512,  # Era 256 MiB por defecto
    ...
)
def get_economic_calendar(request: https_fn.CallableRequest):
```

---

## 7. Prompt Recomendado para Fix

```
AGENTE: Claude 4.6 en Antigravity IDE

TAREA: Fix "Error en la optimización: Desconocido".

REGLAS:
- Solo modificar 2 archivos.
- No ejecutar scripts.
- No tocar credenciales.

CAMBIOS:
1. frontend/src/hooks/usePortfolioActions.ts:
   - Añadir manejo de status "infeasible_constraints" y "auto_expand_failed"
     en processOptimizationResult, entre fallback_no_history y el else final.
   - Extraer mensaje de result.warnings[0] o result.feasibility.reason.

2. functions_python/services/portfolio/optimizer_core.py:
   - L1028: Añadir "message" al return de infeasible_constraints.
   - L643: Añadir "message" al return de auto_expand_failed.

3. (Opcional) functions_python/api/endpoints_macro.py:
   - Verificar memoria de get_economic_calendar y subir a MB_512 si es 256.

Hacer commit, NO push, NO deploy.
```

---

## 8. Confirmaciones

- ✅ No se modificó código.
- ✅ No se hizo deploy.
- ✅ No se hizo push.
- ✅ No se tocaron credenciales.
- ✅ Solo diagnóstico y documentación.
