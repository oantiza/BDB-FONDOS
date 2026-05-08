# BDB-PARSER-DRYRUN-2 — Small Batch Dry-Run Report

**Fecha**: 2026-05-07  
**Proyecto**: `C:\Users\oanti\Documents\BDB-FONDOS` (legacy)  
**Modo**: DRY-RUN — 0 writes, 0 deploy, 0 push, 0 commits  
**BDB-FONDOS-CORE**: NO tocado  
**Gemini llamado**: SÍ — 5 llamadas reales con `gemini-2.5-flash`  
**Credenciales**: `.env` (GEMINI_API_KEY) — sin serviceAccountKey.json  

---

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| PDFs procesados | **5** |
| OK | **5** |
| REVIEW | **0** |
| ERROR | **0** |
| `dry_run` | `true` |
| `would_write` | `false` |
| Firestore writes | **0** |
| `manual.*` en payload | **AUSENTE** ✅ |
| `manual.costs.retrocession` en payload | **AUSENTE** ✅ |
| `economic_exposure` generado | **NO** (correcto — solo S3 genera esto) |
| `asset_mix` escala | **0-1** ✅ en todos |
| Guardrail de escala activado | **SÍ** — en los 5 PDFs |
| Warnings total | **14** (agrupados por tipo abajo) |

### Veredicto: **`PARSER_SMALL_BATCH_OK_WITH_WARNINGS`**

> [!NOTE]
> Actualizacion BDB-PARSER-REGION-0: el hallazgo R14 de `region_primary` para `Asia ex-Japon` queda corregido en la logica regional. La regla nueva detecta `ex/excluding/sin Japon` antes del match simple de Japon y mapea estos casos a `Asia`, no a `Japon`.

---

## Configuración de Ejecución

```
Comando:
  node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js \
    --dry-run \
    --dir data/dryrun2_input \
    --limit 5 \
    --output-dir artifacts/bdb_parser_audit \
    --concurrency 2

Ruta parser:  scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js
Input:        data/dryrun2_input/ (5 PDFs copiados de data/processed_pdfs/ok/)
Output:       artifacts/bdb_parser_audit/parser_dry_run_latest.json
CSVs:         data/work/subcategory_sectors_mapping.csv
              data/work/subcategory_tokens_mapping.csv
Modelo:       gemini-2.5-flash
```

### Confirmación de Seguridad

| Check | Status |
|-------|--------|
| `--write` ausente | ✅ |
| `--confirm-write` ausente | ✅ |
| `dry_run: true` en artifact | ✅ |
| `would_write: false` en artifact | ✅ |
| `fields_preserved` incluye `manual`, `manual.costs`, `manual.costs.retrocession` | ✅ |
| Firestore no inicializado | ✅ (dry-run no llama getFirestoreDb()) |

---

## PDFs Seleccionados

Criterio de selección: diversidad por domicilio (ES, IE, LU), familia de fondos y ISIN prefix. No fue posible pre-identificar categorías antes de parsear.

| # | Archivo | ISIN | Tamaño |
|---|---------|------|--------|
| 1 | `ES0114633003__2025-12-02__cfec3185.pdf` | ES0114633003 | 88 KB |
| 2 | `ES0137381036__2025-12-02__c04c65b5.pdf` | ES0137381036 | 86 KB |
| 3 | `IE0003867441__2025-12-02__65bd2c2b.pdf` | IE0003867441 | 89 KB |
| 4 | `LU0011889846__2025-12-02__e1a0a1c3.pdf` | LU0011889846 | 89 KB |
| 5 | `LU0073229253__2025-12-29__73608fc3.pdf` | LU0073229253 | 88 KB |

---

## Resultados por PDF

### PDF 1: ES0114633003 — Panda Agriculture & Water Fund FI

| Campo | Valor |
|-------|-------|
| **Nombre** | Panda Agriculture & Water Fund FI |
| **Categoría MS** | Sector Equity Agriculture |
| **Estrellas** | ★★★★★ (5) |
| **Moneda** | EUR |
| **`classification_v2.asset_type`** | `equity` |
| **`asset_subtype`** | `THEMATIC_EQUITY` |
| **`region_primary`** | Global |
| **`market_cap_bias`** | small |
| **`vehicle_complexity`** | thematic |
| **`strategy_tags`** | `sector_concentrated:consumer_defensive`, `sector:consumer_defensive`, `theme:water` |
| **`classification_confidence`** | 0.99 |

**Asset Mix (0-1)**:

| Componente | Valor |
|------------|-------|
| equity | **0.9157** |
| bond | 0.0000 |
| cash | 0.0843 |
| other | 0.0000 |
| **Suma** | **1.0000** ✅ |

