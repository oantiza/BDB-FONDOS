# BDB-PARSER-REFACTOR-1 - Utils And Normalizers

Fecha: 2026-05-08

Ruta validada: `C:\Users\oanti\Documents\BDB-FONDOS`

HEAD base observado: `5dcd4d6 CSV_RECENTER_AUDIT: add funds_v3 CSV recentering reports`

Decision: `PARSER_REFACTOR_1_READY`

## Confirmaciones De Seguridad

- BDB-FONDOS-CORE: no tocado, no leido, no buscado.
- Firestore writes: no ejecutados.
- Gemini real: no ejecutado.
- Deploy: no ejecutado.
- Push: no ejecutado.
- Credenciales: no tocadas.
- PDFs reales: no incluidos.
- Raw work dirs/artifacts temporales: fuera del commit.

## Objetivo

Consolidar el plan de modularizacion y la primera extraccion segura del parser Morningstar, manteniendo comportamiento estable mediante fixtures golden y tests de modulo.

## REFACTOR-0

Se agrego el plan de modularizacion:

- `docs/BDB_PARSER_REFACTOR_0_PLAN.md`

Se agregaron fixtures golden para cubrir salidas representativas:

- `MORNINGSTAR_PDF_PARSER/tests/fixtures/golden/equity_global_normal.json`
- `MORNINGSTAR_PDF_PARSER/tests/fixtures/golden/fixed_income_corporate.json`
- `MORNINGSTAR_PDF_PARSER/tests/fixtures/golden/money_market_short.json`

Se agrego test golden:

- `MORNINGSTAR_PDF_PARSER/tests/test_parser_golden_outputs.js`

## REFACTOR-1

Se extrajeron utilidades y normalizadores puros desde:

- `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`

Nuevos modulos:

- `MORNINGSTAR_PDF_PARSER/src/utils/number_utils.js`
- `MORNINGSTAR_PDF_PARSER/src/normalize/text_normalizer.js`
- `MORNINGSTAR_PDF_PARSER/src/normalize/region_normalizer.js`
- `MORNINGSTAR_PDF_PARSER/src/normalize/asset_mix_normalizer.js`
- `MORNINGSTAR_PDF_PARSER/src/normalize/sector_normalizer.js`

Nuevo test de modulos:

- `MORNINGSTAR_PDF_PARSER/tests/test_refactor1_modules.js`

## Responsabilidades Extraidas

`number_utils.js`:

- `cleanString`
- `isPlainObject`
- `parseNum`
- `clampPct`
- `clamp01`
- `approxEqual`
- `hasAnyFiniteNumber`
- `argmaxKey`
- `scalePctMap`
- `deleteUndefinedDeep`
- `pctFromAliases`
- `numFromAliases`
- `strFromAliases`
- `normalizePctBucketObject`
- `cleanRegionKeyBasic`

`text_normalizer.js`:

- `normalizeTextForTokens`

`region_normalizer.js`:

- `REGION_MAPPINGS`
- `REGION_LOOKUP`
- `IGNORE_KEYS`
- `BENIGN_UNKNOWN_REGION_KEYS`
- `cleanRegionKey`
- `normalizeRegions`
- `hasExcludedJapanRegionText`
- `hasJapanRegionText`
- `hasLatinAmericaIdentity`
- `derivePrimaryRegion`

`asset_mix_normalizer.js`:

- `validateAssetMix`
- `validateChildMapAgainstParent`
- `validateCanonicalMath`
- `sanitizeAssetMixForExposureBuilder`
- `normalizeExposureMapToParent01`

`sector_normalizer.js`:

- `normalizeSectors`

## Lineas Antes Y Despues

La base REFACTOR-0 documento un monolito de aproximadamente 3.744 lineas.

En este workspace, tras REFACTOR-1, `cargador_lotes_v_2.js` queda en 3.217 lineas medidas por Node con `split(/\r?\n/)`.

El diff del monolito en este bloque muestra:

- 94 inserciones.
- 599 borrados.
- Reduccion neta aproximada: 505 lineas.

## TDZ Issue Y Resolucion

Durante la extraccion se evito que el monolito usara funciones antes de inicializar sus imports. Las dependencias puras se importan al inicio y se reasignan a constantes locales antes de que el resto del parser las use.

Los modulos extraidos no dependen del parser completo y no inicializan Firestore, Gemini ni filesystem operativo.

## Exports Temporales / Reexports

El parser conserva exports de funciones internas para tests golden y compatibilidad de hardening. REFACTOR-1 mantiene reexports desde el monolito hacia los modulos extraidos para que las suites existentes puedan seguir validando el contrato sin ejecutar el parser real contra PDFs.

## Tests Ejecutados En Este Bloque

Suite prevista:

- `node --check MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_cargador_lotes_v2_hardening.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_region_normalization_ex_japan.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_first_write_controlled.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_file_flow_processed_pdfs.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_parser_golden_outputs.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_refactor1_modules.js`

Resultado confirmado del bloque:

- 7 suites PASS.
- 108/108 assertions PASS.
- 62 golden assertions PASS.
- 46 module assertions PASS.

## Riesgos Pendientes

- El parser sigue siendo monolitico en CLI, IO, Gemini, mapping y payload building.
- Algunos exports internos siguen siendo temporales para pruebas de contrato.
- El siguiente refactor debe mantener golden outputs antes de extraer clasificadores o exposure builders.
- No ejecutar writes hasta que el write gate y approval manifests sigan pasando tras nuevas extracciones.

## Siguiente Bloque Recomendado

`REFACTOR-2 classifiers/exposure`

Objetivo sugerido:

- Extraer clasificadores puros.
- Extraer builders de exposure/payload.
- Mantener fixtures golden sin cambios.
- No ejecutar Gemini real ni Firestore writes.

## Estado

`PARSER_REFACTOR_1_READY`
