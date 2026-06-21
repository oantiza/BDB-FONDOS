# BDB_PARSER_REFACTOR_3_PLAN

Fecha: 2026-05-08

Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`

Decision: `PARSER_REFACTOR_3_PLAN_READY`

## 1. Resumen ejecutivo

Este documento inventaria el estado del parser Morningstar tras REFACTOR-0/1/2 y propone el siguiente bloque de extraccion mecanica.

REFACTOR-3 deberia centrarse en separar orquestacion, IO, adapters, artifacts/report helpers y limite CLI, sin cambiar semantica ni ejecutar Gemini, Firestore, PDFs reales o deploy.

El monolito sigue siendo `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`. Tras REFACTOR-2 mantiene 2.719 lineas medidas con Node y ya delega utilidades, normalizadores, clasificadores y builders de exposicion.

La recomendacion profesional es partir REFACTOR-3 en fases pequenas:

- 3A: limites de bajo riesgo y helpers de IO/artifacts.
- 3B: parseo Gemini/PDF y reporting con mocks.
- 3C: dejar para mas adelante adapters con red/write, Firestore, write CLI y derived/RF inference.

## 2. Estado base Git

Ruta validada: `C:\Users\oanti\Documents\BDB-FONDOS`

Rama: `master`

HEAD: `960592c PARSER_REFACTOR_CLOSEOUT: document refactor 0-2 completion`

`origin/master`: `960592c PARSER_REFACTOR_CLOSEOUT: document refactor 0-2 completion`

Estado inicial observado:

- Sin staged.
- Sin modified tracked.
- Solo untracked locales conocidos:
  - `MORNINGSTAR_PDF_PARSER/artifacts/canonical/`
  - `MORNINGSTAR_PDF_PARSER/artifacts/review/`
  - `MORNINGSTAR_PDF_PARSER/artifacts/work/`
  - `artifacts/bdb_parser_audit/dryrun_1_work/`
  - `artifacts/bdb_parser_audit/dryrun_3_work/`
  - `artifacts/bdb_parser_audit/dryrun_medium_0_work/`
  - documentos locales de backlog/commit/admin fuera de scope.

No se ha leido ni tocado `BDB-FONDOS-CORE`.

## 3. Estado actual del parser tras REFACTOR-0/1/2

REFACTOR-0 congelo comportamiento mediante fixtures golden y tests de salida.

REFACTOR-1 extrajo utilidades y normalizadores puros.

REFACTOR-2 extrajo clasificadores y builders de `classification_v2` / `portfolio_exposure_v2`.

El monolito actual conserva:

- Bootstrap CLI y validacion de flags.
- Resolucion de rutas runtime.
- Creacion de directorios.
- Inicializacion lazy de Gemini.
- Inicializacion lazy de Firebase Admin.
- Carga de CSV/config y construccion de matchers.
- Helpers de movimiento de PDFs.
- Helpers de escritura de JSON/texto.
- Validacion schema LLM.
- Parseo y reparacion de JSON Gemini.
- Prompt y llamada Gemini.
- Estado global de batch.
- Construccion de artifact dry-run.
- Lectura PDF y procesamiento por fichero.
- Construccion de `ms`, `derived`, quality warnings y routing.
- Escritura local de raw/canonical/review/error artifacts.
- Preparacion de payload Firestore.
- Escritura Firestore solo si `--write --confirm-write`.
- Orquestacion batch/concurrency.
- Batch manifest, logs y review queue.
- Reexports temporales para tests.

## 4. Bloques funcionales restantes del monolito

### CLI / argumentos

Funciones y zonas:

- `getArgValueFromArgv`
- `getArgValue`
- `hasArg`
- `printHelp`
- `buildRuntimeOptions`
- `validateWriteGates`
- constantes derivadas de flags: `INPUT_DIR`, `LIMIT`, `BATCH_ID`, `CONCURRENCY`, `MODEL_NAME`, `WRITE_REVIEW`.

Riesgo: medio. `RUNTIME_OPTIONS` se evalua en import y los tests dependen de import seguro.

### Configuracion y resolucion de rutas

Funciones y zonas:

- `resolvePreferredOrLegacy`
- `resolveBackupDir`
- `getConfigSearchDirs`
- `resolveConfigPath`
- `DATA_ROOT`, `PARSER_ROOT`, `PARSER_ARTIFACT_ROOT`, `DIRS`.

Riesgo: medio. Puede romper ENTRADA/SALIDA, CSV mappings o compatibilidad legacy.

### Lectura de PDFs / entrada

Funciones y zonas:

- `INPUT_DIR`
- `isValidPdfText`
- `processPdfFile` usa `fs.readFileSync`, `pdfParse`, hash MD5/SHA1 y texto PDF.
- `main` usa `fs.readdirSync` y filtro `.pdf`.

Riesgo: medio. No debe ejecutarse contra PDFs reales en refactor.

### Gemini adapter y respuesta

Funciones y zonas:

- `getGeminiModel`
- `extraerMSConGemini`
- `stripCodeFences`
- `extractFirstBalancedJsonObject`
- `repairJsonCandidate`
- `hasAnyCriticalGeminiKey`
- `unwrapGeminiRootObject`
- `parseGeminiJsonResponse`
- prompt inline.

Riesgo: medio-alto. La llamada real no debe ejecutarse; el parser de respuesta si puede testearse con fixtures.

### JSON handling / schema

Funciones y zonas:

- `validateRawLlMSchema`
- `deleteUndefinedDeep`
- `serializeForArtifact`
- `writeJsonPretty`
- `writeText`
- `loadCsv`

Riesgo: bajo-medio. Varias funciones son puras o casi puras, pero algunas escriben disco.

### Orquestacion por lote

Funciones y zonas:

- `main`
- `processPdfFile`
- `manifestEntries`
- `errorEntries`
- `reviewEntries`
- `parserDryRunProposals`
- `fileMoveEntries`
- `pLimit(CONCURRENCY)`
- contadores `ok`, `review`, `fail`.

Riesgo: alto. Mezcla todo el flujo y conviene mantenerlo como orquestador hasta extraer piezas menores.

### Artifact/report generation

Funciones y zonas:

- `recordDryRunProposal`
- `recordFileMove`
- `findLatestManifestEntryForFile`
- `buildParserDryRunArtifact`
- `writeParserDryRunArtifact`
- batch manifest.
- `parser_errors.ndjson`
- `review_queue.ndjson`.

Riesgo: bajo-medio. Buen candidato si se inyecta estado y writer.

### File movements

Funciones y zonas:

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

Riesgo: bajo si se mantiene literal y los tests file-flow siguen pasando. No debe borrar ni sobrescribir.

### Write preparation / Firestore

Funciones y zonas:

- `getFirebaseInitOptions`
- `initializeFirebaseAdmin`
- `getFirestoreDb`
- uso de `admin.firestore.FieldValue.serverTimestamp()`
- `writer.set(ref, doc, { merge: true })`
- `bulkWriter`.

Riesgo: alto. No tocar en REFACTOR-3A salvo encapsular lectura de opciones sin ejecutar writes.

### Logging / error handling

Zonas:

- `console.log`, `console.error`.
- errores schema/LLM/PDF.
- return codes `0` y `2`.

Riesgo: medio. El texto de logs puede estar cubierto indirectamente por tests existentes.

### Funciones puras todavia no extraidas

Candidatas:

- `scalePctMap`
- `pctFromAliases`
- `numFromAliases`
- `strFromAliases`
- `normalizePctBucketObject`
- `normalizeFixedIncome`
- `sizeWeightsTotalFromMarketCap`
- `parseStyleBoxCell`
- `deriveMarketCapBiasFromText`
- `buscarISINRegex`
- `reportDateFromFilename`
- `parseSpanishDateToISO`
- `validateRawLlMSchema`
- `decidePipelineStatus`
- JSON response helpers.

Riesgo: bajo a medio segun dependencia. Algunas son buenas candidatas para modulos posteriores, pero REFACTOR-3 debe priorizar IO/orquestacion.

### Reexports temporales de tests

El monolito exporta funciones puras ya extraidas y algunas todavia inline. Mantener estos reexports hasta que los tests apunten directamente a modulos estables.

## 5. Modulos ya extraidos y responsabilidades

### `src/utils/number_utils.js`

Responsabilidades:

- Limpieza basica de strings.
- Parsing numerico.
- Clamps.
- Comparaciones aproximadas.
- Helpers de objetos/mapas porcentuales.

Dependencias: ninguna externa relevante.

### `src/normalize/text_normalizer.js`

Responsabilidades:

- Normalizacion de texto para tokens.

Dependencias: ninguna externa relevante.

### `src/normalize/region_normalizer.js`

Responsabilidades:

- Mappings regionales.
- Normalizacion de regiones.
- `ex-Japan` / Japan guards.
- Region primaria.

Dependencias:

- `number_utils`.

### `src/normalize/asset_mix_normalizer.js`

Responsabilidades:

- Validacion de `asset_mix`.
- Guardrails de escala 0-1 / 0-100.
- Normalizacion para builder de exposure.

Dependencias:

- `number_utils`.

### `src/normalize/sector_normalizer.js`

Responsabilidades:

- Normalizacion de sectores Morningstar.

Dependencias:

- `region_normalizer.cleanRegionKey`.

### `src/classify/asset_type_classifier.js`

Responsabilidades:

- `deriveAssetClassFromCategory`.

Dependencias: ninguna externa relevante.

### `src/classify/subtype_classifier.js`

Responsabilidades:

- Subcategorias.
- Subtypes.
- Flags sector/theme/index-like.
- Normalizacion de subtype por asset type.

Dependencias:

- `number_utils`.
- `text_normalizer`.
- `region_normalizer`.
- Inyeccion de mappings desde monolito para `deriveSubcategories`.

### `src/classify/classification_builder.js`

Responsabilidades:

- `assetTypeFromDerivedAssetClass`.
- `buildClassificationV2`.

Dependencias:

- `subtype_classifier.normalizeSubtypeByAssetType`.

### `src/exposure/portfolio_exposure_builder.js`

Responsabilidades:

- `buildPortfolioExposureV2`.
- Conversor de warnings de guardrail.

Dependencias:

- `asset_mix_normalizer.normalizeExposureMapToParent01`.

### `src/lib/write_gate.js`

Responsabilidades:

- Decision matrix para write gate.
- Diffs.
- Snapshots/manifests.
- Forbidden fields.

Dependencias:

- FS para manifests locales.

Recomendacion: no mezclar con REFACTOR-3 del parser runtime salvo pruebas de no regresion.

## 6. Candidatos REFACTOR-3

### `src/cli/parse_args.js`

Responsabilidad:

- Parsear flags.
- Construir runtime options.
- Validar `--write` / `--confirm-write`.
- Help text.

Funciones candidatas:

- `getArgValueFromArgv`
- `hasArg`
- `printHelp`
- `buildRuntimeOptions`
- `validateWriteGates`

Dependencias:

- `path`, `PARSER_ROOT` o inyeccion de paths default.

Riesgo: medio.

Tests existentes:

- Hardening tests.
- Root CLI dry-run/file-flow.

Tests nuevos:

- Unit tests directos de `parse_args`.
- Import seguro sin `process.exit`.
- `--write` sin confirmacion bloqueado.

Extraer ahora: si, en 3A, pero manteniendo wrappers desde monolito.

### `src/io/path_resolver.js`

Responsabilidad:

- Resolver rutas preferidas/legacy.
- Resolver config dirs.
- Resolver backup dirs.
- Construir `DIRS`.

Funciones candidatas:

- `resolvePreferredOrLegacy`
- `resolveBackupDir`
- `getConfigSearchDirs`
- `resolveConfigPath`

Dependencias:

- `fs`, `path`.
- `REPO_ROOT`, `PARSER_ROOT`, `backupRootArg` como parametros.

Riesgo: medio.

Tests existentes:

- Hardening test de `resolveConfigPath`.

Tests nuevos:

- Busca primero `--config-dir`.
- Luego `MORNINGSTAR_PDF_PARSER/config`.
- Falla claro si falta CSV.
- No lee `.env`.

Extraer ahora: si, pero despues de `parse_args`.

### `src/io/file_mover.js`

Responsabilidad:

- Planificar y mover PDFs procesados/error.
- Renombrar por ISIN.
- Evitar overwrite.
- Registrar resultado.

Funciones candidatas:

- `ensureDir`
- `uniqueDestPath`
- `timestampForFileName`
- `sanitizePdfFileNamePart`
- `isPathInside`
- `uniquePdfPathForIsin`
- `uniqueErrorPdfPath`
- `safeMoveToExactPath`
- `buildFileMovePlan`
- `moveProcessedPdfAfterRouting`

Dependencias:

- `fs`, `path`.
- reloj inyectable para tests si se quiere estabilizar nombres.

Riesgo: bajo.

Tests existentes:

- `test_file_flow_processed_pdfs.js`.

Tests nuevos:

- Import directo del modulo.
- No mover fuera de ENTRADA salvo input explicito.
- Collision deterministic.

Extraer ahora: si, en 3A.

### `src/artifacts/parser_dry_run_artifact.js`

Responsabilidad:

- Construir y escribir `parser_dry_run_latest.json`.
- Serializar payloads.
- Registrar proposals y file movements si se crea factory de estado.

Funciones candidatas:

- `serializeForArtifact`
- `recordDryRunProposal`
- `recordFileMove`
- `buildParserDryRunArtifact`
- `writeParserDryRunArtifact`

Dependencias:

- `path`.
- writer JSON inyectable o `fs` si se incluye escritura.
- estado de batch inyectado.

Riesgo: bajo-medio.

Tests existentes:

- Hardening tests.
- File-flow artifact tests.

Tests nuevos:

- Artifact sin `manual.*`.
- `would_write=false`.
- `input_file_results` contiene movimientos.
- No depende de globals.

Extraer ahora: si, en 3A si se evita tocar `main` de forma agresiva.

### `src/gemini/response_parser.js`

Responsabilidad:

- Limpiar fences.
- Reparar candidatos.
- Extraer primer JSON balanceado.
- Unwrap de wrappers `data/result/output`.
- Parsear JSON Gemini.

Funciones candidatas:

- `stripCodeFences`
- `extractFirstBalancedJsonObject`
- `repairJsonCandidate`
- `hasAnyCriticalGeminiKey`
- `unwrapGeminiRootObject`
- `parseGeminiJsonResponse`

Dependencias:

- `isPlainObject` desde utils.

Riesgo: medio.

Tests existentes:

- Golden tests cubren `parseGeminiJsonResponse`.

Tests nuevos:

- Markdown fences.
- Wrapper `data`.
- Array de un elemento.
- JSON con trailing comma.
- Error parseable claro.

Extraer ahora: 3B.

### `src/gemini/prompt_builder.js`

Responsabilidad:

- Construir prompt Morningstar.
- Mantener contrato de campos pedidos a Gemini.
- Limitar longitud de texto.

Funciones candidatas:

- Prompt inline de `extraerMSConGemini`.
- Slice `textoPDF.slice(0, 240000)`.

Dependencias:

- Ninguna si devuelve string.

Riesgo: medio.

Tests existentes:

- Ninguno especifico.

Tests nuevos:

- Prompt contiene campos requeridos.
- Prompt mantiene prohibicion TER/retrocesiones.
- Texto truncado a limite esperado.

Extraer ahora: 3B.

### `src/adapters/gemini_adapter.js`

Responsabilidad:

- Inicializacion lazy de `GoogleGenerativeAI`.
- `generateContent`.
- Retries.
- Modelo configurable.

Funciones candidatas:

- `getGeminiModel`
- parte externa de `extraerMSConGemini`.

Dependencias:

- `@google/generative-ai`.
- `process.env.GEMINI_API_KEY`.
- sleep/retry.

Riesgo: alto.

Tests existentes:

- Ninguno con red real, y no debe haber red en refactor.

Tests nuevos:

- Mock model.
- No requiere API key al importar.
- Retries sin red.
- No llama Gemini en tests.

Extraer ahora: no; dejar 3C o bloque dedicado.

### `src/io/pdf_reader.js`

Responsabilidad:

- Leer buffer PDF.
- Calcular hashes.
- Ejecutar `pdf-parse`.
- Validar texto.

Funciones candidatas:

- `isValidPdfText`
- parte inicial de `processPdfFile`.

Dependencias:

- `fs`, `crypto`, `pdf-parse`.

Riesgo: medio.

Tests existentes:

- Ninguno directo sin PDF.

Tests nuevos:

- `isValidPdfText` con strings sinteticos.
- reader con mock de `pdfParse` o wrapper inyectado.
- No usar PDFs reales.

Extraer ahora: 3B.

### `src/report/parser_report_builder.js`

Responsabilidad:

- Batch manifest.
- Error NDJSON.
- Review NDJSON.
- Summary de contadores.

Funciones candidatas:

- construccion de `batchManifest`.
- escritura de `parser_errors.ndjson`.
- escritura de `review_queue.ndjson`.

Dependencias:

- `path`, JSON/text writer.

Riesgo: bajo-medio.

Tests existentes:

- Indirectos por dry-run artifact.

Tests nuevos:

- Batch manifest estable.
- `dry_run` y `would_write` correctos.
- No toca Firestore.

Extraer ahora: 3B, despues de artifacts.

### `src/orchestrator/batch_parser_orchestrator.js`

Responsabilidad:

- Recibir files/options.
- Ejecutar `processPdfFile` con limit/concurrency.
- Coordinar contadores.
- Coordinar movimiento de ficheros.

Funciones candidatas:

- parte principal de `main`.

Dependencias:

- `p-limit`.
- process function inyectable.
- file mover.
- report writer.

Riesgo: alto.

Tests existentes:

- No hay unit test directo.

Tests nuevos:

- Orquestador con `processPdfFile` mock.
- OK/REVIEW/ERROR counters.
- Movimiento por estado.
- No red/no PDF/no Firestore.

Extraer ahora: no en 3A; dejar 3C o 3B final si 3A queda estable.

### `src/transform/ms_raw_mapper.js`

Responsabilidad:

- Convertir `msRaw` a `msCleaned`.
- Resolver alias de allocation, regions, sectors, style, fixed income.

Funciones candidatas:

- bloque de raw aliases dentro de `processPdfFile`.
- `pctFromAliases`
- `numFromAliases`
- `strFromAliases`
- `normalizeFixedIncome`
- `normalizePctBucketObject`

Dependencias:

- normalizers existentes.
- utils numericas.

Riesgo: medio-alto por semantica de datos.

Tests existentes:

- Golden tests indirectos.

Tests nuevos:

- Alias coverage.
- Fixed income normalization.
- Empty/null behavior.

Extraer ahora: 3C o REFACTOR-4; no mezclar con IO si el objetivo es orquestacion.

## 7. Matriz de riesgo por candidato

| Candidato | Riesgo | Motivo | Extraer |
|---|---:|---|---|
| `src/io/file_mover.js` | Bajo | Ya cubierto por tests file-flow, logica acotada | 3A |
| `src/artifacts/parser_dry_run_artifact.js` | Bajo-medio | Usa estado global actual; conviene factory/inyeccion | 3A |
| `src/cli/parse_args.js` | Medio | `RUNTIME_OPTIONS` se evalua al importar | 3A con wrappers |
| `src/io/path_resolver.js` | Medio | Puede romper config CSV y rutas legacy | 3A |
| `src/gemini/response_parser.js` | Medio | Parseo tolerante de LLM, cubierto parcialmente | 3B |
| `src/gemini/prompt_builder.js` | Medio | Cambios pequenos podrian alterar LLM output | 3B |
| `src/io/pdf_reader.js` | Medio | PDF parsing real no debe ejecutarse | 3B con mocks |
| `src/report/parser_report_builder.js` | Bajo-medio | Formato de manifests/logs visible | 3B |
| `src/orchestrator/batch_parser_orchestrator.js` | Alto | Coordina concurrencia, estados, movimientos | 3C |
| `src/adapters/gemini_adapter.js` | Alto | Riesgo de red/credenciales/retries | 3C |
| Firestore/write adapter | Alto | Puede tocar writes reales si se equivoca | Fuera de REFACTOR-3 |
| `src/transform/ms_raw_mapper.js` | Medio-alto | Semantica de datos y aliases | 3C/REFACTOR-4 |

## 8. Tests existentes que protegen el cambio

Tests relevantes:

- `MORNINGSTAR_PDF_PARSER/tests/test_parser_golden_outputs.js`
  - Protege outputs semanticos de classification/exposure, ausencia de `manual.*`, parse Gemini helpers y schema.
- `MORNINGSTAR_PDF_PARSER/tests/test_refactor1_modules.js`
  - Protege utils/normalizers ya extraidos.
- `MORNINGSTAR_PDF_PARSER/tests/test_refactor2_classifiers_exposure.js`
  - Protege classifiers/builders extraidos.
- `MORNINGSTAR_PDF_PARSER/tests/test_cargador_lotes_v2_hardening.js`
  - Protege dry-run default, gates, config paths y manual guard.
- `MORNINGSTAR_PDF_PARSER/tests/test_region_normalization_ex_japan.js`
  - Protege region ex-Japan.
- `MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js`
  - Protege write gate dry-run.
- `MORNINGSTAR_PDF_PARSER/tests/test_first_write_controlled.js`
  - Protege controlled write helpers sin ejecutar writes reales.
- `MORNINGSTAR_PDF_PARSER/tests/test_file_flow_processed_pdfs.js`
  - Protege movimiento/renombrado de PDFs por ISIN y anti-overwrite.

Cobertura base esperada:

- Golden outputs: 62 passed, 0 failed.
- REFACTOR-1 modules: 46 passed, 0 failed.
- REFACTOR-2 classifiers/exposure: 9 passed, 0 failed.

## 9. Tests nuevos recomendados

### Para 3A

- `test_refactor3_parse_args.js`
  - `--dry-run` default.
  - `--write` sin `--confirm-write` bloqueado.
  - `--write` y `--dry-run` mutuamente excluyentes.
  - `--config-dir`, `--output-dir`, `--only-isin` parseados igual que antes.

- `test_refactor3_path_resolver.js`
  - prioridad `--config-dir`.
  - fallback `MORNINGSTAR_PDF_PARSER/config`.
  - fallback `data/work`.
  - error claro cuando falta CSV.

- `test_refactor3_file_mover_module.js`
  - OK/REVIEW a `ARCHIVOS_PROCESADOS`.
  - ERROR sin ISIN a `ARCHIVOS_CON_ERROR`.
  - no overwrite.
  - `--no-move-files` mantiene `SKIPPED`.

- `test_refactor3_artifact_builder.js`
  - `dry_run=true`.
  - `would_write=false`.
  - no `manual.*`.
  - file movement entries presentes.

### Para 3B

- `test_refactor3_gemini_response_parser.js`
  - fences markdown.
  - wrapper `data`.
  - JSON parcial balanceado.
  - trailing comma.
  - errores parseables.

- `test_refactor3_prompt_builder.js`
  - campos obligatorios.
  - prohibicion de TER/retrocesiones.
  - truncado de texto.

- `test_refactor3_pdf_reader.js`
  - `isValidPdfText` con texto sintetico.
  - mock de `pdfParse`.
  - hash calculado sin PDFs reales.

- `test_refactor3_report_builder.js`
  - batch manifest.
  - review/error NDJSON.
  - contadores OK/REVIEW/ERROR.

### Para 3C

- `test_refactor3_orchestrator_mocked.js`
  - process mock devuelve OK/REVIEW/ERROR.
  - contadores correctos.
  - file mover mock llamado con estado correcto.
  - sin Gemini, sin PDF, sin Firestore.

- `test_refactor3_gemini_adapter_mocked.js`
  - import sin API key.
  - adapter con mock model.
  - retries deterministas.

## 10. Zonas prohibidas / no tocar

No tocar en REFACTOR-3A:

- Escritura Firestore real.
- `apply_write_gate_controlled.js`.
- `writer.set`, `bulkWriter`, `docRef.update`.
- Snapshot/rollback/write gate real.
- Gemini real call.
- Credenciales, `.env`, `GOOGLE_APPLICATION_CREDENTIALS`.
- PDFs reales.
- Artifacts raw/work dirs.
- `BDB-FONDOS-CORE`.
- Semantica de `asset_mix`.
- Semantica de `classification_v2`.
- Retrocesiones.
- Admin console.

Tocar con cautela solo en bloque dedicado:

- Prompt Gemini.
- `extraerMSConGemini`.
- `getGeminiModel`.
- `processPdfFile`.
- `main`.
- `RUNTIME_OPTIONS` global.
- `derived` builder.
- fixed income inference.

## 11. Plan recomendado por fases

### 3A bajo riesgo

Objetivo: reducir IO/artifact/CLI superficial sin tocar semantica ni red.

Extraer:

- `src/io/file_mover.js`
- `src/artifacts/parser_dry_run_artifact.js`
- `src/cli/parse_args.js`
- `src/io/path_resolver.js`

Orden recomendado:

1. File mover.
2. Artifact builder.
3. CLI args.
4. Path/config resolver.

Validaciones:

- `node --check MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js`
- Golden outputs.
- Refactor1 modules.
- Refactor2 classifiers/exposure.
- Hardening.
- File flow.
- Nuevo test 3A por modulo.

### 3B medio riesgo

Objetivo: separar parseo/adaptadores no mutantes con mocks.

Extraer:

- `src/gemini/response_parser.js`
- `src/gemini/prompt_builder.js`
- `src/io/pdf_reader.js`
- `src/report/parser_report_builder.js`

Validaciones:

- Tests 3A.
- Tests nuevos con mocks.
- No parser real contra PDFs.
- No Gemini real.

### 3C dejar para mas adelante

Objetivo: cambiar limites grandes solo cuando 3A/3B esten versionados.

Candidatos:

- `src/orchestrator/batch_parser_orchestrator.js`
- `src/adapters/gemini_adapter.js`
- `src/transform/ms_raw_mapper.js`
- `src/derived/derived_builder.js`
- fixed income classifier/builder.
- Firestore/write adapters, solo en bloque posterior y con tests de no-write.

No se recomienda tocar 3C antes de cerrar y pushear 3A/3B.

## 12. Recomendacion profesional

El siguiente bloque de implementacion deberia ser `BDB-PARSER-REFACTOR-3A`, no un REFACTOR-3 monolitico.

Motivo:

- El parser ya esta protegido por golden tests, pero `main` y `processPdfFile` siguen mezclando demasiadas responsabilidades.
- Extraer file mover y artifact builder tiene valor inmediato y bajo riesgo.
- Mover Gemini adapter o Firestore ahora aumentaria demasiado el riesgo operativo.
- `RUNTIME_OPTIONS` global es el punto delicado: cualquier cambio ahi debe mantener import seguro y tests de hardening.

Contrato para cada bloque:

- Diff pequeno.
- Sin cambio semantico intencionado.
- Sin Gemini real.
- Sin Firestore writes.
- Sin PDFs reales.
- Sin CORE.
- Tests antes/despues.
- Commit y push controlado por bloque.

## 13. Decision

Estado: `PARSER_REFACTOR_3_PLAN_READY`

REFACTOR-3 queda listo para revision. La recomendacion es implementar primero 3A con extracciones mecanicas de file mover, artifact builder, CLI args y path resolver, manteniendo el monolito como orquestador.
