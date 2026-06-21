# BDB-FI-CREDIT-PARSER-DISCOVERY-0

**Fecha**: 2026-05-11  
**Proyecto**: `C:\Users\oanti\Documents\BDB-FONDOS` (legacy)  
**Modo**: AUDITORÍA READ-ONLY — 0 writes, 0 deploy, 0 cambios productivos  
**BDB-FONDOS-CORE**: NO tocado  

---

## A. Resumen Ejecutivo

La auditoría live contra `funds_v3` (670 fondos) confirma que **130 fondos tienen `ms.fixed_income.credit_quality` con datos cuantitativos completos** (suma ≥ 80%) directamente en Firestore, provenientes del parser Morningstar. La cobertura es del **19.4% del total**, concentrada al 100% en fondos de renta fija (`FIXED_INCOME`) y monetarios (`MONETARY`/`MONEY_MARKET`).

El dato clave para la decisión: **los 43 fondos con `low_quality >= 35%` (potencial FE-9) son todos `HIGH_YIELD_BOND` o `EMERGING_MARKETS_BOND`** — categorías que ya están bloqueadas para perfiles ≤ 4 por reglas cualitativas previas (Rule 10: subtype block). El gap neto real de FE-9 sería **cero fondos** en el universo de datos actualmente disponible.

**Recomendación: `IMPLEMENT_TRANSLATOR_DRYRUN_NEXT`**

La cobertura cuantitativa es suficiente (130 fondos completos) para justificar implementar el traductor `_build_fi_credit_exposure()` en un dry-run controlado. Esto permitirá poblar `portfolio_exposure_v2.fi_credit` sin necesidad de re-parsear PDFs y validará el esquema antes de cualquier write.

| Dimensión | Resultado |
|-----------|-----------|
| Script de auditoría | ✅ Ejecutado — read-only |
| Fondos escaneados | **670** |
| Con `ms.fixed_income.credit_quality` | **130 / 670 (19.4%)** |
| Todos COMPLETE (suma ≥ 80%) | **130 / 130 (100%)** |
| PARTIAL o INVALID | **0** |
| Con `portfolio_exposure_v2.fi_credit` | **0 / 670** |
| FE-9 potencial (bond bucket) | **43** (todos HY/EM, ya bloqueados) |
| FE-9 gap neto (fondos no bloqueados por otras reglas) | **~0** |
| Firestore writes | ✅ CERO |
| Deploy | ✅ NO |
| Código productivo modificado | ✅ NO |
| Tests | ✅ **85 PASS + 17 xpassed + 5 xfailed** |

---

## B. Estado Actual

### B.1 — Lo que ya existe en el parser (S3: `populate_taxonomy_v2.py`)

```python
# línea 959
qual = _safe_dict(ms_fi.get("credit_quality"))
if qual:
    high = _safe_float(qual.get("aaa")) + _safe_float(qual.get("aa")) + _safe_float(qual.get("a"))
    med  = _safe_float(qual.get("bbb"))
    low  = _safe_float(qual.get("bb")) + _safe_float(qual.get("b")) + _safe_float(qual.get("below_b"))
    # → produce FICreditBucketV2 (categórico: HIGH/MEDIUM/LOW_QUALITY)
```

El parser **ya lee** `ms.fixed_income.credit_quality` con las 8 claves `{aaa, aa, a, bbb, bb, b, below_b, not_rated}` y las suma para producir el bucket categórico `classification_v2.fi_credit_bucket`. **No escribe el desglose cuantitativo** a `portfolio_exposure_v2.fi_credit`.

### B.2 — Lo que falta (el gap)

| Campo | Estado |
|-------|--------|
| `ms.fixed_income.credit_quality` (fuente) | ✅ Existe en 130/670 fondos |
| `classification_v2.fi_credit_bucket` (categórico) | ✅ Existe (deducido + heurístico) |
| `portfolio_exposure_v2.fi_credit` (cuantitativo) | ❌ No existe en **ningún** fondo |
| Traductor `_build_fi_credit_exposure()` | ❌ No implementado en S3 |

