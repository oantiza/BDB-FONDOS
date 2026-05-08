# MORNINGSTAR PDF PARSER

Subsistema operativo para procesar PDFs Morningstar en modo seguro.

Flujo:

1. Copiar PDFs Morningstar a `MORNINGSTAR_PDF_PARSER/ENTRADA/`.
2. Ejecutar dry-run.
3. Revisar resultados en `MORNINGSTAR_PDF_PARSER/SALIDA/`.
4. Revisar PDFs movidos a `MORNINGSTAR_PDF_PARSER/ARCHIVOS_PROCESADOS/` o `MORNINGSTAR_PDF_PARSER/ARCHIVOS_CON_ERROR/`.
5. Preparar write gate/diff si procede.
6. No escribir en Firestore sin aprobacion explicita, snapshot y rollback manifest.

## Que Hace

PDF Morningstar -> Gemini -> JSON/artifact -> write gate -> posible payload Firestore `funds_v3`.

El parser puede preparar:

- `classification_v2`
- `portfolio_exposure_v2.asset_mix`
- `ms`
- `derived`, si aplica
- metadata/warnings de parser

El parser no debe tocar:

- `manual.*`
- `manual.costs`
- `manual.costs.retrocession`
- `portfolio_exposure_v2.economic_exposure`

## Comandos Principales

Dry-run manual con defaults:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js
```

Dry-run explicito:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --dry-run --input MORNINGSTAR_PDF_PARSER/ENTRADA --output-dir MORNINGSTAR_PDF_PARSER/SALIDA
```

Write gate dry-run:

```bash
node MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js --output-dir MORNINGSTAR_PDF_PARSER/artifacts
```

## ENTRADA y SALIDA

- `ENTRADA/`: carpeta visible para dejar PDFs Morningstar.
- `SALIDA/`: carpeta visible para revisar artifacts/resultados del dry-run.
- `ARCHIVOS_PROCESADOS/`: PDFs OK o REVIEW, renombrados por ISIN.
- `ARCHIVOS_CON_ERROR/`: PDFs con error, bloqueados o sin ISIN.

No usar `input/` ni `output/` como carpetas visibles de operacion manual.

Por defecto, el dry-run operativo mueve los PDFs fuera de `ENTRADA` al finalizar. Para desactivar ese comportamiento:

```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --no-move-files
```

## Escalas y Pipelines Relacionados

- `portfolio_exposure_v2.asset_mix`: lo prepara el parser PDF, escala 0-1.
- `portfolio_exposure_v2.economic_exposure`: lo prepara `populate_taxonomy_v2.py` / pipeline S3, escala 0-100.
- Retrocesiones: fuera del parser, gestionadas por BDB-RETRO-IMPORT.

## Seguridad

- Dry-run es default.
- `parse_dry_run.js` bloquea flags de escritura.
- Cualquier write futuro debe pasar por policy classification, snapshot, diff, approval manifest y rollback manifest.
- No reintroducir `serviceAccountKey.json`.
- Usar ADC / `GOOGLE_APPLICATION_CREDENTIALS` cuando haya lectura Firestore autorizada.

## Wrappers Legacy

Rutas antiguas mantenidas por compatibilidad:

- `scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js`
- `scripts/MORNINGSTAR_PDF_PARSER/prepare_write_gate_dry_run.js`
- `scripts/maintenance/cargador_lotes_v_2.js`

La ubicacion operativa nueva es esta carpeta raiz: `MORNINGSTAR_PDF_PARSER/`.
