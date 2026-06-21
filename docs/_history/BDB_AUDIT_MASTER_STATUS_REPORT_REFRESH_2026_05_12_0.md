# BDB-FONDOS — Informe Maestro de Estado
## Refresh 2026-05-12

---

## 1. Resumen Ejecutivo

Desde la última revisión de estado (`6b37c88` — 2026-05-11), se han completado **10 bloques** cubriendo tres ejes de trabajo:

1. **Seguridad (CORS)**: Hardening completo de los 4 módulos API. Zero wildcard CORS en producción. 14 functions desplegadas con allowlist explícita.
2. **Deuda técnica (Dead Code)**: Auditoría y eliminación de `syncBusinessRulesFromBackend()` del frontend.
3. **Higiene de código (Mojibake)**: Corrección de 60 artefactos de encoding en `optimizer_core.py`.

**Estado global**: Working tree limpio. Commits pendientes: 0. CORE intacto. Firestore writes: 0.

---

## 2. Timeline de Commits

| # | Hash | Fecha (CEST) | Tipo | Mensaje |
|---|---|---|---|---|
| 1 | `56d816a` | 2026-05-11 23:20 | AUDIT | delta verification of 2026-05-11 technical audit findings |
| 2 | `11656a8` | 2026-05-12 06:06 | SECURITY | harden admin endpoint CORS |
| 3 | `3851c8c` | 2026-05-12 06:29 | DOCS | record CORS hardening deploy |
| 4 | `1f44cf6` | 2026-05-12 06:36 | AUDIT | document dead business rules endpoint |
| 5 | `180915a` | 2026-05-12 06:39 | CLEANUP | remove unused business rules sync |
| 6 | `2845e0f` | 2026-05-12 06:45 | SECURITY | harden portfolio endpoint CORS |
| 7 | `1dbad5f` | 2026-05-12 06:59 | DOCS | record portfolio CORS hardening |
| 8 | `437b818` | 2026-05-12 07:04 | SECURITY | harden admin console endpoint CORS |
| 9 | `aca678c` | 2026-05-12 07:16 | DOCS | record portfolio and admin console CORS deploy |
| 10 | `bc8c1de` | 2026-05-12 07:34 | HYGIENE | fix UTF-8 mojibake in optimizer_core.py comments/logs |

**HEAD actual**: `bc8c1de` — sincronizado con `origin/master`.

---

## 3. Estado CORS Global — 100% COMPLETO EN PRODUCCIÓN

### Módulos API

| Módulo | Estado | Bloque | Desplegado |
|---|---|---|---|
| `endpoints_admin.py` | ✅ Hardened | `BDB-CORS-HARDENING-0` | ✅ Deploy 0 |
| `endpoints_xray_comparador.py` | ✅ Hardened | Original (histórico) | ✅ Histórico |
| `endpoints_portfolio.py` | ✅ Hardened | `BDB-CORS-HARDENING-1` | ✅ Deploy 1-2 |
| `endpoints_admin_console.py` | ✅ Hardened | `BDB-CORS-HARDENING-2` | ✅ Deploy 1-2 |
| `endpoints_macro.py` | ⚪ N/A | No usa `cors_config` propio | N/A |

**Resultado: zero wildcard CORS endpoints en producción.**

### Allowlist aplicada (idéntica en todos los módulos)

```python
# CorsOptions
cors_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    r"https://.*\.web\.app",
    r"https://.*\.firebaseapp\.com"
]

# Headers manuales (endpoints_admin.py)
ALLOWED_ORIGINS = [
    "https://bdb-fondos.web.app",
    "https://bdb-fondos.firebaseapp.com",
    "http://localhost:5173",
    "http://localhost:3000",
]
```

### Invariantes de seguridad CORS

1. Ningún endpoint acepta `Access-Control-Allow-Origin: *` en producción.
2. Solo se aceptan orígenes Firebase Hosting (`*.web.app`, `*.firebaseapp.com`) y desarrollo local.
3. Requests desde dominios no autorizados no reciben header `Access-Control-Allow-Origin`.

---

## 4. Estado Business Rules / Dead Code

| Hallazgo | Estado |
|---|---|
| `get_business_rules` endpoint inexistente en backend | ✅ Documentado (H-06) |
| `syncBusinessRulesFromBackend()` en frontend | ✅ **Eliminado** (`180915a`) |
| Flujo real de risk profiles | ✅ Vía Firestore directo (`system_settings/risk_profiles`) |
| Riesgo funcional | **Nulo** — función nunca se invocaba |

