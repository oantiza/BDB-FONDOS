# BDB-PARSER-REFACTOR-2 - Classifiers And Exposure Builders

Fecha: 2026-05-08

Ruta validada: `C:\Users\oanti\Documents\BDB-FONDOS`

HEAD base: `8211e5e PARSER_REFACTOR_1: extract parser utilities and normalizers`

Decision final: `PARSER_REFACTOR_2_READY_FOR_REVIEW`

## Objetivo

Continuar la modularizacion del parser Morningstar extrayendo de forma mecanica funciones puras o casi puras relacionadas con clasificacion, subtipo y construccion de `portfolio_exposure_v2`, sin cambiar semantica ni ejecutar Gemini, Firestore, deploy, push o parser real contra PDFs.

## Confirmaciones De Seguridad

- BDB-FONDOS-CORE: no tocado, no leido, no buscado.
- Firestore writes: no ejecutados.
- Gemini real: no ejecutado.
- Parser real contra PDFs: no ejecutado.
- Deploy: no ejecutado.
- Push: no ejecutado.
- Commit: no ejecutado.
- Credenciales / `.env`: no tocadas.
- PDFs: no introducidos.
- Raw work dirs / artifacts: no tocados.

## Modulos Creados

- `MORNINGSTAR_PDF_PARSER/src/classify/asset_type_classifier.js`
- `MORNINGSTAR_PDF_PARSER/src/classify/subtype_classifier.js`
- `MORNINGSTAR_PDF_PARSER/src/classify/classification_builder.js`
- `MORNINGSTAR_PDF_PARSER/src/exposure/portfolio_exposure_builder.js`

## Funciones Y Responsabilidades Extraidas

`asset_type_classifier.js`:

- `deriveAssetClassFromCategory`

`subtype_classifier.js`:

- `deriveSubcategories`
- `deriveSectorEquitySubtypeFromTags`
- `topSector`
- `deriveAssetSubtype`
- `deriveFlags`
- `normalizeSubtypeByAssetType`
- Constantes de subtype/sector:
  - `SECTOR_SUBTYPE_FROM_SECTOR_TAG`
  - `STRICT_SECTOR_FUND_MIN_WEIGHT`
  - `TEXT_BACKED_SECTOR_FUND_MIN_WEIGHT`

`classification_builder.js`:

- `assetTypeFromDerivedAssetClass`
- `buildClassificationV2`

`portfolio_exposure_builder.js`:

- `assetMixGuardrailWarningToString`
- `buildPortfolioExposureV2`

## Cambios En El Monolito

Archivo afectado:

- `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`

Cambios mecanicos:

- Importa los nuevos modulos `classify/` y `exposure/`.
- Mantiene wrapper local para `deriveSubcategories` porque depende de mappings cargados por el monolito:
  - `sectorKeyToTag`
  - `tokenMatchers`
- Reemplaza el bloque inline de construccion de `classification_v2` por `buildClassificationV2`.
- Reemplaza el bloque inline de construccion de `portfolio_exposure_v2` por `buildPortfolioExposureV2`.
- Mantiene reexports temporales desde el monolito para tests y compatibilidad.

Lineas del monolito:

- Antes de REFACTOR-2: 3.217 lineas tras REFACTOR-1.
- Despues de REFACTOR-2: 2.719 lineas medidas con Node.
- Reduccion neta aproximada en el monolito: 498 lineas.

## Principio De No Cambio Semantico

La extraccion fue mecanica:

- No se cambiaron thresholds.
- No se cambiaron labels.
- No se cambiaron normalizaciones.
- No se cambiaron warning strings.
- No se cambiaron reglas de asset type/subtype.
- No se cambio CLI.
- No se cambio file flow.
- No se cambio write gate.
- No se cambio Firestore/Gemini.

## Tests Ejecutados

Validaciones ejecutadas:

- `node --check MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_cargador_lotes_v2_hardening.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_region_normalization_ex_japan.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_first_write_controlled.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_file_flow_processed_pdfs.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_parser_golden_outputs.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_refactor1_modules.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_refactor2_classifiers_exposure.js`

Resultados:

- Hardening parser: PASS.
- Region ex-Japan: PASS.
- Write gate: PASS.
- First write controlled: PASS.
- File flow: PASS.
- Golden outputs: 62 passed, 0 failed.
- REFACTOR-1 module tests: 46 passed, 0 failed.
- REFACTOR-2 classifier/exposure tests: 9 passed, 0 failed.

Golden outputs siguen estables.

## Test Nuevo

Nuevo test:

- `MORNINGSTAR_PDF_PARSER/tests/test_refactor2_classifiers_exposure.js`

Cobertura:

- Clasificacion de equity/allocation fixture.
- Clasificacion de fixed income corporate.
- Clasificacion de money market.
- Subtype raw y subtype normalizado.
- Preservacion de `classification_v2`.
- Preservacion de `portfolio_exposure_v2.asset_mix`.
- Buckets de renta fija (`bond_types`, `credit`, `duration`).
- Reexports desde monolito.

## Riesgos Mitigados

- Golden outputs evitan drift semantico.
- Los nuevos modulos son puros: sin IO, sin Firestore, sin Gemini.
- El monolito conserva exports temporales para tests.
- `deriveSubcategories` mantiene acceso a los mappings ya cargados por el monolito mediante wrapper, evitando reordenar config/CSV en este bloque.

## Riesgos Pendientes

- La inferencia de renta fija (`fixedIncomeType`, `creditBucket`, `durationBucket`) sigue inline y es candidata a extraccion posterior.
- El builder de `derived` no se extrajo porque sigue mezclado con style bias, exposure totals y heuristicas de RF.
- El parser aun conserva CLI, IO, Gemini, Firestore init y manifest/file flow en el monolito.

## Que No Se Hizo

- No deploy.
- No push.
- No commit.
- No Firestore writes.
- No Gemini real.
- No parser real contra PDFs.
- No CORE.
- No PDFs.
- No retrocesiones.
- No admin console.
- No optimizer.

## Siguiente Bloque Recomendado

Revision del diff y commit limpio de REFACTOR-2.

Despues del commit, REFACTOR-3 recomendado:

- Extraer inferencia de renta fija (`fixed_income_classifier`).
- Extraer `derived_builder` solo si golden outputs siguen estables.
- Mantener el mismo esquema de tests antes/despues.

## Estado

`PARSER_REFACTOR_2_READY_FOR_REVIEW`
