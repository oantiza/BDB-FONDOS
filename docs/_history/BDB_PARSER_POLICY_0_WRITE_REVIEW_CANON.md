# BDB-PARSER-POLICY-0 — Política Canónica de Write, REVIEW y Campos del Parser Morningstar

**Fecha**: 2026-05-07  
**Proyecto**: `C:\Users\oanti\Documents\BDB-FONDOS` (legacy)  
**Modo**: POLICY ONLY — 0 writes, 0 deploy, 0 push, 0 commits, 0 Gemini calls  
**BDB-FONDOS-CORE**: NO tocado  

---

## 1. Resumen de Auditorías Previas

| Bloque | Estado | Resultado clave |
|--------|--------|-----------------|
| BDB-PARSER-AUDIT-0 | `PARSER_OK_WITH_WARNINGS` | 7 scripts, 5 writers, riesgo semántico oro/minería HIGH, escalas duales by design |
| BDB-PARSER-HARDENING-0 | `PARSER_HARDENED_READY_FOR_DRY_RUN` | dry-run default, `--write --confirm-write`, ADC, `manual.*` guard, artifact obligatorio |
| BDB-PARSER-ORG-1 | `PARSER_RELOCATED_READY` | Parser movido a `scripts/MORNINGSTAR_PDF_PARSER/`, wrapper legacy en `scripts/maintenance/` |
| BDB-PARSER-DRYRUN-1 | `PARSER_DRYRUN_OK_WITH_WARNINGS` | 1 PDF equity OK |
| BDB-PARSER-DRYRUN-2 | `PARSER_SMALL_BATCH_OK_WITH_WARNINGS` | 5 PDFs equity OK, R14 detectado |
| BDB-PARSER-REGION-0 | `PARSER_REGION_FIX_VERIFIED` | R14 corregido: Asia ex-Japón → Asia |
| BDB-PARSER-DRYRUN-3 | `PARSER_TARGETED_BATCH_OK_WITH_WARNINGS` | 5 PDFs dirigidos (RF, mixto, monetario, oro, alternativo). OK=3, REVIEW=2 por `credit_missing` |
| BDB-RETRO-IMPORT-0 | `RETRO_RELOAD_READY_FOR_SOURCE_FILE` | Retrocesiones fuera del parser, pipeline propio |

---

## 2. Estados del Parser

El parser asigna uno de cuatro estados a cada PDF procesado. Estos estados determinan si un payload propuesto puede avanzar hacia escritura futura.

| Estado | Código | Descripción | Puede escribirse? |
|--------|--------|-------------|-------------------|
| **ACCEPT** | `ok` | Sin errores, sin warnings bloqueantes | ✅ Con autorización manual |
| **ACCEPT_WITH_WARNINGS** | `ok` + warnings LOW | Sin errores, solo warnings informativos o esperados | ✅ Con autorización manual si todos los warnings son LOW |
| **REVIEW** | `review` | Sin errores de schema/math, pero warnings que requieren evaluación humana | ❌ No automático. Requiere aprobación explícita por ISIN |
| **BLOCKED** | `error_*` | Error de schema, math, LLM o procesamiento | ❌ Nunca. Requiere corrección y reparseo |

### Mapping interno → estados de política

| `pipeline_status` interno | Estado de política |
|---------------------------|-------------------|
| `ok` sin warnings | ACCEPT |
| `ok` con solo warnings LOW | ACCEPT_WITH_WARNINGS |
| `review` | REVIEW |
| `error_llm_json` | BLOCKED |
| `error_schema_validation` | BLOCKED |
| `error_math_validation` | BLOCKED |
| `error_processing` | BLOCKED |

---

## 3. Clasificación de Warnings por Severidad

### 3.1 Tabla Maestra

