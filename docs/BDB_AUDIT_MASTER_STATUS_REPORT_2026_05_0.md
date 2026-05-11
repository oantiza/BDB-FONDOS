# BDB_AUDIT_MASTER_STATUS_REPORT_2026_05_0

**Fecha de cierre:** 2026-05-11  
**HEAD:** `b67cfba`  
**Rama:** `master`  
**Tipo:** Informe maestro de auditoría y estado del programa — sin deploy, sin escritura Firestore, sin código modificado

---

## A. Resumen Ejecutivo

### Estado global del programa

El programa BDB-FONDOS se encuentra en **estado estable y operativo** tras cerrar 7 bloques de remediación, seguridad y calidad técnica entre el 10 y el 11 de mayo de 2026. La suite de tests local está completamente verde (99/99). La producción no ha requerido deploy en estos bloques (los datos MIXED se corrigen directamente en Firestore; el código corregido en X-Ray y Firestore rules ya estaba en producción desde commits previos).

### Bloques cerrados

| # | Bloque | Estado |
|---|--------|--------|
| 1 | Firestore security hotfix | ✅ CERRADO |
| 2 | X-Ray globalAllocation alternatives | ✅ CERRADO |
| 3 | MIXED exposure remediation (59/60) | ✅ CERRADO (98.3%) |
| 4 | Credentials cleanup | ✅ CERRADO |
| 5 | Post-MIXED smoke test | ✅ CERRADO |
| 6 | X-Ray test dependency / harness | ✅ CERRADO |
| 7 | Short-history regression contract | ✅ CERRADO |

### Pendiente activo

| Pendiente | Prioridad | Bloque sugerido |
|-----------|-----------|-----------------|
| Hamco Global Value R (LU3038481936) — 1/60 MIXED sin datos | BAJA | `BDB-MIXED-PENDING-ISIN-REVIEW-LU3038481936` (cuando haya datos) |
| Auditoría impacto suitability/solver post-MIXED | MEDIA | `BDB-POST-MIXED-SUITABILITY-IMPACT-AUDIT-0` |
| Smoke visual/manual X-Ray UI+PDF | BAJA-OPCIONAL | Manual |
| Deuda técnica scripts remediation | BAJA | `BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0` |
| Hallazgos técnicos de auditoría original (5 items) | MEDIA | Ver sección H |

### Nivel de riesgo actual

| Área | Riesgo | Comentario |
|------|--------|------------|
| Seguridad Firestore | 🟢 BAJO | Reglas endurecidas, sin public reads |
| Datos MIXED | 🟢 BAJO | 59/60 con datos reales; Hamco con fallback razonable |
| Credentials | 🟢 BAJO | Secrets fuera del workspace |
| Tests | 🟢 BAJO | 99/99 PASS |
| Deuda técnica | 🟡 MEDIO | 5 hallazgos técnicos pendientes de auditoría |

---

## B. Timeline de Commits Principales

