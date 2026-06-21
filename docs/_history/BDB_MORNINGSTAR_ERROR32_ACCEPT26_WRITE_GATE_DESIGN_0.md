# DESIGN: BDB-MORNINGSTAR-ERROR32-ACCEPT26-WRITE-GATE-DESIGN-0

**Estado:** documento de diseño. **NO se escribe nada todavía.** No se han creado artifacts ejecutables, no se ha tocado Firestore, no hay commit, no hay push.

**Fecha:** 2026-05-21
**Proyecto:** BDB-FONDOS (legacy real). No se toca `BDB-FONDOS-CORE` ni `funds_core_v1`.
**Colección destino futura:** `funds_v3`.
**Alcance:** sólo los 26 fondos `ACCEPT_AFTER_REPARSE` recuperados del ciclo ERROR-32.

---

## 1. Resumen ejecutivo

El ciclo ERROR-32 dejó 32 fondos en estado de error de parseo. Tras el bugfix `91d4842` (smart-quotes Mojibake en `response_parser.js`) y la reparse dry-run documentada en `docs/BDB_MORNINGSTAR_ERROR_32_REPARSE_DRYRUN_0.md`, la clasificación final es:

| Bucket | Cantidad | Tratamiento futuro |
|---|---|---|
| `ACCEPT_AFTER_REPARSE` | 26 | **Candidatos a write_gate** (este documento) |
| `REVIEW_AFTER_REPARSE` | 4 | Cola de review separada (no en este gate) |
| `STILL_ERROR` | 1 (`LU0568620560`) | Enriquecimiento manual cash profile |
| `NEEDS_MANUAL_DATA` | 1 (`LU1814994353`) | Inserción manual del asset mix en `funds_v3` |

Este documento propone el diseño del **write gate futuro** para los 26 ACCEPT, alineado con el patrón usado en el gate anterior de 520 fondos (`MORNINGSTAR_PDF_PARSER/src/lib/write_gate.js`). El objetivo es preparar exclusivamente los **manifests** (no el ejecutable de write) en un siguiente bloque.

**Verificación cruzada efectuada (sin tocar Firestore ni el repo):**

* `canonical/` del archivo externo contiene **30 ISIN JSON** = 26 ACCEPT + 4 REVIEW (correcto).
* `LU0568620560` (STILL_ERROR) y `LU1814994353` (NEEDS_MANUAL_DATA) **NO aparecen** en `canonical/`. ✅
* `batch_manifest.json` reporta `ok_count=26 review_count=4 error_count=2 total_files=32` — coherente.

---

## 2. Los 26 candidatos (write_candidate = SÍ)

Lista cerrada extraída de `batch_manifest.json` (status=`ok`):

