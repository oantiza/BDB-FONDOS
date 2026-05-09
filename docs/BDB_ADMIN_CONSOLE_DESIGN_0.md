# BDB_ADMIN_CONSOLE_DESIGN_0

> **Tipo:** Diseño funcional y técnico  
> **Fecha:** 2026-05-09  
> **Modo:** Read-only / documentación  
> **HEAD base:** `2991cf0` = origin/master

---

## 1. Resumen Ejecutivo

Diseño de una consola admin segura para BDB-FONDOS que permita gestionar retrocesiones, parser Morningstar, review queue, auditoría, snapshots/rollback, estado de fondos, optimizer/constraints y operaciones controladas con write gate — todo desde la propia aplicación web, con seguridad en tres capas (frontend + backend + Firestore rules).

---

## 2. Estado Base

| Campo | Valor |
|-------|-------|
| HEAD | `2991cf0` |
| Rama | master |
| Producción | Operativa |
| Frontend tests | 9/9 suites, 113/113 PASS |
| Retrocesiones | Write gate cerrado (44 actualizadas, 3 excluidas) |
| Parser | Refactor cerrado |
| Mixto/UX | Cerrado, desplegado |
| Constraints | Plan + tests cerrados |

---

## 3. Diagnóstico de Arquitectura Actual

### 3.1 Autenticación

| Capa | Estado | Detalle |
|------|--------|---------|
| Firebase Auth | ✅ Activo | `signInWithEmailAndPassword` en `App.tsx` |
| Frontend admin check | ⚠️ Parcial | Solo `FundDetailModal.tsx:21` hardcoded `oantiza@gmail.com` |
| Backend admin check | ✅ Activo | `endpoints_admin.py` verifica email en cada endpoint |
| Firestore rules | ✅ Activo | `isAdmin()` function valida `oantiza@gmail.com` |

### 3.2 Colecciones Firestore Existentes

| Colección | Read | Write | Admin |
|-----------|------|-------|-------|
| `funds_v3` | authenticated | admin only | ✅ |
| `historico_vl_v2` | authenticated | admin only | ✅ |
| `users/{userId}` | owner only | owner only | — |
| `system_settings` | public (temp) | admin only | ✅ |
| `analysis_results` | authenticated | denied | — |
| `admin_jobs` | admin only | admin only | ✅ |
| `synthetic_benchmarks` | authenticated | admin only | ✅ |
| `reports` | authenticated | admin only | ✅ |

### 3.3 Backend Admin Endpoints Existentes

| Endpoint | Tipo | Auth | Acción |
|----------|------|------|--------|
| `force_weekly_research` | HTTP | Bearer token + email | Genera informe semanal |
| `generate_analysis_report` | Callable | email check | Deep research |
| `restore_historico` | Callable | email check | Restaura histórico |
| `insertMonthlyReport` | Callable | email check | Inserta informe mensual |
| `updateFundHistory` | Callable | email check | Actualiza NAV desde EODHD |
| `getRiskRate` | Callable | authenticated | Lee risk-free rate |
| `refresh_daily_metrics` | HTTP | REFRESH_TOKEN header | Scheduler diario |

### 3.4 Scripts de Mantenimiento (local, no expuestos)

31 scripts en `scripts/maintenance/` incluyendo: `import_retrocesiones.js`, `bdb_retrocession_reload_dry_run.js`, `update_retrocessions_funds_v3.js`, `recalculate_derived_fields.js`, `audit_funds_v3.js`, `cargador_lotes_v_2.js`.

### 3.5 Routing Frontend Actual

`App.tsx` usa estado `activeView` con valores: `DASHBOARD`, `MIBOUTIQUE`, `XRAY`, `POSITIONS`, `RETIREMENT`, `COMPARATOR`, `ANALYTICS`. No existe ruta `/admin`. No hay React Router — es state-based routing.

---

## 4. Principios de Seguridad

### REGLA CENTRAL: Seguridad en 3 capas obligatorias