| Commit | Fecha | Bloque | Objetivo | Estado |
|--------|-------|--------|----------|--------|
| `eb7ff66` | 2026-05-10 | Firestore security | Cierre de public reads residuales en producción | ✅ MERGED |
| `7529a23` | 2026-05-10 | X-Ray alternatives | Include `alternative` + `real_asset` en globalAllocation | ✅ MERGED |
| `1ed2447` | 2026-05-10 | MIXED pipeline fix | `buildPortfolioExposureV2`: metrics→ms.portfolio→fallback | ✅ MERGED |
| `d9ca28f` | 2026-05-10 | MIXED lote 1 | Write controlado 10 fondos low-risk (MS portfolio) | ✅ MERGED |
| `fd383c2` | 2026-05-10 | MIXED lote 2 | Write controlado 5 fondos low-risk | ✅ MERGED |
| `fd503e8` | 2026-05-10 | MIXED lote 3 | Write controlado 15 fondos low-risk | ✅ MERGED |
| `a17ff30` | 2026-05-10 | MIXED lote 4 | Write controlado 5 fondos review-required | ✅ MERGED |
| `b044d20` | 2026-05-10 | MIXED lote 5 | Write controlado 5 fondos review-required | ✅ MERGED |
| `17e23fa` | 2026-05-10 | MIXED lote 6 | Write controlado 5 fondos review-required (high-delta) | ✅ MERGED |
| `84c9ec4` | 2026-05-10 | MIXED lote 7 | Write controlado 9 fondos (ALL APPROVE, 54/60 total) | ✅ MERGED |
| `24bbcfb` | 2026-05-10 | MIXED Gate 8 audit | Auditoría con fichas oficiales — 5 fondos complejos | ✅ MERGED |
| `fb14f38` | 2026-05-11 | MIXED lote 8 | Write controlado 5 fondos — fichas oficiales gestora | ✅ MERGED |
| `2db5a24` | 2026-05-11 | MIXED closeout | Documento de cierre 59/60 | ✅ MERGED |
| `a32bc2a` | 2026-05-11 | Credentials | Service account movida fuera del workspace | ✅ MERGED |
| `e8ee803` | 2026-05-11 | Smoke test | Informe post-MIXED smoke test (optimizer, suitability, X-Ray) | ✅ MERGED |
| `6bcb4f9` | 2026-05-11 | X-Ray harness | openpyxl instalado; auth mock + xirr_warnings en test contract | ✅ MERGED |
| `b67cfba` | 2026-05-11 | Short-history contract | Test alineados con contrato success+warning (hardening 9198e63) | ✅ MERGED |

> **Nota sobre `71399a0` y `f7bae55`**: commits intermedios del proceso Gate 8 (preparación y cierre previo). No listados por el usuario pero forman parte de la cadena completa de la remediación.

---

## C. Firestore Security Status

### Situación actual

- ✅ Producción **endurecida**: ninguna regla `allow read: if true` activa.
- ✅ `system_settings`: protegido — solo lectura autenticada.
- ✅ `catch-all` cerrado: requests no contempladas son denegadas por defecto.
- ✅ No hay deploy pendiente relacionado con las reglas.

### Referencia

- Commit: `eb7ff66` — `SECURITY_RULES_HOTFIX: close production public read residuals`
- Documento: `docs/BDB_FIRESTORE_RULES_SECURITY_HOTFIX_0.md`

### Recomendación operativa

No se requiere ninguna acción adicional. Monitorizar si en futuros deploys se añade involuntariamente una regla permisiva (revisar siempre `firestore.rules` antes de cualquier `firebase deploy --only firestore:rules`).

---

## D. X-Ray Status

### globalAllocation alternatives

- ✅ `usePortfolioStats.ts`: acumula `alternative` + `real_asset` en bucket propio.
- ✅ `AssetAllocationSection.tsx`: grid 4 columnas si Alternativos > 0.1%.
- ✅ `XRayPdfSections.tsx`: PDF alineado con interfaz interactiva.
- Commit: `7529a23` — `BDB_XRAY: include alternatives in global allocation`
- Documento: `docs/BDB_XRAY_GLOBAL_ALLOCATION_ALTERNATIVES_FIX_0.md`

### Test harness X-Ray

- ✅ `openpyxl 3.1.5` instalado en `functions_python/venv` (ya estaba en `requirements.txt:30`).
- ✅ `_Request` mock: añadido `headers = {"Authorization": "Bearer test-token-bypass"}`.
- ✅ `_bypass_auth` fixture (autouse): parchea `firebase_admin.auth.verify_id_token`.
- ✅ `EXPECTED_RESPONSE_KEYS`: añadido `xirr_warnings`.
- ✅ **30/30 tests X-Ray PASS** (0 fallos).
- Commit: `6bcb4f9`
- Documento: `docs/BDB_XRAY_TEST_DEPS_OPENPYXL_0.md`

