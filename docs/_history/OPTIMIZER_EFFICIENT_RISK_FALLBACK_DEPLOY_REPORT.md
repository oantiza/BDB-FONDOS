# Deploy: Fallback efficient_risk infeasible

**Fecha:** 2026-05-04  
**Commit:** `0283ba8`  
**Proyecto:** bdb-fondos

---

## Resultado

| Paso | Estado |
|---|---|
| Commit | ✅ `0283ba8` |
| Push | ✅ `cec6731..0283ba8` |
| Functions | ✅ 17/17 actualizadas (incluye `optimize_portfolio_quant`) |
| Hosting | ❌ No desplegado |
| Firestore Rules | ❌ No desplegadas |

---

## Siguiente: Probar OPTIMIZAR en perfiles 8, 9 y 10

https://bdb-fondos.web.app

El optimizer ahora usa la cadena de fallback (max_sharpe → min_vol → equal_weight) cuando `efficient_risk` falla, en vez de devolver error.
