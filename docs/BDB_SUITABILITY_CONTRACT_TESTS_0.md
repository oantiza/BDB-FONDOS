# BDB-SUITABILITY-CONTRACT-TESTS-0
## Informe Final — Tests de Contrato Suitability Frontend/Backend

**Bloque:** `BDB-SUITABILITY-CONTRACT-TESTS-0`  
**Fecha:** 2026-05-11  
**Base commit:** `c91e43f` (BDB-SUITABILITY-HARDCODED-CONTRACT-AUDIT-0)  
**Modo:** Tests + documentación (sin modificaciones de lógica productiva, sin Firestore writes, sin deploy)

---

## A. Resumen Ejecutivo

| Entregable | Estado |
|---|---|
| Banner DO NOT RUN en `migrate_suitability_v2.py` | ✅ Añadido |
| Tests backend nuevos (`test_suitability_contract_parity.py`) | ✅ 38/38 PASS |
| Tests frontend nuevos (`rulesEngine.suitability.test.ts`) | ✅ 34/34 PASS |
| Tests regresión + X-Ray | ✅ 37/37 PASS |
| Lógica productiva modificada | ✅ NINGUNA |
| Firestore writes | ✅ CERO |
| Deploy | ✅ NO |

**Tests totales ejecutados:** 38 + 34 + 37 = **109 tests. 109/109 PASS. 0 FAIL.**

---

## B. Archivos Modificados/Creados

### [MODIFIED] `scripts/maintenance/migrate_suitability_v2.py`

Añadido banner `DO NOT RUN` de 33 líneas en la cabecera del script, antes de cualquier import. Sin cambios en la lógica.

**Contenido del banner:**
- Estado: HISTORICAL — NOT SAFE TO EXECUTE WITHOUT EXPLICIT GATE
- Nivel de riesgo: HIGH — escribe en colección `funds_v3` de producción
- Razón crítica: valores de `compatible_profiles` escritos antes de la remediación MIXED (May 2026) son STALE para 59 fondos
- Procedimiento mínimo requerido: DRY-RUN → DIFF MANIFEST → aprobación → subset → post-verificación
- Referencias: `docs/BDB_SUITABILITY_HARDCODED_CONTRACT_AUDIT_0.md`, este documento

### [NEW] `tests/test_suitability_contract_parity.py`

38 tests de contrato backend, organizados en 9 clases:

| Clase | Regla | Tests |
|---|---|---|
| `TestContractRule1_StrictV2` | Strict V2 requirement | 3 |
| `TestContractRule2_MissingExposure` | Missing exposure → block p<=4 | 3 |
| `TestContractRules3_4_VeryConservative` | p1-2: is_suitable_low_risk + risk_bucket | 5 |
| `TestContractRule5_RealEqCap_P1_P2` | real_eq > 30% → block p1-2 (con boundaries) | 4 |
| `TestContractRules7_8_RealEqCap_P3_P4` | real_eq > 45%/60% (p3/p4) + post-MIXED | 7 |
| `TestContractRule9_SectorFundsConservative` | Sector funds → block p<=4 | 3 |
| `TestContractRule11_HealthcareMinProfile6` | Healthcare → min p6 | 4 |
| `TestContractMixedFundLookthrough` | MIXED evaluado por economic_exposure | 4 |
| `TestContractFE9BackendBaseline` | FE-9: backend SIN regla lowQualityCredit | 3 |
| `TestContractCompatibleProfiles` | Backend ignora compatible_profiles (siempre recalcula) | 2 |

### [NEW] `frontend/src/utils/rulesEngine.suitability.test.ts`

34 tests de contrato frontend, organizados en 6 suites:

| Suite | Cobertura | Tests |
|---|---|---|
| `compatible_profiles precedence` | Delegación canónica + riesgo stale | 4 |
| `profiles 1-2 (very conservative)` | Reglas 3, 4, 5 | 5 |
| `real_eq caps for profiles 3 and 4` | Reglas 7, 8 + post-MIXED | 6 |
| `sector funds excluded for profiles <= 4` | Regla 9 | 3 |
| `healthcare minimum profile 6` | Regla 11 | 4 |
| `FE-9 KNOWN_DIVERGENCE_FRONTEND_ONLY` | lowQualityCredit boundaries + isolation | 5 |
| `Frontend/Backend parity — summary` | Tests de alineación + divergencia | 7 |

---

## C. Contrato Backend — Reglas Cubiertas

### C.1 Reglas y cobertura