| Warning | Severidad | Descripción | Bloquea write? |
|---------|-----------|-------------|----------------|
| `scale_guardrail_normalized` / `asset_mix_guardrail:detected_scale_0_100_divided_by_100` | **INFO** | Gemini retorna 0-100, guardrail normaliza a 0-1. Comportamiento esperado. | ❌ |
| `asset_mix_guardrail:asset_mix_rebased_to_sum_1` | **INFO** | Suma raw ≠ 1.0 tras normalización; rebasada correctamente. | ❌ |
| `asset_mix_guardrail:mixed_scale_signal_detected` | **LOW** | Componente mínimo y máximo en escalas aparentemente diferentes. Guardrail maneja. | ❌ |
| `unknown_region_key` | **LOW** | Clave de región en español no mapeada (ej. `Asia - Desarrollada`). No impacta routing ni asset_mix. | ❌ |
| `regions_sum_overflow` | **LOW** | Macro + detail suman >100%. Típico de PDFs en español. No impacta asset_mix. | ❌ |
| `fi_type_inference_weak` | **LOW** | Inferencia de tipo RF débil. Ignorada por router en equity. | ❌ |
| `fi_missing_credit_data` | **LOW** en equity, **MEDIUM** en RF/allocation | Morningstar no reporta calidad crediticia. Ver sección 7. | Depende del contexto |
| `fi_missing_duration_data` | **LOW** en equity, **MEDIUM** en RF/allocation | Similar a credit_missing. | Depende del contexto |
| `credit_missing` | **LOW** en equity, **MEDIUM** en RF/allocation/monetario | Ver sección 7 para política detallada. | Depende del contexto |
| `missing_sectors` / `missing_regions` / `region_incomplete` | **LOW** en monetario/RF, **MEDIUM** en equity | Esperable en RF/monetario. Sospechoso en equity diversificado. | ❌ en monetario/RF, REVIEW en equity |
| `style_missing` | **LOW** | Estilo V/B/G no reportado por Morningstar. | ❌ |
| `asset_mix_sum_out_of_range` | **HIGH** | Suma final de asset_mix fuera de tolerancia (>1.01 o <0.99) tras normalización. | ✅ → BLOCKED |
| `missing_asset_mix` | **HIGH** | Sin datos de asset allocation. Payload inválido. | ✅ → BLOCKED |
| `missing_category` | **HIGH** | Sin categoría Morningstar. Clasificación no posible. | ✅ → BLOCKED |
| `missing_isin` | **CRITICAL** | Sin ISIN. No se puede identificar el fondo. | ✅ → BLOCKED |
| `missing_name` | **MEDIUM** | Sin nombre del fondo. No bloquea pero requiere revisión. | REVIEW |
| `manual_field_attempted` | **CRITICAL** | Payload contiene `manual.*`. Guard debe bloquear. | ✅ → BLOCKED |
| `firestore_write_without_confirm` | **CRITICAL** | Intento de write sin `--write --confirm-write`. | ✅ → BLOCKED |
| `gemini_parse_error` | **HIGH** | Gemini no retornó JSON válido. | ✅ → BLOCKED |
| `pdf_read_error` | **HIGH** | No se pudo extraer texto del PDF. | ✅ → BLOCKED |
| `class_exposure_tension` | **LOW** en equity puro, **MEDIUM** en frontera | `asset_type` no concuerda con `asset_mix` dominante. | REVIEW si MEDIUM |

### 3.2 Resumen por Severidad

| Severidad | Cantidad de warning types | Acción |
|-----------|--------------------------|--------|
| **INFO** | 2 | Ignorar. No afecta estados. |
| **LOW** | 8 | ACCEPT_WITH_WARNINGS. No bloquea write. |
| **MEDIUM** | 5 (contextuales) | REVIEW. Requiere evaluación humana. |
| **HIGH** | 4 | BLOCKED. Requiere corrección y reparseo. |
| **CRITICAL** | 3 | BLOCKED. Error de seguridad o integridad. |

---

## 4. Matriz Warning → Estado

| Warning | En equity | En RF pura | En allocation | En monetario | En alternativo | En oro/minería |
|---------|-----------|------------|---------------|--------------|----------------|----------------|
| `scale_guardrail_normalized` | ACCEPT | ACCEPT | ACCEPT | ACCEPT | ACCEPT | ACCEPT |
| `unknown_region_key` | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W |
| `credit_missing` | ACCEPT_W | **REVIEW** | **REVIEW** | **REVIEW** | Depende¹ | ACCEPT_W |
| `fi_type_inference_weak` | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W |
| `region_incomplete` | **REVIEW** | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W |
| `missing_asset_mix` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `missing_isin` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `manual_field_attempted` | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| `class_exposure_tension` | ACCEPT_W² | ACCEPT_W | ACCEPT_W | ACCEPT_W | ACCEPT_W | **REVIEW**³ |