**Documentación**: `BDB_BUSINESS_RULES_ENDPOINT_AUDIT_0.md` + `BDB_FRONTEND_DEAD_CODE_CLEANUP_0.md`

---

## 5. Estado Mojibake / Code Hygiene

| Archivo | Estado | Ocurrencias |
|---|---|---|
| `optimizer_core.py` | ✅ **Corregido** | 60 patrones en 44 líneas |
| `scripts/reports/insert_report_function.py` | ⚪ Pendiente (histórico) | — |
| `scripts/reports/insert_user_report.py` | ⚪ Pendiente (histórico) | — |
| `scripts/tests/test_research.py` | ⚪ Pendiente (histórico) | — |
| `scripts/migration/check_and_import_retrocesion.py` | ⚪ Pendiente (histórico) | — |
| `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js` | ⚪ Pendiente (parser) | — |
| `MORNINGSTAR_PDF_PARSER/src/classify/asset_type_classifier.js` | ⚪ Pendiente (parser) | — |

### Patrones corregidos en `optimizer_core.py`

| Categoría | Ejemplos | Ocurrencias |
|---|---|---|
| Acentos españoles (`ó`, `í`, `á`, `ú`, `Ó`) | exposición, políticas, matemáticamente, común, CANÓNICA | 44 |
| Emojis (`⚠️`, `⚡`, `🚫`, `📥`) | logger.info/warning messages | 16 |
| **Total** | | **60** |

**Impacto funcional: CERO** — solo docstrings, comentarios, logs y strings de excepción.

**Documentación**: `BDB_CODE_HYGIENE_MOJIBAKE_0.md`

---

## 6. Tests Ejecutados por Bloque

| Bloque | Suite(s) | Tests | Resultado |
|---|---|---|---|
| CORS-HARDENING-0 (admin) | `test_admin_cors_hardening.py` + `test_admin_auth.py` | 53 | ✅ 53/53 |
| CORS-HARDENING-1 (portfolio) | `test_portfolio_cors_hardening.py` + CORS + auth | 65 | ✅ 65/65 |
| CORS-HARDENING-2 (admin console) | `test_admin_console_cors_hardening.py` + CORS + auth | 65 | ✅ 65/65 |
| CODE-HYGIENE-MOJIBAKE-0 | `test_optimizer_fallback_status_contract.py` + `test_optimizer_payload_contract_static.py` + `test_optimizer_p0_contracts.py` | 49 | ✅ 49/49 |

**Total acumulado de ejecuciones de test en esta sesión: 232 tests, 232 passed, 0 failed.**

---

## 7. Deploys Realizados

### Deploy 0 — CORS Admin (`BDB-CORS-HARDENING-DEPLOY-0`)

| Campo | Valor |
|---|---|
| **Fecha** | 2026-05-12 06:24 CEST |
| **HEAD** | `11656a8` |
| **Functions** | 7: `force_weekly_research`, `generate_analysis_report`, `restore_historico`, `insertMonthlyReport`, `getRiskRate`, `updateFundHistory`, `refresh_daily_metrics` |
| **Resultado** | ✅ 7/7 successful |

### Deploy 1-2 — CORS Portfolio + Admin Console (`BDB-CORS-HARDENING-1-2-DEPLOY-0`)

| Campo | Valor |
|---|---|
| **Fecha** | 2026-05-12 ~07:10 CEST |
| **HEAD** | `437b818` |
| **Functions** | 7: `optimize_portfolio_quant`, `backtest_portfolio`, `backtest_portfolio_multi`, `getEfficientFrontier`, `analyze_portfolio_endpoint`, `admin_health`, `admin_fund_search` |
| **Resultado** | ✅ 7/7 successful |

### Resumen de deploys

| Aspecto | Valor |
|---|---|
| Total functions desplegadas | **14** |
| Hosting deploy | **NO** |
| Firestore rules deploy | **NO** |
| Storage rules deploy | **NO** |
| Región | `europe-west1` |

---

## 8. Confirmaciones de Seguridad

