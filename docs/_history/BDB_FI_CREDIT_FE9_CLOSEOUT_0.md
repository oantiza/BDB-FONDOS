# BDB-FI-CREDIT-FE9-CLOSEOUT-0

**Tipo:** Documento maestro de cierre | **Fecha:** 2026-05-11 | **HEAD:** `1c23475`
**Colección:** `funds_v3` | **Firestore writes (este bloque):** 0 | **Deploy:** No

---

## A. Resumen Ejecutivo

Cierre del **ciclo FI credit / FE-9**: desde la detección de FE-9 como regla dormida
hasta el diseño del contrato de warning no bloqueante. Ciclo completado en 8 bloques a
lo largo de múltiples sesiones.

| Métrica | Valor |
|---------|-------|
| **Fondos con `portfolio_exposure_v2.fi_credit`** | **130** ✅ |
| Fondos escaneados total | 670 |
| FE-9 hard block activado | **NO** |
| Warning no bloqueante diseñado | **SÍ** (contrato formal) |
| Fondos auditados FE-9 potential gap | 7 |
| Deploy ejecutado en todo el ciclo | **NO** |
| BDB-FONDOS-CORE tocado | **NO** |
| `suitability_engine.py` modificado | **NO** |
| `compatible_profiles` modificado en el ciclo | **NO** |

**El ciclo ha dejado `funds_v3` con datos de calidad crediticia real en 130 fondos de
renta fija, sin activar ninguna regla automática ni bloquear ningún perfil.**

---

## B. Timeline de Commits

| Commit | Bloque | Objetivo | Resultado clave | Writes | Tests |
|--------|--------|----------|----------------|--------|-------|
| `b248655` | BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0 | Auditar FE-9 dormida | `fi_credit.low_quality` ausente en 670/670. Decisión: NEEDS_DATA_MODEL_FIRST | NO | 85 PASS |
| `948cbd4` | BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0 | Diseñar schema `fi_credit` | Schema canónico diseñado. Gap identificado: falta traductor MS→fi_credit | NO | 85 PASS |
| `2583be0` | BDB-FI-CREDIT-PARSER-DISCOVERY-0 | Auditar cobertura MS CQ | 130/670 COMPLETE. 43 lq≥35%. 36 bloqueados Rule 10. 7 FE9_potential_gap | NO | 85 PASS |
| `fafa46b` | BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0 | Dry-run traductor | 130 TRANSLATED, 249 SKIPPED_ZERO, 291 SKIPPED. INVALID_SUM=0 | NO | 85 PASS |
| `a4823a4` | BDB-FI-CREDIT-TRANSLATOR-WRITE-GATE-0 | Gate controlado | 130 seleccionados, drift=false, already_fi_credit=0, authorized=false | NO | 85 PASS |
| `d28141f` | BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0 | **Write controlado** | **130/130 escritos y verificados. forbidden_fields=0. PASS=130** | **SÍ (130)** | 85+5xf+29xp |
| `1f418fb` | BDB-FI-CREDIT-FE9-IMPACT-AUDIT-0 | Auditar 7 fondos gap | HARD_BLOCK=0, SOFT_WARN=4, NO_ACTION=1, NEEDS_MANUAL=2 | NO | 85+5xf+29xp |
| `1c23475` | BDB-FI-CREDIT-FE9-SOFT-WARNING-DESIGN-0 | Diseñar warning no bloqueante | Contrato: blocking=false, INFO/WARNING/REVIEW. 28 tests nuevos | NO | 110+5xf+32xp |

**Write real del ciclo: exactamente 1 write batch — `d28141f` — solo campo `portfolio_exposure_v2.fi_credit`.**

---

## C. Estado Final de Datos

### Cobertura post-write

| Métrica | Valor |
|---------|-------|
| Total fondos escaneados (`funds_v3`) | 670 |
| Fondos con `fi_credit` poblado | **130** |
| SKIPPED — zero placeholders Morningstar | 249 |
| SKIPPED — sin `credit_quality` en MS | 291 |
| INVALID_SUM (error de suma) | 0 |
| Fondos con `low_quality >= 35%` (bond bucket) | 43 |
| Ya bloqueados por HY/EM Rule 10 | 36 |
| FE-9 potential new gap | **7** |
| FE-9 hard block | **false** |
| `compatible_profiles` modificados en el ciclo | **0** |

### Post-write verification (`d28141f`)

| Métrica | Valor |
|---------|-------|
| `total_written` | 130 |
| `pass_count` | **130** |
| `fail_count` | **0** |
| `drift_count` | 0 |
| `forbidden_fields_changed_count` | 0 |
| Rollback disponible | SÍ — `DELETE_FIELD` x130 |

