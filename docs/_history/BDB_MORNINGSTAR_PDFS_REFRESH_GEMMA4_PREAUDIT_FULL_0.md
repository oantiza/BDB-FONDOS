# BDB Morningstar PDFs Refresh Gemma4 Preaudit Full 0

Fecha de ejecucion: 2026-05-17  
Tarea: `BDB-MORNINGSTAR-PDFS-REFRESH-GEMMA4-PREAUDIT-FULL-0`  
Proyecto: `C:\Users\oanti\Documents\BDB-FONDOS`  
Carpeta PDFs: `MORNINGSTAR_PDF_PARSER/ENTRADA`  
Artefacto JSON: `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_gemma4_preaudit_full_0.json`

## Resumen

- PDFs inventariados: `649`.
- PDFs procesados: `649`.
- ISINs unicos detectados: `649`.
- Modelo usado: `gemma4:e4b`.
- Metodo Ollama: servicio local `http://127.0.0.1:11434`, modelo `gemma4:e4b`.
- `--limit 0`: confirmado como sin limite; procesa todo el bloque porque el script solo recorta cuando `limit > 0`.
- Coste API externo: `0`.
- Gemini API calls: `0`.
- Firestore writes: `0`.
- PDFs movidos: `0`.
- Errores: `0`.

## Seguridad

- No se leyo Firestore.
- No se escribio Firestore.
- No se llamo Gemini.
- No se uso API externa.
- No se movieron ni borraron PDFs.
- No se modifico el parser productivo.
- No se uso `funds_core_v1`.
- No se toco `BDB-FONDOS-CORE`.
- No se toco `manual.*`, `manual.costs` ni `manual.costs.retrocession`.
- Deploy: `NO`.
- Commit: `NO`.
- Push: `NO`.

## Distribucion Por Recomendacion

| Recomendacion | PDFs |
| --- | --- |
| HIGH_VALUE_REFRESH | 649 |
| SAFE_REFRESH_LOW_RISK |  |
| REVIEW_BEFORE_WRITE |  |
| DO_NOT_PARSE_NOW |  |

## Calidad De Identidad

- PDFs sin ISIN: `0`.
- PDFs con ISIN duplicado: `0`.
- PDFs con posible mismatch filename/text: `0`.

La anomalia del piloto de 5 PDFs / 6 ISINs fue un duplicado en el resumen humano anterior. El JSON piloto tenia 5 PDFs y 5 ISINs unicos. Para esta fase full se reforzo la deteccion de ISIN con checksum, prefijos ISIN/ISO validos y un minimo de digitos en el cuerpo para evitar falsos positivos por texto compactado.

### PDFs Sin ISIN

No hay PDFs sin ISIN.

### ISINs Duplicados

No hay ISINs duplicados.

### Posibles Mismatches Filename/Text

No hay mismatches filename/text tras filtrar falsos positivos.

## Campos Disponibles

| Campo | PDFs | Cobertura |
| --- | --- | --- |
| asset_allocation | 649 | 100.0% |
| regions | 495 | 76.3% |
| sectors | 475 | 73.2% |
| top_holdings | 649 | 100.0% |
| credit_quality | 297 | 45.8% |
| duration | 279 | 43.0% |
| yield | 215 | 33.1% |
| costs | 649 | 100.0% |
| ratings | 649 | 100.0% |
| esg | 649 | 100.0% |

## Top 30 PDFs Por Score