| Verificación | Estado |
|---|---|
| Firestore writes (todos los bloques) | **0** |
| BDB-FONDOS-CORE | **NO tocado** |
| `optimizer_core.py` (lógica financiera) | **NO tocada** (solo text encoding) |
| `suitability_engine.py` | **NO tocado** |
| `constraints_builder_v1.py` | **NO tocado** |
| Hosting deploy | **NO** (no en estos bloques) |
| `firestore.rules` | **NO tocado** |
| `storage.rules` | **NO tocado** |
| Auth admin | **NO modificado** |
| Payloads / contratos de optimización | **NO modificados** |
| Parser Morningstar | **NO tocado** |
| Scripts históricos | **NO tocados** |

---

## 9. Pendientes Actuales Priorizados

### Prioridad ALTA

| # | Pendiente | Riesgo | Bloque sugerido |
|---|---|---|---|
| 1 | **CORS regex amplio**: `https://.*\.web\.app` permite cualquier subdominio de `web.app`, no solo `bdb-fondos` | Bajo (solo Firebase Hosting) | `BDB-CORS-REGEX-TIGHTENING-0` |
| 2 | **Build frontend roto**: Falta asset `fondo_v1.png` en `RetirementCalculatorPage.tsx` → `npm run build` falla | Bloquea hosting deploy | `BDB-FRONTEND-BUILD-FIX-0` |

### Prioridad MEDIA

| # | Pendiente | Riesgo | Bloque sugerido |
|---|---|---|---|
| 3 | **TypeScript errors**: ~13 errores en analytics y report generator components | Deuda técnica | `BDB-FRONTEND-TS-CLEANUP-0` |
| 4 | **Mojibake residual**: Scripts históricos y parser aún con encoding corrupto | Bajo (no producción) | `BDB-CODE-HYGIENE-MOJIBAKE-1` |
| 5 | **Scripts históricos**: `scripts/` tiene código legacy sin archivar | Bajo | `BDB-SCRIPTS-ARCHIVE-0` |

### Prioridad BAJA

| # | Pendiente | Riesgo | Bloque sugerido |
|---|---|---|---|
| 6 | **API key restrictions**: Aplicar least-privilege a API keys GCP | Recomendación de seguridad | `BDB-API-KEY-HARDENING-0` |
| 7 | **Hosting deploy**: Desplegar limpieza frontend (`syncBusinessRulesFromBackend` eliminado) | Requiere build fix primero (#2) | `BDB-FRONTEND-DEPLOY-0` |

---

## 10. Recomendación del Siguiente Bloque

### Opción A (Recomendada): `BDB-FRONTEND-BUILD-FIX-0`

**Justificación**: El build roto del frontend bloquea cualquier deploy de hosting futuro. Resolver el asset `fondo_v1.png` faltante desbloquea:
- Deploy de la limpieza `syncBusinessRulesFromBackend`.
- Futuras mejoras de UI.
- TypeScript cleanup.

**Alcance estimado**: Localizar/generar el asset faltante o eliminar la referencia. Verificar `npm run build` exitoso.

### Opción B (Alternativa): `BDB-CORS-REGEX-TIGHTENING-0`

**Justificación**: Restringir `https://.*\.web\.app` a `https://bdb-fondos\.web\.app` para máxima precisión. Cambio mínimo, bajo riesgo, alto valor de seguridad.

**Alcance estimado**: 4 archivos (los 4 módulos API), re-ejecutar test suites CORS (65+), deploy selectivo.

---

## Documentos de Referencia

| Documento | Bloque |
|---|---|
| `BDB_AUDIT_2026_05_11_DELTA_VERIFICATION_0.md` | Auditoría delta |
| `BDB_CORS_HARDENING_0.md` | CORS admin |
| `BDB_CORS_HARDENING_DEPLOY_0.md` | Deploy CORS admin |
| `BDB_BUSINESS_RULES_ENDPOINT_AUDIT_0.md` | Business rules audit |
| `BDB_FRONTEND_DEAD_CODE_CLEANUP_0.md` | Frontend cleanup |
| `BDB_CORS_HARDENING_1_PORTFOLIO_0.md` | CORS portfolio |
| `BDB_CORS_HARDENING_2_ADMIN_CONSOLE_0.md` | CORS admin console |
| `BDB_CORS_HARDENING_1_2_DEPLOY_0.md` | Deploy CORS portfolio + admin console |
| `BDB_CODE_HYGIENE_MOJIBAKE_0.md` | Mojibake cleanup |

---

**Fecha**: 2026-05-12  
**HEAD**: `bc8c1de`  
**Working tree**: limpio  
**Commits pendientes**: 0  
**Autor**: Agente automático
