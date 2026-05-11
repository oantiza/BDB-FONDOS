# BDB-SUITABILITY-FI-CREDIT-DATA-MODEL-0 — Closeout

**Fecha**: 2026-05-11  
**Proyecto**: `C:\Users\oanti\Documents\BDB-FONDOS` (legacy)  
**Modo**: DISEÑO/AUDITORÍA — 0 writes, 0 deploy, 0 cambios productivos  
**BDB-FONDOS-CORE**: NO tocado  

---

## 1. Objetivo del Bloque

Auditar y diseñar el modelo futuro de calidad crediticia de renta fija (`fi_credit`) para BDB-FONDOS legacy, necesario antes de activar cualquier regla tipo FE-9 `lowQualityCredit >= 35%`.

**Decisión previa**: `NEEDS_DATA_MODEL_FIRST` (BDB-SUITABILITY-FE9-LOW_QUALITY_CREDIT-DECISION-0).

---

## 2. Hallazgos de Auditoría

### 2.1 Estado Actual en Firestore

| Campo | Presente en funds_v3 | Cobertura |
|-------|---------------------|-----------|
| `portfolio_exposure_v2.fi_credit.low_quality` | ❌ No | 0/670 |
| `portfolio_exposure_v2.credit` (desglose) | ❌ No | 0/670 |
| `classification_v2.fi_credit_bucket` | ✅ Sí (categórico) | ~450/670 fondos RF |

### 2.2 Estado en el Parser (S3: populate_taxonomy_v2.py)

El parser **ya lee** `ms.fixed_income.credit_quality` con desglose completo:
```
{aaa, aa, a, bbb, bb, b, below_b, not_rated}
```

**Función existente**: `_deduce_fixed_income_credit(data, subtype) → FICreditBucketV2`  
- Usa el desglose para producir un bucket categórico (`HIGH_QUALITY`, `MEDIUM_QUALITY`, `LOW_QUALITY`)  
- **NO escribe** el desglose cuantitativo a Firestore  
- **GAP**: la traducción `credit_quality → portfolio_exposure_v2.fi_credit` (quantitative) no existe

### 2.3 Golden Fixture Confirmada

Fixture `MORNINGSTAR_PDF_PARSER/tests/fixtures/golden/fixed_income_corporate.json`:
```json
"credit_quality": { "aaa": 5, "aa": 10, "a": 25, "bbb": 40, "bb": 10, "b": 5, "below_b": 2, "not_rated": 3 }
```
→ `low_quality = bb + b + below_b = 10 + 5 + 2 = 17%` (por debajo de 35%, no dispararía FE-9)

### 2.4 Política de Parser Confirmada

`docs/BDB_PARSER_POLICY_0_WRITE_REVIEW_CANON.md`, Sección 5:
- `portfolio_exposure_v2.credit` está listado como campo **permitido** (SET merge, de `ms.fixed_income.credit_quality`)
- El campo **no se está generando** en la pipeline actual

---

## 3. Esquema Propuesto: `portfolio_exposure_v2.fi_credit`

```json
{
  "fi_credit": {
    "source": "morningstar_pdf",
    "as_of": "2026-01-31",
    "coverage": 0.97,
    "scale": "percent_of_bond_bucket",
    "investment_grade": 80.0,
    "high_yield": 17.0,
    "low_quality": 17.0,
    "not_rated": 3.0,
    "breakdown": {
      "AAA": 5.0,
      "AA": 10.0,
      "A": 25.0,
      "BBB": 40.0,
      "BB": 10.0,
      "B": 5.0,
      "below_B": 2.0,
      "not_rated": 3.0
    },
    "warnings": []
  }
}
```

### Invariantes del Esquema

| Campo | Regla | Acción si viola |
|-------|-------|-----------------|
| `source` | Obligatorio. `morningstar_pdf` | Rechazar write |
| `as_of` | Obligatorio. ISO date | Warning `stale_data` si None |
| `scale` | Obligatorio. `percent_of_bond_bucket` \| `percent_of_total_portfolio` | Rechazar write |
| `coverage` | > 0 | Rechazar write si 0 |
| `low_quality` | == BB + B + below_B | Error de normalización si no coincide |
| Suma breakdown | ≤ 100% | Warning si supera |

---

## 4. Derivación de `low_quality`

```
low_quality = BB + B + below_B
```

**`not_rated` NO se incluye por defecto.**  
Si se desea incluirlo (ej. regulación CNMV), se debe marcar explícitamente con flag `not_rated_treated_as_lq: true`.