| # | ISIN | Fondo | status | write_candidate | motivo |
|---|---|---|---|---|---|
| 1 | LU0189895229 | Schroder ISF Global High Yield B Acc EUR Hedged | ok | **SÍ** | Parseo limpio, sin warnings bloqueantes |
| 2 | LU0284396289 | DNCA Invest Value Europe Class B shares EUR | ok | **SÍ** | RV: warnings de crédito relajados |
| 3 | LU0778324086 | Fidelity Funds - Asian Special Situations E-Acc-EUR | ok | **SÍ** | RV: warnings de crédito relajados |
| 4 | IE00B986FT65 | Neuberger Berman Emerging Market Debt Hard Currency EUR A Acc | ok | **SÍ** | RF: warnings de región relajados |
| 5 | LU0920839429 | Allianz GI Europe Equity Growth Select CT EUR | ok | **SÍ** | Parseo limpio |
| 6 | LU0117858166 | JPMorgan Funds - Euroland Equity D (acc) EUR | ok | **SÍ** | RV: warnings de crédito relajados |
| 7 | LU1103307408 | GS Absolute Return Tracker Acc EUR-Hedged | ok | **SÍ** | Alternativo: bond ≤ 25%, crédito ignorado |
| 8 | LU1061675168 | GS Frontier Markets Debt Hard Currency X Cap EUR Hedged | ok | **SÍ** | Parseo limpio |
| 9 | LU1191877379 | BlackRock GF - European High Yield Bond A2 | ok | **SÍ** | Parseo limpio |
| 10 | LU0995386439 | EDM Inversion Spanish Equity R EUR | ok | **SÍ** | RV: warnings de crédito/duración relajados |
| 11 | LU1278917536 | DWS Invest CROCI Sectors Plus NC | ok | **SÍ** | Parseo limpio, sin warnings |
| 12 | LU1278917452 | DWS Invest CROCI Sectors Plus LC | ok | **SÍ** | RV: warnings de crédito relajados |
| 13 | LU1769941003 | DWS Invest CROCI World Value LC | ok | **SÍ** | Parseo limpio |
| 14 | LU1951204046 | Natixis IF - Mirova Thematic Meta RA EUR | ok | **SÍ** | RV: warnings de crédito relajados |
| 15 | LU1917163617 | BlackRock GF - FinTech E2 | ok | **SÍ** | RV: warnings de crédito relajados |
| 16 | LU1965927921 | DWS Invest ESG Floating Rate Notes LC | ok | **SÍ** | RF: soft credit warnings relajados |
| 17 | LU1982200609 | DWS Invest Corporate Green Bonds LC | ok | **SÍ** | RF: soft credit warnings relajados |
| 18 | LU2240056015 | Lonvia Mid-Cap Europe Retail | ok | **SÍ** | RV: warnings de crédito relajados |
| 19 | LU2338974699 | Natixis IF - WCM Select Global Growth Equity FA EUR | ok | **SÍ** | Parseo limpio |
| 20 | LU2697545247 | BGF Euro Investment Grade Fixed Maturity Bond 2028 A2 | ok | **SÍ** | Parseo limpio |
| 21 | LU2348336004 | FF - Climate Solutions Fund E-ACC-EUR | ok | **SÍ** | Parseo limpio |
| 22 | LU2240056445 | Lonvia Mid-Cap Euro Retail | ok | **SÍ** | RV: warnings de crédito/duración relajados |
| 23 | LU2375689580 | Sigma Investment House FCP - Global Equity A EUR Income | ok | **SÍ** | RV: warnings de crédito relajados |
| 24 | LU2697545163 | BGF Euro High Yield Fixed Maturity Bond 2027 A2 | ok | **SÍ** | Parseo limpio |
| 25 | LU2376061086 | FF - Climate Solutions Fund A-Acc-EUR | ok | **SÍ** | RV: warnings de crédito relajados |
| 26 | LU2743151057 | Natixis IF - Ossiam Shiller Barclays CAPE US RA EUR | ok | **SÍ** | RV: warnings de crédito relajados |

**Total: 26 ACCEPT_AFTER_REPARSE → write_candidate = SÍ**

---

## 3. Los 6 excluidos explícitamente (write_candidate = NO)

| # | ISIN | Fondo | status | write_candidate | motivo |
|---|---|---|---|---|---|
| 27 | LU0352312184 | Allianz Strategy 50 CT EUR | review | **NO** | REVIEW_AFTER_REPARSE — credit_missing en mixto con bond > 5% |
| 28 | LU0512121004 | DNCA Invest Eurose Class B shares EUR | review | **NO** | REVIEW_AFTER_REPARSE — credit_missing en mixto con bond > 5% |
| 29 | DE000A0X7541 | Acatis Value Event Fonds A | review | **NO** | REVIEW_AFTER_REPARSE — credit_missing en mixto con bond > 5% |
| 30 | LU1899018870 | Sigma Investment House FCP - Best M&G A EUR Acc | review | **NO** | REVIEW_AFTER_REPARSE — credit_missing + duration_missing |
| 31 | LU0568620560 | Amundi Funds - Cash EUR A2 EUR (C) | error_math_validation | **NO** | STILL_ERROR — money market: requiere enriquecimiento manual de cash profile |
| 32 | LU1814994353 | Azvalor Lux SICAV Altum Faith - Consistent Equity R | error_math_validation | **NO** | NEEDS_MANUAL_DATA — Gemini devuelve 0% en allocations: requiere inserción manual en `funds_v3` |

