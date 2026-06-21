# BDB Morningstar PDFs Refresh Gemini Flash Dryrun 0

Fecha de ejecucion: 2026-05-17  
Tarea: `BDB-MORNINGSTAR-PDFS-REFRESH-GEMINI-FLASH-DRYRUN-0`  
Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`  
Modelo solicitado: `gemini-2.5-flash`

## Resumen Ejecutivo

El parser oficial se intento ejecutar en modo dry-run con el comando seguro solicitado, pero el dry-run no pudo completarse por bloqueo de conectividad externa hacia Gemini. El parser arranco correctamente, confirmo `DRY_RUN_ONLY`, detecto `649` PDFs y comenzo a procesar con concurrencia 10. Las primeras llamadas fallaron de forma uniforme con `fetch failed`; se paro la ejecucion tras `70` errores identicos para evitar generar 649 errores repetidos.

No hubo escritura Firestore, no se movieron PDFs y no se ejecuto ningun write gate.

## Comando Ejecutado

```powershell
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --model gemini-2.5-flash --no-move-files
```

Guardas confirmadas:

- El wrapper bloquea `--write` y `--confirm-write`.
- El parser imprimio `DRY_RUN_ONLY: Firestore writes are disabled`.
- Se uso `--no-move-files`.
- No se uso `--write`, `--confirm-write` ni `--write-review`.

## Resultado

- PDFs en entrada: `649`.
- PDFs intentados antes de parar: `70`.
- OK: `0`.
- REVIEW: `0`.
- ERROR: `70`.
- ERROR_LLM_JSON: `70`.
- ERROR_SCHEMA_VALIDATION: `0`.
- ERROR_MATH_VALIDATION: `0`.
- Propuestas dry-run generadas en esta ejecucion: `0`.
- Coste aproximado: `0` respuestas Gemini exitosas; las llamadas fallaron por conectividad antes de obtener respuesta. No se puede confirmar facturacion externa desde el proveedor, pero no hubo outputs Gemini.

## Bloqueo De Red

Pruebas realizadas:

- Node `fetch('https://generativelanguage.googleapis.com')`: `TypeError fetch failed`, causa `EACCES`.
- PowerShell `Invoke-WebRequest https://generativelanguage.googleapis.com`: `No es posible conectar con el servidor remoto`.
- `npm view csv-parse version`: `EACCES` contra `https://registry.npmjs.org`.

Esto apunta a bloqueo de salida HTTPS desde el entorno, no a un problema de los PDFs ni del parser.

## Warnings Principales

| Warning | Count |
|---|---:|
| fetch failed | 70 |

## REVIEW

No hay ISINs en REVIEW porque no se obtuvo ninguna respuesta Gemini parseable.

## ERROR