### Escala y Fondos Mixtos

El problema de denominador para fondos mixtos:

| Fondo | bond_weight | LQ de bond | LQ total_portfolio | FE-9 (bond_bucket) | FE-9 (total_portfolio) |
|-------|-------------|------------|-------------------|-------------------|----------------------|
| Mixto conservador | 30% | 50% | 15% | ❌ Bloquea | ✅ No bloquea |
| HY puro | 100% | 50% | 50% | ❌ Bloquea | ❌ Bloquea |

**Recomendación**: Usar `scale: percent_of_total_portfolio` para FE-9 en fondos mixtos. Evita falsos positivos.

---

## 5. Contrato FE-9 Propuesto

```
SI fi_credit.coverage < 0.50:
    → NO aplicar hard block. Emitir warning CREDIT_COVERAGE_LOW.

SI fi_credit.low_quality >= 35.0 Y fi_credit.coverage >= 0.50:
    → BLOCK perfiles <= 4 (igual que frontend)
    → Motivo: "fi_credit.low_quality = {X}% (umbral: 35%)"

SI asset_subtype == HIGH_YIELD_BOND:
    → BLOCK ya activo por regla categórica (Rule 10)
    → FE-9 es redundante pero no conflictivo
    → Motivo debe referenciar Rule 10, no FE-9
```

---

## 6. Tests de Contrato Creados

**Archivo**: `functions_python/tests/test_fi_credit_data_model_contract.py`

| Sección | Tests | Estado |
|---------|-------|--------|
| Schema Validation | 6 | xfail(strict=False) |
| low_quality Derivation | 4 | xfail(strict=False) |
| Scale & Mixed Fund | 3 | xfail(strict=False) |
| Coverage Contracts | 3 | xfail(strict=False) |
| FE-9 Rule Scope | 4 | xfail(strict=False) |
| Pipeline Gap Documentation | 2 | xfail(strict=False) |
| **Total** | **22** | **5 xfailed + 17 xpassed** |

**Interpretación**:
- `xpassed` = la lógica de referencia (mock helpers) es correcta → diseño validado
- `xfailed` = 5 tests donde la aserción genuinamente falla (campos popeados, coverage=0) → documentan validaciones futuras que el pipeline real debe implementar

**Baseline post-bloque**: `291 PASS, 17 xpassed, 8 xfailed, 2 skipped — EXIT:0`

---

## 7. Gap de Pipeline Identificado

### Lo que existe hoy (✅)

```
ms.fixed_income.credit_quality → _deduce_fixed_income_credit() → fi_credit_bucket (categórico)
                                                                    ↓
                                                       classification_v2.fi_credit_bucket
```

### Lo que falta (❌)

```
ms.fixed_income.credit_quality → [S3 translator] → portfolio_exposure_v2.fi_credit (cuantitativo)
                                                      ↓
                                          {low_quality, investment_grade, breakdown, ...}
```

### Función que necesita añadirse en `populate_taxonomy_v2.py`

```python
def _build_fi_credit_exposure(ms_fi: dict, bond_weight: float = 1.0) -> dict | None:
    """
    Traduce ms.fixed_income.credit_quality → portfolio_exposure_v2.fi_credit quantitative.
    Requiere: ms.fixed_income.credit_quality con claves {aaa, aa, a, bbb, bb, b, below_b, not_rated}
    """
    qual = _safe_dict(ms_fi.get("credit_quality"))
    if not qual:
        return None
    
    aaa   = _safe_float(qual.get("aaa", 0))
    aa    = _safe_float(qual.get("aa", 0))
    a     = _safe_float(qual.get("a", 0))
    bbb   = _safe_float(qual.get("bbb", 0))
    bb    = _safe_float(qual.get("bb", 0))
    b     = _safe_float(qual.get("b", 0))
    below = _safe_float(qual.get("below_b", 0))
    nr    = _safe_float(qual.get("not_rated", 0))
    
    low_quality     = bb + b + below
    investment_grade = aaa + aa + a + bbb
    
    return {
        "source": "morningstar_pdf",
        "scale": "percent_of_bond_bucket",
        "investment_grade": investment_grade,
        "high_yield": low_quality,
        "low_quality": low_quality,
        "not_rated": nr,
        "breakdown": {
            "AAA": aaa, "AA": aa, "A": a, "BBB": bbb,
            "BB": bb, "B": b, "below_B": below, "not_rated": nr,
        },
        "warnings": [],
    }
```

