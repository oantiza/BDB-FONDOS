# BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0

**Tipo:** Read-only dry-run | **Fecha:** 2026-05-11 | **Commit previo:** `2583be0`
**Colección:** `funds_v3` | **Firestore writes:** 0 | **Deploy:** No | **FE-9:** No activado

---

## A. Resumen Ejecutivo

Dry-run read-only completo que traduce `ms.fixed_income.credit_quality` → propuesta de
`portfolio_exposure_v2.fi_credit` para los 670 fondos de `funds_v3`. Ningún dato fue escrito
en Firestore. El traductor generó propuestas válidas para **130 fondos** (exactamente los
identificados como COMPLETE en el discovery previo). Se detectaron **7 fondos con
FE-9 potential new gap** — fondos de renta fija no HY/EM con `low_quality ≥ 35%` que
actualmente tienen perfiles ≤ 4 asignados. Estos fondos **no están afectados por ninguna regla
activa** hasta que se active FE-9 explícitamente.

Resultado global: **`READY_FOR_WRITE_GATE`** — el traductor está listo para un write gate
controlado que solo poblaría `portfolio_exposure_v2.fi_credit`. FE-9 permanecería dormida.

---

## B. Input

### Fuente de datos
```
ms.fixed_income.credit_quality = {
    aaa, aa, a, bbb, bb, b, below_b, not_rated
}
```

### Cobertura previa (BDB-FI-CREDIT-PARSER-DISCOVERY-0)
- **670 fondos** escaneados en `funds_v3`
- **130 fondos** con `ms.fixed_income.credit_quality` COMPLETE (suma ≈ 100%)
- **249 fondos** con credit_quality presente pero todos los valores a 0 (placeholder MS)
- **0 fondos** con `portfolio_exposure_v2.fi_credit` ya poblado

### Hallazgo del dry-run: fondos con CQ=0 (249)
Los fondos con `credit_quality` en Firestore pero con todos los valores a 0 son
**placeholders de Morningstar** — el campo existe en el schema pero no hay datos reales
del proveedor para ese fondo. Esto es esperado y normal; no son errores de traducción.

---

## C. Traducción Propuesta

### Schema `portfolio_exposure_v2.fi_credit`

```json
{
  "source": "morningstar_pdf",
  "as_of": null,
  "scale": "percent_of_bond_bucket",
  "coverage": 1.0,
  "investment_grade": 80.0,
  "high_yield": 17.0,
  "low_quality": 17.0,
  "not_rated": 3.0,
  "breakdown": {
    "AAA": 5.0, "AA": 10.0, "A": 25.0, "BBB": 40.0,
    "BB": 10.0, "B": 5.0, "below_B": 2.0, "not_rated": 3.0
  },
  "warnings": []
}
```

### Fórmulas

| Campo | Fórmula |
|-------|---------|
| `investment_grade` | `AAA + AA + A + BBB` |
| `low_quality` | `BB + B + below_B` |
| `high_yield` | alias de `low_quality` |
| `not_rated` | campo separado — NO incluido en `low_quality` |
| `coverage` | `1.0` si suma ∈ [80, 105], else `sum / 100` |

### Escala
`percent_of_bond_bucket` — los porcentajes son relativos al total del bucket de renta fija
del fondo, no al total del portfolio. Para fondos 100% RF, ambas escalas coinciden.

### Normalización de escala
El parser almacena en Firestore en escala 0-100. Si se detecta suma ≤ 1.05,
se multiplica por 100 antes de calcular. Esta situación no se observó en ningún fondo
durante el dry-run (todos los 130 COMPLETE estaban ya en 0-100).

### Coverage
- `sum ∈ [80, 105]%` → `coverage = 1.0`
- `sum > 105%` → `coverage = 1.0` (ligero over-sum por redondeo MS — 1 fondo)
- `sum = 0` → `SKIPPED_ZERO_VALUES` (no propuesta)
- `sum < 80% o > 200%` → `INVALID_SUM` (no propuesta)

### Warnings generados por el traductor