### B.3 — FE-9 continúa no activable

El campo `portfolio_exposure_v2.fi_credit.low_quality` sigue ausente en 670/670 fondos. La regla FE-9 (`lowQualityCredit >= 35` → block perfiles ≤ 4) continúa dormida en el frontend. **No se debe activar en el backend** hasta que el campo exista y sea validado.

---

## C. Cobertura en Firestore

### C.1 — Distribución por estado

| Estado | Fondos | % del total |
|--------|--------|-------------|
| `HAS_COMPLETE_CREDIT_QUALITY` | 130 | 19.4% |
| `HAS_PARTIAL_CREDIT_QUALITY` | 0 | 0.0% |
| `INVALID_CREDIT_QUALITY_SUM` | 0 | 0.0% |
| `HAS_FI_CREDIT_ALREADY` | 0 | 0.0% |
| `HAS_BUCKET_ONLY` (solo categórico) | 37 | 5.5% |
| `MISSING_CREDIT_QUALITY` | 503 | 75.1% |
| **Total** | **670** | **100%** |

### C.2 — Cobertura por clase de activo

| Clase | Fondos con credit_quality | Completos | Parciales |
|-------|--------------------------|-----------|-----------|
| `FIXED_INCOME` | 125 | 125 | 0 |
| `MONETARY` | 4 | 4 | 0 |
| `MONEY_MARKET` | 1 | 1 | 0 |
| `EQUITY` | 0 | — | — |
| `MIXED` | 0 | — | — |
| `ALTERNATIVE` | 0 | — | — |

**Observación crítica**: Los datos de `ms.fixed_income.credit_quality` están presentes **exclusivamente** en fondos RF y monetarios. Ningún fondo de equity, mixto o alternativo tiene este campo en Firestore, lo que confirma que el parser solo lo captura cuando Morningstar lo reporta (fondos con posición bond dominante).

### C.3 — Calidad del dato

- **Suma promedio** de los 130 fondos: ≥ 80% en todos los casos (criterio COMPLETE)  
- **0 fondos** con suma inválida (> 200%) — no hay problema de escala doble  
- **0 fondos** con suma parcial (10-80%) — el dato es o completo o ausente, nunca a medias  
- **Average `low_quality`** de los 130 fondos completos: **28.68%**

---

## D. Calidad de Datos — Análisis Detallado

### D.1 — Distribución del campo `not_rated`

El campo `not_rated` está incluido en el breakdown y no se suma a `low_quality` por defecto (en línea con el contrato documentado en `test_fi_credit_data_model_contract.py`). Esto es correcto: algunos fondos pueden tener high `not_rated` sin que eso implique baja calidad crediticia.

### D.2 — Coherencia del dato

Los datos son internamente coherentes: ningún fondo tiene suma > 200% (que indicaría problema de escala doble), y el parser ya maneja la normalización en `_deduce_fixed_income_credit()`. La calidad del dato de Morningstar en esta dimensión es **alta**.

### D.3 — Fondos con bucket categórico sin cuantitativo

37 fondos tienen `classification_v2.fi_credit_bucket` pero **no** `ms.fixed_income.credit_quality`. Esto es esperable: el bucket se puede deducir por heurística de texto (nombre del fondo, categoría legacy) sin necesidad de datos cuantitativos de Morningstar.

---

## E. Impacto Potencial FE-9

### E.1 — Fondos con `low_quality >= 35%` (escala bond bucket)

**43 fondos** superan el umbral del 35% en la escala del bucket RF:

