# BDB-PARSER-FILE-FLOW-0 - Processed PDF File Flow

Fecha: 2026-05-08

Proyecto validado: `C:\Users\oanti\Documents\BDB-FONDOS`

Decision: `PARSER_FILE_FLOW_READY`

## Objetivo

Mejorar el flujo operativo del `MORNINGSTAR_PDF_PARSER` para que los PDFs que entren por `ENTRADA` salgan de esa carpeta al finalizar el dry-run:

- OK/REVIEW: `ARCHIVOS_PROCESADOS`
- ERROR/BLOCKED/sin ISIN: `ARCHIVOS_CON_ERROR`

## Nueva Estructura

```text
MORNINGSTAR_PDF_PARSER/
  ENTRADA/
  SALIDA/
  ARCHIVOS_PROCESADOS/
  ARCHIVOS_CON_ERROR/
```

## Regla de Movimiento

Si el PDF se procesa como `OK` o `REVIEW` y se detecta ISIN:

```text
MORNINGSTAR_PDF_PARSER/ENTRADA/<nombre_original>.pdf
-> MORNINGSTAR_PDF_PARSER/ARCHIVOS_PROCESADOS/<ISIN>.pdf
```

Si el PDF falla o no se detecta ISIN:

```text
MORNINGSTAR_PDF_PARSER/ENTRADA/<nombre_original>.pdf
-> MORNINGSTAR_PDF_PARSER/ARCHIVOS_CON_ERROR/UNKNOWN_ISIN__<nombre_original>.pdf
```

## Anti-Overwrite

No se sobrescriben PDFs existentes.

Si ya existe:

```text
ARCHIVOS_PROCESADOS/<ISIN>.pdf
```

se usa:

```text
ARCHIVOS_PROCESADOS/<ISIN>__<report_date>.pdf
```

Si no hay `report_date`:

```text
ARCHIVOS_PROCESADOS/<ISIN>__processed_<YYYYMMDD_HHMMSS>.pdf
```

Si aun asi existiera, se anade sufijo incremental.

## Flag --no-move-files

Para mantener los PDFs en `ENTRADA`:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --no-move-files
```

En ese caso el artifact registra:

- `file_move_status=SKIPPED`
- `file_move_reason=no_move_files_flag`

## Artifact

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json` incluye:

- `input_file_results`
- `file_movements`

Por cada PDF procesado se registra:

- `original_pdf_path`
- `final_pdf_path`
- `file_move_status`
- `file_move_reason`
- `renamed_to`
- `detected_isin`

## Seguridad

- No se hicieron writes a Firestore.
- No se uso `--write`.
- No se uso `--confirm-write`.
- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se llamo Gemini real.
- No se tocaron credenciales.
- No se tocaron retrocesiones.
- No se modifico mapping semantico.
- No se leyo ni modifico `BDB-FONDOS-CORE`.

## Tests Ejecutados

```bash
node --check MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js
node --check MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js
node MORNINGSTAR_PDF_PARSER/tests/test_file_flow_processed_pdfs.js
node MORNINGSTAR_PDF_PARSER/tests/test_cargador_lotes_v2_hardening.js
node MORNINGSTAR_PDF_PARSER/tests/test_region_normalization_ex_japan.js
node MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js
node MORNINGSTAR_PDF_PARSER/tests/test_first_write_controlled.js
```

Resultado: PASS.

## Prueba Manual Sin Gemini

Ejecutado con `ENTRADA` vacia:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --dry-run --input MORNINGSTAR_PDF_PARSER/ENTRADA --output-dir MORNINGSTAR_PDF_PARSER/SALIDA
```

Resultado:

- `dry_run=true`
- `would_write=false`
- `input_files=[]`
- `file_movements=[]`
- no Gemini real
- no Firestore writes

## Resultado

`PARSER_FILE_FLOW_READY`