Leyenda:
- ACCEPT_W = ACCEPT_WITH_WARNINGS
- ¹ En alternativos con bond > 20%: REVIEW. En alternativos con bond < 20%: ACCEPT_W.
- ² Si equity > 50%: ACCEPT_W. Si equity < 50% y `asset_type=equity`: REVIEW.
- ³ Ver sección 8.

---

## 5. Campos Permitidos

El parser Morningstar (S1: `cargador_lotes_v_2.js`) puede preparar payload para los siguientes campos de `funds_v3`:

| Campo | Método | Fuente | Notas |
|-------|--------|--------|-------|
| `isin` | SET | PDF/Gemini | Identificador primario |
| `name` | SET | PDF/Gemini | Nombre comercial del fondo |
| `currency` | SET | PDF/Gemini | Divisa base |
| `ms.*` | SET (merge) | PDF → Gemini → normalización | Bloque completo de datos Morningstar |
| `derived.*` | SET (merge) | Computado de `ms.*` | Clasificación derivada, asset_class, subtype |
| `classification_v2.*` | SET (merge) | Computado de `ms.*` + `derived` | Modelo canónico V2 |
| `portfolio_exposure_v2.asset_mix` | SET (merge) | Computado, escala 0-1 | Solo `asset_mix`. No `economic_exposure`. |
| `portfolio_exposure_v2.equity_regions` | SET (merge) | De `ms.regions` normalizadas | Regiones ponderadas |
| `portfolio_exposure_v2.sectors` | SET (merge) | De `ms.sectors` normalizados | Sectores ponderados |
| `portfolio_exposure_v2.equity_styles` | SET (merge) | De `ms.equity_style` | Si disponible |
| `portfolio_exposure_v2.market_caps` | SET (merge) | De `ms.equity_style.market_cap` | Si disponible |
| `portfolio_exposure_v2.bond_types` | SET (merge) | De `ms.fixed_income` | Si RF > 0 |
| `portfolio_exposure_v2.credit` | SET (merge) | De `ms.fixed_income.credit_quality` | Si disponible |
| `portfolio_exposure_v2.duration` | SET (merge) | Inferido de maturity/duration | Si disponible |
| `quality.*` | SET (merge) | Pipeline metadata | `parsed_at`, `parser_version`, `source_pdf_hash`, `warnings`, `ok` |
| `updatedAt` | SET | Timestamp del write | Server timestamp |

---

## 6. Campos Prohibidos

El parser Morningstar **nunca** debe incluir en su payload ni modificar los siguientes campos:

| Campo | Razón | Quién lo gestiona |
|-------|-------|-------------------|
| `manual.*` | Datos manuales del operador. Protegidos por guard `assertNoManualFields()`. | Operador humano |
| `manual.costs` | Subcampo manual. | Operador humano |
| `manual.costs.retrocession` | Retrocesiones. Pipeline separado (`BDB-RETRO-IMPORT`). | `bdb_retrocession_reload_dry_run.js` |
| `manual.costs.ter` | TER manual. | Operador humano |
| `portfolio_exposure_v2.economic_exposure` | Generado por `populate_taxonomy_v2.py` (S3), escala 0-100. No por S1. | S3: `populate_taxonomy_v2.py` |
| User overrides | Cualquier campo que el usuario haya configurado manualmente. | UI / operador |
| Datos fiscales | No presentes en PDF Morningstar. | Sistemas externos |
| Campos ausentes del PDF | Si un campo existe en Firestore pero no en el PDF actual, el parser **no debe** borrarlo. `merge: true` preserva campos no incluidos en el payload. | — |

### Invariante de protección

```
fields_preserved: ["manual", "manual.costs", "manual.costs.retrocession"]
```

Este invariante debe verificarse en **cada** artifact de dry-run y en **cada** lote de write futuro. Si un payload propuesto contiene cualquier clave bajo `manual.*`, el lote completo se marca como **BLOCKED**.

---

## 7. Política de `credit_missing`

El warning `credit_missing` se genera cuando Morningstar no reporta datos de calidad crediticia (`credit_quality`). Su tratamiento depende del tipo de fondo:

