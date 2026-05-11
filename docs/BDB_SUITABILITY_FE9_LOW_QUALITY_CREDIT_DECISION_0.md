# BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0
## Auditoría y Decisión — Divergencia FE-9 `lowQualityCredit >= 35%`

**Bloque:** `BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0`  
**Fecha:** 2026-05-11  
**Commit base:** `1ca0239`  
**Tipo:** Auditoría read-only + decisión documental — sin writes, sin deploy, sin código productivo

---

## A. Resumen Ejecutivo

La auditoría live contra `funds_v3` (670 fondos) confirma que **el campo `low_quality` no existe en ningún documento de Firestore** bajo ninguna de las rutas que la regla frontend FE-9 consulta. La regla está, por tanto, **siempre dormida**: el fallback es `0` y `0 >= 35` es `false`, por lo que nunca dispara en producción.

**Decisión recomendada:** `NEEDS_DATA_MODEL_FIRST`

La regla FE-9 no puede evaluarse ni migrarse hasta que el campo `portfolio_exposure_v2.fi_credit.low_quality` esté poblado en Firestore. El estado actual es técnicamente inofensivo pero representa deuda de diseño: una regla que existe en código pero que opera sobre datos inexistentes.

| Dimensión | Resultado |
|---|---|
| Script de auditoría | ✅ Ejecutado — read-only |
| Fondos escaneados | **670** |
| Fondos con campo `low_quality` | **0 / 670** |
| Fondos con valor >= 35% | **0** |
| Fondos con FE-9 gap activo | **0** |
| Firestore writes | ✅ CERO |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| Tests backend | ✅ **85 PASS** |
| Tests frontend | ✅ **34 PASS** |

---

## B. Estado Actual

### B.1 — Regla Frontend (`rulesEngine.ts` L425-L447)

```typescript
// rulesEngine.ts — isFundSuitableForProfile()
const lowQualityCredit = Number(
  expV2?.fi_credit?.low_quality || expV2?.credit?.low_quality || 0
);

if (riskProfile <= 4) {
  if (
    assetSubtype === "EMERGING_MARKETS_EQUITY" ||
    assetSubtype === "HIGH_YIELD_BOND"         ||
    lowQualityCredit >= 35                      ||   // ← FE-9
    assetType === "COMMODITIES"
  ) {
    return false;
  }
}
```

La regla busca el valor en dos rutas con fallback `0`:
- `portfolio_exposure_v2.fi_credit.low_quality`
- `portfolio_exposure_v2.credit.low_quality`

Dado que **ambas rutas devuelven `undefined` para los 670 fondos**, el valor efectivo siempre es `0`. La condición `0 >= 35` es `false`: **la regla nunca dispara en producción**.

### B.2 — Backend (`suitability_engine.py`)

No existe ninguna referencia a `lowQualityCredit`, `low_quality_credit` ni `fi_credit.low_quality` en el engine. El test de contrato `test_backend_no_lowqualitycredit_attribute_used` lo verifica explícitamente:

```python
source = inspect.getsource(is_fund_eligible_for_profile)
assert "lowQualityCredit" not in source  # ✅ PASS
```

### B.3 — Tests que documentan la divergencia

| Suite | Test ID | Estado |
|---|---|---|
| `test_suitability_contract_parity.py` | `TestContractFE9BackendBaseline::test_backend_accepts_low_quality_credit_rf_fund_p4` | ✅ PASS |
| `test_suitability_contract_parity.py` | `TestContractFE9BackendBaseline::test_backend_no_lowqualitycredit_attribute_used` | ✅ PASS |
| `test_suitability_contract_parity.py` | `TestContractFE9BackendBaseline::test_high_yield_bond_still_blocked_by_subtype` | ✅ PASS |
| `rulesEngine.suitability.test.ts` | `[FE-9] blocks corporate bond fund with lowQualityCredit >= 35% for profile 4` | ✅ PASS |
| `rulesEngine.suitability.test.ts` | `[FE-9] allows same fund with lowQualityCredit < 35% for profile 4` | ✅ PASS |
| `rulesEngine.suitability.test.ts` | `[FE-9] blocks at exactly 35% (boundary)` | ✅ PASS |
| `rulesEngine.suitability.test.ts` | `[FE-9] does NOT apply for profile 5` | ✅ PASS |
| `rulesEngine.suitability.test.ts` | `[FE-9] HIGH_YIELD_BOND blocked by subtype, not FE-9` | ✅ PASS |
| `rulesEngine.suitability.test.ts` | `[PARITY-DIVERGE] FE-9: lowQualityCredit >= 35% blocks p<=4 in frontend only` | ✅ PASS |

