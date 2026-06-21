# Commit C: Firestore Rules Auth Hardening Report

**Fecha:** 2026-05-04  
**Commit:** `cf65f3a`  
**Mensaje:** `chore: require authentication for Firestore reads`  
**Archivos:** 2  
**Líneas:** +172 / −7

---

## Archivos Incluidos

| Archivo | Estado | Contenido |
|---|---|---|
| `firestore.rules` | Modified | 5 colecciones `true` → `isAuthenticated()`, catch-all cerrado |
| `docs/FIRESTORE_RULES_AUTH_VALIDATION_PLAN.md` | New | Validación auth completa |

---

## Confirmaciones

- ✅ **serviceAccountKey.json** NO incluido.
- ✅ **.env** NO incluido.
- ✅ **frontend/.env** NO incluido.
- ✅ **frontend/src/** NO incluido.
- ✅ **functions_python/api/** NO incluido.
- ✅ No se hizo push.
- ✅ No se desplegó nada.

---

## Estado Post-Commit

```
Working tree clean — 0 archivos pendientes.
```

---

## ⚠️ Recordatorio: Orden de Deploy

```
1. firebase deploy --only functions     ← API con auth headers
2. firebase deploy --only hosting       ← Frontend con getIdToken()
3. Verificar login + lecturas en producción
4. firebase deploy --only firestore:rules  ← AL FINAL
```

> **NUNCA desplegar rules antes que hosting/functions.** Si las rules se despliegan sin el frontend actualizado, las lecturas fallarán.

---

## Resumen Completo de Commits Post-Cleanup

| Commit | Hash | Archivos | Contenido |
|---|---|---|---|
| A: Housekeeping | `1b1ffec` | 36 | Docs + eliminaciones obsoletas |
| Reports | `a131405` | 2 | Reports A/B |
| B: Dev funcional | `0a71c01` | 5 | API auth + fiscal 2026 + XRay |
| **C: Firestore rules** | **`cf65f3a`** | **2** | **Auth hardening + validación** |

**Working tree: LIMPIO.** Listo para push cuando se decida.