| Tipo de fondo | `asset_type` | `bond` en asset_mix | Tratamiento de `credit_missing` |
|---------------|-------------|---------------------|--------------------------------|
| **Equity puro** | `equity` | < 5% | **LOW**. Irrelevante. El routing lo ignora correctamente. ACCEPT_WITH_WARNINGS. |
| **Equity con RF residual** | `equity` | 5-20% | **LOW**. La posición RF es complementaria. ACCEPT_WITH_WARNINGS. |
| **RF pura** | `fixed_income` | > 50% | **MEDIUM → REVIEW**. La calidad crediticia es esencial para el perfil de riesgo. |
| **Allocation con RF significativa** | `allocation` | > 20% | **MEDIUM → REVIEW**. Bond es componente material del fondo. |
| **Allocation conservadora** | `allocation` | > 50% | **MEDIUM → REVIEW**. Fondo dominado por RF. |
| **Monetario** | `money_market` | > 0% o cash=100% | **MEDIUM → REVIEW**. La calidad crediticia define el perfil de un monetario. |
| **Alternativo conservador** | `alternative` | > 20% | **MEDIUM → REVIEW**. Componente RF material. |
| **Alternativo equity-like** | `alternative` | < 20% | **LOW**. ACCEPT_WITH_WARNINGS. |
| **Oro / metales** | `equity`/`alternative` | < 5% | **LOW**. No aplica. ACCEPT_WITH_WARNINGS. |

### Regla formal

```
SI asset_type IN (fixed_income, money_market):
    credit_missing → REVIEW

SI asset_type = allocation Y bond > 0.20:
    credit_missing → REVIEW

SI asset_type = alternative Y bond > 0.20:
    credit_missing → REVIEW

EN CUALQUIER OTRO CASO:
    credit_missing → ACCEPT_WITH_WARNINGS (LOW)
```

### Evidencia empírica

| ISIN | Tipo | bond | credit_missing? | Estado asignado |
|------|------|------|-----------------|-----------------|
| ES0124880032 | RF pura | 0.989 | ✅ | REVIEW (por política; runtime aceptó como OK) |
| ES0112231016 | Allocation | 0.229 | ✅ | REVIEW |
| LU0252500524 | Monetario | 0.000 (cash=1.0) | — | OK (sin posición RF) |
| ES0175437005 | Alternativo | 0.745 | ✅ | REVIEW |
| ES0137381036 | Equity | 0.055 | ✅ | ACCEPT_WITH_WARNINGS (bond < 20%) |
| LU0073229253 | Equity | 0.002 | ✅ | ACCEPT_WITH_WARNINGS (bond < 5%) |

---

## 8. Política de Oro / Metales / Minería / Recursos Naturales

### 8.1 Principio rector

El parser debe **reproducir fielmente** lo que Morningstar reporta. No debe inventar exposure ni corregir el dato de Morningstar.

### 8.2 Caso 1: Morningstar reporta equity > 0

Si el PDF Morningstar reporta `asset_allocation.equity > 0` (como en LU0171306680 BGF World Gold: equity=92.93%), el parser:

- ✅ Acepta el dato como exposure real del PDF.
- ✅ Genera `asset_mix.equity = 0.9293`.
- ✅ Clasifica como `THEMATIC_EQUITY` con tags semánticos de oro/minería.
- ✅ Estado: **ACCEPT_WITH_WARNINGS**.
- ⚠️ El tag `theme:gold` o `theme:mining` debería estar presente en `strategy_tags` para que capas semánticas posteriores puedan detectar el caso.

### 8.3 Caso 2: Morningstar reporta equity = 0, other = 100

Si el PDF Morningstar reporta `asset_allocation.equity = 0, other = 100` (caso de fondos que invierten directamente en commodity/oro):

- ✅ El parser acepta `equity = 0, other = 1.0` como dato fiel del PDF.
- ✅ Clasifica como `alternative` (por `hardCommodities` match).
- ⚠️ **SEMANTIC_REVIEW**: El parser debe emitir un warning `class_exposure_tension:commodity_with_zero_equity` si:
  - `classification_v2.asset_type = equity` o tokens gold/mining presentes, pero
  - `asset_mix.equity = 0`.
- ✅ Estado: **REVIEW** (con tag `SEMANTIC_REVIEW`).

### 8.4 Corrección semántica

La corrección semántica para el optimizador (ej. tratar fondos de mineras como equity aunque Morningstar reporte `other=100`) **no es responsabilidad del parser**. Debe implementarse en una capa separada:

- Opción A: En `populate_taxonomy_v2.py` (S3), que ya tiene acceso a `classification_v2` y puede ajustar `economic_exposure`.
- Opción B: En el runtime del optimizador, mediante un mapping `alternative + commodity_tag → equity_proxy`.
- Opción C: En un override manual por ISIN.

El parser solo reproduce, clasifica y señala. No corrige.

---

## 9. Política de Escalas

### 9.1 Escala canónica por pipeline

| Campo | Escala | Generado por | Normalización |
|-------|--------|--------------|---------------|
| `portfolio_exposure_v2.asset_mix` | **0-1** | S1: `cargador_lotes_v_2.js` | Detecta max > 1.0 → divide /100, rebasa a sum=1.0 |
| `portfolio_exposure_v2.economic_exposure` | **0-100** | S3: `populate_taxonomy_v2.py` | Detecta total ≤ 1.05 → multiplica ×100, rebasa a sum=100 |

### 9.2 Coexistencia

- Las dos escalas **coexisten por diseño** en `funds_v3`.
- El runtime normaliza en lectura vía `_as_fraction()` y `as_pct()`.
- No se debe hacer un write masivo para homogeneizar escalas.
- Cada pipeline es responsable de su propia escala.

### 9.3 Zona ambigua

Valores entre **1.0 y 1.5** caen en zona ambigua para `_as_fraction()` (no los divide). En los datos actuales no existen valores en ese rango. El parser debe emitir `asset_mix_guardrail:ambiguous_zone` si detecta componentes en [1.01, 1.50] tras normalización.

### 9.4 Validación por lote

Cada dry-run y cada write futuro debe verificar:

| Check | Criterio | Acción si falla |
|-------|----------|-----------------|
| `asset_mix` sum = 1.0 ± 0.01 | Tolerancia estricta | BLOCKED si fuera de rango |
| Todos los componentes ∈ [0, 1] | Ningún componente negativo ni > 1 | BLOCKED |
| Escala coherente | max(componente) ≤ 1.0 tras normalización | BLOCKED si max > 1.0 |
| `economic_exposure` no presente | S1 no genera `economic_exposure` | BLOCKED si presente en payload S1 |

---

## 10. Política de Write Futuro

### 10.1 Pre-requisitos obligatorios

Cualquier write futuro desde el parser a `funds_v3` requiere **todos** los siguientes pasos:

| # | Paso | Descripción |
|---|------|-------------|
| 1 | **Dry-run previo** | Ejecución completa con `--dry-run`. Artifact JSON generado. |
| 2 | **Artifact archivado** | `parser_dry_run_latest.json` copiado con timestamp/batch-id. |
| 3 | **Diff por ISIN** | Para cada ISIN propuesto, diferencia explícita entre payload propuesto y documento actual en Firestore. |
| 4 | **Snapshot previo** | Lectura del documento Firestore actual para cada ISIN antes del write. Guardado como artifact de backup. |
| 5 | **Verificación de estados** | Solo ISINs con estado ACCEPT o ACCEPT_WITH_WARNINGS (con warnings LOW) pueden escribirse. |
| 6 | **Verificación de invariantes** | `manual.*` ausente. `economic_exposure` ausente. `asset_mix` sum ≈ 1.0. `isin` presente. |
| 7 | **Aprobación manual explícita** | Operador humano revisa diff, aprueba por escrito (o en artifact). |
| 8 | **Flags de CLI** | `--write --confirm-write` ambos presentes. |
| 9 | **Lote pequeño inicial** | Primer write ≤ 10 ISINs. Verificación post-write antes de lotes mayores. |
| 10 | **Rollback manifest** | Snapshot previo permite restaurar el estado anterior por ISIN. |
| 11 | **Post-write verification** | Lectura inmediata del documento tras write. Comparación con payload propuesto. |
| 12 | **Artifact post-write** | JSON con ISINs escritos, timestamps, diff real, estado final. |

### 10.2 Proceso de escalado

```
Lote 1:  ≤ 10 ISINs    → write + verify → si OK:
Lote 2:  ≤ 50 ISINs    → write + verify → si OK:
Lote 3:  ≤ 200 ISINs   → write + verify → si OK:
Lote 4:  Resto          → write + verify
```