```
┌─────────────────────────────────────────┐
│ CAPA 1: Frontend Guard                  │
│ - Ocultar UI admin a no-admins          │
│ - Guard por email en state/route        │
│ - Botones write deshabilitados sin gate │
│ ⚠️ NUNCA confiar solo en esta capa     │
├─────────────────────────────────────────┤
│ CAPA 2: Backend Middleware              │
│ - verify_id_token en cada endpoint      │
│ - Allowlist email → reject 403          │
│ - Dry-run ≠ write (endpoints separados) │
│ - Write requiere manifest_id + confirm  │
├─────────────────────────────────────────┤
│ CAPA 3: Firestore Rules                 │
│ - isAdmin() en reglas desplegadas       │
│ - Deny by default                       │
│ - Colecciones admin separadas           │
│ - No escritura pública jamás            │
└─────────────────────────────────────────┘
```

### Invariantes obligatorios

1. **NO frontend-only security** — backend SIEMPRE valida.
2. **NO writes sin snapshot** — antes de cualquier write, crear snapshot.
3. **NO writes sin dry-run** — siempre dry-run → review → confirm → write.
4. **NO parser/Gemini desde UI sin gate** — jamás auto-trigger.
5. **NO Firestore rules deploy sin revisión** — siempre review previo.
6. **NO tocar CORE** — repositorio separado.
7. **Auditoría obligatoria** — cada acción admin registrada.

---

## 5. Módulos Funcionales

### A. Dashboard Admin

- Estado global: HEAD, último deploy, último write gate.
- Warnings abiertos (fondos sin `classification_v2`, exposure missing).
- Fondos pendientes review.
- Parser status (último run, cola pendiente).
- Retrocession status (último import, excluidos).
- Quick stats: total fondos, con retro, sin retro, con historial.

### B. Retrocesiones

- Ver retrocesión actual por ISIN.
- Cargar CSV → validar formato/escala.
- Dry-run: comparar CSV vs BD, generar diff.
- Revisión humana: tabla con antes/después/delta.
- Write gate parcial: seleccionar ISINs aprobados.
- Snapshot antes del write.
- Rollback manifest para revertir.
- Post-write verification automática.
- Historial de todos los import runs.

### C. Parser Morningstar

- Cola de PDFs pendientes.
- Dry-run parser (sin Gemini real inicialmente).
- Clasificación: ACCEPT / REVIEW / BLOCKED.
- Preview de artifact generado.
- Write gate por ISIN (selectivo).
- Snapshot/rollback.
- Logs de ejecución (sin exponer API keys).

### D. Review Queue

- Fondos con warnings activos.
- Exposure missing (`portfolio_exposure_v2` vacío).
- Mixed sin `asset_mix` válido.
- Retrocesión con delta > umbral.
- Parser review pendiente.
- ISINs no encontrados.

### E. Funds v3 Audit

- Buscar por ISIN/nombre.
- Ver campos: `manual`, `ms`, `derived`, `classification_v2`, `portfolio_exposure_v2`, `costs`, `retrocession`.
- Detectar inconsistencias (V1 vs V2, campos faltantes).
- Comparar CSV importado vs estado BD.

### F. Optimizer / Constraints

- Ver `risk_profiles` desde `system_settings`.
- Constraints canonical: bucket_bounds por perfil.
- Warnings/fallback logs del último run.
- **NO editar perfiles en v1** — solo visualización.

### G. Logs / Artifacts

- Listar artifacts versionados (`artifacts/bdb_data_audit/`).
- Descargar informes de write gate.
- Historial de snapshots/rollbacks.
- **NO exponer secretos ni API keys.**

### H. Settings / Access

- Lista de admins (inicialmente solo `oantiza@gmail.com`).
- Roles asignados.
- Audit log viewer.
- Gestión de permisos (futuro).

---

## 6. Arquitectura Frontend

### 6.1 Routing

```
App.tsx activeView:
  ... (existing views) ...
  | 'ADMIN' → <AdminPage />
```

La ruta `/admin` se añade al state-based router existente. Un enlace en el header/sidebar solo visible si `isAdmin`.

### 6.2 Componentes Propuestos