> Verificación: ninguno de estos 6 ISIN está en la lista de los 26 candidatos.

---

## 4. Patrón de referencia (gate de 520 fondos)

Fuente: `MORNINGSTAR_PDF_PARSER/src/lib/write_gate.js`. Se reutiliza la misma máquina de estados y la misma lista de campos prohibidos.

**`DECISIONS`** (estados aplicables al gate ERROR32-ACCEPT26):

| Decision | Cuándo aplica en este gate |
|---|---|
| `WRITE_CANDIDATE` | ACCEPT con payload válido, snapshot disponible y diff no vacío |
| `REVIEW_REQUIRES_EXPLICIT_APPROVAL` | No aplica — los REVIEW se gestionan en un gate separado |
| `BLOCKED_NEVER_WRITE` | No aplica — no se incluyen BLOCKED en este lote |
| `SKIP_MISSING_SNAPSHOT` | Si falta snapshot live de un ISIN al preparar |
| `SKIP_FORBIDDEN_FIELD` | Si el canonical contiene cualquier campo prohibido (no debería, ver §6) |
| `SKIP_NO_CHANGE` | Si el diff respecto al doc actual es vacío |
| `SKIP_DIFF_EMPTY` | Variante sin payload propuesto |
| `SKIP_POLICY` | Status no permitido o exceso de candidatos |

---

## 5. Campos PERMITIDOS para escritura

Basado en la estructura del canonical (ver `canonical/LU0189895229.json` como referencia) y alineado con el patrón del gate 520 (que no restringe nada salvo los `FORBIDDEN_PATHS`):

| Path en `funds_v3` | Origen en canonical | Notas |
|---|---|---|
| `classification_v2` (subárbol completo) | canonical.classification_v2 | version v2, asset_type, asset_subtype, region_primary, fixed_income_type, credit_bucket, duration_bucket, strategy_tags, classification_confidence, sources_used, warnings, etc. |
| `portfolio_exposure_v2` **salvo** `economic_exposure` | canonical.portfolio_exposure_v2 | version v2, asset_mix, bond_types, credit, duration, equity_regions, sectors, equity_styles, market_caps, alternatives, exposure_confidence, warnings |
| `ms` (subárbol completo) | canonical.ms | raw Morningstar payload — siempre que ya formaba parte del patrón canónico del ciclo anterior (520) |
| `derived` (subárbol completo) | canonical.derived | asset_class, asset_subtype, primary_region, subcategories, top_sector, top_sector_weight, is_sector_fund, is_thematic, is_index_like, confidence, ruleset_version, reasons |
| `data_quality` / `quality` | canonical.quality | parser_version, source_pdf_hash, warnings, ok, parsed_at — **sólo si el ciclo 520 las escribía**. En caso de duda en el bloque de write, comprobar primero contra un fondo del ciclo 520 ya promovido. |
| `report_date` | canonical.report_date | Para auditoría |
| `name`, `currency` | canonical | Sólo si cambian respecto al doc actual; si no, `SKIP_NO_CHANGE` los filtra |

> **Política operativa**: el payload propuesto = JSON canónico filtrado para eliminar todo path en `FORBIDDEN_PATHS`. El diff por leaf-path determina qué se actualiza realmente; el resto se filtra automáticamente como `SKIP_NO_CHANGE`.

---

## 6. Campos PROHIBIDOS (nunca escribir, ni siquiera si vinieran en el canonical)

Lista cerrada, replicada **literal** del gate 520 (`FORBIDDEN_PATHS` en `write_gate.js`):

```
manual
manual.costs
manual.costs.retrocession
portfolio_exposure_v2.economic_exposure
```

Y, por extensión vía `findForbiddenParserFields`:

* cualquier subpath bajo `manual.*`
* cualquier subpath bajo `portfolio_exposure_v2.economic_exposure.*`

