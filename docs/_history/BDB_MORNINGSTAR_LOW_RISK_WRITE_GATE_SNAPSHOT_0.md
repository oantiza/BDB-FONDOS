# BDB-MORNINGSTAR-LOW-RISK-WRITE-GATE-SNAPSHOT-0

Fecha de ejecucion: 2026-05-18T18:16:34.711Z

## Resumen

- Modo: READ_ONLY_SNAPSHOT_NO_WRITE.
- Manifest fuente: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_low_risk_write_gate_manifest_0.json`.
- Coleccion objetivo: `funds_v3`.
- included_in_gate validado: 76.
- excluded_from_gate validado: 7.
- forbidden_fields_detected validado: false.
- requires_explicit_approval_to_write validado: true.
- write_executed validado: false.
- Documentos snapshot: 76.
- Documentos encontrados: 76.
- Faltantes: 0.

## Fuente del snapshot

- Se intento lectura live read-only de Firestore con credencial externa segura.
- Resultado live: bloqueado por red local/proceso (`EACCES` hacia endpoint Firestore/gRPC en puerto 443).
- No se imprimio ni guardo ningun secreto.
- Snapshot creado desde inventario local read-only: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\exports\funds_v3_inventory_readonly.json`.
- Inventario local generado: 2026-05-16T17:28:14.948Z. Firestore writes del inventario: 0.

## Seguridad

- Firestore writes = 0.
- Gemini calls = 0.
- Parser ejecutado = NO.
- Write gate ejecutado = NO.
- Deploy = NO. Commit = NO. Push = NO.
- `BDB-FONDOS-CORE` no tocado. `funds_core_v1` no usado.
- `manual.*`, `manual.costs.retrocession` y `portfolio_exposure_v2.economic_exposure`: no modificados.

## Documentos incluidos

