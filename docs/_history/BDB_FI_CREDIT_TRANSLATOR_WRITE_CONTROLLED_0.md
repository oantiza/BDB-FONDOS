# BDB-FI-CREDIT-TRANSLATOR-WRITE-CONTROLLED-0

**Tipo:** Write controlado | **Fecha:** 2026-05-11 | **Gate previo:** `a4823a4`
**Colección:** `funds_v3` | **FE-9:** No activada | **Deploy:** No

---

## A. Resumen Ejecutivo

Write controlado **ejecutado y verificado con éxito**. Se pobló el campo
`portfolio_exposure_v2.fi_credit` en exactamente **130 fondos** usando los datos de
`ms.fixed_income.credit_quality` traducidos por el schema canónico diseñado en
`BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0`.

| Métrica | Valor |
|---------|-------|
| **Write ejecutado** | **SÍ** |
| Total seleccionados | 130 |
| Total escritos | **130** |
| Total verificados | **130** |
| **PASS** | **130** ✅ |
| **FAIL** | **0** ✅ |
| FE-9 activada | NO |
| `compatible_profiles` modificado | NO |
| `suitability_engine.py` modificado | NO |
| Deploy ejecutado | NO |
| BDB-FONDOS-CORE tocado | NO |

**Post-verification:** 130/130 PASS — el campo escrito coincide exactamente con
la propuesta del gate. Los campos prohibidos permanecen intactos en todos los fondos.

**Dry-run post-write:** Los 130 fondos ahora caen en SKIPPED (`already has fi_credit`).
`TRANSLATED: 0` — confirma que el campo está poblado en Firestore. `INVALID_SUM: 0`.

---

## B. Tabla de Writes

### Resumen

| Métrica | Valor |
|---------|-------|
| `total_written` | 130 |
| `pass_count` | 130 |
| `fail_count` | 0 |
| `drift_count` | 0 |
| `forbidden_fields_changed_count` | 0 |

Artifact completo: `artifacts/suitability/fi_credit_translator_write_gate_0/post_write_verification.json`

### Top 5 — Highest `low_quality` (bond bucket scale)

| ISIN | `low_quality` | Nombre |
|------|-------------|--------|
| IE00B3RW6Z61 | **96.61%** | Nomura Funds Ireland - US High Yield Bond |
| LU1679113404 | **96.18%** | UBS Bond SICAV - Floating Rate Income |
| IE00BD5CTX77 | **94.46%** | BNY Mellon Global Short-Dated High Yield |
| LU0086177085 | **93.51%** | UBS Bond Fund - Euro High Yield |
| LU1061675168 | **91.86%** | Goldman Sachs Frontier Markets Debt |

*Todos fondos HIGH_YIELD_BOND o EMERGING_MARKETS_BOND — ya bloqueados por Rule 10.*

### Top 5 — Highest `not_rated`

| ISIN | `not_rated` | Nombre |
|------|------------|--------|
| LU2098772366 | **67.96%** | Candriam Bonds Credit Alpha C EUR |
| ES0127795005 | **53.75%** | EDM Renta R FI |
| FI0008811997 | **48.26%** | Evli Nordic Corporate Bond B |
| FI0008804463 | **37.20%** | Evli Euro Liquidity B |
| ES0160873008 | **30.15%** | March Pagarés A FI |

*Fondos con alta deuda no calificada por S&P/Moody's (deuda local, pagarés, mercados nórdicos).*
*`not_rated` está separado de `low_quality` — no suma a HY ni a IG.*

---

## C. Campo Actualizado

**Exactamente UN campo por documento fue actualizado:**

```
portfolio_exposure_v2.fi_credit
```

Usando dotted-path update (Firestore merge implícito):
```python
doc_ref.update({"portfolio_exposure_v2.fi_credit": proposed})
```

Esto preserva todos los demás sub-campos de `portfolio_exposure_v2` intactos
(`economic_exposure`, `exposure_confidence`, `warnings`, etc.).

### Estructura del campo escrito

```json
{
  "source": "morningstar_pdf",
  "as_of": null,
  "scale": "percent_of_bond_bucket",
  "coverage": 1.0,
  "investment_grade": <AAA+AA+A+BBB>,
  "high_yield": <BB+B+below_B>,
  "low_quality": <BB+B+below_B>,
  "not_rated": <not_rated separado>,
  "breakdown": {
    "AAA": ..., "AA": ..., "A": ..., "BBB": ...,
    "BB": ..., "B": ..., "below_B": ..., "not_rated": ...
  },
  "warnings": []
}
```

---

## D. Campos Prohibidos Intactos

Verificado en post-write read-back para cada uno de los 130 fondos:

| Campo | Estado |
|-------|--------|
| `classification_v2` | ✅ Intacto |
| `classification_v2.compatible_profiles` | ✅ Intacto |
| `portfolio_exposure_v2.economic_exposure` | ✅ Intacto |
| `portfolio_exposure_v2.exposure_confidence` | ✅ Intacto |
| `portfolio_exposure_v2.warnings` | ✅ Intacto |
| `ms` | ✅ Intacto (solo lectura usada para calcular fi_credit) |
| `manual` | ✅ No tocado |
| `derived` | ✅ No tocado |
| `std_perf` | ✅ No tocado |
| `optimizer` | ✅ No tocado |

`forbidden_fields_changed_count: 0` en el artifact de verificación.

---

## E. FE-9