**Adicionales para este bloque (precaución por norma del usuario):**

* `compatible_profiles` — **prohibido** en este lote. Sólo se tocaría si se confirma documentalmente que el ciclo 520 lo modificaba (en caso de duda: bloqueado por convención).
* Cualquier campo no presente en el patrón del gate 520 — bloqueado.
* No se crean documentos nuevos: si un ISIN no existe en `funds_v3`, el gate emite `SKIP_MISSING_SNAPSHOT`.

> Si el canonical incluyera por error alguno de estos paths, el gate emite `SKIP_FORBIDDEN_FIELD` para ese ISIN — no se escribe parcialmente.

---

## 7. Pre-write checks obligatorios

Ejecutados por la futura preparación del gate, **antes** de cualquier write executable:

1. **Pertenencia exclusiva al lote**
   * Los 26 ISIN ACCEPT están exactamente en la lista cerrada de la §2.
   * Ningún REVIEW (§3 filas 27-30) está incluido.
   * Ningún ERROR (§3 filas 31-32) está incluido.

2. **Existencia en `funds_v3`**
   * Para cada uno de los 26 ISIN: `funds_v3/{ISIN}` debe existir.
   * Si no existe → `SKIP_MISSING_SNAPSHOT`, no se crea doc nuevo en este lote.

3. **Snapshot live vs canonical (drift check)**
   * Capturar `current_firestore_doc` por ISIN antes de proponer cualquier diff.
   * Si alguna métrica clave del documento live es **más reciente** que `report_date` del canonical (p. ej. `ms.report_date` superior, o `parser_version` posterior) → bloquear ese ISIN por **drift**.
   * Compare por `report_date` y `parser_version` antes de aceptar el diff.

4. **Preservación de `manual.*`**
   * El snapshot live debe contener `manual.costs.retrocession` (o explícitamente confirmar su ausencia previa).
   * Tras simular el merge: `current_firestore_doc.manual.*` permanece **bit a bit** igual.
   * Si el diff toca cualquier path bajo `manual.*` → `SKIP_FORBIDDEN_FIELD`.

5. **Preservación de `compatible_profiles`**
   * El snapshot live debe contener `compatible_profiles` intacto en el plan post-merge.
   * Si el diff toca este path → `SKIP_FORBIDDEN_FIELD`.

6. **Preservación de `portfolio_exposure_v2.economic_exposure`**
   * Si el canonical incluye este path → `SKIP_FORBIDDEN_FIELD`.
   * Si el snapshot live lo tiene → debe permanecer bit a bit igual tras el merge propuesto.

7. **No overlap con REVIEW/ERROR pendientes**
   * Antes de generar el gate, intersecar los 26 ISIN con cualquier cola pendiente de revisión externa. Si hay overlap → bloquear.

8. **Coherencia matemática del exposure**
   * `Σ portfolio_exposure_v2.asset_mix.{equity,bond,cash,other}` debe estar en `[0.95, 1.05]` (chequeo ya presente en el gate 520 — `portfolio_exposure_v2.asset_mix_sum_valid_0_95_to_1_05`).

9. **Diff no vacío**
   * Si el documento live ya es exactamente igual al canonical → `SKIP_NO_CHANGE`.

10. **No creación de documentos nuevos**
    * Reafirmado: `current_doc === null` ⇒ `SKIP_MISSING_SNAPSHOT`. El gate **nunca** propone `create` en este lote.

---

## 8. Diseño de artifacts (estructura futura, NO se crean en este bloque)

Ruta planificada:

```
artifacts/morningstar_error32_accept26_write_gate_0/
├── selection.json
├── snapshots_before.json
├── diff_manifest.json
├── rollback_manifest.json
├── write_approval_manifest.json
├── live_verification_0.json
├── post_write_verification_plan.json
└── snapshots/
    ├── LU0189895229.json
    ├── LU0284396289.json
    └── ... (uno por candidato, 26 en total)
```

### 8.1 `selection.json`

