# BDB-MORNINGSTAR-LOW-RISK-WRITE-GATE-EXECUTE-0

Fecha de ejecucion: 2026-05-18T19:56:16.495Z

## Resumen ejecutivo

- Resultado: WRITE_COMPLETED_VERIFIED.
- Writes solicitados: 76.
- Writes ejecutados: 76.
- Post-read live: 76/76.
- Verificacion post-write: OK.
- Campos prohibidos detectados/tocados: NO.
- Campos protegidos intactos: SI.
- Gemini calls = 0. Parser ejecutado = NO. PDFs movidos = 0.
- Deploy = NO. Commit = NO. Push = NO.

## Alcance

- Escrito SOLO sobre los 76 ISINs incluidos en el manifest.
- Los 7 excluidos no se tocaron.
- REVIEW_REQUIRED, NOT_FOUND_IN_FUNDS_V3 y los 30 errores persistentes no se tocaron.
- `manual.*`, `manual.costs.retrocession`, `retrocession` y `portfolio_exposure_v2.economic_exposure` no fueron incluidos en el payload de escritura.

## Validaciones previas

- Manifest: 76 incluidos, 7 excluidos, campos prohibidos = false, requiere aprobacion explicita = true, write_executed = false.
- Snapshot live previo: 76/76 documentos encontrados.
- Propuestas: sin rutas prohibidas en los 76 incluidos.

## Escritura

- Metodo: batch atomico Firestore Admin SDK.
- Documentos actualizados: 76.
- Campos leaf actualizados total: 3810.

## Post-write

- Documentos leidos live despues del write: 76/76.
- Verificacion de campos actualizados: OK.
- Verificacion de campos protegidos: OK tras comparacion normalizada.
- Nota: la primera comparacion mezclaba snapshot REST y lectura Admin SDK, lo que produjo falsos positivos por serializacion de tipos; la segunda comprobacion normalizada dio 0 discrepancias en `manual`, `manual.costs.retrocession` y `portfolio_exposure_v2.economic_exposure`.

## ISINs escritos