| ID Regla | Descripción | Tests existentes (`test_suitability_v2.py`) | Tests nuevos (`test_suitability_contract_parity.py`) |
|---|---|---|---|
| Rule 1 | Strict V2 — sin classification_v2 → bloqueo total | ✅ `TestAmbiguousNoV2`, `TestEdgeCases` | ✅ `TestContractRule1_StrictV2` (3 tests) |
| Rule 2 | Missing exposure → block p<=4 | ✅ `TestEdgeCases::test_fund_with_only_metrics` | ✅ `TestContractRule2_MissingExposure` (3 tests, incluye p5 pass) |
| Rule 3 | is_suitable_low_risk=False → block p1-2 | ✅ via MOCK_BIOTECH | ✅ `TestContractRules3_4_VeryConservative` |
| Rule 4 | risk_bucket=HIGH → block p1-2 | ✅ via MOCK_BIOTECH | ✅ `TestContractRules3_4_VeryConservative` |
| Rule 5 | real_eq > 30% → block p1-2 | ⚠️ implícito (MOCK_GLOBAL_EQUITY 95%) | ✅ **NUEVO** `TestContractRule5_RealEqCap_P1_P2` (boundaries explícitas) |
| Rule 6 | risk_bucket=HIGH + !EQUITY → block p3-4 | ✅ `TestHighYield` | ✅ via `TestContractFE9BackendBaseline` |
| Rule 7 | real_eq > 45% → block p3 | ✅ `TestAllocationAggressive` (70%) | ✅ **NUEVO** boundaries exactas + post-MIXED examples |
| Rule 8 | real_eq > 60% → block p4 | ✅ `TestAllocationAggressive` (70%) | ✅ **NUEVO** boundaries exactas |
| Rule 9 | Sector funds → block p<=4 | ✅ `TestBiotechSectorial` | ✅ **NUEVO** `TestContractRule9_SectorFundsConservative` (bajo real_eq) |
| Rule 10 | EM_EQUITY/HY_BOND/COMMODITIES → block p<=4 | ✅ `TestSmallCapEM`, `TestHighYield` | ✅ via `TestContractFE9BackendBaseline` |
| Rule 11 | Healthcare → min p6 | ⚠️ implícito (test_allowed_profile_7) | ✅ **NUEVO** `TestContractRule11_HealthcareMinProfile6` (p5, p6, p7) |

### C.2 Nuevas coberturas críticas (post-MIXED)

Los tests de `TestContractRules7_8_RealEqCap_P3_P4` incluyen casos nombrados con fondos reales:

- `test_p3_carmignac_patrimoine_style`: 32% real_eq → ELEGIBLE p3 ✅ (post-remediation OK)
- `test_p3_dma_sri_75_style`: 75% real_eq → INELEGIBLE p3 ✅ (corrección correcta)
- `test_mixed_pre_remediation_50_50_would_have_been_blocked_p3`: documenta por qué 59 fondos MIXED cambiaron su elegibilidad

### C.3 Compatible_profiles — contrato backend

`TestContractCompatibleProfiles` documenta y prueba que:
1. El backend **ignora** `compatible_profiles` almacenado — siempre recalcula desde `classification_v2` + `economic_exposure`.
2. Un fondo sin `compatible_profiles` en Firestore es igualmente evaluado de forma correcta.

Este es el contrato fundamental: el backend es la autoridad, no el cache.

---

## D. Contrato Frontend — Reglas Cubiertas

### D.1 Reglas alineadas con backend

| Regla | Frontend (rulesEngine.ts) | Test nuevo | Alineación |
|---|---|---|---|
| Rule 3 | `is_suitable_low_risk === false → return false` (p1-2) | ✅ `[PARITY-OK] Rule 3` | ✅ Alineado |
| Rule 4 | `riskBucket === "HIGH" → return false` (p1-2) | ✅ `blocks HIGH risk bucket for profile 2` | ✅ Alineado |
| Rule 5 | `realEq > 30 → return false` (p1-2) | ✅ `[PARITY-OK] Rule 5` + boundary | ✅ Alineado |
| Rule 7 | `riskProfile === 3 && realEq > 45 → return false` | ✅ `[PARITY-OK] Rule 7` + boundary + post-MIXED | ✅ Alineado |
| Rule 8 | `riskProfile === 4 && realEq > 60 → return false` | ✅ `[PARITY-OK] Rule 8` + boundary | ✅ Alineado |
| Rule 9 | `isSectorFund → return false` (p<=4) | ✅ `[PARITY-OK] Rule 9` | ✅ Alineado |
| Rule 11 | `isSectorFund && sectorFocus === "HEALTHCARE" && riskProfile < 6 → false` | ✅ `[PARITY-OK] Rule 11` | ✅ Alineado |

### D.2 compatible_profiles — comportamiento frontend