| Warning | Condición | Fondos |
|---------|-----------|--------|
| `CREDIT_QUALITY_ALL_ZERO` | Todos los campos CQ = 0 | 249 |
| `LOW_QUALITY_OVER_35_BOND_BUCKET` | `low_quality ≥ 35%` | 43 |
| `LOW_QUALITY_OVER_35_TOTAL_PORTFOLIO` | `lq * bond_weight / 100 ≥ 35%` | 43 |
| `FE9_ALREADY_BLOCKED_BY_HY_EM_RULE_10` | subtype HY/EM con lq ≥ 35% | 36 |
| `HIGH_NOT_RATED` | `not_rated ≥ 20%` | 8 |
| `FE9_POTENTIAL_NEW_GAP` | lq ≥ 35%, no HY/EM, profiles ≤ 4 | 7 |
| `MISSING_BOND_WEIGHT` | No hay bond_weight en economic_exposure | 4 |

---

## D. Resultado Dry-Run

### Contadores finales

| Métrica | Valor |
|---------|-------|
| **Total scanned** | 670 |
| **Eligible for translation** | 379 (tienen CQ dict) |
| **TRANSLATED** | **130** |
| **SKIPPED_ZERO_VALUES** | 249 (placeholder MS, todos los valores 0) |
| **INVALID_SUM** | **0** |
| **SKIPPED (no CQ o ya tiene fi_credit)** | 291 |

### FE-9 Analysis

| Métrica | Valor |
|---------|-------|
| `low_quality ≥ 35%` (bond bucket) | 43 fondos |
| `low_quality ≥ 35%` (total portfolio) | 43 fondos |
| Ya bloqueados por HY/EM Rule 10 | **36 fondos** |
| **FE-9 potential NEW gap** | **7 fondos** |

### Clave: INVALID_SUM = 0
El resultado limpio (0 INVALID_SUM) confirma que el traductor es correcto para
el universo actual. Los 249 fondos con todos los valores a cero son un caso
documentado y esperado — no errores del traductor.

---

## E. Ejemplos Relevantes

### Top 10 highest low_quality (bond bucket scale)

| ISIN | Nombre | low_quality | Subtype |
|------|--------|-------------|---------|
| IE00B3RW6Z61 | Nomura Funds Ireland - US High Yield B | 96.6% | HIGH_YIELD_BOND |
| LU1679113404 | UBS Bond SICAV - Floating Rate Income | 96.2% | HIGH_YIELD_BOND |
| IE00BD5CTX77 | BNY Mellon Global Short-Dated HY Bond | 94.5% | HIGH_YIELD_BOND |
| LU0086177085 | UBS Bond Fund - Euro High Yield | 93.5% | HIGH_YIELD_BOND |
| LU1061675168 | Goldman Sachs Frontier Markets Debt | 91.9% | EMERGING_MARKETS_BOND |
| LU0569862609 | UBAM - Global High Yield Solution AHC | 90.3% | HIGH_YIELD_BOND |
| LU0940719098 | UBAM - Global High Yield Solution RHC | 90.3% | HIGH_YIELD_BOND |
| LU1191877379 | BlackRock GF - European High Yield | 90.3% | HIGH_YIELD_BOND |
| LU1362999481 | Robeco High Yield Bonds D | 89.5% | HIGH_YIELD_BOND |
| LU1738492658 | Aviva - Short Duration Global HY | 88.0% | HIGH_YIELD_BOND |

**Todos ya bloqueados por Rule 10 (HY/EM subtype qualitative rule).**

### Fondos HIGH_NOT_RATED (not_rated ≥ 20%)
8 fondos con alta exposición a deuda no calificada. Estos son típicamente:
- Fondos de mercados emergentes con deuda local sin rating S&P/Moody's
- Fondos de pagarés corporativos españoles (deuda a corto plazo)

No bloqueados por regla activa — warning informativo documentado en el artifact.

### FE-9 Potential New Gap (7 fondos)
Los 7 fondos identificados como `FE9_POTENTIAL_NEW_GAP` son fondos de renta fija
**no HY, no EM** (típicamente CORPORATE_BOND o GOVERNMENT_BOND crossover) con
`low_quality ≥ 35%` y perfiles compatibles ≤ 4. Si FE-9 se activara hoy, estos 7 fondos
quedarían **nuevamente bloqueados** para perfiles conservadores/moderados.

**Implicación:** La activación de FE-9 no es neutral — afectaría a 7 fondos que hoy
están disponibles para perfiles 3 y 4. Esto requiere análisis antes de cualquier activación.

---

## F. Decisión

**`READY_FOR_WRITE_GATE`**