**Warnings**: 
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=91.57` — guardrail funcionó
- `unknown_region_key:Asia - Desarrollada` — región no mapeada

**`manual.*`**: AUSENTE ✅  
**Veredicto**: ✅ OK

---

### PDF 2: ES0137381036 — Gesconsult Renta Variable Iberia A FI

| Campo | Valor |
|-------|-------|
| **Nombre** | Gesconsult Renta Variable Iberia A FI |
| **Categoría MS** | RV España |
| **Estrellas** | ★★ (2) |
| **Moneda** | EUR |
| **`classification_v2.asset_type`** | `equity` |
| **`asset_subtype`** | `GLOBAL_EQUITY` |
| **`region_primary`** | Europa |
| **`market_cap_bias`** | large |
| **`vehicle_complexity`** | active |
| **`strategy_tags`** | (vacío) |
| **`classification_confidence`** | 0.99 |

**Asset Mix (0-1)**:

| Componente | Valor |
|------------|-------|
| equity | **0.9331** |
| bond | 0.0549 |
| cash | 0.0120 |
| other | 0.0000 |
| **Suma** | **1.0000** ✅ |

**Warnings**:
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=93.31`
- `credit_missing` (classification_v2 + portfolio_exposure_v2)
- `unknown_region_key:Europa/O. Medio/Africa`
- `regions_sum_overflow:200.00` — regiones suman 200% (macro 100 + detail 200 — típico de PDFs en español)
- `fi_missing_credit_data`

> [!NOTE]
> Este fondo tiene un **5.49% de renta fija** (bonos gobierno España), y el parser correctamente genera `bond_types.corporate` y `duration.ultrashort`. Sin embargo, `credit` es `null` porque Morningstar no reporta datos de credit quality para esta posición menor. Esto genera `credit_missing` warning, que el routing pipeline correctamente ignora en fondos de equity.

**`manual.*`**: AUSENTE ✅  
**Veredicto**: ✅ OK con warnings menores

---

### PDF 3: LU0011889846 — Janus Henderson Horizon Euroland Fund A2 EUR

| Campo | Valor |
|-------|-------|
| **Nombre** | Janus Henderson Horizon Euroland Fund A2 EUR |
| **Categoría MS** | RV Zona Euro Cap. Grande |
| **Estrellas** | ★★★★ (4) |
| **Moneda** | EUR |
| **`classification_v2.asset_type`** | `equity` |
| **`asset_subtype`** | `EUROZONE_EQUITY` |
| **`region_primary`** | Europa |
| **`market_cap_bias`** | large |
| **`vehicle_complexity`** | active |
| **`strategy_tags`** | `sector:industrials` |
| **`classification_confidence`** | 0.99 |

**Asset Mix (0-1)**:

| Componente | Valor |
|------------|-------|
| equity | **0.9816** |
| bond | 0.0000 |
| cash | 0.0184 |
| other | 0.0000 |
| **Suma** | **1.0000** ✅ |

**Warnings**:
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=98.16`

**`manual.*`**: AUSENTE ✅  
**Veredicto**: ✅ OK — **limpio, 0 warnings funcionales**

---

### PDF 4: IE0003867441 — BNY Mellon Small Cap Euroland Fund EUR A Acc

| Campo | Valor |
|-------|-------|
| **Nombre** | BNY Mellon Small Cap Euroland Fund EUR A Acc |
| **Categoría MS** | Eurozone Mid-Cap Equity |
| **Estrellas** | ★★★★ (4) |
| **Moneda** | EUR |
| **`classification_v2.asset_type`** | `equity` |
| **`asset_subtype`** | `THEMATIC_EQUITY` |
| **`region_primary`** | Europa |
| **`market_cap_bias`** | mid |
| **`vehicle_complexity`** | thematic |
| **`strategy_tags`** | `theme:small_cap` |
| **`classification_confidence`** | 0.99 |

**Asset Mix (0-1)**:

| Componente | Valor |
|------------|-------|
| equity | **0.9853** |
| bond | 0.0000 |
| cash | 0.0147 |
| other | 0.0000 |
| **Suma** | **1.0000** ✅ |

**Warnings**:
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=98.53`

**`manual.*`**: AUSENTE ✅  
**Veredicto**: ✅ OK — **limpio**

---

### PDF 5: LU0073229253 — Morgan Stanley Asia Equity Fund A

