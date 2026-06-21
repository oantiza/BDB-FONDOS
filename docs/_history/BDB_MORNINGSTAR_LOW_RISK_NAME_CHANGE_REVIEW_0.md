# BDB-MORNINGSTAR-LOW-RISK-NAME-CHANGE-REVIEW-0

Fecha: 2026-05-18 22:24 Europe/Madrid

Modo: revision local/read-only. No se ha escrito Firestore, no se ha llamado Gemini, no se ha ejecutado parser, no se ha hecho deploy, commit ni push.

## Fuentes

- `artifacts/bdb_parser_audit/morningstar_low_risk_write_gate_manifest_0.json`
- `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_firestore_comparison_0.json`
- `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_merged_flash_pro_dryrun_0.json`

## Resumen

Se revisaron los 7 LOW_RISK_UPDATE excluidos del write gate de 76 por proponer cambio en `name`.

- SAFE_NAME_NORMALIZATION: 2
- REVIEW_NAME_CHANGE: 3
- POSSIBLE_WRONG_MATCH: 1
- DO_NOT_WRITE: 1
- Campos prohibidos detectados: NO
- `manual.*` tocado: NO
- `manual.costs.retrocession` tocado: NO
- `portfolio_exposure_v2.economic_exposure` tocado: NO

## Tabla de revision

| ISIN | Name actual | Name propuesto | Tipo de diferencia | Clasificacion | Recomendacion |
|---|---|---|---|---|---|
| ES0138922002 | Gesconsult Horizonte 2025 FI | Gesconsult Horizonte 2027 FI | Cambio material de ano/termino objetivo | REVIEW_NAME_CHANGE | Mantener excluido salvo confirmacion humana de renombre/rollover del mismo ISIN. |
| LU0137009238 | Vontobel Fund - Euro Short Term Bond C EUR Cap | Vontobel Fund - TwentyFour Euro Short Term Bond C EUR Cap | Nombre de gestora/estrategia mas completo | REVIEW_NAME_CHANGE | Candidato condicional solo si se confirma oficialmente que TwentyFour debe formar parte del nombre. |
| LU0208853944 | JPMorgan Funds - Global Natural Resources Fund D (acc) - EUR | JPMorgan Funds - Global Natural Resources Fund D (acc) EUR | Puntuacion: elimina separador antes de EUR | SAFE_NAME_NORMALIZATION | Puede entrar en mini-gate posterior. |
| LU0260085492 | Jupiter European Growth Class L EUR Acc | Jupiter European Select Class L EUR Acc | Cambio material Growth -> Select | POSSIBLE_WRONG_MATCH | Mantener excluido; requiere confirmacion externa/manual antes de cualquier escritura. |
| LU0430492750 | JPMorgan Funds - Euro Aggregate Bond Fund C (acc) - EUR | JPMorgan Funds - Euro Aggregate Bond Fund C (acc) EUR | Puntuacion: elimina separador antes de EUR | SAFE_NAME_NORMALIZATION | Puede entrar en mini-gate posterior. |
| LU0658026512 | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E Capitalisation EUR | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E | El nombre propuesto pierde detalle de share class/divisa | DO_NOT_WRITE | Mantener excluido; el nombre actual es mas preciso. |
| LU2482630162 | European Specialist Investment Funds - M&G European Credit Investment Fund Class P EUR Acc | M&G European Credit Investment Fund Class P EUR Acc | Elimina prefijo umbrella | REVIEW_NAME_CHANGE | Candidato condicional solo si se decide que funds_v3 debe usar el nombre corto Morningstar. |

## Resto de campos propuestos

Los 7 casos siguen siendo LOW_RISK_UPDATE en el comparador para los campos no-name y no presentan campos prohibidos. El resto de campos son refrescos de fecha, cartera, asset mix, holdings, calidad/hash y, segun el caso, renta fija, ratings ESG o sectores/regiones.

- ES0138922002: 25 campos no-name. Incluye fecha, cartera, asset mix, holdings, management_fee, vencimientos/cupones y exposicion de renta fija.
- LU0137009238: 36 campos no-name. Incluye fecha, rating, asset mix, duracion/maturity, credito, holdings y exposicion de renta fija.
- LU0208853944: 84 campos no-name. Incluye fecha, asset mix, sectores, regiones, market cap, holdings, derivados y exposicion sectorial/regional.
- LU0260085492: 83 campos no-name. Incluye fecha, ratings, asset mix, sectores, regiones, estilo, objetivo, holdings y exposiciones derivadas.
- LU0430492750: 42 campos no-name. Incluye fecha, asset mix, duracion, calidad crediticia, vencimientos/cupones, holdings y exposicion de renta fija.
- LU0658026512: 46 campos no-name. Incluye fecha, sustainability, asset mix, duracion/maturity, credito high yield, holdings y warnings.
- LU2482630162: 48 campos no-name. Incluye fecha, ratings, asset mix, duracion, credito, holdings y exposicion de renta fija.

## Candidatos a mini-gate posterior

Aptos por normalizacion clara de nombre:

- LU0208853944
- LU0430492750

Candidatos condicionales, solo con aprobacion humana explicita del nombre:

- LU0137009238
- LU2482630162

Deben seguir excluidos por ahora:

- ES0138922002
- LU0260085492
- LU0658026512

## Validacion de seguridad

- Firestore writes = 0
- Gemini calls = 0
- Parser ejecutado = NO
- PDFs movidos = 0
- Deploy = NO
- Commit = NO
- Push = NO
- BDB-FONDOS-CORE tocado = NO
- `funds_core_v1` usado = NO
- Campos prohibidos detectados = NO