### Dry-run post-write confirma
- `TRANSLATED: 0` — los 130 fondos ya tienen `fi_credit` (correctamente skippeados).
- `INVALID_SUM: 0` — sin errores de validación.

---

## D. Campo Escrito

### Único write real del ciclo
```
portfolio_exposure_v2.fi_credit
```
Actualizado via dotted-path update (`doc.update({"portfolio_exposure_v2.fi_credit": ...})`)
— preserva todos los demás sub-campos de `portfolio_exposure_v2` intactos.

### Campos NO modificados en ningún momento del ciclo

| Campo | Estado |
|-------|--------|
| `classification_v2` | ✅ Intacto |
| `classification_v2.compatible_profiles` | ✅ Intacto — **0 fondos modificados** |
| `classification_v2.is_sector_fund` | ✅ Intacto (ciclo anterior) |
| `portfolio_exposure_v2.economic_exposure` | ✅ Intacto |
| `portfolio_exposure_v2.exposure_confidence` | ✅ Intacto |
| `portfolio_exposure_v2.warnings` | ✅ Intacto |
| `manual` | ✅ No tocado |
| `ms` | ✅ Solo lectura |
| `derived` | ✅ No tocado |
| `std_perf` | ✅ No tocado |
| `optimizer` | ✅ No tocado |
| `suitability_engine.py` | ✅ No modificado |
| `frontend runtime` | ✅ No modificado |
| `firestore.rules` | ✅ No modificado |
| `optimizer_core.py` | ✅ No modificado |
| `BDB-FONDOS-CORE` | ✅ No tocado |

---

## E. Schema Final `fi_credit`

El campo `portfolio_exposure_v2.fi_credit` tiene la siguiente estructura canónica,
vigente en los 130 fondos escritos:

```json
{
  "source":           "morningstar_pdf",
  "as_of":            null,
  "scale":            "percent_of_bond_bucket",
  "coverage":         1.0,
  "investment_grade": 38.2,
  "high_yield":       60.0,
  "low_quality":      60.0,
  "not_rated":        1.9,
  "breakdown": {
    "AAA":      0.0,
    "AA":       0.0,
    "A":        5.3,
    "BBB":      32.9,
    "BB":       28.1,
    "B":        24.5,
    "below_B":  7.4,
    "not_rated": 1.9
  },
  "warnings": []
}
```

### Campos del schema

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `source` | string | Fuente del dato (`morningstar_pdf`) — proveniencia obligatoria |
| `as_of` | string\|null | Fecha del dato (null si MS no la expone) |
| `scale` | string | `"percent_of_bond_bucket"` — escala de denominación |
| `coverage` | float [0,1] | Fracción del bucket RF cubierta por el dato |
| `investment_grade` | float | AAA + AA + A + BBB (sobre bucket RF) |
| `high_yield` | float | BB + B + below_B (alias de `low_quality`) |
| `low_quality` | float | BB + B + below_B — **el campo crítico de FE-9** |
| `not_rated` | float | Deuda sin rating S&P/Moody's — **separado** de `low_quality` |
| `breakdown` | dict | Distribución por tramos de rating individuales |
| `warnings` | list | Warnings técnicos del parser (vacío si datos limpios) |

---

## F. Fórmulas Canónicas

```python
investment_grade = AAA + AA + A + BBB          # grado de inversión

low_quality      = BB + B + below_B            # sub-IG (= high_yield)
high_yield       = BB + B + below_B            # alias de low_quality

not_rated        # SEPARADO — nunca sumado a low_quality ni a investment_grade

# Suma del bucket RF:
# investment_grade + low_quality + not_rated ≈ 100% (± redondeo)

# Estimación de exposición al portafolio total:
low_quality_total_portfolio_estimate = low_quality * bond_weight / 100.0
```

> [!NOTE]
> Para fondos 100% RF (bond_weight=100%), los 7 fondos del gap tienen
> `low_quality_total_portfolio_estimate == low_quality_bond_bucket`.
> La distinción solo importa para fondos mixtos (allocation, balanced).

---

## G. FE-9 Impact Audit — Los 7 Fondos

