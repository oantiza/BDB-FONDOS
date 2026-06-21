# BDB-MORNINGSTAR-PDFS-REFRESH-FIRESTORE-COMPARISON-0

## Resumen ejecutivo

Comparacion read-only de las 619 propuestas consolidadas contra Firestore `funds_v3`. No se llamo a Gemini, no se ejecuto parser, no se escribio Firestore y no se movieron PDFs.

Resultado:

- Total propuestas comparadas: 619
- Encontradas en `funds_v3`: 617
- No encontradas en `funds_v3`: 2
- NO_CHANGE: 0
- LOW_RISK_UPDATE: 83
- REVIEW_REQUIRED: 534
- BLOCKED: 0
- Campos prohibidos detectados: false
- Firestore writes: 0
- Gemini calls: 0
- PDFs movidos: 0

## Fuentes

- Consolidado: `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_merged_flash_pro_dryrun_0.json`
- Coleccion Firestore leida: `funds_v3`
- Docs Firestore leidos: 671

## ISINs Pro rescatados incluidos

- LU0568620560
- LU1278917536

## No encontrados en funds_v3

- LU0171281750
- LU0171282212

## Muestra de REVIEW_REQUIRED

- BE0943877671: classification_or_asset_type_changed, material_exposure_change
- BE0946564383: material_exposure_change
- BE0947853660: classification_or_asset_type_changed
- BE6213829094: classification_or_asset_type_changed, material_exposure_change, proposal_incomplete_relevant_fields
- DE0005318406: classification_or_asset_type_changed, material_exposure_change
- DE0008490962: material_exposure_change
- DE000DWS17J0: classification_or_asset_type_changed, material_exposure_change
- ES0110407006: classification_or_asset_type_changed
- ES0111166031: classification_or_asset_type_changed, material_exposure_change
- ES0112231016: classification_or_asset_type_changed, material_exposure_change
- ES0114904008: classification_or_asset_type_changed, material_exposure_change
- ES0116419005: material_exposure_change
- ES0116567035: classification_or_asset_type_changed
- ES0116848005: classification_or_asset_type_changed
- ES0118537002: classification_or_asset_type_changed, material_exposure_change
- ES0125323008: classification_or_asset_type_changed, material_exposure_change
- ES0126542036: classification_or_asset_type_changed, material_exposure_change
- ES0126547035: classification_or_asset_type_changed, material_exposure_change
- ES0127097030: classification_or_asset_type_changed, material_exposure_change
- ES0127795005: classification_or_asset_type_changed, material_exposure_change
- ES0128067008: classification_or_asset_type_changed, material_exposure_change
- ES0131462022: classification_or_asset_type_changed, material_exposure_change
- ES0137381036: classification_or_asset_type_changed, material_exposure_change
- ES0138217031: classification_or_asset_type_changed
- ES0138911039: classification_or_asset_type_changed, material_exposure_change

## Pendientes duros no comparados

Los 30 errores pendientes del refresh siguen fuera del consolidado y quedan documentados en `unresolved_30_errors` del JSON.

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

No se detectaron propuestas que modifiquen:

- `manual`
- `manual.costs`
- `manual.costs.retrocession`
- `retrocession`
- `portfolio_exposure_v2.economic_exposure`

## Validacion operativa

- Firestore writes: 0
- Gemini calls: 0
- Parser masivo: NO
- PDFs moved: 0
- Deploy: NO
- Commit: NO
- Push: NO
- BDB-FONDOS-CORE tocado: NO
- funds_core_v1 usado: NO

## Siguiente paso recomendado

Revisar los grupos `REVIEW_REQUIRED` y `NOT_FOUND_IN_FUNDS_V3` antes de preparar cualquier write gate. Solo los `LOW_RISK_UPDATE` deberian considerarse candidatos iniciales para un gate controlado posterior.