La regla FE-9 (`lowQualityCredit >= 35%`) **NO está activada** y no se modificó en
este bloque. El write de `portfolio_exposure_v2.fi_credit` **solo puebla datos** —
no añade ninguna regla de bloqueo en `suitability_engine.py`.

| Métrica FE-9 del dry-run previo | Valor |
|--------------------------------|-------|
| Fondos con `low_quality >= 35%` | 43 |
| Ya bloqueados por HY/EM Rule 10 | 36 |
| FE-9 potential new gap | **7** |

Los 7 fondos con `FE9_POTENTIAL_NEW_GAP` quedan documentados para un bloque futuro.
Su suitability y `compatible_profiles` **no se han modificado**.

> [!IMPORTANT]
> Si en el futuro se activa FE-9, debe crearse un bloque independiente
> (`BDB-FI-CREDIT-FE9-ACTIVATE-0`) con análisis de impacto sobre los 7 fondos
> con potential gap antes de cualquier write en `suitability_engine.py`.

---

## F. Rollback

**Rollback disponible:** `artifacts/suitability/fi_credit_translator_write_gate_0/rollback_manifest.json`

- **`rollback_count:`** 130
- **`rollback_action` para todos:** `DELETE_FIELD`
  — el campo `portfolio_exposure_v2.fi_credit` no existía en ningún fondo antes del write.

Para hacer rollback de un fondo concreto:
```python
from google.cloud.firestore_v1 import DELETE_FIELD
doc_ref.update({"portfolio_exposure_v2.fi_credit": DELETE_FIELD})
```

> [!WARNING]
> El rollback **NO debe ejecutarse automáticamente**. Requiere instrucción
> explícita de un aprobador humano. El post-write verification confirma 130/130 PASS
> — no hay causa de rollback actualmente.

---

## G. Tests Ejecutados

### Comando
```bash
.\functions_python\venv\Scripts\python.exe -m pytest \
  functions_python\tests\test_fi_credit_data_model_contract.py \
  functions_python\tests\test_suitability_contract_parity.py \
  functions_python\tests\test_suitability_v2.py \
  -v --tb=short
```

### Resultado
**85 PASS + 5 xfailed + 29 xpassed — EXIT 0** ✅

Sin regresiones. La suite completa pasa sin cambios frente al gate previo.

---

## H. Dry-Run Post-Write

### Resultado
```
Total scanned:                   670
Eligible for translation:        249
TRANSLATED:                      0        ← 130 fondos ahora SKIPPED (ya tienen fi_credit)
SKIPPED_ZERO_VALUES (all CQ=0):  249
INVALID_SUM (bad sum range):     0
SKIPPED (no CQ / already has):  421      ← 291 sin CQ + 130 con fi_credit ya poblado

FE-9 ANALYSIS:
  low_quality >= 35% (bond bucket): 0    ← No TRANSLATED => no análisis posible
  FE-9 potential NEW gap:           0
```

### Interpretación
- `TRANSLATED: 0` — **confirma** que los 130 fondos ya tienen `fi_credit` en Firestore.
  El dry-run los salta correctamente con la lógica `already has fi_credit`.
- `INVALID_SUM: 0` — sin errores de validación.
- `RECOMMENDATION: NEEDS_PARSER_COVERAGE` — el dry-run detecta correctamente que
  no hay más fondos traducibles sin datos de CQ.

El artifact del dry-run post-write fue sobreescrito (`fi_credit_translator_dryrun_0.json`).
El backup pre-write está en `fi_credit_translator_dryrun_0_PRE_WRITE.json`.

---

## I. Confirmaciones

| Restricción | Estado |
|-------------|--------|
| Firestore write limitado a `portfolio_exposure_v2.fi_credit` | ✅ SÍ |
| Otros campos no modificados | ✅ Verificado en 130 fondos |
| Deploy | ✅ NO |
| `suitability_engine.py` modificado | ✅ NO |
| FE-9 activada | ✅ NO |
| Frontend runtime tocado | ✅ NO |
| BDB-FONDOS-CORE tocado | ✅ NO |
| `firestore.rules` tocado | ✅ NO |
| `optimizer_core.py` tocado | ✅ NO |
| `migrate_suitability_v2.py` ejecutado | ✅ NO |
| `compatible_profiles` modificado | ✅ NO |
| `classification_v2` modificado | ✅ NO |
| Rollback disponible | ✅ SÍ — DELETE_FIELD x130 |
| Post-write verification | ✅ 130/130 PASS |
| Dry-run post-write | ✅ TRANSLATED=0 (fondos skippeados correctamente) |

### Archivos creados/modificados
- `scripts/maintenance/bdb_fi_credit_translator_write_controlled_0.py` — Write script [NEW]
- `artifacts/suitability/fi_credit_translator_write_gate_0/write_approval_manifest.json` — `authorized=true` [MODIFIED]
- `artifacts/suitability/fi_credit_translator_write_gate_0/post_write_verification.json` — 130/130 PASS [NEW]
- `artifacts/suitability/fi_credit_translator_dryrun_0.json` — Post-write dryrun [OVERWRITTEN]
- `artifacts/suitability/fi_credit_translator_dryrun_0_PRE_WRITE.json` — Backup pre-write [NEW]
- `docs/BDB_FI_CREDIT_TRANSLATOR_WRITE_CONTROLLED_0.md` — Este documento [NEW]

### Estado del campo en Firestore
`portfolio_exposure_v2.fi_credit` ahora poblado en **130 fondos** de `funds_v3`.
Los 540 fondos restantes (249 zero-placeholder + 291 sin CQ) no tienen el campo.
