# Dry-Run Guide

1. Copiar PDFs Morningstar a `MORNINGSTAR_PDF_PARSER/ENTRADA/`.
2. Ejecutar:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js
```

3. Revisar `MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json`.

El dry-run debe mostrar:

- `dry_run=true`
- `would_write=false`

Al finalizar:

- PDFs OK/REVIEW pasan a `MORNINGSTAR_PDF_PARSER/ARCHIVOS_PROCESADOS/` y se renombran por ISIN.
- PDFs con error o sin ISIN pasan a `MORNINGSTAR_PDF_PARSER/ARCHIVOS_CON_ERROR/`.

Para no mover PDFs:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --no-move-files
```

Si `ENTRADA` esta vacia, no se llama Gemini.