```
frontend/src/
├── pages/
│   └── AdminPage.tsx              # Layout principal admin
├── components/admin/
│   ├── AdminGuard.tsx             # HOC: verifica email, redirige si no admin
│   ├── AdminLayout.tsx            # Sidebar + tabs + content area
│   ├── AdminDashboard.tsx         # Sección A: overview
│   ├── RetrocessionManager.tsx    # Sección B: import/dry-run/write
│   ├── ParserManager.tsx          # Sección C: cola/dry-run/write
│   ├── ReviewQueue.tsx            # Sección D: warnings/pendientes
│   ├── FundAuditor.tsx            # Sección E: búsqueda/inspección
│   ├── OptimizerViewer.tsx        # Sección F: constraints read-only
│   ├── ArtifactViewer.tsx         # Sección G: logs/artifacts
│   └── SettingsPanel.tsx          # Sección H: roles/audit
├── hooks/
│   └── useAdminAuth.ts            # Hook: isAdmin, adminEmail, role
```

### 6.3 Guard Frontend

```typescript
// useAdminAuth.ts
export function useAdminAuth() {
  const user = auth.currentUser;
  const isAdmin = user?.email === 'oantiza@gmail.com';
  return { isAdmin, email: user?.email, user };
}
```

**⚠️ Este guard es UX only.** El backend SIEMPRE re-valida.

---

## 7. Arquitectura Backend

### 7.1 Middleware Admin

```python
# services/auth_middleware.py
ADMIN_ALLOWLIST = ["oantiza@gmail.com"]

def require_admin(request):
    """Valida token + email. Raise HttpsError si no admin."""
    if not request.auth:
        raise HttpsError(UNAUTHENTICATED, "Auth required")
    email = request.auth.token.get("email", "")
    if email not in ADMIN_ALLOWLIST:
        raise HttpsError(PERMISSION_DENIED, f"Forbidden: {email}")
    return email
```

### 7.2 Endpoints Nuevos (propuestos)

| Endpoint | Tipo | Acción | Fase |
|----------|------|--------|------|
| `admin_health` | Callable | Status read-only | 2 |
| `admin_fund_search` | Callable | Buscar fondos | 2 |
| `admin_fund_detail` | Callable | Detalle fondo | 2 |
| `admin_retro_dry_run` | Callable | Dry-run CSV retrocesiones | 4 |
| `admin_retro_write` | Callable | Write gate retrocesiones | 5 |
| `admin_parser_queue` | Callable | Cola parser read-only | 6 |
| `admin_parser_dry_run` | Callable | Dry-run parser | 7 |
| `admin_parser_write` | Callable | Write gate parser | 7 |
| `admin_audit_log` | Callable | Leer audit log | 8 |

### 7.3 Write Gate Protocol

Todo endpoint de escritura DEBE seguir:

```
1. Frontend envía: { manifest_id, isins[], confirmation_phrase }
2. Backend valida:
   a. Token + email admin ✓
   b. manifest_id existe en admin_jobs ✓
   c. manifest.status == "APPROVED" ✓
   d. confirmation_phrase == manifest.expected_phrase ✓
   e. ISINs subset of manifest.approved_isins ✓
3. Backend crea snapshot ANTES del write
4. Backend ejecuta writes atómicos
5. Backend registra audit log
6. Backend verifica post-write
7. Backend retorna resultado + rollback_manifest_id
```

---

## 8. Firestore Collections Propuestas

### Nuevas colecciones admin

```
admin_audit_log/{logId}
  actor_email: string
  timestamp: Timestamp
  action_type: "DRY_RUN" | "WRITE" | "ROLLBACK" | "CONFIG_CHANGE"
  scope: "retrocession" | "parser" | "fund" | "system"
  manifest_id: string?
  isins_affected: string[]
  before_hash: string
  after_hash: string
  rollback_path: string?
  result: "SUCCESS" | "PARTIAL" | "FAILED"

admin_write_manifests/{manifestId}
  created_by: string
  created_at: Timestamp
  type: "retrocession" | "parser" | "manual"
  status: "DRAFT" | "DRY_RUN_COMPLETE" | "APPROVED" | "EXECUTED" | "ROLLED_BACK"
  dry_run_artifact: string
  approved_isins: string[]
  excluded_isins: string[]
  expected_confirmation_phrase: string
  executed_at: Timestamp?
  rollback_manifest_id: string?

admin_snapshots/{snapshotId}
  manifest_id: string
  created_at: Timestamp
  scope: string
  data: map  // snapshot of affected documents
```