| ISIN | Doc ID | Nombre actual | Categoria actual | Report date | Cartera as of | Fuente |
| --- | --- | --- | --- | --- | --- | --- |
| ES0112602000 | ES0112602000 | Azvalor Managers FI | Global Small-Cap Equity | 2025-12-29 | 2024-12-31 | local read-only inventory |
| ES0114633003 | ES0114633003 | Panda Agriculture & Water Fund FI | Sector Equity Agriculture | 2026-03-11 | 2026-01-31 | local read-only inventory |
| ES0124880032 | ES0124880032 | UBS Renta Fija 0-5 B FI | RF Diversificada Corto Plazo EUR | 2026-01-28 | 2025-12-31 | local read-only inventory |
| ES0125240038 | ES0125240038 | Trea Renta Fija Ahorro S FI | RF Diversificada Corto Plazo EUR | 2025-12-29 | 2025-11-29 | local read-only inventory |
| ES0141580037 | ES0141580037 | SIH Ahorro A FI | RF Diversificada Corto Plazo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| ES0142167032 | ES0142167032 | SIH Renta Fija A FI | RF Diversificada EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| ES0162333035 | ES0162333035 | Merchrenta FI | RF Otros | 2025-12-02 | 2025-10-30 | local read-only inventory |
| ES0162368007 | ES0162368007 | Metavalor Internacional I FI | Global Small-Cap Equity | 2025-12-29 | 2025-11-29 | local read-only inventory |
| ES0165242001 | ES0165242001 | Myinvestor S&P500 Equiponderado FI | RV USA Cap. Grande Blend | 2024-06-23 | 2024-05-30 | local read-only inventory |
| ES0168662031 | ES0168662031 | Trea Renta Fija FI | RF Diversificada EUR | 2025-12-29 | 2025-11-29 | local read-only inventory |
| ES0170138038 | ES0170138038 | Santalucía Renta Fija B FI | RF Diversificada EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| FI0008811997 | FI0008811997 | Evli Nordic Corporate Bond B | RF Flexible EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| FR0010149120 | FR0010149120 | Carmignac Sécurité AW EUR Acc | RF Diversificada Corto Plazo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| FR0011288513 | FR0011288513 | Sycomore Sélection Crédit R | RF Deuda Corporativa EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| FR0013201001 | FR0013201001 | EdR SICAV - Euro Sustainable Credit R EUR | RF Deuda Corporativa EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| FR0013460920 | FR0013460920 | EdR SICAV - Short Duration Credit A EUR | RF Flexible EUR | 2026-02-20 | 2025-12-31 | local read-only inventory |
| FR0013460961 | FR0013460961 | EdR SICAV - Short Duration Credit B EUR | RF Flexible EUR | 2025-12-04 | 2025-10-31 | local read-only inventory |
| FR001400NTN5 | FR001400NTN5 | Lazard High Yield 2029 EC EUR | Fixed Term Bond | 2025-12-29 | 2025-11-29 | local read-only inventory |
| IE000MI53C66 | IE000MI53C66 | Man Funds plc - Man Global Investment Grade Opportunities D H EUR | Global Corporate Bond - EUR Hedged | 2026-01-25 | 2025-06-29 | local read-only inventory |
| IE0032722484 | IE0032722484 | BNY Mellon Euroland Bond Fund EUR C Acc | RF Diversificada EUR | 2026-01-14 | 2025-11-29 | local read-only inventory |
| IE00B11XZ871 | IE00B11XZ871 | PIMCO GIS US High Yield Bond Fund E Class Accumulation | RF Bonos Alto Rendimiento USD | 2026-01-25 | 2025-09-29 | local read-only inventory |
| IE00B18GC888 | IE00B18GC888 | Vanguard Global Bond Index Fund EUR Hedged Acc | RF Global - EUR Cubierto | 2026-02-19 | 2026-01-31 | local read-only inventory |
| IE00B28YJQ65 | IE00B28YJQ65 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) | RV Sector Salud | 2025-12-04 | 2025-10-30 | local read-only inventory |
| IE00B53H0P79 | IE00B53H0P79 | PIMCO GIS Global Advantage Fund E Class EUR (Partially Hedged) Accumulation | RF Global | 2025-12-02 | 2025-09-29 | local read-only inventory |
| IE00B5ZW6Z28 | IE00B5ZW6Z28 | PIMCO GIS Emerging Local Bond Fund E Class EUR (Unhedged) Accumulation | RF Global Emergente - Moneda Local | 2025-12-02 | 2025-09-29 | local read-only inventory |
| IE00B84J9L26 | IE00B84J9L26 | PIMCO GIS Income Fund E Class EUR (Hedged) Accumulation | Global Flexible Bond - EUR Hedged | 2025-06-04 | 2025-03-30 | local read-only inventory |
| IE00B90VC092 | IE00B90VC092 | PIMCO European Short-Term Opportunities Fund E EUR Accumulation | RF Diversificada Corto Plazo EUR | 2026-01-14 | 2025-09-29 | local read-only inventory |
| IE00BD5CTX77 | IE00BD5CTX77 | BNY Mellon Global Short-Dated High Yield Bond Fund EUR H Acc Hedged | Global High Yield Bond - EUR Hedged | 2025-06-04 | 2025-03-30 | local read-only inventory |
| IE00BDZRWZ54 | IE00BDZRWZ54 | Neuberger Berman Short Duration Emerging Market Debt Fund EUR A Accumulating Class | RF Global Emergente - Sesgo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| IE00BF2FJG67 | IE00BF2FJG67 | PIMCO GIS Low Duration Opportunities Fund E Class EUR (Hedged) Accumulation | RF Global - EUR Cubierto | 2025-12-02 | 2025-09-29 | local read-only inventory |
| IE00BYX5NX33 | IE00BYX5NX33 | Fidelity MSCI World Index Fund EUR P Acc | RV Global Cap. Grande Blend | 2025-12-29 | 2025-12-26 | local read-only inventory |
| LU0073235904 | LU0073235904 | Morgan Stanley Investment Funds - Short Maturity Euro Bond Fund A | RF Diversificada Corto Plazo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0080237943 | LU0080237943 | DWS Euro Ultra Short Fixed Income Fund NC | RF Ultra Corto Plazo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0112467450 | LU0112467450 | Nordea 1 - Global Stable Equity Fund BP EUR | RV Global Cap. Grande Value | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0114723033 | LU0114723033 | Fidelity Funds - Global Industrials Fund E-Acc-EUR | RV Sector Materiales Insustriales | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0115139569 | LU0115139569 | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR | RV Sector Consumo | 2025-12-29 | 2025-11-29 | local read-only inventory |
| LU0119620416 | LU0119620416 | Morgan Stanley Investment Funds - Global Brands Fund A | RV Global Cap. Grande Blend | 2026-02-20 | 2026-01-31 | local read-only inventory |
| LU0132601682 | LU0132601682 | Morgan Stanley Investment Funds - Euro Corporate Bond Fund A | RF Deuda Corporativa EUR | 2026-03-05 | 2026-01-31 | local read-only inventory |
| LU0133717503 | LU0133717503 | Schroder International Selection Fund EURO Corporate Bond A1 Accumulation EUR | RF Deuda Corporativa EUR | 2026-02-20 | 2026-01-31 | local read-only inventory |
| LU0145656715 | LU0145656715 | DWS Invest ESG Euro Bonds (Short) NC | RF Diversificada Corto Plazo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0151324935 | LU0151324935 | Candriam Bonds Credit Opportunities Class N EUR Cap | Global Flexible Bond - EUR Hedged | 2025-12-02 | 2025-09-29 | local read-only inventory |
| LU0153925689 | LU0153925689 | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc | RV Europa Cap. Grande Value | 2025-12-11 | 2025-10-30 | local read-only inventory |
| LU0161305163 | LU0161305163 | Schroder International Selection Fund European Value A Accumulation EUR | RV Europa Cap. Mediana | 2025-12-11 | 2025-11-29 | local read-only inventory |
| LU0162660350 | LU0162660350 | BlackRock Global Funds - Euro Corporate Bond Fund A1 | RF Deuda Corporativa EUR | 2025-12-04 | 2025-10-30 | local read-only inventory |
| LU0170473374 | LU0170473374 | Franklin European Total Return Fund A(acc)EUR | RF Diversificada EUR | 2023-09-07 | 2023-07-30 | local read-only inventory |
| LU0177497491 | LU0177497491 | abrdn SICAV II-Euro Corporate Bond Fund A Acc EUR | RF Deuda Corporativa EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0227385266 | LU0227385266 | Nordea 1 - Stable Return Fund E EUR | Mixtos Moderados EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0243958393 | LU0243958393 | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR | RF Deuda Corporativa EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0309468980 | LU0309468980 | Nordea 1 - Latin American Equity Fund E EUR | RV Latinoamérica | 2025-12-11 | 2025-11-29 | local read-only inventory |
| LU0321373184 | LU0321373184 | Schroder International Selection Fund European Dividend Maximiser B Distribution | RV Europa Alto Dividendo | 2025-12-29 | 2025-11-29 | local read-only inventory |
| LU0353647737 | LU0353647737 | Fidelity Funds - European Dividend Fund A-Acc-EUR | RV Europa Alto Dividendo | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0391944815 | LU0391944815 | Pictet-Global Megatrend Selection R EUR | RV Global Cap. Med/Peq | 2026-01-11 | 2025-11-30 | local read-only inventory |
| LU0447425785 | LU0447425785 | SIH FCP - Short Term EUR A Classic | RF Ultra Corto Plazo EUR | 2026-01-25 | 2025-12-31 | local read-only inventory |
| LU0568583420 | LU0568583420 | Amundi Funds - Equity Japan Target A EUR (C) | RV Japón Cap. Med/Peq | 2025-12-11 | 2025-10-30 | local read-only inventory |
| LU0571101558 | LU0571101558 | Groupama Euro High Yield NC | RF Bonos Alto Rendimiento EUR | 2026-03-11 | 2026-02-27 | local read-only inventory |
| LU0690375182 | LU0690375182 | Fundsmith Equity Fund T EUR Acc | RV Global Cap. Grande Growth | 2026-01-25 | 2025-09-30 | local read-only inventory |
| LU0712123511 | LU0712123511 | Morgan Stanley Investment Funds - Global Fixed Income Opportunities Fund AH (EUR) | Global Flexible Bond - EUR Hedged | 2025-06-03 | 2025-04-30 | local read-only inventory |
| LU0733673288 | LU0733673288 | Nordea 1 - European Cross Credit Fund BP EUR | RF Flexible EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0910636892 | LU0910636892 | Goldman Sachs Emerging Markets Debt Blend Portfolio E Acc EUR | RF Global Emergente - Sesgo EUR | 2025-12-02 | 2025-09-29 | local read-only inventory |
| LU0926439992 | LU0926439992 | Vontobel Fund - Emerging Markets Debt H (hedged) EUR Cap | RF Global Emergente - Sesgo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU0995119749 | LU0995119749 | Schroder International Selection Fund EURO Credit Conviction B Accumulation EUR | RF Deuda Corporativa EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU1022658667 | LU1022658667 | Franklin Euro Short Duration Bond Fund A(acc)EUR | RF Diversificada Corto Plazo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU1080015693 | LU1080015693 | Edmond de Rothschild Fund - Emerging Credit A EUR Hedged | RF Deuda Corporativa Global Emergente - Sesgo EUR | 2026-03-12 | 2026-01-31 | local read-only inventory |
| LU1161086159 | LU1161086159 | Amundi Funds - Emerging Markets Blended Bond A EUR (C) | RF Global Emergente - Sesgo EUR | 2026-03-12 | 2026-01-31 | local read-only inventory |
| LU1164219682 | LU1164219682 | AXA World Funds - Euro Credit Total Return A Capitalisation EUR | RF Flexible EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU1164220854 | LU1164220854 | AXA World Funds - Euro Credit Total Return E Capitalisation EUR | RF Flexible EUR | 2025-06-04 | 2025-04-30 | local read-only inventory |
| LU1165644672 | LU1165644672 | IVO Funds - IVO Emerging Markets Corporate Debt EUR R Acc | RF Deuda Corporativa Global Emergente - Sesgo EUR | 2026-03-12 | 2026-01-31 | local read-only inventory |
| LU1299306321 | LU1299306321 | Carmignac Portfolio Sécurité AW EUR Acc | RF Diversificada Corto Plazo EUR | 2026-03-23 | 2026-02-27 | local read-only inventory |
| LU1330191542 | LU1330191542 | Magallanes Value Investors UCITS European Equity R EUR | RV Europa Cap. Mediana | 2025-12-11 | 2025-11-29 | local read-only inventory |
| LU1481583711 | LU1481583711 | Flossbach von Storch - Bond Opportunities RT | Global Flexible Bond - EUR Hedged | 2025-06-04 | 2025-04-30 | local read-only inventory |
| LU1694789451 | LU1694789451 | DNCA Invest Alpha Bonds A EUR | Global Flexible Bond | 2025-12-02 | 2025-09-29 | local read-only inventory |
| LU1697013008 | LU1697013008 | SIH FCP - Flexible Fixed Income USD | RF Flexible USD | 2026-01-25 | 2025-12-31 | local read-only inventory |
| LU1882457143 | LU1882457143 | Amundi Funds - Emerging Markets Corporate High Yield Bond A EUR (C) | RF Deuda Corporativa Global Emergente | 2026-03-12 | 2025-12-31 | local read-only inventory |
| LU1882462655 | LU1882462655 | Amundi Funds - Emerging Markets Short Term Bond A2 EUR (C) | RF Global Emergente | 2026-03-12 | 2025-12-31 | local read-only inventory |
| LU1883329432 | LU1883329432 | Amundi Funds - Global Multi-Asset Conservative A EUR (C) | Mixtos Defensivos EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |
| LU1919971074 | LU1919971074 | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR | RF Global Emergente - Sesgo EUR | 2025-12-02 | 2025-10-30 | local read-only inventory |

## Artefacto JSON

Creado: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_low_risk_write_gate_snapshot_0.json`
