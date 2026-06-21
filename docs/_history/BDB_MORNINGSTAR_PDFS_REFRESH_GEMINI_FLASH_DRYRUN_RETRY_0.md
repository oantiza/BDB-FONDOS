# BDB Morningstar PDFs Refresh Gemini Flash Dryrun Retry 0

Fecha: 2026-05-17  
Tarea: `BDB-MORNINGSTAR-PDFS-REFRESH-GEMINI-FLASH-DRYRUN-RETRY-0`  
Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`  
Modelo: `gemini-2.5-flash`

## Resumen Ejecutivo

Se reintento el dry-run completo tras confirmar que las dependencias reales estaban instaladas. El parser arranco correctamente, confirmo `DRY_RUN_ONLY`, detecto `649` PDFs y uso `gemini-2.5-flash`. Sin embargo, las llamadas al endpoint Gemini volvieron a fallar de forma uniforme con `fetch failed`. Se detuvo el lote tras `22` errores iguales para evitar producir 649 errores repetidos.

No hubo escritura Firestore, no se movieron PDFs y no se genero ningun payload dry-run util.

## Comando Ejecutado

```powershell
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --model gemini-2.5-flash --no-move-files
```

No se usaron `--write`, `--confirm-write` ni `--write-review`.

## Motivo Del Retry

El diagnostico previo confirmo:

- `csv-parse/sync`: dependencia real activa (`6.2.1`).
- `@google/generative-ai`: dependencia real activa (`0.24.1`).
- DNS y TCP 443 a Gemini: OK.
- Node HTTPS/fetch y llamada minima Gemini: OK en diagnostico previo.

## Resultado Del Retry

- PDFs en entrada: `649`.
- PDFs intentados antes de parar: `22`.
- OK: `0`.
- REVIEW: `0`.
- ERROR: `22`.
- ERROR_LLM_JSON: `22`.
- ERROR_SCHEMA_VALIDATION: `0`.
- ERROR_MATH_VALIDATION: `0`.
- Propuestas dry-run generadas: `0`.

## Warnings / Errores Principales

| Warning/Error | Count |
|---|---:|
| [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed | 22 |

## REVIEW

No hay ISINs en REVIEW porque no se obtuvo ninguna respuesta Gemini parseable.

## ERROR

| ISIN | PDF | Error | Message |
|---|---|---|---|
| BE0943877671 | BE0943877671-DPAM B - Bonds Eur Government B Cap.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| BE0946564383 | BE0946564383-DPAM B - Equities NewGems Sustainable B Cap.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| BE0947853660 | BE0947853660-DPAM B - Equities US Dividend Sustainable B EUR Cap.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| BE6213829094 | BE6213829094-DPAM B - Real Estate Europe Dividend Sustainable B Cap.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| DE0005318406 | DE0005318406-DWS ESG Stiftungsfonds LD.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| DE0008490962 | DE0008490962-DWS Deutschland LC.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| DE000A0X7541 | DE000A0X7541-Acatis Value Event Fonds A.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| DE000DWS17J0 | DE000DWS17J0-DWS ESG Dynamic Opportunities LC.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0110407006 | ES0110407006-Gestión Boutique VI Argos FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0111166031 | ES0111166031-Atl Capital Corto Plazo A FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0112231016 | ES0112231016-Avantage Fund B FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0112602000 | ES0112602000-Azvalor Managers FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0114633003 | ES0114633003-Panda Agriculture & Water Fund FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0114904008 | ES0114904008-Brightgate Focus A FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0116419005 | ES0116419005-Cartera Renta Fija Horizonte 2026 FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0116567035 | ES0116567035-Cartesio X FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0116848005 | ES0116848005-Global Allocation R FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0118537002 | ES0118537002-Olea Neutral FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0124880032 | ES0124880032-UBS Renta Fija 0-5 B FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0125240038 | ES0125240038-Trea Renta Fija Ahorro S FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0125323008 | ES0125323008-Gestión Value A FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |
| ES0126542036 | ES0126542036-Amundi Corto Plazo A FI.pdf | error_llm_json | [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: fetch failed |

## Validacion De Campos Prohibidos

No se generaron propuestas dry-run nuevas. Los artefactos nuevos de esta ejecucion son errores LLM con `fileName`, `error`, `message` y `generated_at`.

- Forbidden fields detected: `FALSE`.
- `manual.*` aparece en propuestas nuevas: `NO`.
- `manual.costs.retrocession` aparece en propuestas nuevas: `NO`.
- `retrocession` aparece en propuestas nuevas: `NO`.
- `portfolio_exposure_v2.economic_exposure` aparece en propuestas nuevas: `NO`.

Nota: `MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json` contiene `manual`, `manual.costs` y `manual.costs.retrocession` como `fields_preserved` de un artefacto antiguo, no como payload nuevo ni campo a escribir.

## Coste Aproximado

No hubo respuestas Gemini exitosas ni JSON parseable. No se puede confirmar facturacion desde el proveedor, pero tecnicamente todas las llamadas observadas fallaron en `fetch failed` antes de producir respuesta de modelo.

## Diagnostico Posterior Al Fallo

Despues de parar el lote:

- Prueba SDK oficial con JSON: `fetch failed`.
- Prueba SDK oficial texto simple: `fetch failed`.
- `fetch('https://generativelanguage.googleapis.com')`: `fetch failed EACCES`.

Esto indica que la salida Node hacia Gemini no esta estable/permitida durante el intento real, aunque hubiese funcionado en la prueba minima previa.

## Recomendacion

No pasar a `BDB-MORNINGSTAR-PDFS-REFRESH-FIRESTORE-COMPARISON-0` todavia. Tampoco tiene sentido `PRO-RESCUE` porque no hay errores de contenido/schema: hay un fallo uniforme de conectividad/fetch.

Siguiente paso recomendado:

1. Estabilizar o permitir explicitamente salidas Node hacia `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`.
2. Ejecutar primero un smoke test del parser con `--limit 1 --no-move-files --model gemini-2.5-flash`.
3. Si ese smoke test produce un artefacto OK/REVIEW real, relanzar los 649 PDFs.

Comando smoke sugerido, no ejecutado:

```powershell
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --model gemini-2.5-flash --no-move-files --limit 1
```

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
- `portfolio_exposure_v2.economic_exposure` no tocado.