| Escenario | Comportamiento esperado | Test |
|---|---|---|
| `compatible_profiles = [1,2,...,10]` (array poblado) | Se usa directamente, sin evaluar reglas | ✅ `uses compatible_profiles when populated` |
| Profile NOT IN `compatible_profiles` | Rechazado aunque reglas lo permitirían | ✅ `rejects a profile NOT in compatible_profiles` |
| `compatible_profiles = []` (array vacío) | Fallthrough a reglas | ✅ `falls through to rule-based check` |
| `compatible_profiles` stale (pre-MIXED) | El frontend muestra eligibilidad incorrecta | ✅ `[STALE RISK] stale compatible_profiles` |

El test `[STALE RISK]` es un **test de documentación**: demuestra que el frontend mostraría p3=false para Carmignac si `compatible_profiles` fue calculado antes de la remediación (real_eq=50% → bloqueado). Con datos post-MIXED (real_eq=32%) el backend lo acepta, pero el frontend mostraría el valor stale del cache.

### D.3 FE-9 — KNOWN_DIVERGENCE_FRONTEND_ONLY

```typescript
// rulesEngine.ts L443:
if (lowQualityCredit >= 35) return false;  // SOLO EN FRONTEND
```

**Estado:** Documentado como divergencia conocida. **No corregido en este bloque.**

Tests añadidos que protegen y documentan FE-9:

| Test | Propósito |
|---|---|
| `[FE-9] blocks corporate bond with lowQualityCredit >= 35% for p4` | Confirma que la regla existe en frontend |
| `[FE-9] allows same fund with lowQualityCredit < 35% for p4` | Confirma el threshold |
| `[FE-9] blocks at exactly 35% (boundary: rule is >= 35)` | Boundary condition |
| `[FE-9] does NOT apply for profile 5` | Confirma el rango (solo p<=4) |
| `[FE-9] HIGH_YIELD_BOND is blocked by subtype rule, not FE-9` | Aísla FE-9 de la regla Rule 10 |
| `[PARITY-DIVERGE] FE-9: lowQualityCredit >= 35% frontend only` | Entrada explícita en el resumen de paridad |
| Backend: `test_backend_accepts_low_quality_credit_rf_fund_p4` | Confirma que backend NO tiene la regla |
| Backend: `test_backend_no_lowqualitycredit_attribute_used` | Inspección de código fuente — falla si se añade la regla |

**Impacto actual de FE-9:**
- Fondos RF con crédito low-quality >= 35% y subtype != HIGH_YIELD_BOND son **ocultos en la UI** para p<=4 pero **aceptados por el optimizer**.
- El usuario no los ve disponibles aunque matemáticamente podrían entrar en cartera si fueran seleccionados por otro medio.

---

## E. compatible_profiles — Riesgo Stale Post-MIXED

### E.1 Estado del campo

| Dimensión | Estado |
|---|---|
| Definido en modelo (`canonical_types.py`) | ✅ `compatible_profiles: List[int]` |
| Escrito por `migrate_suitability_v2.py` | ✅ script existe |
| Leído por backend runtime | ❌ NUNCA — backend siempre recalcula |
| Leído por frontend (`isFundSuitableForProfile`) | ✅ PRIMERA PRIORIDAD si array no vacío |
| Evidencia de ejecución en producción | ❌ Sin evidencia (`suitability_version` no leído en runtime) |
| Banner DO NOT RUN | ✅ Añadido en este bloque |

### E.2 Por qué no se ejecutó la migración

La migración no fue ejecutada (o si lo fue, no hay trazabilidad) porque:

1. El script no tenía gate de aprobación ni dry-run step.
2. El campo `suitability_version` que escribe no es leído por ningún código de runtime — no existe forma de saber si fue ejecutado sin consultar Firestore directamente.
3. El riesgo de ejecutar ahora es alto: si se ejecutó antes de la remediación MIXED (May 2026), los valores serían incorrectos para 59 fondos. Si no se ejecutó, Firestore no tiene el campo.

### E.3 Condiciones mínimas para futura regeneración

Para ejecutar `migrate_suitability_v2.py` de forma segura:

1. **Verificar estado actual**: query read-only para determinar si `compatible_profiles` existe en algún fondo y qué valores tiene.
2. **Dry-run**: modificar el script para que logee cambios propuestos SIN escribir.
3. **Diff manifest**: comparar perfiles actuales vs propuestos, especialmente para los 59 fondos MIXED remediados.
4. **Aprobación**: revisión explícita del diff.
5. **Hamco exclusión**: `LU3038481936` no tiene `portfolio_exposure_v2` — el script debe manejarlo explícitamente (skip o perfil vacío).
6. **Post-verificación**: confirmar que el frontend muestra eligibilidad consistente con el backend para una muestra de fondos.

**Bloque recomendado:** `BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0`

---

## F. Resultados de Tests

### F.1 Tests backend — contrato parity (NUEVO)

```
Comando: .\venv\Scripts\python.exe -m pytest tests\test_suitability_contract_parity.py -v --tb=short

Resultado: 38/38 PASS · 0 FAIL · 0 ERROR
Duración: 0.13s
```

