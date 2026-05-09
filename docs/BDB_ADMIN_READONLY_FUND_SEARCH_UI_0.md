# BDB_ADMIN_READONLY_FUND_SEARCH_UI_0

## 1. Resumen Ejecutivo

Primera funcionalidad real read-only integrada en la consola admin:
panel **Funds v3 Audit** con búsqueda por ISIN/nombre mediante
callable `admin_fund_search` (backend sanitizado).

**Resultado: ✅ BDB_ADMIN_READONLY_FUND_SEARCH_UI_0_READY_FOR_REVIEW**

## 2. Estado Base

| Campo | Valor |
|---|---|
| HEAD | `d1ad30f` |
| origin/master | `d1ad30f` |
| admin_fund_search | Desplegado y verificado en europe-west1 |
| admin_health | Desplegado y verificado en europe-west1 |
| Frontend tests previos | 142/142 PASS |
| Backend admin tests | 43/43 PASS |

## 3. Qué Se Implementó

### A) Service frontend read-only
**`frontend/src/services/adminConsoleService.ts`** (NUEVO)

- Exporta `searchAdminFunds(query, limit)`.
- Usa `httpsCallable` contra `admin_fund_search` en europe-west1.
- Auto-detecta si el query es un ISIN (regex `^[A-Z]{2}[A-Z0-9]{10}$`).
- Valida mínimo 2 caracteres.
- Limit máximo 20.
- Tipos TypeScript: `AdminFundResult`, `AdminFundSearchResponse`.
- NO importa getFirestore.
- NO contiene operaciones de escritura.
- NO accede a Firestore directamente.

### B) Componente UI
**`frontend/src/components/admin/FundAuditor.tsx`** (NUEVO)

- Panel para el tab "Funds v3 Audit".
- Input de búsqueda "Buscar por ISIN o nombre".
- Botón "Buscar" con validación (deshabilitado si < 2 chars).
- Banner: "Consulta Read-Only — No se escribe en Firestore".
- Estados: idle, loading, error, empty, results.
- Tabla de resultados con columnas:
  - ISIN (monospace)
  - Nombre
  - Tipo (asset_subtype)
  - Retrocesión (%)
  - TER (%)
  - Asset Mix (badges RV/RF)
  - Riesgo (badge LOW/MEDIUM/HIGH)
- Sin botones de escritura, edición, exportación ni rollback.
- Estilo visual coherente con AdminDashboard (Private Banking UI).

### C) Integración AdminLayout
**`frontend/src/components/admin/AdminLayout.tsx`** (MODIFICADO)

- Import de FundAuditor.
- `funds` module marcado como `implemented: true`.
- Renderiza `<FundAuditor />` cuando el tab activo es "Funds v3 Audit".

### D) Tests
**`frontend/src/__tests__/adminFundSearch.test.tsx`** (NUEVO — 37 tests)

- Service exports (searchAdminFunds, MAX_SEARCH_LIMIT, MIN_QUERY_LENGTH).
- Service source: referencia admin_fund_search, usa httpsCallable.
- Security invariants: no setDoc(, updateDoc(, deleteDoc(, writeBatch(, etc.
- No getFirestore, no parser, no Gemini, no secrets.
- FundAuditor source: read-only text, no write patterns.
- AdminLayout: importa FundAuditor, funds implemented, renderiza componente.
- Input validation: MIN >= 2, MAX <= 50, MAX == 20.
- Cross-module: no process.env, no import.meta.env, no collection(.

**`frontend/src/__tests__/adminConsoleShell.test.tsx`** (MODIFICADO)

- Actualizado: "dashboard and funds are implemented" (era "only dashboard").

## 4. Seguridad

| Invariante | Estado |
|---|---|
| Callable backend admin | ✅ admin_fund_search via httpsCallable |
| Frontend no lee Firestore directo | ✅ Solo callable |
| No writes | ✅ Escaneado estáticamente |
| No documentos completos | ✅ Backend devuelve campos sanitizados |
| No exports/edición/rollback UI | ✅ Verificado en tests |
| No parser | ✅ Sin imports |
| No Gemini | ✅ Sin imports |
| No secrets | ✅ Sin private_key/serviceAccount |
| No process.env/import.meta.env | ✅ Cross-module scan |

## 5. Tests Ejecutados

```
Test Suites: 12 passed (12)
Tests:       184 passed (184)
Build:       PASS (7.92s)
```

Desglose tests nuevos:
- adminConsoleService: 4 tests
- adminConsoleService source: 3 tests
- adminConsoleService security: 13 tests
- FundAuditor source: 11 tests
- AdminLayout integration: 3 tests
- Input validation: 3 tests
- Cross-module security: 3 tests
Total nuevos: ~37 tests

## 6. Qué NO Se Hizo

- ✅ NO backend nuevo
- ✅ NO endpoints nuevos
- ✅ NO deploy
- ✅ NO Firestore writes
- ✅ NO parser real
- ✅ NO Gemini real
- ✅ NO CORE
- ✅ NO libs nuevas
- ✅ NO React Router
- ✅ NO commit
- ✅ NO push
- ✅ NO scripts/scratch/ leído/tocado
- ✅ NO .playwright-mcp/ leído/tocado

## 7. Archivos Creados/Modificados

| Archivo | Acción |
|---|---|
| `frontend/src/services/adminConsoleService.ts` | NUEVO |
| `frontend/src/components/admin/FundAuditor.tsx` | NUEVO |
| `frontend/src/components/admin/AdminLayout.tsx` | MODIFICADO |
| `frontend/src/__tests__/adminFundSearch.test.tsx` | NUEVO |
| `frontend/src/__tests__/adminConsoleShell.test.tsx` | MODIFICADO |
| `docs/BDB_ADMIN_READONLY_FUND_SEARCH_UI_0.md` | NUEVO |

## 8. Próximo Bloque Recomendado

**Opción A:** `BDB-ADMIN-READONLY-FUND-SEARCH-UI-COMMIT-0`
Commit de este bloque.

**Opción B:** `BDB-ADMIN-READONLY-FUND-SEARCH-UI-DEPLOY-0`
Deploy hosting-only para que la UI sea accesible en producción.

**Opción C:** `BDB-ADMIN-HEALTH-LIVE-DASHBOARD-0`
Conectar admin_health al dashboard para mostrar estado real del backend.

## 9. Decisión

**ESTADO: `BDB_ADMIN_READONLY_FUND_SEARCH_UI_0_READY_FOR_REVIEW`**

Fecha: 2026-05-09T07:37:00+02:00