### Incidencias abiertas en X-Ray

- **Ninguna bloqueante.** Smoke visual/manual del UI X-Ray y PDF es opcional y se puede hacer en cualquier momento.

---

## E. MIXED Exposure Status

### Causa raíz

`buildPortfolioExposureV2()` en `functions_python/scripts/migration/populate_taxonomy_v2.py` leía `metrics` raíz del documento Firestore para obtener la exposición económica. Los fondos MIXED no tienen `metrics` raíz (solo tienen `ms.portfolio.asset_allocation`), por lo que el pipeline caía directamente al fallback genérico (50/50, 80/20, 20/80) ignorando los datos Morningstar reales.

### Cambio de pipeline (commit `1ed2447`)

```
ANTES:  metrics_root → fallback
AHORA:  metrics_root → ms.portfolio.asset_allocation → fallback
```

### Estado de remediación

| Métrica | Valor |
|---------|-------|
| Total fondos MIXED | 60 |
| **Corregidos** | **59 / 60 (98.3%)** |
| Lotes ejecutados | 8 |
| Fuentes | MS portfolio (lotes 1-7) + fichas oficiales gestora (lote 8) |
| Confidence escribed | 0.85 (MS) / 0.90 (fichas oficiales) |
| Tests por lote | 62/62 PASS (todos los lotes) |
| Writes automáticos pendientes | 0 |
| Rollbacks disponibles | ✅ Todos los lotes (gate directories) |

### Detalle lotes

| Lote | Fondos | Fuente | Commit | Confidence |
|------|--------|--------|--------|------------|
| 1 | 10 | MS portfolio | `d9ca28f` | 0.85 |
| 2 | 5 | MS portfolio | `fd383c2` | 0.85 |
| 3 | 15 | MS portfolio | `fd503e8` | 0.85 |
| 4 | 5 | MS portfolio | `a17ff30` | 0.85 |
| 5 | 5 | MS portfolio | `b044d20` | 0.85 |
| 6 | 5 | MS portfolio (high-delta) | `17e23fa` | 0.85 |
| 7 | 9 | MS portfolio (ALL APPROVE) | `84c9ec4` | 0.85 |
| 8 | 5 | Fichas oficiales gestora | `fb14f38` | **0.90** |

**Gate 8 — fondos con fichas oficiales (fuente primaria):**

| ISIN | Nombre | eq% final | Problema MS original |
|------|--------|-----------|----------------------|
| FR0010306142 | Carmignac Patrimoine E | 35.4 | bond=0, cash=100 |
| LU0121216526 | GS Patrimonial Aggressive X | 75.2 | eq infraestimado |
| LU0352312853 | Allianz Strategy 75 CT | 86.0 | sum=170.81 (apalancamiento) |
| LU1594335520 | Allianz Dynamic MA SRI 75 AT | 79.1 | eq=0, bond=100 (invertido) |
| LU1548496022 | Allianz Dynamic MA SRI 15 AT | 24.6 | eq sobreestimado |

### Fondo pendiente

| Campo | Valor |
|-------|-------|
| ISIN | `LU3038481936` |
| Nombre | Hamco Global Value R EUR Acc |
| Estado | FONDO NUEVO — sin datos suficientes |
| Exposición actual | eq=80, bd=20 (fallback AGGRESSIVE_ALLOCATION) |
| Confidence | 0.45 |
| `ms.portfolio.asset_allocation` | `null` |
| Decisión | **NO TOCAR** hasta que haya datos |
| Tarea futura | `BDB-MIXED-PENDING-ISIN-REVIEW-LU3038481936` |

### Campos intactos (invariante de remediación)

En los 59 fondos corregidos, **ningún campo de los siguientes fue modificado**:

- `manual` / `manual.costs` / `manual.costs.retrocession`
- `classification_v2`
- `ms` (datos Morningstar originales)
- `derived`
- `std_perf`
- Solo se escribió: `portfolio_exposure_v2` via `update()` (nunca `set()`)