```jsonc
{
  "generated_at": "<ISO timestamp>",
  "source_batch": "morningstar_error32_reparse_2026-05-21",
  "policy": "ERROR32_ACCEPT_AFTER_REPARSE_ONLY",
  "candidate_count": 26,
  "candidates": [
    { "isin": "LU0189895229", "policy_status": "ACCEPT", "source": "canonical/LU0189895229.json" },
    /* ...los 26... */
  ],
  "excluded": [
    { "isin": "LU0352312184", "reason": "REVIEW_AFTER_REPARSE" },
    { "isin": "LU0512121004", "reason": "REVIEW_AFTER_REPARSE" },
    { "isin": "DE000A0X7541", "reason": "REVIEW_AFTER_REPARSE" },
    { "isin": "LU1899018870", "reason": "REVIEW_AFTER_REPARSE" },
    { "isin": "LU0568620560", "reason": "STILL_ERROR" },
    { "isin": "LU1814994353", "reason": "NEEDS_MANUAL_DATA" }
  ],
  "forbidden_paths": [
    "manual", "manual.costs", "manual.costs.retrocession",
    "portfolio_exposure_v2.economic_exposure", "compatible_profiles"
  ]
}
```

### 8.2 `snapshots_before.json`

Read-only snapshot por ISIN de `funds_v3/{ISIN}` ANTES de cualquier escritura.
Sin write a Firestore: el helper hará `get()`, no `set()`/`update()`.

```jsonc
{
  "generated_at": "...",
  "dry_run": true,
  "write_executed": false,
  "entries": [
    {
      "isin": "LU0189895229",
      "document_exists": true,
      "current_firestore_doc": { /* doc tal cual */ },
      "fingerprint_pre_merge": "<sha256 del doc serializado estable>"
    }
    /* ...los 26... */
  ]
}
```

### 8.3 `diff_manifest.json`

Mismo formato que el gate 520: un entry por ISIN con `diff.changed_fields` (path/current/proposed) y `diff.unchanged_fields`. Marca `forbidden_fields_detected` (debería estar vacío para los 26).

### 8.4 `rollback_manifest.json`

Por ISIN: lista `fields_that_would_be_restored = [{ path, restore_value }]` con el valor previo de cada path modificado, exactamente como hace el gate 520. Permite revertir el batch si algo sale mal en el write.

### 8.5 `write_approval_manifest.json`

Réplica directa de `buildManifests.approvalManifest` del 520, con:

* `approval_required: true`
* `approved_isins`: vacío inicialmente — se rellena en el bloque siguiente cuando se haga la aprobación manual.
* `candidates`: los 26 ISIN con `policy_status: "ACCEPT"` y `approval_status: "PENDING_MANUAL_APPROVAL"`.
* `excluded_review`: los 4 REVIEW (referencia, no escribibles aquí).
* `blocked`: vacío.
* `skipped`: los 2 ERROR + cualquier ISIN que falle pre-checks.

### 8.6 `live_verification_0.json`

Nuevo respecto al 520 — pensado para este lote. Recorre los 26 ISIN, sin escribir, contra Firestore y registra:

* existencia del doc,
* presencia/integridad de `manual.costs.retrocession`,
* presencia de `compatible_profiles`,
* `parser_version` actual,
* `report_date` actual,
* hash del subárbol `manual`,
* warnings o discrepancias contra el canonical.

Si cualquier ISIN devuelve "stale snapshot" o drift, queda anotado para que el gate lo pase a `SKIP_*` antes del write.

### 8.7 `post_write_verification_plan.json`

Mismo set de checks del gate 520, ampliado para este bloque:

```jsonc
{
  "checks": [
    "document_exists",
    "proposed_fields_updated",
    "forbidden_fields_unchanged",
    "manual_fields_unchanged",
    "manual.costs.retrocession_bit_for_bit_equal",
    "compatible_profiles_unchanged",
    "portfolio_exposure_v2.economic_exposure_unchanged",
    "portfolio_exposure_v2.asset_mix_sum_valid_0_95_to_1_05",
    "parser_metadata_or_warnings_present_when_applicable",
    "report_date_not_regressed"
  ]
}
```