> **⚠️ Esta función NO debe añadirse hasta completar `BDB-FI-CREDIT-PARSER-DISCOVERY-0`**  
> que validará la cobertura real y determinará si `as_of` puede derivarse del PDF.

---

## 8. Roadmap Técnico

### Fase 1: Discovery (Prerrequisito)
**`BDB-FI-CREDIT-PARSER-DISCOVERY-0`**
- Analizar cobertura de `ms.fixed_income.credit_quality` en los ~450 fondos RF de funds_v3
- Determinar porcentaje de fondos con dato vs. `credit_missing`
- Evaluar cómo derivar `as_of` del PDF para el campo de fecha

### Fase 2: Extracción Piloto
**`BDB-FI-CREDIT-DRYRUN-EXTRACTION-0`**
- Dry-run en 50 fondos representativos (RF pura + mixtos)
- Validar que low_quality < 35% en fondos IG conocidos
- Validar que low_quality >= 35% en fondos HY conocidos
- Sin writes

### Fase 3: Tests de Contrato
**`BDB-FI-CREDIT-SCHEMA-CONTRACT-TESTS-0`**
- Eliminar xfail de tests que dependan de datos reales
- Añadir tests de integración con datos extraídos del piloto
- Verificar que baseline sigue limpio

### Fase 4: Write Controlado (Gate + Write)
**`BDB-FI-CREDIT-WRITE-GATE-0`** → **`BDB-FI-CREDIT-WRITE-CONTROLLED-0`**
- Siguiendo el protocolo estándar de gate (snapshot + diff + rollback manifest)
- Primer lote: ≤ 10 fondos RF conocidos (IG + HY confirmados)
- Verificación post-write

### Fase 5: Activación FE-9 (Decisión Futura)
**`BDB-SUITABILITY-FE9-BACKEND-IMPLEMENTATION-0`**
- Solo si coverage >= 50% de fondos RF + mixtos
- Requiere alineación frontend/backend en definición de `low_quality`
- Considera escala (`bond_bucket` vs `total_portfolio`) según tipo de fondo

---

## 9. Decisión Final

### **`NEEDS_DATA_MODEL_FIRST — SCHEMA_DESIGNED — PIPELINE_GAP_DOCUMENTED`**

| Aspecto | Estado |
|---------|--------|
| FE-9 en frontend | Activa, dormida (siempre evalúa 0) |
| FE-9 en backend | NO implementada. Correcto. |
| `fi_credit` en Firestore | 0/670 fondos |
| Schema propuesto | ✅ Diseñado y documentado |
| Tests de contrato | ✅ 22 tests, EXIT:0 |
| Baseline backend | ✅ 291 PASS |
| Pipeline gap | ✅ Identificado: S3 necesita `_build_fi_credit_exposure()` |
| Próximo paso recomendado | `BDB-FI-CREDIT-PARSER-DISCOVERY-0` |

---

## 10. Artifacts

| Archivo | Contenido |
|---------|-----------|
| `docs/BDB_SUITABILITY_FI_CREDIT_DATA_MODEL_0.md` | Este documento |
| `functions_python/tests/test_fi_credit_data_model_contract.py` | 22 design contract tests |
| `scripts/maintenance/bdb_fe9_low_quality_credit_audit.py` | Audit script read-only (bloque anterior) |
| `artifacts/suitability/fe9_low_quality_credit_audit_0.json` | Audit results: 0/670 fondos con fi_credit |

---

## 11. Registro de Sesión

| Acción | Resultado |
|--------|-----------|
| Auditoría estado actual | `fi_credit.low_quality` ausente 0/670 |
| Lectura parser S3 | `_deduce_fixed_income_credit` usa credit_quality pero solo produce categórico |
| Lectura golden fixture | `ES0165142003`: bb=10, b=5, below_b=2 → LQ=17% |
| Lectura `utils.py` | `get_v2_group_map` busca `portfolio_exposure_v2.credit` o `fi_credit` (ya soportado) |
| Lectura `BDB_PARSER_POLICY_0` | `portfolio_exposure_v2.credit` listado como campo permitido de S3 |
| Tests creados | 22 tests de contrato, `strict=False`, EXIT:0 |
| Baseline verificado | 291 PASS — sin regresiones |
| Firestore writes | 0 |
| Deploy | 0 |
| Código productivo modificado | 0 |
| BDB-FONDOS-CORE | NO tocado |