| ISIN | PDF | Error | Message |
|---|---|---|---|
| BE0943877671 | BE0943877671-DPAM B - Bonds Eur Government B Cap.pdf | error_llm_json | fetch failed |
| ES0111166031 | ES0111166031-Atl Capital Corto Plazo A FI.pdf | error_llm_json | fetch failed |
| BE0946564383 | BE0946564383-DPAM B - Equities NewGems Sustainable B Cap.pdf | error_llm_json | fetch failed |
| BE0947853660 | BE0947853660-DPAM B - Equities US Dividend Sustainable B EUR Cap.pdf | error_llm_json | fetch failed |
| BE6213829094 | BE6213829094-DPAM B - Real Estate Europe Dividend Sustainable B Cap.pdf | error_llm_json | fetch failed |
| DE0008490962 | DE0008490962-DWS Deutschland LC.pdf | error_llm_json | fetch failed |
| DE0005318406 | DE0005318406-DWS ESG Stiftungsfonds LD.pdf | error_llm_json | fetch failed |
| DE000A0X7541 | DE000A0X7541-Acatis Value Event Fonds A.pdf | error_llm_json | fetch failed |
| DE000DWS17J0 | DE000DWS17J0-DWS ESG Dynamic Opportunities LC.pdf | error_llm_json | fetch failed |
| ES0110407006 | ES0110407006-Gestión Boutique VI Argos FI.pdf | error_llm_json | fetch failed |
| ES0112231016 | ES0112231016-Avantage Fund B FI.pdf | error_llm_json | fetch failed |
| ES0112602000 | ES0112602000-Azvalor Managers FI.pdf | error_llm_json | fetch failed |
| ES0114633003 | ES0114633003-Panda Agriculture & Water Fund FI.pdf | error_llm_json | fetch failed |
| ES0114904008 | ES0114904008-Brightgate Focus A FI.pdf | error_llm_json | fetch failed |
| ES0116419005 | ES0116419005-Cartera Renta Fija Horizonte 2026 FI.pdf | error_llm_json | fetch failed |
| ES0116567035 | ES0116567035-Cartesio X FI.pdf | error_llm_json | fetch failed |
| ES0116848005 | ES0116848005-Global Allocation R FI.pdf | error_llm_json | fetch failed |
| ES0118537002 | ES0118537002-Olea Neutral FI.pdf | error_llm_json | fetch failed |
| ES0124880032 | ES0124880032-UBS Renta Fija 0-5 B FI.pdf | error_llm_json | fetch failed |
| ES0125240038 | ES0125240038-Trea Renta Fija Ahorro S FI.pdf | error_llm_json | fetch failed |
| ES0125323008 | ES0125323008-Gestión Value A FI.pdf | error_llm_json | fetch failed |
| ES0126542036 | ES0126542036-Amundi Corto Plazo A FI.pdf | error_llm_json | fetch failed |
| ES0126547035 | ES0126547035-UBS Duración 0-2 B FI.pdf | error_llm_json | fetch failed |
| ES0127097030 | ES0127097030-Dux Rentinver Renta Fija FI.pdf | error_llm_json | fetch failed |
| ES0127795005 | ES0127795005-EDM Renta R FI.pdf | error_llm_json | fetch failed |
| ES0128067008 | ES0128067008-Dux Mixto Variable FI.pdf | error_llm_json | fetch failed |
| ES0131462022 | ES0131462022-Gestion Boutique V Robotics R FI.pdf | error_llm_json | fetch failed |
| ES0137381036 | ES0137381036-Gesconsult Renta Variable Iberia A FI.pdf | error_llm_json | fetch failed |
| ES0138217031 | ES0138217031-Gesconsult Renta Fija Flexible A FI.pdf | error_llm_json | fetch failed |
| ES0138911039 | ES0138911039-Gesconsult Renta Variable Eurozona FI.pdf | error_llm_json | fetch failed |
| ES0138914033 | ES0138914033-Merch-Fontemar FI.pdf | error_llm_json | fetch failed |
| ES0138922002 | ES0138922002-Gesconsult Horizonte 2027 FI.pdf | error_llm_json | fetch failed |
| ES0138922036 | ES0138922036-Gesconsult Corto Plazo A FI.pdf | error_llm_json | fetch failed |
| ES0138930005 | ES0138930005-Fonvalcem B FI.pdf | error_llm_json | fetch failed |
| ES0138936036 | ES0138936036-Fondibas FI.pdf | error_llm_json | fetch failed |
| ES0140643034 | ES0140643034-GVC Gaesco Europa FI.pdf | error_llm_json | fetch failed |
| ES0140986011 | ES0140986011-Gesconsult Oportunidad Renta Fija A FI.pdf | error_llm_json | fetch failed |
| ES0141113037 | ES0141113037-GVC Gaesco Japón A FI.pdf | error_llm_json | fetch failed |
| ES0141580037 | ES0141580037-SIH Ahorro A FI.pdf | error_llm_json | fetch failed |
| ES0141991002 | ES0141991002-Gestión Talento FI.pdf | error_llm_json | fetch failed |
| ES0142046038 | ES0142046038-Gesem Agresivo Flexible FI.pdf | error_llm_json | fetch failed |
| ES0142167032 | ES0142167032-SIH Renta Fija A FI.pdf | error_llm_json | fetch failed |
| ES0146309002 | ES0146309002-Horos Value Internacional FI.pdf | error_llm_json | fetch failed |
| ES0148181003 | ES0148181003-Indexa RV mixta internacional 75 FI.pdf | error_llm_json | fetch failed |
| ES0155142005 | ES0155142005-Intermoney Variable Euro A FI.pdf | error_llm_json | fetch failed |
| ES0155598008 | ES0155598008-UBS Corto Plazo A FI.pdf | error_llm_json | fetch failed |
| ES0155598032 | ES0155598032-UBS Corto Plazo B FI.pdf | error_llm_json | fetch failed |
| ES0156873004 | ES0156873004-A&G Renta Fija Corto Plazo FI.pdf | error_llm_json | fetch failed |
| ES0158600033 | ES0158600033-Sigma Invesment House Flexible Global FI.pdf | error_llm_json | fetch failed |
| ES0159201013 | ES0159201013-Magallanes Iberian Equity M FI.pdf | error_llm_json | fetch failed |
| ES0159259011 | ES0159259011-Magallanes European Equity M FI.pdf | error_llm_json | fetch failed |
| ES0160873008 | ES0160873008-March Pagarés A FI.pdf | error_llm_json | fetch failed |
| ES0161032034 | ES0161032034-March Renta Fija Corto Plazo A FI.pdf | error_llm_json | fetch failed |
| ES0161992005 | ES0161992005-Sigma Investment House Capital FI.pdf | error_llm_json | fetch failed |
| ES0162211033 | ES0162211033-Merch-Eurounión FI.pdf | error_llm_json | fetch failed |
| ES0162295002 | ES0162295002-Cartera Renta Fija Horizonte 2027 FI.pdf | error_llm_json | fetch failed |
| ES0162305033 | ES0162305033-Merch-Oportunidades FI.pdf | error_llm_json | fetch failed |
| ES0162333035 | ES0162333035-Merchrenta FI.pdf | error_llm_json | fetch failed |
| ES0162368007 | ES0162368007-Metavalor Internacional I FI.pdf | error_llm_json | fetch failed |
| ES0162946034 | ES0162946034-Abante Selección FI.pdf | error_llm_json | fetch failed |
| ES0162949012 | ES0162949012-Abante Índice Selección A FI.pdf | error_llm_json | fetch failed |
| ES0165142003 | ES0165142003-Mutuafondo Corto Plazo D FI.pdf | error_llm_json | fetch failed |
| ES0165142037 | ES0165142037-Mutuafondo Corto Plazo A FI.pdf | error_llm_json | fetch failed |
| ES0165242001 | ES0165242001-Myinvestor S&P500 Equiponderado FI.pdf | error_llm_json | fetch failed |
| ES0167238023 | ES0167238023-Estela Global Equities R FI.pdf | error_llm_json | fetch failed |
| ES0168662031 | ES0168662031-Trea Renta Fija FI.pdf | error_llm_json | fetch failed |
| ES0168673038 | ES0168673038-EDM Ahorro R FI.pdf | error_llm_json | fetch failed |
| ES0168799056 | ES0168799056-Gestión Boutique IV Alclam US Equities FI.pdf | error_llm_json | fetch failed |
| ES0170138038 | ES0170138038-Santalucía Renta Fija B FI.pdf | error_llm_json | fetch failed |
| ES0170141008 | ES0170141008-Santalucía Quality Acciones Europeas B FI.pdf | error_llm_json | fetch failed |