---

## C. Fuente de Datos

### C.1 — Rutas auditadas

| Ruta | Documentos con valor | Fondos >= 35% |
|---|---|---|
| `portfolio_exposure_v2.fi_credit.low_quality` | **0 / 670** | 0 |
| `portfolio_exposure_v2.credit.low_quality` | **0 / 670** | 0 |

**Conclusión: el campo no existe en Firestore.** No hay datos que alimenten la regla FE-9.

### C.2 — Campos relacionados que SÍ existen

El modelo de datos tiene un campo de calidad crediticia en `classification_v2`:
- `classification_v2.fi_credit_bucket`: enum `HIGH_QUALITY | MEDIUM_QUALITY | LOW_QUALITY | UNKNOWN`
- Este campo es **cualitativo** (bucket categórico), no cuantitativo (porcentaje)

También existe la ruta `portfolio_exposure_v2.fi_credit` como sub-objeto `Record<string, number>`, que contendría breakdowns de distribución de crédito (Morningstar proporciona este breakout para fondos de renta fija). Sin embargo, **ningún documento tiene este sub-objeto poblado** con el campo `low_quality`.

### C.3 — Proceso de ingesta de Morningstar

Morningstar sí proporciona un breakdown de crédito (`credit_quality_breakdown` o similar) para fondos de renta fija. El pipeline de ingesta (`populate_taxonomy_v2.py`, `utils.py`) mapea:
- `LOW_QUALITY` y `HIGH_YIELD` → `low_quality` en el mapping de `normalize_v2_credit_bucket()`
- Pero esto aplica al **bucket categórico** en `classification_v2.fi_credit_bucket`, **no al campo cuantitativo porcentual** en `portfolio_exposure_v2.fi_credit.low_quality`

**El campo porcentual nunca fue implementado en el pipeline de ingesta.**

### C.4 — Calidad y confiabilidad del campo

| Dimensión | Estado |
|---|---|
| Existencia en Firestore | ❌ **No existe** |
| Fuente primaria | Morningstar (disponible, no procesado) |
| Cobertura potencial | Solo fondos de renta fija / mixtos |
| Confiabilidad si se implementara | Media — requiere normalización y auditoría |
| Volatilidad del dato | Alta — cambia con rebalanceos |

---

## D. Impacto Potencial

### D.1 — Situación actual (0 fondos afectados)

Dado que el campo no existe, la regla FE-9:
- **No bloquea ningún fondo** que no esté ya bloqueado por otra regla
- **No produce ninguna discrepancia activa** entre frontend y backend
- **No genera ningún riesgo inmediato** para el usuario final

### D.2 — Situación hipotética si el campo se poblara

Si Morningstar proporcionara `low_quality >= 35%` para fondos de renta fija corporativa de alto rendimiento (HY cortos, CCC concentrados, cross-over), estos serían:
- **Bloqueados por frontend** para perfiles ≤ 4 (FE-9)
- **Aceptados por backend** (sin regla)

Sin embargo, la mayoría de esos fondos **ya estarían bloqueados** por:
- `asset_subtype === "HIGH_YIELD_BOND"` (Regla 10 — ambos sistemas)
- `risk_bucket === "HIGH"` (Regla 3/4 — ambos sistemas)

