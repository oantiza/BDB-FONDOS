# Deploy: Quick Wins Técnicos del Optimizador

**Fecha:** 2026-05-04  
**Commit:** `d4585c4`  
**Proyecto:** bdb-fondos

---

## Resultado

| Paso | Estado |
|---|---|
| Commit | ✅ `d4585c4` — fix: improve optimizer objective and fallback reporting |
| Push | ✅ `0283ba8..d4585c4` |
| Functions | ✅ 17/17 (incluye `optimize_portfolio_quant`) |
| Hosting | ❌ No desplegado |
| Firestore Rules | ❌ No desplegadas |
| Frontend | ❌ No tocado |
| config.py | ❌ No tocado |
| Credenciales | ❌ No tocadas |

**Nota:** Primer intento de deploy falló por timeout de inicialización (flaky, no relacionado con el código). Segundo intento exitoso.

---

## Cambios desplegados

1. **P8-10 usan `max_sharpe`** en vez de `efficient_risk` — elimina infeasibility crónica.
2. **Status "fallback" honesto** — el frontend sabe cuándo se usó fallback.
3. **Métricas con target_vol / achieved_vol / vol_deviation** — transparencia.

---

## Siguiente: Probar OPTIMIZAR en perfiles 8, 9 y 10

https://bdb-fondos.web.app
