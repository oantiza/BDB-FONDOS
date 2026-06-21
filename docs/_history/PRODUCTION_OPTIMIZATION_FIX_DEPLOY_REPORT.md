# Deploy: Fix "Error en la optimización: Desconocido"

**Fecha:** 2026-05-04  
**Commit:** `0a578c7`  
**Hosting URL:** https://bdb-fondos.web.app

---

## Resultado

| Servicio | Estado |
|---|---|
| **Push** | ✅ `4049298..0a578c7 master → master` |
| **Functions** | ✅ 17/17 actualizadas |
| **Hosting** | ✅ 20 archivos, release complete |
| **Firestore Rules** | ❌ NO desplegado |

---

## Siguiente Paso

Probar **OPTIMIZAR** en https://bdb-fondos.web.app:
- Si el optimizer falla por restricciones → debe mostrar mensaje claro, no "Desconocido".
- Si funciona correctamente → la cartera se optimiza normal.