| ISIN | Score | Recomendacion | Fecha informe | Fecha cartera | PDF |
| --- | --- | --- | --- | --- | --- |
| LU2784406998 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2025-12-31 | LU2784406998-Morgan Stanley Investment Funds - Emerging Markets Debt Opportunities Fund A EUR.pdf |
| LU2697545247 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU2697545247-BGF Euro Investment Grade Fixed Maturity Bond Fund 2028 A2.pdf |
| LU2697545163 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU2697545163-BlackRock Global Funds - Euro High Yield Fixed Maturity Bond Fund 2027 Class A2.pdf |
| LU2482630162 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU2482630162-European Specialist Investment Funds - M&G European Credit Investment Fund Class P EUR Acc.pdf |
| LU2295320068 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU2295320068-Morgan Stanley Investment Funds - Global Insight Fund A (EUR).pdf |
| LU2278574988 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU2278574988-Buy & Hold Luxembourg B&H Bond Class 2.pdf |
| LU2278574715 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU2278574715-Buy & Hold Luxembourg B&H Flexible Class 2.pdf |
| LU2267099674 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU2267099674-BlackRock Global Funds - China Bond Fund Class A2 USD EUR.pdf |
| LU2222028099 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU2222028099-Merchbanc FCP Renta Fija Flex A.pdf |
| LU2210151341 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-01-31 | LU2210151341-Fidelity Funds - Absolute Return Global Equity Fund A-PF-Acc-Euro (EuroUSD hedged).pdf |
| LU2098772366 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-02-28 | LU2098772366-Candriam Bonds Credit Alpha C EUR.pdf |
| LU2050544563 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU2050544563-DWS ESG Multi Asset Dynamic LC.pdf |
| LU2002383896 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU2002383896-Allianz Global Investors Fund - Allianz Credit Opportunities Plus AT EUR.pdf |
| LU1982200609 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1982200609-DWS Invest Corporate Green Bonds LC.pdf |
| LU1966822956 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2025-12-31 | LU1966822956-Cartesio Funds Income R.pdf |
| LU1965927921 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1965927921-DWS Invest ESG Floating Rate Notes LC.pdf |
| LU1961009468 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1961009468-DWS Strategic Allocation Balance NC.pdf |
| LU1951921383 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1951921383-Allianz Global Investors Fund - Allianz Credit Opportunities AT EUR.pdf |
| LU1919971074 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1919971074-abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR.pdf |
| LU1915690918 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1915690918-Nordea 1 - Active Rates Opportunities Fund Fund E EUR.pdf |
| LU1902444584 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1902444584-CPR Invest - Climate Bonds Euro - A EUR - Acc.pdf |
| LU1899018953 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU1899018953-Sigma Investment House FCP - Best Blackrock Class A EUR Accumulation.pdf |
| LU1899018870 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU1899018870-Sigma Investment House FCP - Best M&G Class A EUR Accumulation.pdf |
| LU1894680757 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1894680757-Amundi Funds - Income Opportunities A2 EUR (C).pdf |
| LU1883342377 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-04-30 | LU1883342377-Amundi Funds - Global Equity A EUR (C).pdf |
| LU1883340322 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1883340322-Amundi Funds - Pioneer Flexible Opportunities A EUR (C).pdf |
| LU1883334275 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1883334275-Amundi Funds - Global Subordinated Bond A EUR (C).pdf |
| LU1883330521 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2025-11-30 | LU1883330521-Amundi Funds - Global Multi-Asset Target Income A2 EUR (C).pdf |
| LU1883329432 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1883329432-Amundi Funds - Global Multi-Asset Conservative A EUR (C).pdf |
| LU1883327816 | 15 | HIGH_VALUE_REFRESH | 2026-05-17 | 2026-03-31 | LU1883327816-Amundi Funds - Global Multi-Asset A EUR (C).pdf |

## Bottom / Revision

No hubo errores ni `DO_NOT_PARSE_NOW`. El score minimo fue `12`, que sigue clasificando como `HIGH_VALUE_REFRESH`. Estos son los 30 scores mas bajos para revision de cobertura:

| ISIN | Score | Recomendacion | Warnings | PDF |
| --- | --- | --- | --- | --- |
| BE0946564383 | 12 | HIGH_VALUE_REFRESH |  | BE0946564383-DPAM B - Equities NewGems Sustainable B Cap.pdf |
| BE6213829094 | 12 | HIGH_VALUE_REFRESH |  | BE6213829094-DPAM B - Real Estate Europe Dividend Sustainable B Cap.pdf |
| ES0112602000 | 12 | HIGH_VALUE_REFRESH |  | ES0112602000-Azvalor Managers FI.pdf |
| ES0114633003 | 12 | HIGH_VALUE_REFRESH |  | ES0114633003-Panda Agriculture & Water Fund FI.pdf |
| ES0155142005 | 12 | HIGH_VALUE_REFRESH |  | ES0155142005-Intermoney Variable Euro A FI.pdf |
| ES0165242001 | 12 | HIGH_VALUE_REFRESH |  | ES0165242001-Myinvestor S&P500 Equiponderado FI.pdf |
| ES0168799056 | 12 | HIGH_VALUE_REFRESH |  | ES0168799056-Gestión Boutique IV Alclam US Equities FI.pdf |
| ES0182769002 | 12 | HIGH_VALUE_REFRESH |  | ES0182769002-Valentum E FI.pdf |
| FR0000989899 | 12 | HIGH_VALUE_REFRESH |  | FR0000989899-Oddo BHF Avenir CR-EUR.pdf |
| FR0010148981 | 12 | HIGH_VALUE_REFRESH |  | FR0010148981-Carmignac Investissement A EUR Acc.pdf |
| FR0010288308 | 12 | HIGH_VALUE_REFRESH |  | FR0010288308-Groupama Avenir Euro NC.pdf |
| FR0010312660 | 12 | HIGH_VALUE_REFRESH |  | FR0010312660-Carmignac Investissement E EUR Acc.pdf |
| FR0010321810 | 12 | HIGH_VALUE_REFRESH |  | FR0010321810-Echiquier Agenor Mid Cap Europe A.pdf |
| FR0010547869 | 12 | HIGH_VALUE_REFRESH |  | FR0010547869-Sextant PME A.pdf |
| FR0010722348 | 12 | HIGH_VALUE_REFRESH |  | FR0010722348-Groupama Global Active Equity NC.pdf |
| FR0010859769 | 12 | HIGH_VALUE_REFRESH |  | FR0010859769-Echiquier World Equity Growth A.pdf |
| IE0003867441 | 12 | HIGH_VALUE_REFRESH |  | IE0003867441-BNY Mellon Small Cap Euroland Fund EUR A Acc.pdf |
| IE0004766675 | 12 | HIGH_VALUE_REFRESH |  | IE0004766675-Comgest Growth Europe EUR Acc.pdf |
| IE0031573904 | 12 | HIGH_VALUE_REFRESH |  | IE0031573904-Brandes Global Value Fund A Euro Acc.pdf |
| IE0031574647 | 12 | HIGH_VALUE_REFRESH |  | IE0031574647-Brandes European Value Fund A Euro Acc.pdf |
| IE0031575271 | 12 | HIGH_VALUE_REFRESH |  | IE0031575271-Brandes US Value Fund A Euro Acc.pdf |
| IE00B03HCZ61 | 12 | HIGH_VALUE_REFRESH |  | IE00B03HCZ61-Vanguard Global Stock Index Fund Investor EUR Accumulation.pdf |
| IE00B03HD191 | 12 | HIGH_VALUE_REFRESH |  | IE00B03HD191-Vanguard Global Stock Index Fund EUR Acc.pdf |
| IE00B23S7K36 | 12 | HIGH_VALUE_REFRESH |  | IE00B23S7K36-BNY Mellon Brazil Equity Fund EUR A Acc.pdf |
| IE00B2NXKW18 | 12 | HIGH_VALUE_REFRESH |  | IE00B2NXKW18-Seilern World Growth EUR U R.pdf |
| IE00B4M05337 | 12 | HIGH_VALUE_REFRESH |  | IE00B4M05337-Brown Advisory US Equity Growth $ P.pdf |
| IE00B4ZJ4188 | 12 | HIGH_VALUE_REFRESH |  | IE00B4ZJ4188-Comgest Growth Europe Opportunities EUR Acc.pdf |
| IE00B87MS887 | 12 | HIGH_VALUE_REFRESH |  | IE00B87MS887-Liontrust GF Special Situations Fund A1 Acc EUR.pdf |
| IE00B88WFS66 | 12 | HIGH_VALUE_REFRESH |  | IE00B88WFS66-Federated Hermes Asia ex-Japan Equity Fund Class R EUR Accumulating.pdf |
| IE00B8BPMF80 | 12 | HIGH_VALUE_REFRESH |  | IE00B8BPMF80-Wellington Strategic European Equity Fund EUR D Ac.pdf |

## Errores

`errors_count = 0`. No se registraron errores de lote ni de PDF.

## Limitaciones Observadas

- Gemma4 local sirve como preclasificador, no como parser definitivo para escribir datos.
- La extraccion local usa `pdf-parse` via Node como fallback porque no estaban disponibles `pypdf`, `pymupdf` ni `pdfplumber` en Python.
- Las categorias Morningstar exactas siguen siendo el punto menos fiable cuando el texto de tablas sale compactado.
- Todos los PDFs puntuaron alto; eso indica que el bloque parece homogeneo y compatible, pero no sustituye el dry-run oficial del parser Gemini.
- La deteccion de ISIN principal se toma del filename si existe; los ISINs secundarios se filtran para evitar ruido de palabras compactadas.

## Recomendacion Para Gemini Flash

Conviene pasar a la siguiente fase con Gemini Flash en dry-run para los `649` `HIGH_VALUE_REFRESH`. No hay `SAFE_REFRESH_LOW_RISK`, `REVIEW_BEFORE_WRITE` ni `DO_NOT_PARSE_NOW` en este lote.

Recomendacion de alcance:

- Incluir `HIGH_VALUE_REFRESH`: si, los `649`.
- Incluir `SAFE_REFRESH_LOW_RISK`: no aplica, hay `0`.
- Excluir `REVIEW_BEFORE_WRITE` salvo aprobacion humana: no aplica, hay `0`.
- Excluir `DO_NOT_PARSE_NOW`: no aplica, hay `0`.
- Usar Pro solo para rescate puntual de PDFs que fallen en Flash o cuya salida dry-run tenga errores estructurales de alto valor. No hay evidencia para usar Pro de forma masiva.

Comando seguro propuesto para el siguiente bloque, sin ejecutarlo:

```powershell
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --model gemini-2.5-flash --no-move-files
```

El wrapper `parse_dry_run.js` bloquea `--write` y `--confirm-write`, anade `--dry-run` si falta y pasa `--no-move-files` al parser productivo.

## Siguiente Bloque Propuesto

`BDB-MORNINGSTAR-PDFS-REFRESH-GEMINI-FLASH-DRYRUN-0`

Objetivo sugerido: ejecutar el parser oficial con `gemini-2.5-flash` en dry-run, sin mover PDFs, sobre el bloque completo de `HIGH_VALUE_REFRESH`, revisar el artefacto dry-run y no escribir nada hasta aprobacion humana explicita.