### Firestore Rules (propuestas)

```
match /admin_audit_log/{logId} {
  allow read: if isAdmin();
  allow write: if false; // Solo backend escribe
}

match /admin_write_manifests/{manifestId} {
  allow read: if isAdmin();
  allow write: if isAdmin();
}

match /admin_snapshots/{snapshotId} {
  allow read: if isAdmin();
  allow write: if false; // Solo backend escribe
}
```

---

## 9. Roles y Access Model

### 9.1 Roles

| Rol | Dashboard | Dry-run | Review | Write | Rollback | Config |
|-----|-----------|---------|--------|-------|----------|--------|
| **viewer** | ✅ Read | ❌ | ✅ Read | ❌ | ❌ | ❌ |
| **advisor** | ✅ Read | ✅ Execute | ✅ Read/Comment | ❌ | ❌ | ❌ |
| **admin** | ✅ Full | ✅ Execute | ✅ Full | ✅ Con gate | ✅ Con confirm | ❌ |
| **super_admin** | ✅ Full | ✅ Execute | ✅ Full | ✅ Con gate | ✅ Con confirm | ✅ |

### 9.2 Implementación Inicial

- **Fase 1-5:** Solo `oantiza@gmail.com` como admin hardcoded.
- **Fase 9:** Migrar a colección `system_settings/admin_roles` con documento por email.

```json
// system_settings/admin_roles
{
  "oantiza@gmail.com": { "role": "super_admin", "added_at": "2026-05-09" }
}
```

---

## 10. Audit Log Model

Cada acción admin registra:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `actor_email` | string | Email del operador |
| `timestamp` | Timestamp | Momento exacto |
| `action_type` | enum | DRY_RUN, WRITE, ROLLBACK, CONFIG_CHANGE |
| `scope` | enum | retrocession, parser, fund, system |
| `dry_run_artifact` | string? | Path al artifact del dry-run |
| `write_plan` | map? | Plan de escritura aprobado |
| `confirmation_phrase` | string? | Frase de confirmación usada |
| `before_hash` | string | Hash de estado previo |
| `after_hash` | string | Hash de estado posterior |
| `rollback_path` | string? | Referencia al snapshot para rollback |
| `isins_affected` | string[] | ISINs modificados |
| `result` | enum | SUCCESS, PARTIAL, FAILED |

---

## 11. Write Gate Model

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  UPLOAD  │───▶│ DRY-RUN  │───▶│  REVIEW  │───▶│  WRITE   │───▶│  VERIFY  │
│  CSV/PDF │    │ Read-only│    │  Humana  │    │  Gated   │    │  Post-WR │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │               │               │               │
                     ▼               ▼               ▼               ▼
                 artifact        manifest         snapshot       audit_log
                 generado       APPROVED         creado         registrado
```

Reglas:
- **NO auto-write** — siempre requiere confirmación humana explícita.
- **NO write sin dry-run** previo exitoso.
- **NO write sin snapshot** del estado actual.
- **NO write de documentos nuevos** — solo update de existentes.
- **Confirmation phrase** generada por backend, introducida manualmente por admin.

---

## 12. Retrocessions Admin Flow

```
1. Admin sube CSV retrocesiones
2. Frontend valida formato → backend admin_retro_dry_run
3. Backend compara CSV vs funds_v3:
   - Lista cambios con before/after/delta
   - Clasifica: PROCESSABLE, EXCLUDED, LARGE_CHANGE, NOT_FOUND
   - Genera artifact JSON
4. Admin revisa tabla diff en UI
5. Admin selecciona ISINs aprobados, excluye dudosos
6. Admin confirma → backend admin_retro_write:
   - Verifica manifest APPROVED
   - Crea snapshot de documentos afectados
   - Ejecuta updates atómicos
   - Post-write verification
   - Registra audit log