| # | ISIN | Nombre | lq_bond | ig | Clasificación | Nota |
|---|------|--------|---------|----|--------------|----|
| 1 | FR0011288513 | Sycomore Sélection Crédit R | 60.0% | 38.2% | **WARNING** | Fondo crossover; warning adecuado |
| 2 | LU0733673288 | Nordea 1 European Cross Credit | 62.1% | 38.0% | **WARNING** | Fondo crossover explícito |
| 3 | LU1951921383 | Allianz Credit Opportunities | 58.0% | 41.4% | **WARNING** | Crossover; ig significativo |
| 4 | LU1623762843 | Carmignac Pf Credit A EUR | 39.1% | 60.9% | **WARNING** | IG dominante; borderline, no block |
| 5 | LU1919971074 | abrdn Frontier Markets Bond | 86.9% | 6.8% | **REVIEW** | Requiere ficha oficial; lq muy alto |
| 6 | LU2002383896 | Allianz Credit Opport. Plus | 83.9% | 15.3% | **REVIEW** | Requiere ficha oficial; lq muy alto |
| 7 | LU0151324935 | Candriam Bonds Credit Opport. | 79.4% | 12.3% | **REVIEW** | Candidato reclasificación subtype HY |

**Perfiles afectados si se aplicara hard block <=4:** [3, 4] en todos los fondos.
**Decisión:** ninguno bloqueado. Warning no bloqueante para todos cuando se implemente.

---

## H. Warning Contract FE-9

### Contrato aprobado

```json
{
  "code":     "FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET",
  "severity": "WARNING",
  "blocking": false,
  "low_quality": 39.1,
  "not_rated":   0.0,
  "scale":   "percent_of_bond_bucket",
  "bond_weight":  100.0,
  "low_quality_total_portfolio_estimate": 39.1,
  "source":  "morningstar_pdf",
  "coverage": 1.0,
  "message_advisor":   "...",
  "message_client":    "...",
  "message_technical": "..."
}
```

### Invariantes del contrato

| Invariante | Regla |
|-----------|-------|
| `blocking` | **Siempre `false`** — sin excepciones posibles |
| `not_rated` | Separado de `low_quality`; nunca sumado |
| `compatible_profiles` | **No se modifica** bajo ninguna circunstancia |
| `scale` | Debe ser `"percent_of_bond_bucket"` explícito |
| `coverage` | `>= 0.8` requerido para emitir warning |
| `source` | Debe estar presente (proveniencia obligatoria) |

### Niveles de severidad

| Rango `low_quality` | Severidad | Código |
|--------------------|----------|--------|
| 25% – <35% | `INFO` | `FI_CREDIT_LOW_QUALITY_OVER_25_BOND_BUCKET` |
| 35% – <70% | `WARNING` | `FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET` |
| ≥ 70% | `REVIEW` | `FI_CREDIT_LOW_QUALITY_OVER_70_BOND_BUCKET` |

> [!IMPORTANT]
> Los umbrales son propuesta técnica. Requieren validación con gestión y compliance
> antes de despliegue en producción.

### Tests de contrato
`functions_python/tests/test_fi_credit_fe9_warning_contract.py`
- 28 tests | 25 PASS + 3 xpassed | EXIT 0

---

## I. Lo que NO Queda Autorizado

El cierre de este ciclo **no autoriza ni implica**:

| Acción | Estado |
|--------|--------|
| Hard block FE-9 para perfil <=4 por `low_quality >= 35%` | ❌ **No autorizado** |
| Modificación de `compatible_profiles` por fi_credit | ❌ **No autorizado** |
| Cambio en `suitability_engine.py` para FE-9 | ❌ **No autorizado** |
| Frontend-only como solución permanente de warnings | ❌ **No recomendado** |
| Regla de exclusión automática por low_quality | ❌ **No autorizado** |
| Rollback de los 130 fondos sin aprobación explícita | ❌ **Requiere aprobación humana** |
| Activación automática de warning sin diseño de runtime | ❌ **Pendiente bloque futuro** |

---

## J. Pendientes Vivos

### Prioritarios

| Pendiente | Descripción | Bloque sugerido |
|-----------|-------------|----------------|
| **Warning runtime** | Implementar `fi_credit_warnings.py` o frontend desde `fi_credit` | `BDB-FI-CREDIT-FE9-WARNING-RUNTIME-DESIGN-0` |
| **Fichas oficiales** | LU1919971074 y LU2002383896 (lq>80%, sin avg_quality) — verificar idoneidad | `BDB-FI-CREDIT-FE9-MANUAL-FACTSHEETS-0` |
| **Revisión subtype** | LU0151324935 (Candriam) — ¿debe ser `HIGH_YIELD_BOND`? Si sí, cubierto por Rule 10 | `BDB-FI-CREDIT-SUBTYPE-REVIEW-0` |

### Arquitecturales