### F.2 Tests backend — suitability existentes + MIXED

```
Comando: .\venv\Scripts\python.exe -m pytest 
  tests\test_suitability_contract_parity.py 
  tests\test_suitability_v2.py 
  tests\test_mixed_funds_lookthrough_contract.py 
  tests\test_mixed_exposure_ms_portfolio.py -v --tb=short

Resultado: 100/100 PASS · 0 FAIL · 0 ERROR
  - test_suitability_contract_parity.py: 38 tests
  - test_suitability_v2.py: 47 tests
  - test_mixed_funds_lookthrough_contract.py: 4 tests
  - test_mixed_exposure_ms_portfolio.py: 11 tests
```

### F.3 Tests frontend — suitability (NUEVO)

```
Comando: powershell -ExecutionPolicy Bypass -Command "cd frontend; npx vitest run src/utils/rulesEngine.suitability.test.ts --reporter=verbose"

Resultado: 34/34 PASS · 0 FAIL · 0 ERROR
Duración: 434ms
Entorno: Vitest v4.0.16
```

### F.4 Tests regresión + X-Ray

```
Comando: .\venv\Scripts\python.exe -m pytest tests\test_regression_coverage.py tests\xray\ -v --tb=short

Resultado: 37/37 PASS · 0 FAIL · 0 ERROR
Duración: 2.47s
```

### F.5 Total acumulado

| Suite | Tests | Resultado |
|---|---|---|
| `test_suitability_contract_parity.py` (NUEVO) | 38 | ✅ 38/38 |
| `test_suitability_v2.py` | 47 | ✅ 47/47 |
| `test_mixed_funds_lookthrough_contract.py` | 4 | ✅ 4/4 |
| `test_mixed_exposure_ms_portfolio.py` | 11 | ✅ 11/11 |
| `test_regression_coverage.py` | 7 | ✅ 7/7 |
| `tests/xray/` | 30 | ✅ 30/30 |
| `rulesEngine.suitability.test.ts` (NUEVO FE) | 34 | ✅ 34/34 |
| **TOTAL** | **171** | **✅ 171/171** |

---

## G. Divergencias Conocidas — Estado Post-Bloque

| ID | Descripción | Estado |
|---|---|---|
| FE-9 | lowQualityCredit >= 35% en frontend, ausente en backend | ⚠️ KNOWN — documentado y testeado, sin resolver |
| FE-1 | Frontend sin classV2 acepta si equity < 50% para p<=4; backend bloquea todo | ⚠️ KNOWN — documentado en audit anterior, fuera de scope |
| Bucket seeds | RISK_PROFILES frontend difieren de RISK_BUCKETS_LABELS backend en p3-8 | ℹ️ INFO — solo presentación visual |
| compatible_profiles stale | Si se ejecutó pre-MIXED, los valores son incorrectos para 59 fondos | ⚠️ ACTIVE RISK — banner añadido, pendiente regen dry-run |

---

## H. Recomendación Siguiente

**Opción A (máximo impacto técnico):**  
`BDB-COMPATIBLE-PROFILES-REGEN-DRYRUN-0`  
Query read-only para determinar si `compatible_profiles` existe en Firestore y qué valores tiene. Preparar dry-run del script con diff manifest. Requiere: credencial de servicio, lógica de dry-run (solo log, no write).

**Opción B (decisión de negocio sobre FE-9):**  
`BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0`  
Decidir si `lowQualityCredit >= 35%` debe:
  - A) Añadirse al backend (parity total)
  - B) Eliminarse del frontend (menos divergencia, menor protección UX)
  - C) Mantenerse como known divergence documentada indefinidamente

**Opción C (arquitectura a largo plazo):**  
`BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0`  
Diseñar migración de los umbrales hardcoded (30%, 45%, 60%, p<6 healthcare) a `system_settings/suitability_rules` en Firestore. Eliminación progresiva de lógica duplicada.

**Recomendación:** Ejecutar Opción A primero (es read-only y resuelve la incertidumbre sobre el estado real de `compatible_profiles` en producción). Luego Opción B como gate de negocio.

---

## I. Confirmaciones

| Confirmación | Estado |
|---|---|
| Firestore writes | ✅ CERO |
| Deploy | ✅ NO |
| Lógica productiva modificada | ✅ NINGUNA |
| `suitability_engine.py` modificado | ✅ NO |
| `rulesEngine.ts` modificado | ✅ NO (solo test file nuevo) |
| `optimizer_core.py` modificado | ✅ NO |
| `firestore.rules` modificado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| Scripts de write históricos reeejecutados | ✅ NO |
| `migrate_suitability_v2.py` ejecutado | ✅ NO |