El **gap neto** afectaría principalmente a fondos `CORPORATE_BOND` o `MIXED` con **exposición significativa a crédito sub-investment-grade sin subtype HIGH_YIELD_BOND** — un caso de borde que requeriría validación con fondos reales.

### D.3 — Riesgo regulatorio y comercial

| Tipo de riesgo | Nivel | Justificación |
|---|---|---|
| Regulatorio | **Bajo** | La regla no tiene base regulatoria documentada (no es MiFID II explícita) |
| Comercial | **Bajo actual** | Sin datos, no puede disparar |
| Comercial futuro | **Medio** | Si se popula el campo, la inconsistencia FE/BE sería visible |
| Reputacional | **Bajo** | El frontend es más restrictivo (favorece la prudencia) |
| UX | **Nulo actual** | El usuario no experimenta la regla porque nunca dispara |

---

## E. Opciones Evaluadas

### E.1 — `REMOVE_FRONTEND_RULE`
Eliminar la línea `lowQualityCredit >= 35` de `rulesEngine.ts`.

- ✅ Simplifica el frontend
- ✅ Elimina la divergencia
- ❌ Elimina una guardia que podría ser útil cuando el dato exista
- ❌ Requiere deploy frontend
- **Veredicto:** Posible, pero prematuro. Si el dato va a implementarse, eliminar la regla ahora y reimplementarla después genera doble trabajo.

### E.2 — `KEEP_FRONTEND_WARNING_ONLY`
Convertir el bloqueo en un warning visual (badge o tooltip).

- ✅ No elimina la información de calidad crediticia si se popula
- ❌ Requiere rediseño de componente UI
- ❌ El campo aún no existe — el warning nunca aparecería
- **Veredicto:** Prematuro. No tiene sentido diseñar el warning antes del dato.

### E.3 — `MIGRATE_TO_BACKEND_HARD_RULE`
Añadir regla en `is_fund_eligible_for_profile()`.

- ✅ Parity total
- ❌ Requiere que el campo exista en Firestore (hoy: 0/670)
- ❌ Requiere definir semántica exacta: ¿qué porcentaje de qué exposición?
- ❌ Añade complejidad a un engine que hoy funciona sin el campo
- **Veredicto:** No viable hasta que existan datos.

### E.4 — `MIGRATE_TO_BACKEND_SOFT_WARNING`
Añadir lógica de warning (no bloqueo) en backend.

- ✅ Más prudente que hard block
- ❌ Misma dependencia de datos que E.3
- **Veredicto:** No viable hasta datos.

### E.5 — `KEEP_FRONTEND_ONLY_TEMPORARILY`
Mantener la regla como está, documentada como divergencia conocida.

- ✅ Zero cambios de código
- ✅ La regla es inofensiva (nunca dispara)
- ✅ Preserva la intención si el campo se popula
- ❌ Mantiene deuda de diseño
- **Veredicto:** Aceptable a corto plazo, pero incompleto.

### E.6 — `NEEDS_DATA_MODEL_FIRST` ← **RECOMENDADA**
Bloquear toda decisión de migración hasta que el dato exista en Firestore.

- ✅ No decide prematuramente sin datos
- ✅ Define un prerrequisito claro
- ✅ No requiere ningún cambio de código
- ✅ Compatible con todos los escenarios futuros
- **Veredicto:** Es la única opción honesta dado que el dato no existe.

---

## F. Decisión Recomendada

### `NEEDS_DATA_MODEL_FIRST`

**Justificación:**

La regla FE-9 fue escrita anticipando un campo de datos (`portfolio_exposure_v2.fi_credit.low_quality`) que nunca fue implementado en el pipeline de ingesta. La regla opera sobre un valor que siempre es `0` porque su fuente es inexistente.

Resolver FE-9 correctamente requiere, en orden:

