# BDB-MORNINGSTAR-HIGH-FI-CREDIT-MANUAL-GATE-0

## Objetivo

Diseño de gate dry-run para actualizar `portfolio_exposure_v2.fi_credit` en 7
fondos HIGH priority, usando datos de calidad crediticia extraídos manualmente
desde capturas de pantalla de Morningstar Web.

> **ESTADO**: Solo diseño.  Write NO ejecutado.  Gate NO autorizado.
>
> **REVISIÓN**: PASS_WITH_CHANGES aplicado (BDB-MORNINGSTAR-HIGH-FI-CREDIT-MANUAL-GATE-REVIEW-0).

---

## Fuente de Datos

- **Evidence**: [BDB_MORNINGSTAR_HIGH_CREDIT_SCREENSHOT_MINI_EVIDENCE_0.md](./BDB_MORNINGSTAR_HIGH_CREDIT_SCREENSHOT_MINI_EVIDENCE_0.md)
- **Origen**: Capturas manuales de Morningstar Web, sección Cartera → Renta Fija → Rating Crediticio
- **Fecha captura**: 2026-05-20
- **Fecha exacta Morningstar**: No documentada (dato más reciente publicado al momento de la captura)
- **Metadata extra** (evidence_doc, confidence, avg_credit_quality): Se guardará
  en artifact externo `artifacts/morningstar_high_fi_credit_manual_gate_0/evidence_metadata.json`,
  NO dentro del payload Firestore.

---

## Schema Firestore Verificado

El campo `portfolio_exposure_v2.fi_credit` en `funds_v3` tiene la siguiente
estructura, confirmada por auditoría de documentos existentes (ej: ES0127795005,
ES0160873008, ES0161032034):

```json
{
  "source": "morningstar_pdf",
  "as_of": null,
  "scale": "percent_of_bond_bucket",
  "coverage": 1,
  "investment_grade": 46.25,
  "high_yield": 0,
  "low_quality": 0,
  "not_rated": 53.75,
  "breakdown": {
    "AAA": 13.78,
    "AA": 0,
    "A": 17.4,
    "BBB": 15.07,
    "BB": 0,
    "B": 0,
    "below_B": 0,
    "not_rated": 53.75
  },
  "warnings": []
}
```

### Notas de Schema

- **`breakdown`**: claves en **UPPER_CASE** (`AAA`, `AA`, `A`, `BBB`, `BB`, `B`, `below_B`, `not_rated`)
- **`investment_grade`** = AAA + AA + A + BBB
- **`high_yield`** = BB + B + below_B
- **`low_quality`** = BB + B + below_B (alias de high_yield)
- **`not_rated`** top-level = copia del breakdown.not_rated
- **`scale`** = `"percent_of_bond_bucket"` (porcentajes sobre la cartera de RF)
- **`source`**: para parser automático = `"morningstar_pdf"`.  Para este gate manual = `"morningstar_web_screenshot_manual"`
- **`coverage`** = 1 si desglose completo (Σ ≈ 100%)
- **`as_of`** = `"2026-05-20"` (fecha de captura, no fecha del dato subyacente de Morningstar)

### Campos Permitidos en fi_credit (payload Firestore)

Solo estos 10 campos van al payload:

| Campo            | Tipo     | Descripción                                |
|------------------|----------|--------------------------------------------|
| source           | string   | `"morningstar_web_screenshot_manual"`      |
| as_of            | string   | `"2026-05-20"` (fecha captura)             |
| scale            | string   | `"percent_of_bond_bucket"`                 |
| coverage         | number   | 1.0 = desglose completo                   |
| investment_grade | number   | AAA+AA+A+BBB                              |
| high_yield       | number   | BB+B+below_B                              |
| low_quality      | number   | Alias de high_yield                        |
| not_rated        | number   | Sin rating                                 |
| breakdown        | object   | AAA/AA/A/BBB/BB/B/below_B/not_rated        |
| warnings         | string[] | Warnings de fuente/calidad                 |

### Campos Excluidos del Payload Firestore

Estos campos **NO** van dentro de `fi_credit` en Firestore:

| Campo              | Destino                                          |
|--------------------|--------------------------------------------------|
| evidence_doc       | → `evidence_metadata.json` (artifact externo)    |
| confidence         | → `evidence_metadata.json` (artifact externo)    |
| avg_credit_quality | → `evidence_metadata.json` (artifact externo)    |
| metadata           | No existe en schema                              |
| custom_*           | No existe en schema                              |

---

## Patch Mínimo Recomendado — Formato Canónico

