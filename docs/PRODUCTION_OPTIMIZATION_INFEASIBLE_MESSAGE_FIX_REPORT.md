# Fix: Mensaje infeasible técnico → español claro

**Fecha:** 2026-05-04  
**Archivo:** `frontend/src/hooks/usePortfolioActions.ts`  
**Solo frontend.** Backend no modificado.

---

## Antes

```
"Error en la optimización: ('Please check your objectives/constraints or use a different solver.', 'Solver status: infeasible')"
```

## Después

```
"No se ha podido encontrar una cartera óptima con las restricciones actuales. Pruebe a reducir el nivel de riesgo, aumentar el número de fondos o ampliar el universo disponible."
```

---

## Cambios

1. **`infeasible_constraints` / `auto_expand_failed`:** Mensaje fijo en español, sin propagar texto técnico del solver.
2. **Catch-all:** Detecta si `rawMsg` contiene `"Solver status: infeasible"` o `"Please check your objectives/constraints"` y reemplaza por el mensaje español. Otros errores muestran el mensaje original.

---

## Verificaciones

| Check | Resultado |
|---|---|
| `npm run build` | ✅ 7.57s |
| Backend modificado | ❌ No |
| firestore.rules | ❌ No tocado |
| Credenciales | ❌ No tocadas |
| Commit | ❌ No |
| Deploy | ❌ No |

---

## Deploy Recomendado

Solo hosting (cambio exclusivamente frontend):

```
firebase deploy --only hosting
```