1. **Diseñar e implementar el campo** `portfolio_exposure_v2.fi_credit` como un breakdown cuantitativo de calidad crediticia (sourced de Morningstar credit quality breakdown)
2. **Determinar cobertura**: ¿qué porcentaje de los 670 fondos tendría el campo? ¿Solo renta fija? ¿También mixtos?
3. **Validar el threshold**: ¿35% es correcto? ¿Debe ser diferente para fondos mixtos vs pure fixed income?
4. **Decidir si es hard block o warning**: Con datos reales se puede analizar el impacto sobre `compatible_profiles`
5. **Entonces** decidir entre migrar al backend, mantener en frontend, o convertir en warning

**Hasta que ocurra el paso 1**, la regla FE-9 puede permanecer en `rulesEngine.ts` sin consecuencias. La divergencia documentada es teórica, no activa.

> [!IMPORTANT]
> **La regla FE-9 NO debe añadirse al backend mientras el campo `low_quality` no exista en Firestore.** Añadir una regla a `is_fund_eligible_for_profile()` sobre un dato que no existe generaría una regla hardcoded permanentemente inactiva — exactamente el mismo problema que en el frontend, duplicado en el backend.

---

## G. Próximos Bloques

| Prioridad | Bloque | Prerrequisito | Objetivo |
|---|---|---|---|
| 1 | `BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0` | — | Diseñar e implementar ingesta de `fi_credit` breakdown cuantitativo desde Morningstar |
| 2 | `BDB-SUITABILITY-FE9-IMPACT-ANALYSIS-0` | `fi_credit` poblado | Cuantificar fondos afectados con datos reales |
| 3 | `BDB-SUITABILITY-FE9-BACKEND-CONTRACT-TESTS-0` | Decisión de migración aprobada | Implementar tests de contrato para la regla en backend si se decide migrar |
| 4 | `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0` | — | Diseño global de fuente de verdad para reglas hardcoded |

---

## H. Tests Ejecutados

### H.1 — Backend

```powershell
.\functions_python\venv\Scripts\python.exe -m pytest \
  functions_python\tests\test_suitability_contract_parity.py \
  functions_python\tests\test_suitability_v2.py \
  -v --tb=short
```

```
============================= 85 passed in 0.18s ==============================
EXIT:0
```

Incluye los 3 tests de `TestContractFE9BackendBaseline` — todos PASS.

### H.2 — Frontend

```powershell
cd frontend; npx vitest run src/utils/rulesEngine.suitability.test.ts --reporter=verbose
```

```
Test Files  1 passed (1)
     Tests  34 passed (34)
  Duration  321ms
EXIT:0
```

Incluye los 5 tests de `FE-9 KNOWN_DIVERGENCE_FRONTEND_ONLY` y el `[PARITY-DIVERGE]` — todos PASS.

### H.3 — Audit script live

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "...\bdb-fondos-service-account.json"
python -X utf8 scripts\maintenance\bdb_fe9_low_quality_credit_audit.py
```

```
Total scanned:                  670
With low_quality field:         0
Missing field:                  670
Over FE-9 threshold (>= 35%):  0
Over threshold + profile <= 4 (FE-9 gap): 0
EXIT:0
```

Artifact: `artifacts/suitability/fe9_low_quality_credit_audit_0.json`

---

## I. Confirmaciones de Seguridad

| Confirmación | Estado |
|---|---|
| Firestore writes | ✅ **CERO** |
| Deploy ejecutado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `rulesEngine.ts` modificado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| Scripts históricos de write ejecutados | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |

---

## J. Artifacts Generados

| Archivo | Descripción |
|---|---|
| `scripts/maintenance/bdb_fe9_low_quality_credit_audit.py` | Script read-only de auditoría live (write-guard incorporado) |
| `artifacts/suitability/fe9_low_quality_credit_audit_0.json` | Resultado de auditoría: 0/670 fondos con campo `low_quality` |
| `docs/BDB_SUITABILITY_FE9_LOW_QUALITY_CREDIT_DECISION_0.md` | Este documento |