### Impacto logrado

| Área | Antes | Después |
|------|-------|---------|
| Exposición MIXED | 60 fondos con fallback genérico | 59 con datos reales |
| Confidence | 0.45 | 0.85–0.90 |
| Solver | Asignaciones basadas en fallback | Look-through real |
| Suitability | Evaluación distorsionada | Alineada con exposición real |
| Reporting | Asset allocation inexacto | Basado en datos de portfolio |

---

## F. Credentials Status

### Situación actual

- ✅ Ninguna service account dentro del workspace del repositorio.
- ✅ Ruta externa confirmada: `C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json`
- ✅ `.gitignore` cubre las rutas anteriores (`scripts/serviceAccountKey.json`, `ServiceAccountkey.json`).
- ✅ `git check-ignore` y escaneo del workspace: sin secretos expuestos.
- Commit: `a32bc2a`
- Documento: `docs/BDB_CREDENTIALS_WORKSPACE_CLEANUP_0.md`

### Instrucción para próximas sesiones

```powershell
# Requerido antes de ejecutar tests o scripts con acceso Firestore:
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json"
```

### Recomendación

**Nunca volver a copiar la service account dentro del workspace del repositorio.** Si se necesita para scripts ad-hoc, usar siempre la variable de entorno apuntando a la ruta externa.

---

## G. Test Status

### Resumen actual (HEAD `b67cfba`)

| Suite | Resultado | Nota |
|-------|-----------|------|
| `tests/xray/` | 🟢 **30/30 PASS** | Tras fix harness + openpyxl |
| `tests/test_mixed_exposure_ms_portfolio.py` | 🟢 **11/11 PASS** | |
| `tests/test_mixed_funds_lookthrough_contract.py` | 🟢 **4/4 PASS** | |
| `tests/test_suitability_v2.py` | 🟢 **47/47 PASS** | |
| `tests/test_regression_coverage.py` | 🟢 **7/7 PASS** | Tras short-history contract |
| **Suite relevante total** | 🟢 **99/99 PASS** | |

### Smoke tests ejecutados (bloque `e8ee803`)

| Componente | Resultado |
|------------|-----------|
| Firestore reads (sample fondos) | ✅ OK |
| Optimizer smoke | ✅ OK |
| MIXED lookthrough | ✅ OK |
| Suitability evaluation | ✅ OK |
| X-Ray (tras harness fix) | ✅ 30/30 PASS |
| **Writes Firestore** | ✅ 0 |
| **Deploy** | ✅ NO |

### Preexistentes NO resueltos (fuera de scope de estos bloques)

| Test | Estado | Nota |
|------|--------|------|
| `adminFundSearch` (frontend Vitest) | ⚠️ PREEXISTENTE | `auth/invalid-api-key` — no relacionado con bloques cerrados |
| `npm run build` | ⚠️ PREEXISTENTE | `fondo_v1.png` missing en `RetirementCalculatorPage.tsx` |
| `npx tsc --noEmit` 16 errores | ⚠️ PREEXISTENTE | En archivos no tocados |
| `test_regression_coverage.py` 2 fallos | ✅ RESUELTO | Cerrado en bloque 7 (`b67cfba`) |

---

## H. Pendientes Actuales Priorizados

### H.1 — Hamco Global Value R (LU3038481936)
**Prioridad:** BAJA  
**Estado:** NO TOCAR  
**Condición de desbloqueo:** MS publique datos de portfolio O gestora Hamco publique ficha con desglose de cartera.  
**Riesgo de inacción:** Mínimo. El fallback AGGRESSIVE (80/20) es razonable para un fondo "Global Value".

---

### H.2 — Smoke visual/manual X-Ray UI + PDF
**Prioridad:** BAJA — OPCIONAL  
**Acción:** Abrir la aplicación, subir un Excel de ejemplo, verificar que:
- El bucket "Alternativos" aparece si el fondo tiene `alternative`/`real_asset`.
- El PDF X-Ray refleja el mismo breakdown.
- Los valores de letras y depósitos son coherentes.