| ISIN | Doc ID | Campos | Nombre |
| --- | --- | --- | --- |
| ES0112602000 | ES0112602000 | 8 | Azvalor Managers FI |
| ES0114633003 | ES0114633003 | 108 | Panda Agriculture & Water Fund FI |
| ES0124880032 | ES0124880032 | 29 | UBS Renta Fija 0-5 B FI |
| ES0125240038 | ES0125240038 | 24 | Trea Renta Fija Ahorro S FI |
| ES0141580037 | ES0141580037 | 44 | SIH Ahorro A FI |
| ES0142167032 | ES0142167032 | 45 | SIH Renta Fija A FI |
| ES0162333035 | ES0162333035 | 26 | Merchrenta FI |
| ES0162368007 | ES0162368007 | 82 | Metavalor Internacional I FI |
| ES0165242001 | ES0165242001 | 82 | Myinvestor S&P500 Equiponderado FI |
| ES0168662031 | ES0168662031 | 24 | Trea Renta Fija FI |
| ES0170138038 | ES0170138038 | 45 | Santalucía Renta Fija B FI |
| FI0008811997 | FI0008811997 | 35 | Evli Nordic Corporate Bond B |
| FR0010149120 | FR0010149120 | 37 | Carmignac Sécurité AW EUR Acc |
| FR0011288513 | FR0011288513 | 41 | Sycomore Sélection Crédit R |
| FR0013201001 | FR0013201001 | 46 | EdR SICAV - Euro Sustainable Credit R EUR |
| FR0013460920 | FR0013460920 | 29 | EdR SICAV - Short Duration Credit A EUR |
| FR0013460961 | FR0013460961 | 27 | EdR SICAV - Short Duration Credit B EUR |
| FR001400NTN5 | FR001400NTN5 | 30 | Lazard High Yield 2029 EC EUR |
| IE000MI53C66 | IE000MI53C66 | 38 | Man Funds plc - Man Global Investment Grade Opportunities D H EUR |
| IE0032722484 | IE0032722484 | 40 | BNY Mellon Euroland Bond Fund EUR C Acc |
| IE00B11XZ871 | IE00B11XZ871 | 35 | PIMCO GIS US High Yield Bond Fund E Class Accumulation |
| IE00B18GC888 | IE00B18GC888 | 28 | Vanguard Global Bond Index Fund EUR Hedged Acc |
| IE00B28YJQ65 | IE00B28YJQ65 | 65 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) |
| IE00B53H0P79 | IE00B53H0P79 | 37 | PIMCO GIS Global Advantage Fund E Class EUR (Partially Hedged) Accumulation |
| IE00B5ZW6Z28 | IE00B5ZW6Z28 | 44 | PIMCO GIS Emerging Local Bond Fund E Class EUR (Unhedged) Accumulation |
| IE00B84J9L26 | IE00B84J9L26 | 42 | PIMCO GIS Income Fund E Class EUR (Hedged) Accumulation |
| IE00B90VC092 | IE00B90VC092 | 32 | PIMCO European Short-Term Opportunities Fund E EUR Accumulation |
| IE00BD5CTX77 | IE00BD5CTX77 | 43 | BNY Mellon Global Short-Dated High Yield Bond Fund EUR H Acc Hedged |
| IE00BDZRWZ54 | IE00BDZRWZ54 | 40 | Neuberger Berman Short Duration Emerging Market Debt Fund EUR A Accumulating Class |
| IE00BF2FJG67 | IE00BF2FJG67 | 40 | PIMCO GIS Low Duration Opportunities Fund E Class EUR (Hedged) Accumulation |
| IE00BYX5NX33 | IE00BYX5NX33 | 109 | Fidelity MSCI World Index Fund EUR P Acc |
| LU0073235904 | LU0073235904 | 45 | Morgan Stanley Investment Funds - Short Maturity Euro Bond Fund A |
| LU0080237943 | LU0080237943 | 28 | DWS Euro Ultra Short Fixed Income Fund NC |
| LU0112467450 | LU0112467450 | 96 | Nordea 1 - Global Stable Equity Fund BP EUR |
| LU0114723033 | LU0114723033 | 80 | Fidelity Funds - Global Industrials Fund E-Acc-EUR |
| LU0115139569 | LU0115139569 | 85 | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR |
| LU0119620416 | LU0119620416 | 63 | Morgan Stanley Investment Funds - Global Brands Fund A |
| LU0132601682 | LU0132601682 | 35 | Morgan Stanley Investment Funds - Euro Corporate Bond Fund A |
| LU0133717503 | LU0133717503 | 44 | Schroder International Selection Fund EURO Corporate Bond A1 Accumulation EUR |
| LU0145656715 | LU0145656715 | 45 | DWS Invest ESG Euro Bonds (Short) NC |
| LU0151324935 | LU0151324935 | 44 | Candriam Bonds Credit Opportunities Class N EUR Cap |
| LU0153925689 | LU0153925689 | 91 | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc |
| LU0161305163 | LU0161305163 | 88 | Schroder International Selection Fund European Value A Accumulation EUR |
| LU0162660350 | LU0162660350 | 38 | BlackRock Global Funds - Euro Corporate Bond Fund A1 |
| LU0170473374 | LU0170473374 | 41 | Franklin European Total Return Fund A(acc)EUR |
| LU0177497491 | LU0177497491 | 32 | abrdn SICAV II-Euro Corporate Bond Fund A Acc EUR |
| LU0227385266 | LU0227385266 | 101 | Nordea 1 - Stable Return Fund E EUR |
| LU0243958393 | LU0243958393 | 47 | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR |
| LU0309468980 | LU0309468980 | 83 | Nordea 1 - Latin American Equity Fund E EUR |
| LU0321373184 | LU0321373184 | 74 | Schroder International Selection Fund European Dividend Maximiser B Distribution |
| LU0353647737 | LU0353647737 | 85 | Fidelity Funds - European Dividend Fund A-Acc-EUR |
| LU0391944815 | LU0391944815 | 97 | Pictet-Global Megatrend Selection R EUR |
| LU0447425785 | LU0447425785 | 27 | SIH FCP - Short Term EUR A Classic |
| LU0568583420 | LU0568583420 | 60 | Amundi Funds - Equity Japan Target A EUR (C) |
| LU0571101558 | LU0571101558 | 41 | Groupama Euro High Yield NC |
| LU0690375182 | LU0690375182 | 60 | Fundsmith Equity Fund T EUR Acc |
| LU0712123511 | LU0712123511 | 39 | Morgan Stanley Investment Funds - Global Fixed Income Opportunities Fund AH (EUR) |
| LU0733673288 | LU0733673288 | 36 | Nordea 1 - European Cross Credit Fund BP EUR |
| LU0910636892 | LU0910636892 | 29 | Goldman Sachs Emerging Markets Debt Blend Portfolio E Acc EUR |
| LU0926439992 | LU0926439992 | 41 | Vontobel Fund - Emerging Markets Debt H (hedged) EUR Cap |
| LU0995119749 | LU0995119749 | 40 | Schroder International Selection Fund EURO Credit Conviction B Accumulation EUR |
| LU1022658667 | LU1022658667 | 48 | Franklin Euro Short Duration Bond Fund A(acc)EUR |
| LU1080015693 | LU1080015693 | 45 | Edmond de Rothschild Fund - Emerging Credit A EUR Hedged |
| LU1161086159 | LU1161086159 | 27 | Amundi Funds - Emerging Markets Blended Bond A EUR (C) |
| LU1164219682 | LU1164219682 | 47 | AXA World Funds - Euro Credit Total Return A Capitalisation EUR |
| LU1164220854 | LU1164220854 | 47 | AXA World Funds - Euro Credit Total Return E Capitalisation EUR |
| LU1165644672 | LU1165644672 | 27 | IVO Funds - IVO Emerging Markets Corporate Debt EUR R Acc |
| LU1299306321 | LU1299306321 | 46 | Carmignac Portfolio Sécurité AW EUR Acc |
| LU1330191542 | LU1330191542 | 98 | Magallanes Value Investors UCITS European Equity R EUR |
| LU1481583711 | LU1481583711 | 42 | Flossbach von Storch - Bond Opportunities RT |
| LU1694789451 | LU1694789451 | 49 | DNCA Invest Alpha Bonds A EUR |
| LU1697013008 | LU1697013008 | 42 | SIH FCP - Flexible Fixed Income USD |
| LU1882457143 | LU1882457143 | 28 | Amundi Funds - Emerging Markets Corporate High Yield Bond A EUR (C) |
| LU1882462655 | LU1882462655 | 33 | Amundi Funds - Emerging Markets Short Term Bond A2 EUR (C) |
| LU1883329432 | LU1883329432 | 114 | Amundi Funds - Global Multi-Asset Conservative A EUR (C) |
| LU1919971074 | LU1919971074 | 47 | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR |

## Artefacto JSON

Creado: `C:/Users/oanti/Documents/BDB-FONDOS/artifacts/bdb_parser_audit/morningstar_low_risk_write_gate_execute_0.json`