| Pendiente | Descripción | Bloque sugerido |
|-----------|-------------|----------------|
| **Source of truth suitability** | Diseñar la arquitectura de warnings vs bloqueos (suitability_engine vs warnings module) | `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0` |
| **Master status refresh** | Actualizar el informe global de estado del sistema BDB tras este ciclo | `BDB-AUDIT-MASTER-STATUS-REPORT-REFRESH-2026-05-2` |

### Excluidos permanentes (hasta nueva decisión)

| Fondo | Motivo |
|-------|--------|
| **Hamco** | Sin datos históricos suficientes. Excluido desde compatible_profiles regen. No se escribe nada sin ficha. |
| 249 fondos SKIPPED_ZERO_VALUES | Placeholders de Morningstar (CQ = 0 en todos los tramos). Dato no confiable. No se traduce. |
| 291 fondos sin `credit_quality` | Sin dato en `ms.fixed_income.credit_quality`. No hay base para traducción. |

---

## K. Próximos Bloques Recomendados

Orden sugerido por prioridad e impacto:

### 1. `BDB-FI-CREDIT-FE9-WARNING-RUNTIME-DESIGN-0` ⭐
Implementar el módulo backend de warnings:
- `fi_credit_warnings.py` — función `compute_fi_credit_warnings(fund_data) -> list[dict]`.
- Integración con endpoint suitability (respuesta enriquecida, no persistida).
- Tests unitarios reales (no xfail).
- O: implementar warning frontend desde `fi_credit` como solución corto plazo.

### 2. `BDB-FI-CREDIT-FE9-MANUAL-FACTSHEETS-0`
- Solicitar fichas y prospectos de LU1919971074 y LU2002383896.
- Verificar si `average_credit_quality` puede obtenerse de Bloomberg/Morningstar directo.
- Decidir con datos reales si aplica reclasificación o warning REVIEW confirmado.

### 3. `BDB-FI-CREDIT-SUBTYPE-REVIEW-0`
- Auditar LU0151324935 (Candriam Bonds Credit Opportunities).
- Si se confirma que es de facto HIGH_YIELD_BOND: reclasificar → cubierto por Rule 10.
- Auditar también LU1919971074 (abrdn Frontier Markets) — posiblemente EMERGING_MARKETS_BOND.

### 4. `BDB-SUITABILITY-RULES-SOURCE-OF-TRUTH-DESIGN-0`
- Diseñar la arquitectura final: `suitability_engine.py` solo para bloqueos.
- Capa separada `suitability_warnings.py` para avisos informativos.
- Frontend consume ambas capas, no implementa lógica.

### 5. `BDB-AUDIT-MASTER-STATUS-REPORT-REFRESH-2026-05-2`
- Actualizar foto global del sistema suitability BDB:
  - `fi_credit` poblado.
  - compatible_profiles saneados.
  - commodities clasificados.
  - FE-9 estado: diseñado, no activado.
  - Pendientes vivos listados.

---

## L. Confirmaciones Finales

### Este bloque (closeout)

| Restricción | Estado |
|-------------|--------|
| Firestore writes | ✅ NO |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| BDB-FONDOS-CORE | ✅ NO |
| `suitability_engine.py` | ✅ NO |
| `firestore.rules` | ✅ NO |
| `optimizer_core.py` | ✅ NO |
| Frontend runtime | ✅ NO |
| FE-9 activada | ✅ NO |
| `compatible_profiles` modificado | ✅ NO |
| `migrate_suitability_v2.py` ejecutado | ✅ NO |

### Ciclo completo (8 bloques)

| Restricción | Estado en el ciclo |
|-------------|-------------------|
| Firestore writes totales | **130** — solo campo `portfolio_exposure_v2.fi_credit` |
| Deploy | **0** |
| `suitability_engine.py` | **No modificado** |
| `compatible_profiles` | **0 fondos modificados** |
| FE-9 activada | **No** |
| BDB-FONDOS-CORE | **No tocado** |
| Rollback disponible | **SÍ** — `DELETE_FIELD` x130 (`rollback_manifest.json`) |

### Tests finales (al cierre del ciclo)
```
110 PASS + 5 xfailed + 32 xpassed — EXIT 0
```
Suite: `test_fi_credit_data_model_contract.py` + `test_suitability_contract_parity.py`
      + `test_suitability_v2.py` + `test_fi_credit_fe9_warning_contract.py`

---

*Documento maestro de cierre del ciclo FI credit / FE-9. BDB-FONDOS legacy.*
*Generado: 2026-05-11 | HEAD: `1c23475`*