Todos los patches siguen exactamente este formato:

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": "...",
    "high_yield": "...",
    "low_quality": "...",
    "not_rated": "...",
    "breakdown": {
      "AAA": "...", "AA": "...", "A": "...", "BBB": "...",
      "BB": "...", "B": "...", "below_B": "...", "not_rated": "..."
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

---

## Patch Propuesto por ISIN

### IE00BYYPF474 — Aegon Global Diversified Income A Acc

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 82.04,
    "high_yield": 12.39,
    "low_quality": 12.39,
    "not_rated": 5.57,
    "breakdown": {
      "AAA": 0.00, "AA": 58.01, "A": 2.84, "BBB": 21.19,
      "BB": 7.23, "B": 5.16, "below_B": 0.00, "not_rated": 5.57
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

### IE00BYYPF581 — Aegon Global Diversified Income A Inc

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 82.04,
    "high_yield": 12.39,
    "low_quality": 12.39,
    "not_rated": 5.57,
    "breakdown": {
      "AAA": 0.00, "AA": 58.01, "A": 2.84, "BBB": 21.19,
      "BB": 7.23, "B": 5.16, "below_B": 0.00, "not_rated": 5.57
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

### LU0087412390 — DWS Concept DJE Alpha Renten Global LC

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 81.25,
    "high_yield": 14.59,
    "low_quality": 14.59,
    "not_rated": 4.07,
    "breakdown": {
      "AAA": 24.36, "AA": 2.60, "A": 20.49, "BBB": 33.80,
      "BB": 13.22, "B": 1.37, "below_B": 0.00, "not_rated": 4.07
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date", "avg_credit_quality_not_available_in_source"]
  }
}
```

### LU0243957239 — Invesco Pan European High Income A

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 28.87,
    "high_yield": 53.12,
    "low_quality": 53.12,
    "not_rated": 18.02,
    "breakdown": {
      "AAA": 0.10, "AA": 2.25, "A": 5.30, "BBB": 21.22,
      "BB": 35.27, "B": 14.26, "below_B": 3.59, "not_rated": 18.02
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

### LU0243957742 — Invesco Pan European High Income E

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 28.87,
    "high_yield": 53.12,
    "low_quality": 53.12,
    "not_rated": 18.02,
    "breakdown": {
      "AAA": 0.10, "AA": 2.25, "A": 5.30, "BBB": 21.22,
      "BB": 35.27, "B": 14.26, "below_B": 3.59, "not_rated": 18.02
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

### LU0404220724 — JPMorgan Global Income D (div) EUR

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 43.30,
    "high_yield": 45.08,
    "low_quality": 45.08,
    "not_rated": 11.62,
    "breakdown": {
      "AAA": 0.24, "AA": 34.34, "A": 1.37, "BBB": 7.35,
      "BB": 29.26, "B": 10.20, "below_B": 5.62, "not_rated": 11.62
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

### LU1095739733 — First Eagle Amundi Income Builder AE-QD

```json
{
  "portfolio_exposure_v2.fi_credit": {
    "source": "morningstar_web_screenshot_manual",
    "as_of": "2026-05-20",
    "scale": "percent_of_bond_bucket",
    "coverage": 1,
    "investment_grade": 71.46,
    "high_yield": 26.84,
    "low_quality": 26.84,
    "not_rated": 1.71,
    "breakdown": {
      "AAA": 2.79, "AA": 34.83, "A": 3.20, "BBB": 30.64,
      "BB": 22.35, "B": 4.49, "below_B": 0.00, "not_rated": 1.71
    },
    "warnings": ["source_is_manual_web_capture", "as_of_is_capture_date_not_underlying_date"]
  }
}
```

---

## Tabla Consolidada de Control

| # | ISIN           | IG %  | HY/LQ % | NR %  | Σ      | write_candidate |
|---|----------------|------:|--------:|------:|-------:|:---------------:|
| 1 | IE00BYYPF474   | 82.04 | 12.39   | 5.57  | 100.00 | SÍ              |
| 2 | IE00BYYPF581   | 82.04 | 12.39   | 5.57  | 100.00 | SÍ              |
| 3 | LU0087412390   | 81.25 | 14.59   | 4.07  | 99.91  | SÍ              |
| 4 | LU0243957239   | 28.87 | 53.12   | 18.02 | 100.01 | SÍ*             |
| 5 | LU0243957742   | 28.87 | 53.12   | 18.02 | 100.01 | SÍ*             |
| 6 | LU0404220724   | 43.30 | 45.08   | 11.62 | 100.00 | SÍ*             |
| 7 | LU1095739733   | 71.46 | 26.84   | 1.71  | 100.01 | SÍ              |

**SÍ\*** = write_candidate condicionado a verificación FE-9 pre-write (ver sección abajo).

---

## Riesgo Frontend FE-9 Ya Activo

### Contexto

El rules engine del frontend (`rulesEngine.ts` L425) **ya evalúa en runtime**:

```typescript
const lowQualityCredit = Number(
  expV2?.fi_credit?.low_quality || expV2?.credit?.low_quality || 0
);
```

Si `low_quality >= 35`, FE-9 genera un warning de suitability informativo.

### Fondos Afectados

| ISIN           | low_quality | ¿Dispara FE-9? |
|----------------|------------:|:---------------:|
| LU0243957239   | 53.12       | **SÍ**          |
| LU0243957742   | 53.12       | **SÍ**          |
| LU0404220724   | 45.08       | **SÍ**          |

Actualmente estos 3 fondos **no tienen** `fi_credit` en Firestore, así que
FE-9 no se dispara.  Al escribir `fi_credit`, FE-9 **empezará a evaluarse
inmediatamente** en el frontend.

### Pre-write Obligatorio

Antes de escribir `fi_credit` en estos 3 fondos, el script de write **DEBE**
verificar:

1. Que `classification_v2.compatible_profiles` existe y **no está vacío** en
   cada uno de los 3 ISINs.
2. Que `classification_v2.fi_credit_bucket` existe.

Si alguno de los 3 **no tiene** `compatible_profiles` poblado:
- **ABORTAR** el gate para ese ISIN.
- Decidir suitability primero antes de escribir fi_credit.
- Los demás ISINs (4 fondos IG mayoritario) pueden escribirse sin problema.

### Impacto FE-9

FE-9 es un **warning informativo** (`blocking: false`).  No bloquea la
selección del fondo en el optimizador.  El riesgo es visual: el usuario verá
un aviso de baja calidad crediticia al seleccionar estos fondos.  Esto es
**correcto** porque son fondos High Yield por mandato.

---

## Guard: No Sobrescribir fi_credit Existente

El script de write **DEBE** incluir este guard:

```javascript
// GUARD: no sobrescribir fi_credit existente
const doc = await db.collection("funds_v3").doc(isin).get();
const existingFiCredit = doc.data()?.portfolio_exposure_v2?.fi_credit;
if (existingFiCredit && Object.keys(existingFiCredit).length > 0) {
  console.log(`ABORT ${isin}: fi_credit already populated, skipping`);
  continue;
}
```

Razón: si un reparseo futuro ya pobló `fi_credit` desde el parser automático,
el dato manual no debe sobrescribirlo.

---

## Nota: source Nuevo

El valor `source = "morningstar_web_screenshot_manual"` es **nuevo** respecto
a los ~130 documentos existentes que usan `source = "morningstar_pdf"`.

- **No bloquea runtime**: el frontend no filtra por source.
- **Debería documentarse** en un test de integración futuro que valide los
  valores aceptados de `fi_credit.source`.
- **No es bloqueante** para este gate.

---

## Campos Prohibidos (NO TOCAR)

El script de write **solo** puede escribir la dotted path
`portfolio_exposure_v2.fi_credit`.  **Cualquier otro campo es prohibido.**

| Campo Prohibido                             | Razón                              |
|---------------------------------------------|------------------------------------|
| classification_v2                           | No modificar clasificación         |
| classification_v2.compatible_profiles       | No recalcular perfiles             |
| classification_v2.fi_credit_bucket          | No modificar bucket                |
| portfolio_exposure_v2.economic_exposure     | Calculado por otro pipeline        |
| portfolio_exposure_v2.asset_mix             | Del parser, no tocar               |
| portfolio_exposure_v2.fi_duration           | No tenemos duration fiable         |
| portfolio_exposure_v2.duration              | No tenemos duration fiable         |
| portfolio_exposure_v2.equity_regions        | Del parser, no tocar               |
| portfolio_exposure_v2.sectors               | Del parser, no tocar               |
| portfolio_exposure_v2.equity_styles         | Del parser, no tocar               |
| portfolio_exposure_v2.market_caps           | Del parser, no tocar               |
| portfolio_exposure_v2.bond_types            | Del parser, no tocar               |
| portfolio_exposure_v2.credit                | Bucket credit, no tocar            |
| portfolio_exposure_v2.fi_types              | Del parser, no tocar               |
| portfolio_exposure_v2.alternatives          | Del parser, no tocar               |
| portfolio_exposure_v2.concentration_metrics | Del parser, no tocar               |
| portfolio_exposure_v2.exposure_confidence   | Del parser, no tocar               |
| portfolio_exposure_v2.warnings              | Del parser, no tocar               |
| ms                                          | Datos Morningstar originales       |
| ms.fixed_income                             | Datos Morningstar originales       |
| manual                                      | Datos manuales del usuario         |
| manual.costs                                | Costes manuales                    |
| manual.costs.retrocession                   | Retrocesiones                      |
| derived                                     | Campos derivados                   |
| std_perf                                    | Rendimientos estandarizados        |
| data_quality                                | Métricas de calidad                |

---

## Método de Escritura

```javascript
// Pseudo-código del write (NO EJECUTAR)
const admin = require("firebase-admin");
const db = admin.firestore();

for (const { isin, fi_credit } of patches) {
  // GUARD 1: no sobrescribir fi_credit existente
  const doc = await db.collection("funds_v3").doc(isin).get();
  if (!doc.exists) { console.log(`SKIP ${isin}: doc not found`); continue; }
  const existing = doc.data()?.portfolio_exposure_v2?.fi_credit;
  if (existing && Object.keys(existing).length > 0) {
    console.log(`ABORT ${isin}: fi_credit already populated`);
    continue;
  }

  // GUARD 2: para fondos HY, verificar compatible_profiles
  if (fi_credit.low_quality >= 35) {
    const cp = doc.data()?.classification_v2?.compatible_profiles;
    if (!cp || !Array.isArray(cp) || cp.length === 0) {
      console.log(`ABORT ${isin}: low_quality=${fi_credit.low_quality} but no compatible_profiles`);
      continue;
    }
  }

  // WRITE: solo fi_credit via dotted path
  await db.collection("funds_v3").doc(isin).update({
    "portfolio_exposure_v2.fi_credit": fi_credit,
  });
}
```

Se usa `update()` con dotted path `"portfolio_exposure_v2.fi_credit"` que:
- **Crea o reemplaza** solo `fi_credit` dentro del objeto `portfolio_exposure_v2`
- **No toca** ningún otro campo de `portfolio_exposure_v2`
- **No toca** ningún otro campo del documento

---

## Prerequisitos para Fase de Ejecución

Antes de autorizar el write:

1. **Snapshot pre-write** de los 7 documentos completos
2. **Rollback plan** con el `fi_credit` anterior (probablemente `null` o ausente)
3. **Verificar compatible_profiles** en LU0243957239, LU0243957742, LU0404220724
4. **Verificar fi_credit no existe** en los 7 fondos
5. **Crear** `artifacts/morningstar_high_fi_credit_manual_gate_0/evidence_metadata.json`
   con avg_credit_quality, confidence, evidence_doc por ISIN
6. **Verificación post-write**:
   - `fi_credit.breakdown` escrito correctamente
   - `fi_credit.source` = `"morningstar_web_screenshot_manual"`
   - `fi_credit.as_of` = `"2026-05-20"`
   - `fi_credit.investment_grade + fi_credit.high_yield + fi_credit.not_rated ≈ 100`
   - `fi_credit.warnings` contiene `source_is_manual_web_capture`
   - Todos los demás campos del documento intactos
   - `manual.*` intacto
   - `economic_exposure` intacto
   - `classification_v2` intacto
7. **Releer** los 7 documentos y comparar

---

## Riesgos y Limitaciones

1. **Fuente manual**: Los datos provienen de capturas de pantalla, no de un
   parser automatizado.  Error de transcripción posible pero mitigado por
   verificación de sumas ≈ 100%.
2. **Sin duration**: Los fondos IE00BYYPF474, IE00BYYPF581 y LU0087412390
   no tienen duración efectiva disponible.  No se inventa.  `fi_duration`
   no se toca.
3. **FE-9 activo en runtime**: Al escribir fi_credit en los 3 fondos HY,
   FE-9 empezará a evaluar low_quality y mostrará warning informativo.
   Pre-write de compatible_profiles es obligatorio para esos 3.
4. **source nuevo**: `"morningstar_web_screenshot_manual"` no existe en los
   ~130 docs actuales.  No bloquea runtime pero debería documentarse en test
   futuro.
5. **as_of es fecha captura**: `"2026-05-20"` es la fecha de la captura de
   pantalla, no la fecha del dato subyacente de Morningstar.
6. **Sin compatible_profiles**: No se recalculan perfiles de riesgo.
7. **Sin suitability_engine**: No se ejecuta ni modifica el motor de suitability.
8. **Fondos REVIEW**: Estos 7 ISINs están en REVIEW en el parser.  El gate
   manual NO los saca de REVIEW; solo enriquece su `fi_credit`.

---

## Confirmación de Invariantes

| Invariante                  | Estado |
|:----------------------------|:-------|
| Firestore writes            | 0      |
| Deploy                      | NO     |
| Push                        | NO     |
| Commit nuevo                | NO     |
| CORE tocado                 | NO     |
| Frontend tocado             | NO     |
| SharpeMaximizerModal tocado | NO     |
| compatible_profiles tocado  | NO     |
| suitability_engine tocado   | NO     |
| Write ejecutado             | NO     |
| Write gate creado           | NO     |