7. UI muestra resultado: PASS/FAIL por ISIN
```

---

## 13. Parser Admin Flow

```
1. Admin sube PDF o indica URL
2. Backend admin_parser_dry_run:
   - Parsea con Gemini (read-only)
   - Clasifica campos: ACCEPT/REVIEW/BLOCKED
   - Genera artifact con campos extraídos
3. Admin revisa preview en UI:
   - Campos marcados por confianza
   - Diff vs estado actual en BD
4. Admin aprueba campos selectivos
5. Backend admin_parser_write:
   - Verifica manifest
   - Snapshot previo
   - Escribe campos aprobados
   - NO sobreescribe retrocesiones manuales
   - Post-write verification
   - Audit log
```

---

## 14. Review Queue Flow

La review queue es un **agregador read-only** que consulta:
- `funds_v3` buscando fondos con warnings.
- `admin_write_manifests` con status DRAFT o DRY_RUN_COMPLETE.
- Warnings conocidos: missing `classification_v2`, missing `portfolio_exposure_v2`, retro delta > 0.5pp, parser REVIEW items.

No ejecuta writes. Solo presenta información para decisión humana.

---

## 15. Rollback/Snapshot Flow

```
1. Antes de cada write, backend serializa documentos afectados
2. Snapshot se almacena en admin_snapshots/{id}
3. Write manifest incluye snapshot_id
4. Si rollback necesario:
   a. Admin solicita rollback con manifest_id
   b. Backend verifica snapshot existe
   c. Backend restaura documentos desde snapshot
   d. Post-rollback verification
   e. Audit log con action_type=ROLLBACK
