# BDB_ADMIN_BACKEND_REQUIRE_ADMIN_0

## 1. Resumen Ejecutivo

Implementación del middleware backend autoritativo `requireAdmin` y dos endpoints read-only para la consola admin: `admin_health` y `admin_fund_search`.

Este bloque cierra la brecha de seguridad identificada en el diseño: el frontend AdminGuard es solo UX/conveniencia; este módulo backend es la capa de autorización autoritativa.

## 2. Estado Base

| Campo | Valor |
|---|---|
| HEAD base | `d3de1ad` |
| Rama | master |
| Frontend shell | desplegado en producción (hosting-only) |
| Admin guard frontend | cerrado y operativo |

## 3. Qué se Implementó

### A) Helper de autorización admin
**Archivo:** `functions_python/services/admin_auth.py`

| Función | Propósito |
|---|---|
| `ADMIN_EMAILS` | Allowlist canónica (frozenset inmutable) |
| `normalize_email(email)` | Normalización case-insensitive + trim |
| `is_admin_email(email)` | Check booleano contra allowlist |
| `require_admin_email(email)` | Validación con ValueError para no-admin |
| `extract_and_verify_admin_callable(request)` | Extractor para @on_call endpoints |
| `extract_and_verify_admin_http(req)` | Extractor para @on_request endpoints |

### B) Endpoints read-only
**Archivo:** `functions_python/api/endpoints_admin_console.py`

| Endpoint | Tipo | Propósito |
|---|---|---|
| `admin_health` | @on_call | Health check: status, mode, capabilities, invariants |
| `admin_fund_search` | @on_call | Búsqueda sanitizada de fondos por query/ISIN |

**Campo allowlist para fund_search:**
```
isin, name, asset_type, classification_v2, manual, portfolio_exposure_v2
```

Campos como `eod_ticker`, `std_extra`, `internal_score` se excluyen explícitamente.

### C) Registro en main.py
**Archivo:** `functions_python/main.py`

Nuevos endpoints registrados en sección separada `ADMIN CONSOLE (READ-ONLY)`.

### D) Tests
| Suite | Tests | Estado |
|---|---|---|
| `test_admin_auth.py` | 29 | PASS ✅ |
| `test_admin_endpoints_readonly.py` | 14 | PASS ✅ |
| **Total backend nuevo** | **43** | **PASS** ✅ |
| Frontend (sin cambios) | 142 | PASS ✅ |

## 4. Modelo de Seguridad — 3 Capas

```
┌─────────────────────────────────────────┐
│ Capa 1: Frontend AdminGuard (UX-only)   │
│ → isAdminEmail() en hooks/useAdminAuth  │
│ → Bypassable. Solo conveniencia.        │
├─────────────────────────────────────────┤
│ Capa 2: Backend requireAdmin (THIS)     │
│ → services/admin_auth.py                │
│ → Autoritativo. HttpsError si no admin. │
├─────────────────────────────────────────┤
│ Capa 3: Firestore Security Rules        │
│ → Defensa en profundidad (futura).      │
│ → Para operaciones de write.            │
└─────────────────────────────────────────┘
```

## 5. Endpoints

### `admin_health`
- **Auth:** require_admin (callable)
- **Input:** ninguno
- **Output:** `{ status, mode, admin_email, capabilities, invariants, version, phase }`
- **Firestore:** NO accede
- **Secrets:** NO expone
- **Write:** NO

### `admin_fund_search`
- **Auth:** require_admin (callable)
- **Input:** `{ query: string }` o `{ isin: string }`
- **Output:** `{ results: sanitized[], count, query, mode }`
- **Firestore:** Lee `funds_v3` (read-only)
- **Sanitización:** Solo campos de la allowlist (`SAFE_FUND_FIELDS`)
- **Limits:** max 20 resultados
- **Write:** NO

## 6. Invariantes Verificadas

| Invariante | Estado |
|---|---|
| Read-only | ✅ No hay `.set()`, `.update()`, `.delete()`, `batch` |
| No writes | ✅ Verificado estáticamente y en tests |
| No parser | ✅ No imports de cargador_lotes ni research |
| No Gemini | ✅ No imports de GenerativeModel |
| No secrets | ✅ No api_key, private_key, serviceAccount |
| Tests verdes | ✅ 43 backend + 142 frontend |

## 7. Tests Ejecutados

```
functions_python/tests/test_admin_auth.py ........... 29 PASS
functions_python/tests/test_admin_endpoints_readonly.py ... 14 PASS
frontend (sin cambios) ............................ 142 PASS
```

## 8. Qué NO se Hizo

- ❌ NO deploy functions — endpoints aún no están en producción.
- ❌ NO firestore.rules deploy — no se modificaron reglas.
- ❌ NO Firestore writes — todo es read-only.
- ❌ NO frontend funcional nuevo — no se conectó el frontend a los nuevos endpoints.
- ❌ NO parser real — sin invocaciones.
- ❌ NO Gemini real — sin invocaciones.
- ❌ NO CORE — sin cambios.
- ❌ NO audit logs — implican write, diferidos.

## 9. Próximo Bloque Recomendado

**Opción A:** `BDB-ADMIN-BACKEND-DEPLOY-0`
Deploy controlado de `--only functions` para activar `admin_health` y `admin_fund_search` en producción.

**Opción B:** `BDB-ADMIN-CONSOLE-LIVE-DASHBOARD-0`
Conectar el frontend AdminDashboard a `admin_health` para mostrar estado real del backend.

**Opción C:** Refactor de endpoints_admin.py existentes para usar `extract_and_verify_admin_callable` en lugar del check inline duplicado (mejora de deuda técnica).

## 10. Decisión

**ESTADO: `BDB_ADMIN_BACKEND_REQUIRE_ADMIN_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T06:52:00+02:00