| Posición | ISIN | Nombre (truncado) | low_quality | Subtype |
|----------|------|-------------------|-------------|---------|
| 1 | IE00B3RW6Z61 | Nomura US High Yield Bond | 96.6% | HIGH_YIELD_BOND |
| 2 | LU1679113404 | UBS Floating Rate Income | 96.2% | HIGH_YIELD_BOND |
| 3 | IE00BD5CTX77 | BNY Mellon Short-Dated HY Bond | 94.5% | HIGH_YIELD_BOND |
| 4 | LU0086177085 | UBS Euro High Yield | 93.5% | HIGH_YIELD_BOND |
| 5 | LU1061675168 | Goldman Sachs Frontier Markets Debt | 91.9% | EMERGING_MARKETS_BOND |
| ... | ... | ... | ... | HIGH_YIELD_BOND / EMERGING_MARKETS_BOND |

### E.2 — Gap neto real de FE-9

> [!IMPORTANT]
> **Los 43 fondos con `low_quality >= 35%` son TODOS `HIGH_YIELD_BOND` o `EMERGING_MARKETS_BOND`.**  
> Ambos subtypes ya están bloqueados para perfiles ≤ 4 por **Rule 10** (subtype hard block) en frontend y backend.  
> El gap neto de FE-9 sobre los fondos con datos cuantitativos disponibles es **aproximadamente cero**.

Esto significa que implementar FE-9 como hard block en el backend (o activarla en el frontend) con los datos actuales no produciría ningún cambio observable en el comportamiento de suitability. La regla sería **redundante** para el universo de fondos donde hoy existe el dato.

### E.3 — Fondos CORPORATE_BOND con `low_quality` significativa

Los fondos `CORPORATE_BOND` con datos cuantitativos en el rango 20-34% (sub-umbral FE-9 pero significativo) son los más interesantes para monitoreo futuro. Si el parser procesa más PDFs de fondos corporativos flexibles o crossover, podría aparecer el primer fondo que active FE-9 sin ser HY/EM.

### E.4 — Fondos mixtos — ausencia total de datos

**0 fondos mixtos** tienen `ms.fixed_income.credit_quality`. El problema del denominador (escala bond_bucket vs total_portfolio) documentado en los tests de contrato es **teórico** para el universo actual: no hay datos en esta clase de activo.

> [!WARNING]
> **No activar FE-9 como hard block en el backend hasta que:**  
> 1. El campo `portfolio_exposure_v2.fi_credit` esté poblado en producción  
> 2. Se confirme que existe al menos 1 fondo `CORPORATE_BOND` (no HY/EM) con `low_quality >= 35%`  
> 3. Se valide el impacto sobre `compatible_profiles` con datos reales

---

## F. Recomendación

### **`IMPLEMENT_TRANSLATOR_DRYRUN_NEXT`**

**Justificación:**

1. **Cobertura suficiente**: 130 fondos con datos COMPLETE es suficiente para un primer dry-run del traductor. La calidad del dato es alta (0 partial, 0 invalid).

2. **Pipeline limpio**: El gap de implementación es exactamente uno — la función `_build_fi_credit_exposure()` en `populate_taxonomy_v2.py`. El rest del pipeline (parser, `utils.py`, `get_v2_group_map`) ya está preparado.

3. **Sin riesgo de falsos positivos en FE-9**: Como todos los candidatos actuales son HY/EM, implementar el traductor y poblar `fi_credit` **no cambiará ningún resultado de suitability** hasta que el parser procese más fondos corporativos crossover.

4. **Valor informativo**: Tener `portfolio_exposure_v2.fi_credit` poblado permitirá que el frontend muestre la distribución de calidad crediticia en la UI (futura mejora UX), independientemente de FE-9.

5. **Siguiente bloque natural**: `BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0` — implementar y probar `_build_fi_credit_exposure()` en dry-run sobre los 130 fondos con datos.

---

## G. Próximo Bloque Propuesto

### `BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0`

**Objetivo**: Implementar `_build_fi_credit_exposure()` en `populate_taxonomy_v2.py` y ejecutar un dry-run que simule qué se escribiría en `portfolio_exposure_v2.fi_credit` para los 130 fondos con datos.