```

---

## 16. Tests Recomendados

### Frontend Tests

| Test | Descripción |
|------|-------------|
| admin-guard-hidden | Ruta admin oculta para non-admin |
| admin-guard-visible | Ruta admin visible para admin email |
| write-button-disabled | Botones write deshabilitados sin manifest aprobado |
| write-gate-confirmation | Write gate requiere frase de confirmación |
| no-accidental-write | No llamada accidental a endpoint write |

### Backend Tests

| Test | Descripción |
|------|-------------|
| require-admin-unauthenticated | Rechaza requests sin auth |
| require-admin-non-admin | Rechaza email no admin |
| dry-run-read-only | Dry-run no modifica Firestore |
| write-requires-manifest | Write rechaza sin manifest válido |
| write-rejects-create | Write rechaza creación de documentos nuevos |
| audit-log-required | Cada write genera audit log entry |
| snapshot-required | Cada write genera snapshot previo |

### Firestore Rules Tests

| Test | Descripción |
|------|-------------|
| non-admin-no-write-admin-collections | Non-admin no puede escribir colecciones admin |
| viewer-no-write | Viewer no puede escribir |
| admin-read-write-allowed | Admin puede leer/escribir colecciones admin |
| public-denied | Acceso público denegado |

---

## 17. Plan de Implementación por Fases

### Fase 0 — Diseño y Tests Estáticos ← **ACTUAL**
- **Archivos:** `docs/BDB_ADMIN_CONSOLE_DESIGN_0.md`
- **Riesgo:** Ninguno (solo documentación).
- **Deploy:** No.

### Fase 1 — Admin Route Read-Only + Guard Frontend
- **Archivos:** `AdminPage.tsx`, `AdminGuard.tsx`, `AdminLayout.tsx`, `useAdminAuth.ts`, `App.tsx` (añadir ADMIN view).
- **Riesgo:** Bajo. Solo UI nueva, sin backend.
- **Tests:** admin-guard-hidden, admin-guard-visible.
- **Deploy:** Sí (hosting).
- **Rollback:** Revert commit.

### Fase 2 — Backend requireAdmin + Endpoints Read-Only
- **Archivos:** `auth_middleware.py`, `endpoints_admin.py` (admin_health, admin_fund_search).
- **Riesgo:** Bajo. Solo lectura.
- **Tests:** require-admin-unauthenticated, require-admin-non-admin.
- **Deploy:** Sí (functions).
- **Rollback:** Revert deploy.

### Fase 3 — Dashboard Admin + Fund Auditor
- **Archivos:** `AdminDashboard.tsx`, `FundAuditor.tsx`.
- **Riesgo:** Bajo. Solo UI read-only conectada a endpoints lectura.
- **Tests:** Dashboard renders, fund search works.
- **Deploy:** Sí (hosting).

### Fase 4 — Retrocession Dry-Run UI
- **Archivos:** `RetrocessionManager.tsx`, `admin_retro_dry_run` endpoint.
- **Riesgo:** Medio. Endpoint nuevo pero read-only.
- **Tests:** dry-run-read-only, CSV validation.
- **Deploy:** Sí (hosting + functions).

### Fase 5 — Retrocession Write Gate UI
- **Archivos:** `RetrocessionManager.tsx` (write flow), `admin_retro_write` endpoint, Firestore rules update.
- **Riesgo:** Alto. Primer endpoint con writes.
- **Tests:** write-requires-manifest, snapshot-required, audit-log-required.
- **Deploy:** Sí (hosting + functions + rules).
- **Rollback:** Snapshot restore.

### Fase 6 — Parser Review Queue Read-Only
- **Archivos:** `ParserManager.tsx`, `ReviewQueue.tsx`.
- **Riesgo:** Bajo. Solo lectura.
- **Deploy:** Sí (hosting).

### Fase 7 — Parser Write Gate UI
- **Archivos:** `admin_parser_dry_run`, `admin_parser_write` endpoints.
- **Riesgo:** Alto. Gemini API + writes.
- **Tests:** Igual que Fase 5 + parser-specific.
- **Deploy:** Sí (full stack).

### Fase 8 — Audit Logs + Rollback Viewer
- **Archivos:** `ArtifactViewer.tsx`, `admin_audit_log` endpoint.
- **Riesgo:** Bajo. Solo lectura de logs.
- **Deploy:** Sí (hosting + functions).

### Fase 9 — Roles Formalizados + Firestore Rules Hardening
- **Archivos:** `SettingsPanel.tsx`, `system_settings/admin_roles`, Firestore rules update.
- **Riesgo:** Medio. Cambio de modelo de auth.
- **Tests:** Firestore rules tests completos.
- **Deploy:** Sí (full stack).

---

## 18. Qué NO Hacer

| Prohibición | Razón |
|-------------|-------|
| Frontend-only security | Bypassable con DevTools |
| Writes sin backend auth | Cualquier usuario podría escribir |
| Writes sin snapshot | No hay rollback posible |
| Parser/Gemini desde UI sin gate | Costo + riesgo de datos incorrectos |
| Firestore rules deploy sin revisión | Puede abrir acceso público |
| Tocar CORE | Repositorio separado, scope diferente |
| Auto-write tras dry-run | Siempre requiere confirmación humana explícita |
| Crear documentos nuevos desde admin | Solo update de existentes |

---

## 19. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Write accidental desde UI | Baja | Alto | Triple gate: manifest + confirm + backend verify |
| Escalada de privilegios | Baja | Alto | 3 capas de auth (FE+BE+Rules) |
| Snapshot corruption | Muy baja | Alto | Verificación post-snapshot antes de write |
| Parser Gemini costs | Media | Medio | Rate limit + gate manual obligatorio |
| Firestore rules regression | Baja | Alto | Tests de rules antes de deploy |

---

## 20. Próximo Bloque Recomendado

### Opción A (recomendada): `BDB-ADMIN-CONSOLE-FRONTEND-SHELL-0`
- Crear AdminPage + AdminGuard + AdminLayout vacíos.
- Conectar al router existente en App.tsx.
- Guard por email.
- Solo UI shell, sin backend.
- Menor riesgo, valida el flujo de routing.

### Opción B: `BDB-ADMIN-AUTH-GUARD-0`
- Crear `useAdminAuth` hook + tests.
- Sin UI nueva todavía.
- Validar patrón de guard antes de crear componentes.

### Opción C: `BDB-ADMIN-CONSOLE-TESTS-0`
- Escribir tests estáticos antes de implementar.
- TDD approach: tests primero, implementación después.

---

## 21. Decisión Final

### Estado: `BDB_ADMIN_CONSOLE_DESIGN_0_READY` ✅

Documento de diseño completo. Listo para revisión humana antes de proceder a implementación.