No requiere bloque formal. Se puede hacer como validación puntual.

---

### H.3 — Auditoría impacto solver/suitability post-MIXED
**Prioridad:** MEDIA  
**Bloque:** `BDB-POST-MIXED-SUITABILITY-IMPACT-AUDIT-0`  
**Objetivo:**
- Revisar si los nuevos look-through (59 fondos con exposición real) cambian perfiles de suitability compatibles.
- Comparar carteras reales antes/después si hay fixtures o historial.
- Verificar que el solver no produce asignaciones inesperadas con la nueva exposición.
- **Read-only.** No tocar código.

---

### H.4 — Deuda técnica: scripts de remediación
**Prioridad:** BAJA  
**Bloque:** `BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0`  
**Objetivo:** Los scripts de gate (1-8) y sus artefactos JSON no deben reejecutarse. Crear plan de archivo o documentar como "historical only". Evitar confusión futura.  
**Regla:** No reejecutar scripts de write históricos bajo ninguna circunstancia.

---

### H.5 — Hallazgos técnicos de auditoría original (5 items)
Identificados en `BDB_AUDIT_2026_05_10_VERIFICATION_0.md`:

| ID | Hallazgo | Prioridad | Bloque sugerido |
|----|----------|-----------|-----------------|
| T-01 | `EQUITY_FLOOR` posible código muerto en `optimizer_core.py` | MEDIA | `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0` |
| T-02 | Suitability con valores hardcoded (perfiles, thresholds) | MEDIA | `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0` |
| T-03 | Spike/outlier >40% puede abortar endpoints | MEDIA | `BDB-OUTLIER-SPIKE-GUARD-AUDIT-0` |
| T-04 | Tupla de 13 valores en optimizer (fragilidad) | BAJA | Incluir en bloque optimizer futuro |
| T-05 | `EconomicExposureV2` sin campo `alternative` formal si aplica | BAJA | Incluir en bloque suitability |

> **Regla para todos:** Auditar primero en read-only. No modificar código sin gate explícito.

---

## I. Recomendación de Siguiente Bloque

### Orden recomendado

| Orden | Bloque | Justificación |
|-------|--------|---------------|
| 1 | `BDB-POST-MIXED-SUITABILITY-IMPACT-AUDIT-0` | Cierra la pregunta de impacto real del MIXED fix en producción |
| 2 | `BDB-REMEDIATION-SCRIPTS-ARCHIVE-PLAN-0` | Limpieza de deuda técnica antes de tocar más código |
| 3 | `BDB-EQUITY-FLOOR-DEAD-CODE-AUDIT-0` | Seguridad del optimizer — ningún riesgo en auditar |
| 4 | `BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0` | Revisa si los perfiles hardcoded son correctos o hay drift |

### Por qué en este orden

1. **Post-MIXED suitability** es la pregunta directamente derivada de la remediación cerrada: "¿cambiaron los perfiles?" Se debe responder mientras el contexto está fresco.
2. **Scripts archive** evita accidentes de reejección. Es rápido y de bajo riesgo.
3. **Equity floor** es un hallazgo técnico del optimizer que puede ser código muerto o una funcionalidad sin tests. Requiere solo lectura.
4. **Suitability hardcoded** es el hallazgo más complejo: necesita auditar thresholds y perfiles contra la normativa vigente.

---

## J. Instrucciones para Próximo Chat