### 8.8 `snapshots/{ISIN}.json`

Uno por candidato, contiene snapshot pre-merge + decisión + diff + rollback plan (igual al gate 520).

---

## 9. Riesgos identificados

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Sobrescritura accidental de `manual.costs.retrocession` | Baja-Media (canonical no debería contenerla) | `FORBIDDEN_PATHS` + check post-write bit a bit |
| Drift entre canonical (2026-05-17) y doc live actual | Media | `live_verification_0.json` + comparación `report_date`/`parser_version` antes de aceptar el diff |
| ISIN inexistente en `funds_v3` | Baja | `SKIP_MISSING_SNAPSHOT`, nunca crear documentos nuevos |
| Suma de `asset_mix` fuera de `[0.95, 1.05]` | Baja (validation.ok=true en los 26) | Check ya en place; abortar ISIN si falla |
| Mezcla involuntaria con los 4 REVIEW | Baja | Selection cerrada y validada en §2; pre-check 1 |
| Mezcla con los 2 ERROR | Muy baja | Mismo control que arriba |
| Pérdida del flag `manualSwap` / `isLocked` del frontend | N/A | Estos flags viven en el cliente, no en `funds_v3` — fuera de alcance |
| Eliminación silenciosa de `compatible_profiles` | Baja-Media | Añadido explícitamente a `FORBIDDEN_PATHS` para este lote + check post-write |
| Doble ejecución del gate (idempotencia) | Baja | `SKIP_NO_CHANGE` cubre la segunda pasada cuando los pesos ya están aplicados |
| Truncación de payloads por límites de Firestore | Muy baja (canonical ≤ 20 KB típico) | No procede para este tamaño de payload |

---

## 10. Confirmación de invariantes

* **NO Firestore writes**: ningún `set()`, `update()`, `delete()`, `commit()` se ha ejecutado ni se ejecutará en este bloque.
* **NO deploy**: no se ha desplegado nada.
* **NO push**: no se ha empujado nada.
* **NO commit**: no se ha hecho commit. `origin/master..HEAD` permanece vacío. Staged vacío. Working tree limpio en contenido (sólo ruido CRLF irrelevante del mount).
* **NO CORE tocado**: `BDB-FONDOS-CORE` y `funds_core_v1` no se han tocado.
* **NO frontend tocado** en este bloque.
* **NO artifacts restaurados al repo**: el archivo externo `BDB-FONDOS_LOCAL_ARCHIVE/morningstar_error32_reparse_2026-05-21/` se ha leído pero no copiado al repo.
* **NO write gate ejecutable creado**: no existe ningún script de write nuevo. Sólo este documento de diseño.

---

## 11. Recomendación de siguiente bloque

**Bloque siguiente sugerido:** `BDB-MORNINGSTAR-ERROR32-ACCEPT26-WRITE-GATE-DRYRUN-0`.

Alcance del bloque siguiente (sin write executable todavía):

1. Crear la carpeta `artifacts/morningstar_error32_accept26_write_gate_0/` (vacía o con placeholders).
2. Capturar `snapshots_before.json` mediante un script read-only que use `getDoc()` contra `funds_v3` para cada uno de los 26 ISIN. **Sin** `set()`/`update()`.
3. Generar `selection.json` con los 26 candidatos + 6 excluidos.
4. Generar `live_verification_0.json` para detectar drift y faltantes.
5. Ejecutar `buildWriteGatePlan` reutilizando `src/lib/write_gate.js` para producir:
   * `diff_manifest.json`
   * `rollback_manifest.json`
   * `write_approval_manifest.json`
   * `post_write_verification_plan.json`
   * `snapshots/{ISIN}.json` por candidato
6. **NO** preparar todavía el ejecutable de write. Eso queda para un tercer bloque (`...-WRITE-EXECUTE-0`) con aprobación manual explícita por ISIN.

---

## 12. Tabla resumen final