## Validacion De Campos Prohibidos

La ejecucion no genero propuestas dry-run ni payloads canonicos nuevos. Los artefactos de error generados solo contienen `fileName`, `error`, `message` y `generated_at`.

- Forbidden fields detected: `FALSE`.
- `manual.*` en propuestas nuevas: `NO`.
- `manual.costs.retrocession` en propuestas nuevas: `NO`.
- `retrocession` en propuestas nuevas: `NO`.
- `portfolio_exposure_v2.economic_exposure` en propuestas nuevas: `NO`.

## Campos Extraidos

No se extrajeron campos Morningstar en esta fase porque todas las llamadas al modelo fallaron por conectividad antes de devolver JSON.

## Comparacion Contra Preaudit Gemma4

La preauditoria Gemma4 local fue completa y clasifico los `649` PDFs como `HIGH_VALUE_REFRESH`, con `649` ISINs unicos y sin errores. El dry-run Gemini Flash no contradice esa conclusion; simplemente no pudo ejecutarse por bloqueo de red externa.

## Nota De Entorno Node

`package.json` declaraba `csv-parse` y `@google/generative-ai`, pero no estaban presentes en `node_modules`. Como `npm` tambien fallo con `EACCES`, se a?adieron shims locales minimos bajo `node_modules` para esas dependencias ya declaradas y asi permitir que el parser arrancara sin modificar `MORNINGSTAR_PDF_PARSER/src/cargador_lotes_v_2.js` ni el wrapper productivo.

## Recomendacion

No pasar todavia a comparacion contra `funds_v3`, write gate ni Pro rescue. Primero hay que desbloquear salida HTTPS a `generativelanguage.googleapis.com` y reejecutar el mismo dry-run Flash completo.

Siguiente bloque recomendado:

`BDB-MORNINGSTAR-PDFS-REFRESH-GEMINI-FLASH-DRYRUN-0-RETRY-NETWORK-UNBLOCKED`

Cuando exista un dry-run Flash completo, entonces proponer:

`BDB-MORNINGSTAR-PDFS-REFRESH-FIRESTORE-COMPARISON-0`

Si tras desbloquear red quedan errores aislados de modelo o schema, entonces proponer:

`BDB-MORNINGSTAR-PDFS-REFRESH-PRO-RESCUE-0`

## Confirmaciones

- Firestore writes: `0`.
- PDFs movidos: `0`.
- Deploy: `NO`.
- Commit: `NO`.
- Push: `NO`.
- `BDB-FONDOS-CORE` no tocado.
- `funds_core_v1` no usado.
- `manual.*` no tocado.
- `manual.costs.retrocession` no tocado.