### Variables de entorno requeridas

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json"
```

### Reglas absolutas (no negociables)

1. **NO tocar BDB-FONDOS-CORE** bajo ninguna circunstancia.
2. **NO escribir Firestore** salvo gate explícito con:
   - dry-run previo
   - diff manifest aprobado
   - backup/rollback disponible
3. **NO reejecutar scripts de write históricos** (gates 1-8, retrocession, parser writes).
4. **NO deploy** salvo que el bloque lo requiera explícitamente y se hayan pasado todos los tests.
5. **NO modificar `optimizer_core.py` ni `suitability_engine.py`** sin auditoría y gate.
6. **NO modificar `firestore.rules`** sin revisión previa.
7. **Empezar siempre por auditoría read-only.** Si el bloque requiere escritura, el primer paso es siempre dry-run.

### Estado del entorno

```
HEAD:    b67cfba
Branch:  master
Tests:   99/99 PASS
Secrets: C:\Users\oanti\Documents\_SECRETS\bdb-fondos-service-account.json
venv:    functions_python/venv (openpyxl 3.1.5 instalado)
```

### Próximo bloque recomendado al arrancar

```
AGENTE: Claude 4.6 en Antigravity IDE
TAREA: BDB-POST-MIXED-SUITABILITY-IMPACT-AUDIT-0
OBJETIVO: Auditar el impacto en suitability y solver tras la remediación de 59/60 fondos MIXED.
REGLAS: NO escribir Firestore. NO deploy. NO modificar código. Read-only.
```

---

## K. Documentos de Referencia

| Documento | Descripción |
|-----------|-------------|
| `docs/BDB_FIRESTORE_RULES_SECURITY_HOTFIX_0.md` | Cierre hotfix seguridad Firestore |
| `docs/BDB_XRAY_GLOBAL_ALLOCATION_ALTERNATIVES_FIX_0.md` | Fix alternatives X-Ray globalAllocation |
| `docs/BDB_MIXED_EXPOSURE_SOURCE_AUDIT_0.md` | Auditoría de fuentes para MIXED |
| `docs/BDB_MIXED_EXPOSURE_FIX_DRYRUN_0.md` | Dry-run del fix pipeline |
| `docs/BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_1.md` — `8_OFFICIAL_FACTSHEET.md` | Escrituras controladas por lote |
| `docs/BDB_MIXED_EXPOSURE_WRITE_GATE_0.md` — `8_OFFICIAL_FACTSHEET.md` | Gates de aprobación por lote |
| `docs/BDB_MIXED_EXPOSURE_OFFICIAL_FACTSHEET_AUDIT_0.md` | Auditoría fichas oficiales Gate 8 |
| `docs/BDB_MIXED_EXPOSURE_FINAL_CLOSEOUT_59_60.md` | **Cierre definitivo 59/60 MIXED** |
| `docs/BDB_CREDENTIALS_WORKSPACE_CLEANUP_0.md` | Limpieza de credentials del workspace |
| `docs/BDB_POST_MIXED_REMEDIATION_SMOKE_TEST_0.md` | Smoke test post-remediación |
| `docs/BDB_XRAY_TEST_DEPS_OPENPYXL_0.md` | Fix harness X-Ray + openpyxl |
| `docs/BDB_REGRESSION_COVERAGE_SHORT_HISTORY_CONTRACT_0.md` | Decisión de contrato short-history |
| `docs/BDB_AUDIT_2026_05_10_VERIFICATION_0.md` | Auditoría técnica general (hallazgos T-01 a T-05) |

---

## L. Confirmaciones Finales

| Check | Estado |
|-------|--------|
| Writes a Firestore en ESTE bloque | ✅ 0 |
| Deploy realizado | ✅ NO |
| Código productivo modificado | ✅ NO |
| `optimizer_core.py` tocado | ✅ NO |
| `suitability_engine.py` tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| Frontend tocado | ✅ NO |
| Scripts de write históricos reejecutados | ✅ NO |

---

*Generado por Antigravity Agent (Claude Sonnet 4.6 Thinking) — BDB-AUDIT-MASTER-STATUS-REPORT-2026-05-0*  
*HEAD al cierre: `b67cfba` — Suite: 99/99 PASS — Producción: ESTABLE*