| Campo | Valor |
|-------|-------|
| **Nombre** | Morgan Stanley Investment Funds - Asia Equity Fund A |
| **Categoría MS** | RV Asia (ex-Japón) |
| **Estrellas** | ★★★★ (4) |
| **Moneda** | USD |
| **`classification_v2.asset_type`** | `equity` |
| **`asset_subtype`** | `THEMATIC_EQUITY` |
| **`region_primary`** | Japón *(⚠️ debería ser Asia ex-Japón)* |
| **`market_cap_bias`** | large |
| **`vehicle_complexity`** | thematic |
| **`strategy_tags`** | `sector:financials`, `sector:technology`, `theme:asia` |
| **`classification_confidence`** | 0.99 |

**Asset Mix (0-1)**:

| Componente | Valor |
|------------|-------|
| equity | **0.9797** |
| bond | 0.0024 |
| cash | 0.0203 |
| other | 0.0000 |
| **Suma** | **1.0024** ⚠️ (1.002 ≈ 1.0, dentro de tolerancia 0.01) |

**Warnings**:
- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=97.97`
- `asset_mix_guardrail:mixed_scale_signal_detected:min_positive_component=0.24,max_component=97.97`
- `credit_missing`
- `fi_type_inference_weak`
- `unknown_region_key:América`
- `unknown_region_key:Asia - Desarrollada`
- `regions_sum_overflow:200.00`

> [!WARNING]
> **Observación semántica**: `region_primary` resuelve a "Japón" pero el fondo es "Asia ex-Japón". La detección de regiones recibe `asia=98.71` pero el nombre del fondo excluye Japón. El token "JAPÓN" en la categoría dispara la clasificación errónea. Esto es un **edge case conocido** del clasificador de regiones.

> [!NOTE]
> **Mixed scale signal**: El componente bond=0.24 (escala 0-100, valor bajo) coexiste con equity=97.97. El guardrail lo detecta correctamente y normaliza todo a 0-1.

**`manual.*`**: AUSENTE ✅  
**Veredicto**: ✅ OK con warnings menores

---

## Análisis de Warnings

### Agrupación por Tipo

| Warning | Ocurrencias | Severidad | Análisis |
|---------|-------------|-----------|----------|
| `asset_mix_guardrail:detected_scale_0_100_divided_by_100` | **5/5** | INFO | Gemini retorna asset_allocation en escala 0-100. El guardrail divide entre 100 correctamente. Comportamiento **esperado y correcto**. |
| `unknown_region_key:Asia - Desarrollada` | 2/5 | LOW | Clave de región en español no mapeada. Afecta a PDFs ES/asiáticos. No impacta routing. |
| `unknown_region_key:Europa/O. Medio/Africa` | 1/5 | LOW | Similar: nombre de macro-región en español no mapeado. |
| `unknown_region_key:América` | 1/5 | LOW | Macro-región en español. |
| `regions_sum_overflow:200.00` | 2/5 | LOW | Macro + detail suman 200%. Típico de PDFs Morningstar en español que reportan ambos niveles. No impacta asset_mix. |
| `credit_missing` | 2/5 | LOW | Fondos equity con posición RF residual (<1%). Morningstar no reporta credit quality para posiciones tan pequeñas. Router ignora correctamente en equity. |
| `fi_type_inference_weak` | 1/5 | LOW | Inferencia de tipo RF débil para posición bond=0.24%. Ignorada por router en equity. |
| `fi_missing_credit_data` | 1/5 | LOW | Idéntico a credit_missing para quality.warnings. |
| `asset_mix_guardrail:mixed_scale_signal_detected` | 1/5 | LOW | Detecta que componente mínimo (0.24) está en escala diferente al máximo (97.97). Guardrail maneja correctamente. |

### Unknown Region Keys — Patrón

Los 3 `unknown_region_key` son **nombres de región en español** de PDFs Morningstar España:
- `Asia - Desarrollada` → debería mapear a región asiática
- `Europa/O. Medio/Africa` → debería mapear a `europe_me_africa`
- `América` → debería mapear a `americas`

Estos warnings existían ya en DRYRUN-1 (`middle_east_africa`). Son candidatos para mejorar el mapeo de regiones del parser, pero **no impactan** la clasificación ni el routing.

---

## Análisis Especial

### 1. Fondo Oro/Minería/Recursos Naturales

**No encontrado** en la selección. Los 5 PDFs son todos equity. Para probar el gap semántico oro/minería detectado en PARSER-AUDIT-0 (R3-HIGH), se necesitaría localizar PDFs de fondos como BGF World Gold o similar en `data/processed_pdfs/ok/`. Estos no se identificaron por nombre de archivo.

### 2. Fondo Mixto/Allocation

**No encontrado**. Los 5 fondos son todos equity puro (>93% equity). Para probar mixtos, se necesitarían ISINs de fondos balanced/allocation.

### 3. Fondo Renta Fija

**No encontrado puro**. Sin embargo, 2 fondos (ES0137381036, LU0073229253) tienen **componente RF residual** (5.49% y 0.24%) que permitió verificar:
- `bond_types` se genera correctamente
- `duration` se infiere como `ultrashort` (maturity=0)
- `credit` queda `null` cuando Morningstar no reporta datos → warning correcto

### 4. Escalas

| ISIN | asset_mix sum | Escala correcta? |
|------|---------------|-------------------|
| ES0114633003 | 1.0000 | ✅ 0-1 |
| ES0137381036 | 1.0000 | ✅ 0-1 |
| LU0011889846 | 1.0000 | ✅ 0-1 |
| IE0003867441 | 1.0000 | ✅ 0-1 |
| LU0073229253 | 1.0024 | ✅ 0-1 (dentro de tolerancia) |

### 5. Hallazgo: `region_primary` para Asia ex-Japón

El fondo LU0073229253 (RV Asia ex-Japón) obtiene `region_primary: "Japón"`. Esto ocurre porque el token "JAPÓN" en la categoría Morningstar `"RV Asia (ex-Japón)"` dispara el match sin considerar la negación "(ex-Japón)". Este es un **edge case del clasificador de regiones** que no se detectó en DRYRUN-1.

**Impacto**: El optimizador usaría "Japón" como región primaria para un fondo que explícitamente excluye Japón. Severidad: **MEDIUM**.

**Estado BDB-PARSER-REGION-0**: corregido. `RV Asia (ex-Japon)` ahora queda como `region_primary: "Asia"` y `Japan Equity` sigue resolviendo a Japon.

---

## Confirmaciones Finales

| Invariante | Status |
|-----------|--------|
| `manual.*` ausente en todos los payloads | ✅ CONFIRMADO |
| `manual.costs.retrocession` ausente | ✅ CONFIRMADO |
| `economic_exposure` no generado | ✅ CONFIRMADO (solo S3 genera esto) |
| `dry_run: true` | ✅ CONFIRMADO |
| `would_write: false` | ✅ CONFIRMADO |
| `fields_preserved` lista `manual`, `manual.costs`, `manual.costs.retrocession` | ✅ CONFIRMADO |
| Escalas asset_mix en 0-1 | ✅ CONFIRMADO (5/5) |
| Guardrail de escala funcionó | ✅ CONFIRMADO (5/5 detectaron 0-100 y normalizaron) |
| Código no modificado | ✅ |
| No deploy | ✅ |
| No push | ✅ |
| No commit | ✅ |

---

## Nuevo Riesgo Detectado

| ID | Riesgo | Severidad | Detalle |
|----|--------|-----------|---------|
| R14 | **Region primary misclassification for "ex-X" categories** | MEDIUM | El token matcher clasifica "RV Asia (ex-Japón)" como `region_primary: "Japón"` por detectar "JAPÓN" sin considerar la negación "(ex-)". Afecta a fondos Asia ex-Japón, Europa ex-Euro, etc. |

> [!NOTE]
> R14 cerrado para Japon en BDB-PARSER-REGION-0 mediante tests unitarios de `Asia ex-Japon`, `Asia ex Japan`, `Asia Pacific ex Japan`, `RV Asia (ex-Japon)`, `Japan Equity`, `Japon`, `Asia` y `Asia Pacific`. Quedan fuera de este bloque posibles reglas futuras para otros `ex-X` distintos de Japon.

---

## Decisión Final

### **PARSER_SMALL_BATCH_OK_WITH_WARNINGS**

- **5/5 PDFs procesados OK** — sin errores, sin REVIEW, sin bloqueos.
- **Guardrail de escala funciona** en el 100% de los casos.
- **`manual.*` protegido** — jamás aparece en los payloads propuestos.
- **Warnings son informativos** — ninguno es bloqueante.
- **2 edge cases documentados** para mejora futura:
  - `unknown_region_key` en español (3 claves no mapeadas).
  - `region_primary` erróneo para categorías con negación "(ex-Japón)".
- **No se encontraron fondos oro/minería/mixtos/RF puros** en la selección. Se recomienda un DRYRUN-3 dirigido con ISINs específicos para validar esos tipos.
- **Parser listo para dry-run de lote mediano** (20-50 PDFs).

---

## Artifacts

| Archivo | Contenido |
|---------|-----------|
| `artifacts/bdb_parser_audit/parser_dry_run_latest.json` | JSON completo con 5 payloads propuestos |
| `docs/BDB_PARSER_DRYRUN_2_SMALL_BATCH.md` | Este informe |
