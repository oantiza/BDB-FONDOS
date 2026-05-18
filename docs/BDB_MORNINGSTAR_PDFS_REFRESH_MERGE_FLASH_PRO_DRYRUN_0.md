# BDB-MORNINGSTAR-PDFS-REFRESH-MERGE-FLASH-AND-PRO-DRYRUN-0

## Resumen ejecutivo

Se consolido en modo read-only el dry-run Flash con las 2 propuestas rescatadas por Pro. No se ejecuto parser, no se escribio Firestore, no se movieron PDFs y no se hizo commit ni push.

Resultado del merge:

- Total PDFs fuente: 649
- Propuestas validas Flash: 617
- Propuestas Pro rescatadas: 2
- Propuestas consolidadas: 619
- Errores pendientes: 30
- Campos prohibidos detectados: false

## Fuentes

Flash:

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_flash_before_pro_rescue_errors_0.json`

Pro retry:

`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_pro_rescue_errors_retry_0.json`

## ISINs rescatados por Pro

- LU0568620560
- LU1278917536

No habia duplicado Flash para esos ISINs, asi que se agregaron al consolidado como nuevas propuestas Pro.

## ISINs todavia pendientes

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

No se detectaron campos prohibidos como campos propuestos en el payload consolidado.

- `manual`: no propuesto
- `manual.costs`: no propuesto
- `manual.costs.retrocession`: no propuesto
- `retrocession`: no propuesto
- `portfolio_exposure_v2.economic_exposure`: no propuesto

Campos preservados declarados por los artefactos:

- manual
- manual.costs
- manual.costs.retrocession

## Artefacto consolidado

`artifacts/bdb_parser_audit/morningstar_pdfs_refresh_merged_flash_pro_dryrun_0.json`

## Validacion operativa

- Firestore writes: 0
- PDFs moved: 0
- Deploy: false
- Commit: false
- Push: false
- BDB-FONDOS-CORE tocado: false
- funds_core_v1 usado: false

## Siguiente bloque recomendado

`BDB-MORNINGSTAR-PDFS-REFRESH-FIRESTORE-COMPARISON-0`

Objetivo: comparar las 619 propuestas consolidadas contra `funds_v3` en modo read-only antes de cualquier write gate.
