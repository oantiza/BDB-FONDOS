# Commit B: Dev Functional Report

**Fecha:** 2026-05-04  
**Commit:** `0a71c01`  
**Mensaje:** `feat: update xray and macro endpoints before deployment validation`  
**Archivos:** 5  
**Líneas:** +123 / −49

---

## Archivos Incluidos

| # | Archivo | Cambio |
|---|---|---|
| 1 | `frontend/src/components/xray/XRayReportGenerator.tsx` | Auth token en API call |
| 2 | `frontend/src/utils/retirementUtils.ts` | Escala fiscal Bizkaia 2026 |
| 3 | `functions_python/api/endpoints_admin.py` | Bearer auth + email check |
| 4 | `functions_python/api/endpoints_macro.py` | print → logger |
| 5 | `functions_python/api/endpoints_xray_comparador.py` | CORS restringido, Letras 2026, XIRR None handling |

---

## Verificaciones

| Check | Resultado |
|---|---|
| `py_compile endpoints_admin.py` | ✅ OK |
| `py_compile endpoints_macro.py` | ✅ OK |
| `py_compile endpoints_xray_comparador.py` | ✅ OK |
| `npm run build` (frontend) | ✅ Built in 7.32s |

---

## Confirmaciones de Seguridad

- ✅ **firestore.rules** NO incluido.
- ✅ **serviceAccountKey.json** NO incluido.
- ✅ **.env** NO incluido.
- ✅ **frontend/.env** NO incluido.
- ✅ No se hizo push.
- ✅ No se desplegó nada.

---

## Estado Post-Commit

```
Solo quedan pendientes:
 M firestore.rules
?? docs/POST_CLEANUP_COMMIT_A_HOUSEKEEPING_REPORT.md
```

- `firestore.rules` — reservado para Commit C.
- `POST_CLEANUP_COMMIT_A_HOUSEKEEPING_REPORT.md` — report que puede incluirse en Commit C.

---

## Próxima Fase

**Commit C:** `firestore.rules` — cambio de reads `true` → `isAuthenticated()`.

> ⚠️ **No ejecutar Commit C sin antes validar** que el frontend envía tokens Firebase Auth en todas las lecturas Firestore. Si el frontend no tiene auth integrado, el deploy de estas rules bloqueará todas las lecturas.

> No ejecutado. Requiere aprobación explícita.
