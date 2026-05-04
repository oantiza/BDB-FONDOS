# Fix: "Error en la optimización: Desconocido"

**Fecha:** 2026-05-04  
**Estado:** Cambios aplicados, pendiente commit/deploy.

---

## Archivos Modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/hooks/usePortfolioActions.ts` | Añadido manejo de `infeasible_constraints` y `auto_expand_failed` |
| `functions_python/services/portfolio/optimizer_core.py` | Añadido campo `message` en returns de ambos status |

---

## Cambios Exactos

### Frontend — `usePortfolioActions.ts` (L692)

**Antes:** El catch-all mostraba "Desconocido" para cualquier status no reconocido.

**Después:** Nuevo bloque antes del catch-all que maneja explícitamente ambos status:

```diff
+        } else if (result.status === 'infeasible_constraints' || result.status === 'auto_expand_failed') {
+            const msg = result.message
+                || result.error
+                || result.warnings?.[0]
+                || result.feasibility?.reason
+                || "Las restricciones actuales no permiten encontrar una cartera óptima. ...";
+            toast.error(`Error en la optimización: ${msg}`);
         } else {
             const msg = result.message || result.error || "Desconocido";
```

### Backend — `optimizer_core.py`

**`auto_expand_failed` (L644):**
```diff
+                    "message": "No se encontraron fondos válidos para expandir el universo. Pruebe con otros activos.",
```

**`infeasible_constraints` (L1030):**
```diff
+                "message": solver_feasibility.get("reason", "No se pudo construir una cartera óptima con las restricciones actuales."),
```

---

## Verificaciones

| Verificación | Resultado |
|---|---|
| `npm run build` | ✅ built in 9.10s |
| `py_compile optimizer_core.py` | ✅ exit 0 |
| `infeasible_constraints` tiene `message` en backend | ✅ |
| `auto_expand_failed` tiene `message` en backend | ✅ |
| Frontend maneja ambos status | ✅ |
| firestore.rules NO tocado | ✅ |
| Credenciales NO tocadas | ✅ |
| No se hizo commit | ✅ |
| No se hizo push | ✅ |
| No se hizo deploy | ✅ |

---

## Recomendación de Deploy

```
1. git add + commit
2. git push
3. firebase deploy --only functions    ← backend con message
4. firebase deploy --only hosting      ← frontend con manejo de status
5. NO desplegar firestore:rules (ya está desplegado)
```