### 10.3 Abort conditions

Si en cualquier lote se detecta:

- Un payload con `manual.*` → **ABORT TODO**.
- Un `asset_mix` sum fuera de [0.99, 1.01] → **ABORT ISIN**, continuar resto.
- Un ISIN en estado BLOCKED → **SKIP ISIN**, continuar resto.
- Un ISIN en estado REVIEW → **SKIP ISIN** sin aprobación explícita.
- Una escritura fallida → **ABORT LOTE**, revisar logs.

---

## 11. Relación con Retrocesiones

### 11.1 Separación total

Las retrocesiones (`manual.costs.retrocession`) quedan **completamente fuera** del parser Morningstar. La separación es:

| Aspecto | Parser Morningstar (S1) | Retro Reload (BDB-RETRO-IMPORT) |
|---------|------------------------|--------------------------------|
| Campo | `ms.*`, `derived.*`, `classification_v2`, `portfolio_exposure_v2.asset_mix` | `manual.costs.retrocession` |
| Fuente | PDF Morningstar + Gemini | CSV/Excel operador |
| Escala | 0-1 (asset_mix) | Puntos porcentuales directos |
| Guard | `assertNoManualFields()` | Canon: no convertir nunca |
| Pipeline | `cargador_lotes_v_2.js` | `bdb_retrocession_reload_dry_run.js` |
| Estado | PARSER-POLICY-0 | RETRO_RELOAD_READY_FOR_SOURCE_FILE |

### 11.2 Invariante de no interferencia

```
Parser NUNCA toca manual.costs.retrocession.
Retro reload NUNCA toca ms.*, derived.*, classification_v2, portfolio_exposure_v2.
Ambos usan merge: true.
Ambos requieren doble flag de confirmación para write.
```

---

## 12. Resumen de Decisiones

| Área | Decisión |
|------|----------|
| Default mode | Dry-run. Siempre. |
| Write mode | Requiere `--write --confirm-write`, dry-run previo, snapshot, aprobación manual. |
| `manual.*` | PROHIBIDO en payload. Guard activo. Violación = BLOCKED. |
| `economic_exposure` | NO generado por parser. Responsabilidad de S3. |
| `asset_mix` escala | 0-1. Guardrail activo. |
| `credit_missing` en equity | LOW → ACCEPT_WITH_WARNINGS. |
| `credit_missing` en RF/allocation/monetario | MEDIUM → REVIEW. |
| Oro/minería con equity > 0 | ACCEPT_WITH_WARNINGS. |
| Oro/minería con equity = 0 | REVIEW + `SEMANTIC_REVIEW` tag. Corrección en capa separada. |
| Retrocesiones | Fuera del parser. Pipeline propio. |
| Escalas | Coexisten 0-1 (S1) y 0-100 (S3). No homogeneizar. |
| Primer write | ≤ 10 ISINs con snapshot + rollback manifest. |

---

## 13. Decisión Final

### **`PARSER_POLICY_READY`**

La política está definida y lista para gobernar cualquier write futuro del parser Morningstar a `funds_v3`.

**Warnings que bloquean write automático** (requieren corrección o REVIEW humano):
- `missing_isin` → BLOCKED
- `missing_asset_mix` → BLOCKED
- `asset_mix_sum_out_of_range` → BLOCKED
- `manual_field_attempted` → BLOCKED
- `gemini_parse_error` → BLOCKED
- `pdf_read_error` → BLOCKED
- `credit_missing` en RF/allocation/monetario → REVIEW
- `class_exposure_tension:commodity_with_zero_equity` → REVIEW

**Campos prohibidos** (invariante absoluto):
- `manual.*`
- `manual.costs`
- `manual.costs.retrocession`
- `portfolio_exposure_v2.economic_exposure`

**Siguiente bloque recomendado**:
- `BDB-PARSER-DRYRUN-MEDIUM-0`: Dry-run de 20-50 PDFs variados para medir frecuencia real de REVIEW y acumular evidencia estadística antes de plantear el primer write real.

---

## Artifacts

| Archivo | Contenido |
|---------|-----------|
| `docs/BDB_PARSER_POLICY_0_WRITE_REVIEW_CANON.md` | Este documento |
| `artifacts/bdb_parser_audit/parser_policy_0_write_review_canon.json` | Política en formato máquina |
