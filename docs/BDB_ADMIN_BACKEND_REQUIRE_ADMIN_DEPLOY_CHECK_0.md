# BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_CHECK_0

## 1. Resumen Ejecutivo

Verificación post-deploy de las 2 Cloud Functions admin read-only desplegadas
a producción. Deploy ejecutado manualmente por el operador. Ambas functions
creadas exitosamente en `europe-west1`.

**Resultado: ✅ DEPLOY VERIFICADO — ambos endpoints operativos en producción.**

## 2. Deploy Ejecutado

| Campo | Valor |
|---|---|
| Comando | `firebase deploy --only functions:admin_health,functions:admin_fund_search` |
| Resultado | `admin_health(europe-west1)` created successfully |
| Resultado | `admin_fund_search(europe-west1)` created successfully |
| Proyecto Firebase | bdb-fondos |
| Región | europe-west1 |
| Operador | manual |

## 3. Estado Git

| Campo | Valor |
|---|---|
| HEAD | `39f43cb` |
| origin/master | `39f43cb` |
| Sincronización | ✅ HEAD = origin/master |
| Working tree | Limpio (solo untracked locales conocidos) |

## 4. Firebase Functions List

Confirmado via `firebase functions:list`:

| Function | Version | Trigger | Location | Memory | Runtime |
|---|---|---|---|---|---|
| **admin_health** | v2 | callable | europe-west1 | 256 | python312 |
| **admin_fund_search** | v2 | callable | europe-west1 | 512 | python312 |

Total functions desplegadas: 20 (18 existentes + 2 nuevas).
Schedulers intactos. No se desplegaron functions inesperadas.

## 5. Runtime Checks — Callable Production

### admin_health ✅ PASS

Llamado desde browser con auth admin (`oantiza@gmail.com`).

Respuesta confirmada:
- `status`: `ok`
- `mode`: `read_only`
- `admin_email`: `oantiza@gmail.com`
- `phase`: `backend_require_admin_0`
- `version`: `0.1.0`
- `capabilities`:
  - `admin_health`: true
  - `admin_fund_search_read_only`: true
- Invariants:
  - `no_writes`: true
  - `no_parser`: true
  - `no_gemini`: true

**No secretos expuestos. No datos sensibles.**

### admin_fund_search ✅ PASS

Llamado desde browser con auth admin, ISIN `BE0946564383`.

Respuesta confirmada:
- Fund encontrado: `DPAM B - Equities NewGems Sustainable B Cap`
- Classification: `THEMATIC_EQUITY` (confidence 0.99)
- Datos sanitizados: solo campos de la allowlist
  - `classification_v2` ✅
  - `portfolio_exposure_v2` ✅
  - Sector distribution ✅
  - Regional exposure ✅
- No `eod_ticker` en respuesta ✅
- No `std_extra` en respuesta ✅
- No documento Firestore completo ✅

### Non-admin rejection

Ambos endpoints requieren auth admin via `extract_and_verify_admin_callable`.
Cualquier usuario no-admin recibe `HttpsError(PERMISSION_DENIED)`.
Verificado en tests unitarios (43/43 PASS).

## 6. Tests Locales Post-deploy

```
tests/test_admin_auth.py .............. 29 PASSED
tests/test_admin_endpoints_readonly.py . 14 PASSED
Total: 43/43 PASS ✅
```

## 7. Seguridad Post-deploy

| Invariante | Estado |
|---|---|
| No hosting deploy | ✅ No se tocó hosting |
| No firestore.rules deploy | ✅ No se tocaron rules |
| No storage deploy | ✅ No se tocó storage |
| No Firestore writes | ✅ Endpoints son read-only |
| No parser | ✅ No imports de cargador_lotes |
| No Gemini | ✅ No imports de GenerativeModel |
| No CORE | ✅ No cambios en BDB-FONDOS-CORE |
| No secrets expuestos | ✅ Respuestas no contienen api_key/credentials |
| Schedulers intactos | ✅ Deploy específico no tocó schedulers |
| Functions existentes intactas | ✅ 18 functions previas no redespliegadas |

## 8. Riesgos Pendientes

| Riesgo | Mitigación |
|---|---|
| Integración frontend pendiente | AdminDashboard no llama a admin_health aún — es placeholder |
| Audit logs de acceso admin | No implementados (requieren write) — diferido |
| Rate limiting admin endpoints | No implementado — Firebase default throttling |
| Reciclaje de instancias Cloud Functions | Riesgo negligible — imports adicionales son independientes |

## 9. Próximo Bloque Recomendado

**Opción A:** `BDB-ADMIN-BACKEND-REQUIRE-ADMIN-DEPLOY-CHECK-COMMIT-0`
Commit documental de este informe de verificación.

**Opción B:** `BDB-ADMIN-READONLY-FUND-SEARCH-UI-0`
Conectar el frontend AdminDashboard al endpoint `admin_health` para mostrar
estado real del backend en la consola admin.

**Opción C:** `BDB-ADMIN-CONSOLE-LIVE-DASHBOARD-0`
Módulo de búsqueda de fondos read-only en la consola admin conectado a
`admin_fund_search`.

## 10. Decisión

**ESTADO: `BDB_ADMIN_BACKEND_REQUIRE_ADMIN_DEPLOY_CHECK_0_READY`**

Deploy verificado completo. Ambos endpoints operativos en producción.

Fecha: 2026-05-09T07:27:00+02:00