**Pre-requisitos confirmados** (todos ✅):
- `ms.fixed_income.credit_quality` existe con buena calidad en 130 fondos
- `utils.py` ya lee `portfolio_exposure_v2.credit` y `fi_credit` (línea 393)
- `test_fi_credit_data_model_contract.py` define el contrato de esquema
- Schema propuesto documentado en `docs/BDB_SUITABILITY_FI_CREDIT_DATA_MODEL_0.md`

**Pasos esperados**:
1. Añadir `_build_fi_credit_exposure()` a `populate_taxonomy_v2.py`
2. Integrarlo en el flujo de generación del payload (solo cuando `ms.fixed_income.credit_quality` exista)
3. Dry-run sobre los 130 fondos → artifact con diff propuesto
4. Verificar que ningún CORPORATE_BOND (no HY) con `low_quality >= 35%` existe actualmente
5. Gate + write controlado (protocolo estándar)

**Reglas absolutas**:
- Primer dry-run: 0 writes
- Primer write gate: ≤ 10 fondos
- No activar FE-9 en backend (regla separada, bloque distinto)

---

## H. Tests Ejecutados

```powershell
.\functions_python\venv\Scripts\python.exe -m pytest `
  functions_python\tests\test_fi_credit_data_model_contract.py `
  functions_python\tests\test_suitability_contract_parity.py `
  functions_python\tests\test_suitability_v2.py `
  -v --tb=short
```

```
================== 85 passed, 5 xfailed, 17 xpassed in 0.20s ==================
EXIT:0
```

Detalle:
- **85 PASS** — tests de parity, baseline suitability V2
- **17 xpassed** — lógica de referencia de `fi_credit` correcta (mock helpers)
- **5 xfailed** — tests de guardrail (pop source/as_of/scale, coverage=0, breakdown>100) confirman que la validación futura es necesaria

---

## I. Confirmaciones de Seguridad

| Confirmación | Estado |
|--------------|--------|
| Firestore writes | ✅ **CERO** |
| `write_executed` en artifact | ✅ **false** |
| Operaciones `.update(`, `.set(`, `.delete(` en script | ✅ **Ninguna** (verificado grep) |
| Deploy ejecutado | ✅ **NO** |
| `suitability_engine.py` modificado | ✅ **NO** |
| `rulesEngine.ts` modificado | ✅ **NO** |
| `populate_taxonomy_v2.py` modificado | ✅ **NO** |
| BDB-FONDOS-CORE tocado | ✅ **NO** |
| `migrate_suitability_v2.py` ejecutado | ✅ **NO** |
| Scripts históricos de write ejecutados | ✅ **NO** |
| `firestore.rules` modificado | ✅ **NO** |
| `optimizer_core.py` modificado | ✅ **NO** |
| Commit previo `948cbd4` pusheado | ✅ **SÍ** (push verificado antes de iniciar) |

---

## J. Artifacts Generados

| Archivo | Descripción |
|---------|-------------|
| `scripts/maintenance/bdb_fi_credit_parser_discovery.py` | Script read-only de discovery (write-guard incorporado) |
| `artifacts/suitability/fi_credit_parser_discovery_0.json` | Artifact completo: 670 fondos, 130 con credit_quality, 43 sobre FE-9 threshold |
| `docs/BDB_FI_CREDIT_PARSER_DISCOVERY_0.md` | Este documento |

---

## K. Datos de Sesión

| Campo | Valor |
|-------|-------|
| Commit previo | `948cbd4` (BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0) |
| Push previo | ✅ Ejecutado al inicio del bloque |
| Fondos escaneados | 670 |
| Con `ms.fixed_income.credit_quality` | 130 (19.4%) |
| Avg low_quality (fondos completos) | 28.68% |
| FE-9 potencial (bond bucket) | 43 fondos (todos HY/EM) |
| FE-9 gap neto | ~0 (todos ya bloqueados por Rule 10) |
| Recomendación | `IMPLEMENT_TRANSLATOR_DRYRUN_NEXT` |
| Próximo bloque | `BDB-FI-CREDIT-TRANSLATOR-DRYRUN-0` |
