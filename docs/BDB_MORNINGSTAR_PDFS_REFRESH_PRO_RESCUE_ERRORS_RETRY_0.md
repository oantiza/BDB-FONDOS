# BDB-MORNINGSTAR-PDFS-REFRESH-PRO-RESCUE-ERRORS-RETRY-0

## Resumen ejecutivo

Se repitio el rescate autorizado de los mismos 32 PDFs de ERROR con `gemini-2.5-pro`, en modo dry-run, con `--no-move-files` y `--concurrency 1`.

Resultado:

- PDFs intentados: 32
- OK: 2
- REVIEW: 0
- ERROR: 30
- Propuestas validas nuevas: 2
- `fetch failed`: no reaparecio
- Firestore writes: 0
- PDFs movidos: 0
- Commit: no
- Push: no
- Deploy: no

## Comando ejecutado

Desde `MORNINGSTAR_PDF_PARSER/bin`:

```powershell
node .\parse_dry_run.js --dir "C:\Users\oanti\Documents\BDB-FONDOS\MORNINGSTAR_PDF_PARSER\ENTRADA_PRO_RESCUE_ERRORS" --model gemini-2.5-pro --no-move-files --concurrency 1
```

Artefacto copiado inmediatamente despues del run:

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_pro_rescue_errors_retry_0.json`

## Rescatados

- LU0568620560
- LU1278917536

`LU0568620560` quedo rescatado en este retry. En el intento Flash habia fallado por `portfolio_exposure_v2_missing`; en este retry Pro produjo propuesta valida.

## Errores persistentes

Los 30 errores persistentes fallaron por el mismo motivo:

`Gemini no devolvio un JSON objeto parseable`

ISIN persistentes:

- DE000A0X7541
- IE00B986FT65
- LU0117858166
- LU0189895229
- LU0284396289
- LU0352312184
- LU0512121004
- LU0778324086
- LU0920839429
- LU0995386439
- LU1061675168
- LU1103307408
- LU1191877379
- LU1278917452
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

## Validacion de campos prohibidos

No se detectaron campos prohibidos como campos propuestos.

- `manual`: no propuesto
- `manual.costs`: no propuesto
- `manual.costs.retrocession`: no propuesto
- `retrocession`: no propuesto
- `portfolio_exposure_v2.economic_exposure`: no propuesto

Campos a actualizar propuestos por el parser para las 2 propuestas validas:

- `classification_v2`
- `currency`
- `derived`
- `isin`
- `ms`
- `name`
- `portfolio_exposure_v2`
- `quality`
- `updatedAt`

Campos preservados:

- `manual`
- `manual.costs`
- `manual.costs.retrocession`

## Validacion operativa

- Carpeta de entrada original: 649 PDFs
- Carpeta de rescate: 32 PDFs
- Movimientos de PDFs en artefacto: 32 `SKIPPED`
- `dry_run`: true
- `would_write`: false
- Firestore writes: 0
- Parser masivo: no ejecutado sobre los 649
- `BDB-FONDOS-CORE`: no tocado
- `funds_core_v1`: no usado

## Recomendacion

Usar este artefacto retry como fuente Pro rescatada para un siguiente bloque de merge read-only, combinando las 617 propuestas validas Flash con las 2 propuestas Pro rescatadas. No abrir write gate todavia; antes conviene comparar el consolidado contra `funds_v3` en modo read-only y dejar documentados los 30 errores persistentes.
