# Firestore Rules — Validación Pre-Commit C

**Fecha:** 2026-05-04  
**Estado:** Solo análisis, sin modificaciones.

---

## 1. Cambios Exactos

| # | Colección | Antes | Después | Impacto |
|---|---|---|---|---|
| 1 | `funds_v3` | `read: if true` | `read: if isAuthenticated()` | Requiere login |
| 2 | `historico_vl_v2` | `read: if true` | `read: if isAuthenticated()` | Requiere login |
| 3 | `analysis_results` | `read: if true` | `read: if isAuthenticated()` | Requiere login |
| 4 | `synthetic_benchmarks` | `read: if true` | `read: if isAuthenticated()` | Requiere login |
| 5 | `reports` | `read: if true` | `read: if isAuthenticated()` | Requiere login |
| 6 | **Default catch-all** | `read: true, write: false` | `read, write: false` | Bloqueo total |

### Colecciones NO modificadas (ya seguras):

| Colección | Regla actual | Estado |
|---|---|---|
| `users/{userId}` | `auth.uid == userId` | ✅ Ya autenticada |
| `system_settings` | `read: if true` | ⚠️ Sigue pública — NO cambia en este diff |
| `admin_jobs` | `email == oantiza@gmail.com` | ✅ Ya protegida |

---

## 2. Análisis del Frontend Auth

### ¿Existe auth gating en App.tsx? ✅ SÍ

```tsx
// App.tsx L90-92
if (!isAuthenticatedLocal) {
  return <Login key="login" onLogin={handleLogin} />
}
```

**`App.tsx` bloquea TODO el contenido detrás de `auth.onAuthStateChanged`.**  
Ninguna página se renderiza sin usuario autenticado.

### ¿Las lecturas Firestore ocurren después de auth?

| Componente | Colección leída | ¿Post-auth? |
|---|---|---|
| `App.tsx` L44 | `system_settings` | ⚠️ Se ejecuta en `useEffect` sin depender de auth — PERO esta colección **no cambia** en el diff (sigue `read: true`) |
| `usePortfolio.ts` | `funds_v3` | ✅ Usa `onAuthStateChanged` guard (L32) |
| `useAssets.ts` | `funds_v3` | ✅ Se renderiza solo post-auth |
| `useSavedPortfolios.ts` | `users/{uid}/saved_portfolios` | ✅ Depende de `auth.onAuthStateChanged` (L22) |
| `useSyntheticBenchmarks.ts` | `synthetic_benchmarks` | ✅ Se renderiza solo post-auth |
| `useXRayData.ts` | `reports` | ✅ Se renderiza solo post-auth |
| `directSearch.ts` | `funds_v3` | ✅ Se usa en componentes post-auth |
| `dashboard.tsx` (MiBoutique) | `analysis_results` | ✅ Se renderiza solo post-auth |
| `DashboardPage.tsx` | `reports` | ✅ Se renderiza solo post-auth |
| `MacroDashboardV3.tsx` | `reports` | ✅ Se renderiza solo post-auth |
| `FundComparator.tsx` | `funds_v3` | ✅ Se renderiza solo post-auth |
| `PrintMacroStrategyReport.tsx` | `reports` | ⚠️ Ver nota abajo |

### ⚠️ Caso Especial: `PrintMacroStrategyReport`

```tsx
// App.tsx L142-144
if (window.location.pathname === '/print/macro-report') {
  return <PrintMacroStrategyReport key="print-macro" />
}
```

Este check está **DENTRO** del bloque post-auth (L90 es previo). ✅ OK — el usuario ya está autenticado cuando llega aquí.

---

## 3. Caso `system_settings` — Lectura Pre-Auth

```tsx
// App.tsx L41-63
useEffect(() => {
  const fetchRiskProfiles = async () => {
    const docRef = doc(db, 'system_settings', 'risk_profiles');
    const docSnap = await getDoc(docRef);
    ...
  };
  fetchRiskProfiles();
}, []);
```

- Este `useEffect` se ejecuta al montar, **antes** de que auth resuelva.
- **PERO** `system_settings` sigue con `allow read: if true` en el diff.
- **No hay cambio de regla para `system_settings`.** ✅ No se rompe.

### ⚠️ Nota para futuro:
Si en alguna fase futura se protege `system_settings`, este `useEffect` necesitará un guard de auth o deberá moverse al bloque post-auth.

---

## 4. Cloud Functions — ¿Usan Admin SDK o Client SDK?

Las Cloud Functions (endpoints Python) usan **Firebase Admin SDK** que **bypasea Firestore rules** completamente. Los cambios de rules NO afectan a:
- `endpoints_admin.py`
- `endpoints_macro.py`
- `endpoints_xray_comparador.py`
- Cualquier script backend

✅ Sin impacto en backend.

---

## 5. Evaluación de Riesgo

| Riesgo | Nivel | Justificación |
|---|---|---|
| Frontend reads post-auth | 🟢 BAJO | App.tsx gatea todo tras login |
| `system_settings` pre-auth | 🟢 NINGUNO | No cambia en este diff |
| Backend/Functions | 🟢 NINGUNO | Admin SDK bypasea rules |
| Usuarios no logueados | 🟢 CONTROLADO | Login es obligatorio |
| Catch-all cerrado | 🟡 BAJO | Colecciones no listadas quedan bloqueadas — correcto |

---

## 6. Pruebas Necesarias Post-Deploy

| # | Prueba | Qué verificar |
|---|---|---|
| 1 | Login estándar | Email/password funciona |
| 2 | Dashboard → funds_v3 | Fondos se cargan correctamente |
| 3 | Históricos → historico_vl_v2 | Gráficos de NAV funcionan |
| 4 | MiBoutique → analysis_results | Panel de análisis funciona |
| 5 | Benchmarks → synthetic_benchmarks | Perfiles sintéticos se cargan |
| 6 | Reports → reports | Informes semanales visibles |
| 7 | XRay Comparador | API + frontend + token |
| 8 | Modo no logueado | Redirige a Login, no muestra datos |
| 9 | system_settings al inicio | Risk profiles se sincronizan antes de dashboard |

---

## 7. Veredicto

### ✅ Commit C: AUTORIZADO

**Justificación:**
1. El frontend **ya bloquea todo el contenido tras auth** (App.tsx L90).
2. Todas las lecturas Firestore de colecciones afectadas ocurren en componentes post-auth.
3. La única lectura pre-auth (`system_settings`) **no se modifica** en este diff.
4. El backend (Admin SDK) **no se ve afectado** por rules.
5. El catch-all cerrado es la postura correcta de seguridad.

**Condición para deploy de rules:**
> Desplegar rules DESPUÉS de desplegar hosting (frontend) y functions (API) para asegurar que el código con auth tokens ya está en producción.

### Secuencia de deploy recomendada:
```
1. firebase deploy --only functions    ← API con auth headers
2. firebase deploy --only hosting      ← Frontend con getIdToken()
3. Verificar login + lecturas en producción
4. firebase deploy --only firestore:rules  ← Rules protectoras AL FINAL
```

---

## 8. Confirmaciones

- ✅ No se modificó ningún archivo.
- ✅ No se hizo commit.
- ✅ No se hizo push.
- ✅ No se desplegó nada.
- ✅ Solo análisis y documentación.
