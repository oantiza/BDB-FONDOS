# BDB_ADMIN_AUTH_GUARD_0

> **Tipo:** Implementación técnica  
> **Fecha:** 2026-05-09  
> **HEAD base:** `b3d4b81` = origin/master

---

## 1. Resumen Ejecutivo

Implementación del primer bloque técnico de la futura consola admin: un patrón reutilizable de autorización frontend que centraliza la lógica de verificación de email admin en un solo lugar, reemplazando checks hardcoded dispersos.

---

## 2. Estado Base

| Campo | Valor |
|-------|-------|
| HEAD | `b3d4b81` |
| Rama | master |
| Diseño admin | Cerrado (`BDB_ADMIN_CONSOLE_DESIGN_0.md`) |
| Frontend tests previos | 9/9 suites, 113/113 PASS |

---

## 3. Qué se Implementó

### A) Hook `useAdminAuth` — `frontend/src/hooks/useAdminAuth.ts`

- **`ADMIN_EMAILS`**: Readonly array, single source of truth para emails admin frontend.
- **`normalizeEmail(email)`**: Lowercase + trim, null-safe.
- **`isAdminEmail(email)`**: Case-insensitive check contra allowlist, null-safe.
- **`useAdminAuth()`**: React hook que devuelve `{ user, email, isAuthenticated, isAdmin }`.

### B) Componente `AdminGuard` — `frontend/src/components/admin/AdminGuard.tsx`

- Props: `children`, `fallback?`, `requireAdmin? = true`.
- Admin → render children.
- Non-admin → render fallback o mensaje por defecto "Acceso restringido".
- `requireAdmin=false` → solo requiere autenticación.
- No navega, no escribe, no llama endpoints.

### C) Tests — `frontend/src/__tests__/adminAuth.test.tsx`

17 tests cubriendo:
- `ADMIN_EMAILS` contiene email correcto.
- `normalizeEmail`: lowercase, trim, null, undefined, empty.
- `isAdminEmail`: true exacto, true case-insensitive (caps, mixed), true con espacios, false para non-admin, false para similar, false null, false undefined, false empty, false number.

### D) FundDetailModal refactor mínimo

Reemplazado:
```diff
-  const isAdmin = auth.currentUser?.email === 'oantiza@gmail.com';
+  const isAdmin = isAdminEmail(auth.currentUser?.email);
```

Comportamiento idéntico, ahora usa single source of truth.

---

## 4. Invariante de Seguridad

> ⚠️ **El guard frontend es UX-ONLY.**  
> NO proporciona seguridad real. El backend (Cloud Functions `endpoints_admin.py`) y las Firestore Security Rules (`isAdmin()` en `firestore.rules`) DEBEN validar independientemente toda autorización.

---

## 5. Admin Inicial

| Email | Rol |
|-------|-----|
| `oantiza@gmail.com` | admin / super_admin |

---

## 6. Qué NO se Hizo

| Prohibición | Cumplido |
|-------------|----------|
| NO backend | ✅ |
| NO endpoints nuevos | ✅ |
| NO Firestore writes | ✅ |
| NO deploy | ✅ |
| NO push | ✅ |
| NO parser real | ✅ |
| NO Gemini real | ✅ |
| NO CORE | ✅ |
| NO consola admin completa | ✅ |
| NO botones de write | ✅ |
| NO rutas admin | ✅ |

---

## 7. Tests Ejecutados

| Métrica | Valor |
|---------|-------|
| Suites | 10/10 PASS |
| Tests | 130/130 PASS |
| Build | PASS |
| Nuevos tests | 17 (adminAuth.test.tsx) |

---

## 8. Próximo Bloque Recomendado

**Opción A (recomendada):** `BDB-ADMIN-CONSOLE-FRONTEND-SHELL-0`
- Crear `AdminPage.tsx` + `AdminLayout.tsx`.
- Añadir ruta `ADMIN` al state router en `App.tsx`.
- Envolver con `AdminGuard`.
- Solo shell vacío, sin datos reales.

**Opción B:** `BDB-ADMIN-BACKEND-REQUIRE-ADMIN-0`
- Extraer middleware reutilizable `require_admin` en backend.
- Crear endpoint `admin_health` read-only.

---

## 9. Decisión

### Estado: `BDB_ADMIN_AUTH_GUARD_0_READY` ✅