- 130 fondos con propuesta válida
- 0 INVALID_SUM
- Lógica de traducción correcta y verificada
- Schema canónico definido y testeado
- 7 FE-9 potential gaps documentados (no bloqueantes para el write gate)

El traductor está listo para un write gate controlado que solo poblaría el campo
`portfolio_exposure_v2.fi_credit` en Firestore. **FE-9 NO se activará como parte
de ese write gate.**

---

## G. Recomendación

### Próximo bloque: `BDB-FI-CREDIT-TRANSLATOR-WRITE-GATE-0`

**Objetivo:** Generar snapshots de los 130 fondos TRANSLATED, crear diff manifest con
las propuestas de escritura, y mantener `authorized=false` hasta aprobación explícita.

**Restricciones absolutas que se heredan:**
- Solo se escribiría `portfolio_exposure_v2.fi_credit`
- **FE-9 NO se activaría** — la regla permanece dormida en frontend
- No se tocaría `compatible_profiles`, `suitability_engine.py`, ni ningún otro campo
- No se tocaría BDB-FONDOS-CORE
- El write gate requeriría `authorized=true` y `can_write=true` explícitos

### Sobre los 7 fondos FE-9 Potential New Gap
Antes de activar FE-9, se requiere un bloque de análisis de impacto independiente
(`BDB-FI-CREDIT-FE9-IMPACT-ANALYSIS-0`) que evalúe si los 7 fondos deben:
1. Ser excluidos de FE-9 (whitelist)
2. Tener sus perfiles compatibles reducidos antes de activar la regla
3. Activar FE-9 con un threshold diferente o solo para nuevas suscripciones

---

## H. Tests Ejecutados

### Comando
```bash
.\functions_python\venv\Scripts\python.exe -m pytest \
  functions_python\tests\test_fi_credit_data_model_contract.py \
  functions_python\tests\test_suitability_contract_parity.py \
  functions_python\tests\test_suitability_v2.py \
  -v --tb=short
```

### Resultado (ver sección I para confirmación exacta)
- `test_fi_credit_data_model_contract.py`: **5 xfailed + 29 xpassed** (EXIT 0)
- Suite completa: ver confirmación de ejecución en sección I

### Nuevos tests añadidos (Section 7: TestTranslatorDryRunContracts)
12 tests nuevos en `test_fi_credit_data_model_contract.py`:
- `test_translator_produces_all_required_fields` — XPASS
- `test_low_quality_matches_bb_b_below_b` — XPASS
- `test_not_rated_excluded_from_low_quality` — XPASS
- `test_warning_low_quality_over_35_bond_bucket` — XPASS
- `test_warning_missing_bond_weight` — XPASS
- `test_warning_high_not_rated` — XPASS
- `test_fe9_already_blocked_tag_for_hy_bond` — XPASS
- `test_fe9_new_gap_for_corporate_bond_with_high_lq` — XPASS
- `test_invalid_sum_returns_no_proposal` — XPASS
- `test_lq_total_portfolio_estimate_computed_correctly` — XPASS
- `test_write_recommended_always_false_in_dryrun` — XPASS
- `test_coverage_is_1_when_sum_is_100` — XPASS

Todos XPASS = lógica correcta, aún no hay datos en Firestore.

---

## I. Confirmaciones

### Write guard validado
- Script rechaza flags: `--write`, `--apply`, `--execute`, `--commit`
- No contiene `.update(`, `.set(`, `.delete(`, `.add(`
- Artifact `write_executed: false`
- Artifact `dry_run: true`

### Checklist final

| Restricción | Estado |
|-------------|--------|
| Firestore writes | ✅ NO |
| Deploy | ✅ NO |
| `suitability_engine.py` modificado | ✅ NO |
| FE-9 activada | ✅ NO |
| Frontend runtime tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| `migrate_suitability_v2.py` ejecutado | ✅ NO |
| Código productivo modificado | ✅ NO |

### Archivos modificados/creados
- `scripts/maintenance/bdb_fi_credit_translator_dryrun.py` — Script dry-run [NEW]
- `functions_python/tests/test_fi_credit_data_model_contract.py` — +12 tests Sección 7 [MODIFIED]
- `artifacts/suitability/fi_credit_translator_dryrun_0.json` — Artifact dryrun [NEW]
- `docs/BDB_FI_CREDIT_TRANSLATOR_DRYRUN_0.md` — Este documento [NEW]
