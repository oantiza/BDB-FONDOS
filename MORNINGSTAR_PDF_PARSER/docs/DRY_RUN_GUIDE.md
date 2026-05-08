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

Si `ENTRADA` esta vacia, no se llama Gemini.
