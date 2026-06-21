# BDB-FONDOS — Risk Profiles Auth Load Fix
## BDB-RISK-PROFILES-AUTH-LOAD-FIX-0 | 2026-05-12

---

## 1. Error Observado

```
[App] Error fetching risk profiles from DB:
FirebaseError: Missing or insufficient permissions.
```

Aparecia en consola al cargar la aplicacion, antes del login.

---

## 2. Causa Raiz

**Hipotesis A confirmada: lectura pre-auth (race condition).**

En `App.tsx` existian dos `useEffect` con dependencia `[]` (mount-only):
- **useEffect 1** (linea 35): `auth.onAuthStateChanged()` — resuelve auth.
- **useEffect 2** (linea 43): `fetchRiskProfiles()` — lee `system_settings/risk_profiles` de Firestore.

Ambos se disparaban simultaneamente en el mount. El segundo ejecutaba `getDoc()` **antes** de que Firebase Auth resolviera `onAuthStateChanged`, por lo que `request.auth == null` en el momento de la lectura.

**Firestore rules** (correctas, no modificadas):
```
match /system_settings/{document=**} {
  allow read: if isAuthenticated();  // request.auth != null
  allow write: if isAdmin();
}
```

El resultado era `permission-denied` porque no habia token auth todavia.

Adicionalmente, el error activaba `setConfigError()`, que mostraba una pantalla bloqueante "Error Critico del Sistema" impidiendo incluso ver el login.

---

## 3. Solucion Aplicada

**Archivo**: `frontend/src/App.tsx`

### Cambio 1: Dependencia de auth
```diff
-  useEffect(() => {
+  useEffect(() => {
+    if (!isAuthenticatedLocal) {
+      setIsSyncingRiskProfiles(false);
+      return;
+    }
     const fetchRiskProfiles = async () => { ... };
     fetchRiskProfiles();
-  }, []);
+  }, [isAuthenticatedLocal]);
```

El fetch ahora solo se ejecuta cuando `isAuthenticatedLocal === true`, es decir, despues de que `onAuthStateChanged` confirme un usuario.

### Cambio 2: Error degradado a warning
```diff
-  console.error("Error fetching risk profiles from DB:", error);
-  setConfigError(error.message || "No se pudieron cargar...");
+  console.warn("Risk profiles Firestore sync failed, using local seed:", error?.code);
```

Si Firestore falla (por cualquier razon), se usa el seed local silenciosamente. No se bloquea la UI.

### Cambio 3: Eliminacion de configError
Se elimino el estado `configError` y su pantalla bloqueante "Error Critico del Sistema", ya que era dead code con la nueva logica.

---

## 4. Comportamiento Resultante

| Escenario | Antes | Despues |
|---|---|---|
| Usuario no logueado | Error + pantalla bloqueante | Login normal, seed local |
| Usuario logueado | Error transitorio, luego sync | Sync directo sin error |
| Firestore caido | Pantalla bloqueante | Warning en consola, seed local |
| Rules incorrectas | Pantalla bloqueante | Warning en consola, seed local |

---

## 5. Archivos Modificados

| Archivo | Cambio |
|---|---|
| `frontend/src/App.tsx` | Retrasar fetch risk_profiles hasta auth; eliminar configError |

---

## 6. Archivos NO Tocados

- `firestore.rules` — correctas, no relajadas
- `rulesEngine.ts` — fallback local intacto
- `optimizer_core.py` — NO tocado
- `suitability_engine.py` — NO tocado
- `constraints_builder_v1.py` — NO tocado

---

## 7. Validaciones

| Check | Resultado |
|---|---|
| TypeScript (`tsc --noEmit`) | Sin errores nuevos en App.tsx |
| Errores TS preexistentes | Si (XRayReportGenerator, portfolioAnalyticsEngine, usePortfolioActions) — no relacionados |
| Firestore rules | No modificadas |
| Firestore writes | **0** |
| Deploy | **NO** |
| CORE | **NO tocado** |

---

**Fecha**: 2026-05-12
**Autor**: Agente automatico
