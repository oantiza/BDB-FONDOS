# BDB-MORNINGSTAR-PDFS-REFRESH-PRO-RESCUE-ERRORS-0

## Resumen ejecutivo

Se preparo un rescate read-only de los 32 PDFs que quedaron en ERROR en el dry-run Flash de Morningstar. Los 32 PDFs se copiaron a una carpeta separada y se intento reprocesarlos con `gemini-2.5-pro` en modo dry-run, con `--no-move-files` y `--concurrency 1`.

Resultado del intento efectivo Pro:

- PDFs intentados: 32
- OK: 0
- REVIEW: 0
- ERROR: 32
- Propuestas validas nuevas: 0
- Firestore writes: 0
- PDFs movidos: 0
- Deploy: no
- Commit: no
- Push: no

Todos los fallos Pro fueron errores de conexion/API contra Gemini:

`[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent: fetch failed`

## Origen

Artefacto Flash fuente:

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_flash_before_pro_rescue_errors_0.json`

El artefacto Flash original indicaba:

- Total PDFs: 649
- OK: 524
- REVIEW: 93
- ERROR: 32
- Propuestas validas: 617
- dry_run: true
- would_write: false

Antes de ejecutar Pro se preservo una copia del artefacto Flash porque `parser_dry_run_latest.json` es sobrescrito por el parser.

## Motivo del rescate

El objetivo era reintentar exclusivamente los 32 PDFs sin propuesta valida del dry-run Flash usando `gemini-2.5-pro`, para comprobar si Pro podia rescatar errores de parseo/JSON de Flash.

## Lista de 32 errores

- DE000A0X7541
- IE00B986FT65
- LU0117858166
- LU0189895229
- LU0284396289
- LU0352312184
- LU0512121004
- LU0568620560
- LU0778324086
- LU0920839429
- LU0995386439
- LU1061675168
- LU1103307408
- LU1191877379
- LU1278917452
- LU1278917536
- LU1769941003
- LU1814994353
- LU1899018870
- LU1917163617
- LU1951204046
- LU1965927921
- LU1982200609
- LU2240056015
- LU2240056445
- LU2338974699
- LU2348336004
- LU2375689580
- LU2376061086
- LU2697545163
- LU2697545247
- LU2743151057

Manifest de preparacion:

`artifacts/bdb_parser_audit/morningstar_flash_errors_for_pro_rescue_0.json`

Carpeta de rescate:

`MORNINGSTAR_PDF_PARSER/ENTRADA_PRO_RESCUE_ERRORS`

La carpeta de rescate contiene 32 PDFs copiados. Los originales siguen en `MORNINGSTAR_PDF_PARSER/ENTRADA`.

## Comando Pro ejecutado

Comando solicitado, ejecutado desde `MORNINGSTAR_PDF_PARSER/bin`:

```powershell
node .\parse_dry_run.js --dir ..\ENTRADA_PRO_RESCUE_ERRORS --model gemini-2.5-pro --no-move-files --concurrency 1
```

Ese intento genero un artefacto vacio porque el parser interno resolvio la ruta relativa desde la raiz del repo, no desde `bin`.

Para ejecutar el rescate efectivo sin modificar el parser productivo, se repitio con la misma carpeta en ruta absoluta:

```powershell
node .\parse_dry_run.js --dir "C:\Users\oanti\Documents\BDB-FONDOS\MORNINGSTAR_PDF_PARSER\ENTRADA_PRO_RESCUE_ERRORS" --model gemini-2.5-pro --no-move-files --concurrency 1
```

Artefacto Pro definitivo:

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_pro_rescue_errors_0.json`

## Resultados

- PDFs intentados: 32
- OK: 0
- REVIEW: 0
- ERROR: 32
- Rescatados: ninguno
- Persisten en ERROR: los 32 ISIN listados arriba

`LU0568620560` no llego a validar `portfolio_exposure_v2`: en Pro fallo por `fetch failed`, no por `portfolio_exposure_v2_missing`.

## Validacion de campos prohibidos

No se detectaron campos prohibidos como campos propuestos.

- `proposed_payload_by_isin`: 0 propuestas
- `fields_to_update`: vacio
- `manual`: no propuesto
- `manual.costs`: no propuesto
- `manual.costs.retrocession`: no propuesto
- `retrocession`: no propuesto
- `portfolio_exposure_v2.economic_exposure`: no propuesto

Nota: `manual`, `manual.costs` y `manual.costs.retrocession` aparecen como `fields_preserved`, lo cual es esperado y no es propuesta de escritura.

## Coste aproximado

Coste estimado: 0 o no material, sujeto a confirmacion de facturacion del proveedor. Las llamadas fallaron por `fetch failed` y no produjeron respuestas Gemini ni propuestas parseadas.

## Recomendacion de siguiente paso

No ejecutar merge ni write gate todavia. Primero resolver conectividad/API de Gemini Pro y repetir este mismo bloque de rescate sobre los mismos 32 PDFs. Despues, si Pro rescata la mayoria, proponer:

`BDB-MORNINGSTAR-PDFS-REFRESH-MERGE-FLASH-AND-PRO-DRYRUN-0`

Objetivo: unir las 617 propuestas validas de Flash con las nuevas propuestas Pro rescatadas, todavia sin Firestore.

Despues:

`BDB-MORNINGSTAR-PDFS-REFRESH-FIRESTORE-COMPARISON-0`

Objetivo: comparar propuestas consolidadas contra `funds_v3` en modo read-only.