| ISIN | fondo | status | write_candidate | motivo |
|---|---|---|---|---|
| LU0189895229 | Schroder ISF Global High Yield B Acc EUR Hedged | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU0284396289 | DNCA Invest Value Europe B EUR | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU0778324086 | Fidelity Asian Special Situations E-Acc-EUR | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| IE00B986FT65 | Neuberger Berman EM Debt Hard Currency EUR A Acc | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU0920839429 | Allianz GI Europe Equity Growth Select CT EUR | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU0117858166 | JPMorgan Euroland Equity D (acc) EUR | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU1103307408 | GS Absolute Return Tracker Acc EUR-Hedged | ACCEPT_AFTER_REPARSE | **SÍ** | alt: bond ≤ 25% |
| LU1061675168 | GS Frontier Markets Debt Hard Currency X Cap EUR Hgd | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU1191877379 | BlackRock European High Yield Bond A2 | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU0995386439 | EDM Inversion Spanish Equity R EUR | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU1278917536 | DWS Invest CROCI Sectors Plus NC | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU1278917452 | DWS Invest CROCI Sectors Plus LC | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU1769941003 | DWS Invest CROCI World Value LC | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU1951204046 | Natixis Mirova Thematic Meta RA EUR | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU1917163617 | BlackRock FinTech E2 | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU1965927921 | DWS Invest ESG Floating Rate Notes LC | ACCEPT_AFTER_REPARSE | **SÍ** | RF |
| LU1982200609 | DWS Invest Corporate Green Bonds LC | ACCEPT_AFTER_REPARSE | **SÍ** | RF |
| LU2240056015 | Lonvia Mid-Cap Europe Retail | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU2338974699 | Natixis WCM Select Global Growth Equity FA EUR | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU2697545247 | BGF Euro IG Fixed Maturity Bond 2028 A2 | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU2348336004 | FF Climate Solutions E-ACC-EUR | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU2240056445 | Lonvia Mid-Cap Euro Retail | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU2375689580 | Sigma IH Global Equity A EUR Income | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU2697545163 | BGF Euro HY Fixed Maturity Bond 2027 A2 | ACCEPT_AFTER_REPARSE | **SÍ** | parseo limpio |
| LU2376061086 | FF Climate Solutions A-Acc-EUR | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU2743151057 | Natixis Ossiam Shiller CAPE US RA EUR | ACCEPT_AFTER_REPARSE | **SÍ** | RV |
| LU0352312184 | Allianz Strategy 50 CT EUR | REVIEW_AFTER_REPARSE | NO | credit_missing en mixto |
| LU0512121004 | DNCA Invest Eurose B EUR | REVIEW_AFTER_REPARSE | NO | credit_missing en mixto |
| DE000A0X7541 | Acatis Value Event Fonds A | REVIEW_AFTER_REPARSE | NO | credit_missing en mixto |
| LU1899018870 | Sigma IH FCP - Best M&G A EUR Acc | REVIEW_AFTER_REPARSE | NO | credit_missing + duration_missing |
| LU0568620560 | Amundi Funds - Cash EUR A2 EUR (C) | STILL_ERROR | NO | money market: cash profile manual |
| LU1814994353 | Azvalor Altum Faith - Consistent Equity R | NEEDS_MANUAL_DATA | NO | Gemini devuelve 0%: manual en `funds_v3` |

---

## 13. Confirmación final

```
Firestore writes        = 0
Deploy                  = NO
Push                    = NO
Commit                  = NO
CORE tocado             = NO
Frontend tocado         = NO
Artifacts restaurados   = NO
Write gate ejecutable   = NO
Documento de diseño     = SÍ (este archivo)
```

**Estado del repo verificado:**

* `git status --short`: sólo ruido CRLF del mount Linux (1.288.338 inserciones = 1.288.338 eliminaciones — sin cambios reales de contenido).
* `git log --oneline origin/master..HEAD`: vacío.
* `git diff --cached --name-status`: vacío.

Listo para que el siguiente bloque (`...-WRITE-GATE-DRYRUN-0`) genere los manifests sin escribir nada en Firestore.
