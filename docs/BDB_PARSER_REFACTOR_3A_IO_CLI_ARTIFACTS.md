# BDB_PARSER_REFACTOR_3A_IO_CLI_ARTIFACTS

Fecha: 2026-05-08

Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`

Decision: `PARSER_REFACTOR_3A_READY_FOR_REVIEW`

## 1. Resumen ejecutivo

REFACTOR-3A extrae componentes de bajo riesgo del parser Morningstar sin cambiar semantica, CLI visible, rutas efectivas ni estructura de artifacts.

El monolito `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js` sigue siendo el orquestador principal, pero ahora delega partes de IO/CLI/artifacts en modulos separados.

No se ejecuto Gemini real, no hubo Firestore writes, no se ejecuto parser real contra PDFs y no se toco `BDB-FONDOS-CORE`.

## 2. Estado base Git

HEAD base: `756ecf5 PARSER_REFACTOR_3_PLAN: document IO and adapter extraction plan`

Rama: `master`

`HEAD = origin/master = 756ecf5` al iniciar el bloque.

Working tree inicial:

- Sin staged.
- Sin modified tracked.
- Solo untracked locales conocidos fuera de scope.

## 3. Alcance 3A

Alcance permitido:

- Extraer parser CLI helpers.
- Extraer resolucion de rutas/config.
- Extraer file mover de PDFs procesados/error.
- Extraer builder/writer del artifact dry-run.
- Mantener reexports desde el monolito.
- Crear tests unitarios de los modulos extraidos.

Fuera de alcance:

- Gemini adapter real.
- Prompt Gemini.
- PDF reader.
- Firestore/write paths.
- Write gate.
- Orquestador batch.
- Optimizer, retrocessions, admin console o frontend.

## 4. Modulos creados

- `MORNINGSTAR_PDF_PARSER/src/cli/parse_args.js`
- `MORNINGSTAR_PDF_PARSER/src/io/path_resolver.js`
- `MORNINGSTAR_PDF_PARSER/src/io/file_mover.js`
- `MORNINGSTAR_PDF_PARSER/src/artifacts/parser_dry_run_artifact.js`

## 5. Funciones y responsabilidades extraidas

### `src/cli/parse_args.js`

Responsabilidades:

- Parseo de flags.
- `--dry-run` default.
- Gate `--write` + `--confirm-write`.
- Help CLI.
- Runtime options basicas.

Funciones:

- `getArgValueFromArgv`
- `getArgValue`
- `hasArg`
- `printHelp`
- `buildRuntimeOptions`
- `validateWriteGates`

### `src/io/path_resolver.js`

Responsabilidades:

- Resolver rutas preferidas/legacy.
- Resolver backup dirs.
- Resolver busqueda de CSV/config.

Funciones:

- `resolvePreferredOrLegacy`
- `resolveBackupDir`
- `getConfigSearchDirs`
- `resolveConfigPath`

### `src/io/file_mover.js`

Responsabilidades:

- Crear directorios.
- Calcular destinos unicos.
- Renombrar PDFs procesados por ISIN.
- Mover errores a `ARCHIVOS_CON_ERROR`.
- Evitar overwrite.

Funciones:

- `ensureDir`
- `uniqueDestPath`
- `moveFileSafe`
- `moveFileSafeIfNeeded`
- `timestampForFileName`
- `sanitizePdfFileNamePart`
- `isPathInside`
- `uniquePdfPathForIsin`
- `uniqueErrorPdfPath`
- `safeMoveToExactPath`
- `buildFileMovePlan`
- `moveProcessedPdfAfterRouting`

### `src/artifacts/parser_dry_run_artifact.js`

Responsabilidades:

- Serializar payloads para artifacts.
- Proteger `manual.*`.
- Registrar propuestas dry-run.
- Registrar movimientos de ficheros.
- Construir/escribir `parser_dry_run_latest.json`.

Funciones:

- `serializeForArtifact`
- `hasManualField`
- `assertNoManualFields`
- `recordDryRunProposal`
- `recordFileMove`
- `findLatestManifestEntryForFile`
- `buildParserDryRunArtifact`
- `writeParserDryRunArtifact`

## 6. Principio de no cambio semantico

La extraccion fue mecanica:

- No se cambiaron defaults CLI.
- No se cambiaron flags CLI.
- No se cambiaron rutas efectivas.
- No se cambio la estructura de `parser_dry_run_latest.json`.
- No se cambio la politica de movimiento de PDFs.
- No se tocaron mappings, classification, exposure, asset_mix, Gemini, PDF reader ni Firestore.
- El monolito mantiene reexports/wrappers para los tests existentes.

## 7. Tests nuevos

Nuevo test:

- `MORNINGSTAR_PDF_PARSER/tests/test_refactor3a_io_cli_artifacts.js`

Cobertura:

- Defaults de `buildRuntimeOptions`.
- Bloqueo `--write` sin `--confirm-write`.
- `--write` y `--dry-run` mutuamente excluyentes.
- `--no-move-files`.
- `--only-isin` normalizado.
- Path resolver con `--config-dir`, fallback y `searchDirs`.
- Movimiento OK/REVIEW a `ARCHIVOS_PROCESADOS`.
- Movimiento ERROR/sin ISIN a `ARCHIVOS_CON_ERROR`.
- Artifact dry-run con `dry_run`, `would_write`, `input_file_results`, `file_movements` y summary.
- Guard `manual.*`.

## 8. Tests existentes ejecutados

Validaciones ejecutadas en este bloque:

- `node --check MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_cargador_lotes_v2_hardening.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_region_normalization_ex_japan.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_first_write_controlled.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_file_flow_processed_pdfs.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_parser_golden_outputs.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_refactor1_modules.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_refactor2_classifiers_exposure.js`
- `node MORNINGSTAR_PDF_PARSER/tests/test_refactor3a_io_cli_artifacts.js`

Resultados:

- Hardening parser: PASS.
- Region ex-Japan: PASS.
- Parser write gate: PASS.
- First write controlled: PASS.
- File flow processed PDFs: PASS.
- Golden outputs: `62 passed, 0 failed`.
- REFACTOR-1 modules: `46 passed, 0 failed`.
- REFACTOR-2 classifiers/exposure: `9 passed, 0 failed`.
- REFACTOR-3A IO/CLI/artifacts: PASS.

## 9. Golden outputs

Golden outputs esperados:

- `62 passed, 0 failed`.

Estos golden tests siguen siendo el contrato para confirmar que no hubo drift semantico.

## 10. Riesgos mitigados

- Separacion de helpers IO/CLI/artifacts reduce responsabilidad del monolito.
- Reexports temporales mantienen compatibilidad con tests existentes.
- Tests nuevos validan modulos directamente.
- File mover sigue cubierto con temp dirs y fake PDF bytes, sin PDFs reales.
- Artifact builder sigue bloqueando `manual.*`.

## 11. Riesgos pendientes

- `RUNTIME_OPTIONS` sigue inicializandose al importar el monolito.
- `processPdfFile` sigue mezclando PDF IO, Gemini, mapping, validation, artifacts y payload.
- `main` sigue coordinando batch/concurrency/movimientos/logs.
- Gemini adapter, prompt, PDF reader y report builder quedan para 3B o posterior.
- Firestore/write paths quedan fuera de 3A y deben mantenerse con bloque dedicado.

## 12. Que NO se hizo

- No deploy.
- No push.
- No commit.
- No Firestore writes.
- No Gemini real.
- No parser real contra PDFs.
- No CORE.
- No credenciales / `.env`.
- No raw work dirs.
- No write gate.
- No Firestore/write paths.
- No prompt Gemini.
- No PDF reader.
- No optimizer.
- No retrocessions.
- No admin console.
- No frontend.

## 13. Siguiente paso recomendado

Siguiente paso inmediato:

- Revision diff + commit limpio de REFACTOR-3A.

Despues:

- REFACTOR-3B solo si 3A queda validado y pusheado.
- 3B deberia abordar `gemini/response_parser`, `prompt_builder`, `pdf_reader` y `parser_report_builder` con mocks y sin red.

## 14. Decision

Estado: `PARSER_REFACTOR_3A_READY_FOR_REVIEW`
