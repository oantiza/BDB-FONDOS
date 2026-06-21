# BDB Morningstar PDF Updated Batch Dryrun 0

Este documento resume los resultados del procesamiento dry-run en lote de los informes PDF Morningstar actualizados del usuario en la Evidence Layer local.

## 1. Estado Git Inicial
```
M MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json
Note: The file MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json was already in a modified state in the working tree prior to execution.
```

## 2. PDFs Detectados en ENTRADA
* **Ruta de Entrada**: `MORNINGSTAR_PDF_PARSER/ENTRADA/`
* **Total de Archivos en Carpeta**: 649
* **Mutual Fund PDFs**: 649 PDFs
* **Archivos Adicionales Detectados**:
  * `.gitkeep`: No
  * `README.md`: No
* **Análisis de Duplicados**: Se comprobó que no hay nombres de archivos de PDF duplicados ni ISINs repetidos con distintas nomenclaturas en la carpeta. Todos los nombres siguen el patrón estándar `<ISIN>-<Nombre de Fondo>.pdf`.

## 3. Comando Ejecutado
Se ejecutó de forma segura el dry-run principal del parser utilizando el flag para **no mover ni alterar** los archivos de entrada:
```bash
node MORNINGSTAR_PDF_PARSER/bin/parse_dry_run.js --no-move-files
```

## 4. Artifact Generado
El script generó con éxito el resumen consolidado en:
`MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json`

### Estadísticas Consolidadas del Artifact:
* **Total Procesados (Proposals + Errors)**: 649
* **Proposals Generadas (OK + REVIEW)**: 617 (ISINs únicos)
* **ACCEPT / ACCEPT_WITH_WARNINGS**: 522
* **REVIEW**: 95
* **ERROR**: 32

---

## 5. Tabla de Resultados por ISIN

| ISIN | Fondo / Archivo | Status | Warnings / Reason | Acción Recomendada |
| :--- | :--- | :--- | :--- | :--- |
| BE0943877671 | DPAM B - Bonds Eur Government B Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| BE0946564383 | DPAM B - Equities NewGems Sustainable B Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| BE0947853660 | DPAM B - Equities US Dividend Sustainable B EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| BE6213829094 | DPAM B - Real Estate Europe Dividend Sustainable B Cap | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| DE0005318406 | DWS ESG Stiftungsfonds LD | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| DE0008490962 | DWS Deutschland LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| DE000DWS17J0 | DWS ESG Dynamic Opportunities LC | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0110407006 | Gestión Boutique VI Argos FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0111166031 | Atl Capital Corto Plazo A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0112231016 | Avantage Fund B FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0112602000 | Azvalor Managers FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0114633003 | Panda Agriculture & Water Fund FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0114904008 | Brightgate Focus A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0116419005 | Cartera Renta Fija Horizonte 2026 FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0116567035 | Cartesio X FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0116848005 | Global Allocation R FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0118537002 | Olea Neutral FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0124880032 | UBS Renta Fija 0-5 B FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0125240038 | Trea Renta Fija Ahorro S FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0125323008 | Gestión Value A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0126542036 | Amundi Corto Plazo A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0126547035 | UBS Duración 0-2 B FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0127097030 | Dux Rentinver Renta Fija FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0127795005 | EDM Renta R FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0128067008 | Dux Mixto Variable FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0131462022 | Gestion Boutique V Robotics R FI | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| ES0137381036 | Gesconsult Renta Variable Iberia A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0138217031 | Gesconsult Renta Fija Flexible A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0138911039 | Gesconsult Renta Variable Eurozona FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0138914033 | Merch-Fontemar FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0138922002 | Gesconsult Horizonte 2027 FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0138922036 | Gesconsult Corto Plazo A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0138930005 | Fonvalcem B FI | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| ES0138936036 | Fondibas FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0140643034 | GVC Gaesco Europa FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0140986011 | Gesconsult Oportunidad Renta Fija A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0141113037 | GVC Gaesco Japón A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0141580037 | SIH Ahorro A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0141991002 | Gestión Talento FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0142046038 | Gesem Agresivo Flexible FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0142167032 | SIH Renta Fija A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0146309002 | Horos Value Internacional FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0148181003 | Indexa RV mixta internacional 75 FI | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| ES0155142005 | Intermoney Variable Euro A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0155598008 | UBS Corto Plazo A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0155598032 | UBS Corto Plazo B FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0156873004 | A&G Renta Fija Corto Plazo FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0158600033 | Sigma Invesment House Flexible Global FI | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| ES0159201013 | Magallanes Iberian Equity M FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0159259011 | Magallanes European Equity M FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0160873008 | March Pagarés A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0161032034 | March Renta Fija Corto Plazo A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0161992005 | Sigma Investment House Capital FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0162211033 | Merch-Eurounión FI | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| ES0162295002 | Cartera Renta Fija Horizonte 2027 FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0162305033 | Merch-Oportunidades FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0162333035 | Merchrenta FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0162368007 | Metavalor Internacional I FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0162946034 | Abante Selección FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0162949012 | Abante Índice Selección A FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0165142003 | Mutuafondo Corto Plazo D FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0165142037 | Mutuafondo Corto Plazo A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0165242001 | Myinvestor S&P500 Equiponderado FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0167238023 | Estela Global Equities R FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0168662031 | Trea Renta Fija FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0168673038 | EDM Ahorro R FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0168799056 | Gestión Boutique IV Alclam US Equities FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0170138038 | Santalucía Renta Fija B FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0170141008 | Santalucía Quality Acciones Europeas B FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0173323009 | Renta 4 Wertefinder FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0175316019 | Dunas Valor Flexible R FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0175414012 | Dunas Valor Equilibrado R FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0175437005 | Dunas Valor Prudente R FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0175604000 | Gesconsult León Valores Mixto Flexible B FI | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| ES0176954008 | Renta 4 Renta Fija R FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0182631004 | Polar Renta Fija A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0182769002 | Valentum E FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0184949008 | Sigma Investment House Megatrends A FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| ES0184949016 | Sigma Investment House Megatrends B FI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FI0008800511 | Evli Short Corporate Bond B | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FI0008811997 | Evli Nordic Corporate Bond B | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0000174310 | Lazard Small Caps Euro SRI I | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0000989626 | Groupama Trésorerie IC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0000989899 | Oddo BHF Avenir CR-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0000989915 | Oddo BHF Immobilier CR-EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| FR0007008750 | R-co Conviction Credit Euro C EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010041822 | Edmond de Rothschild Patrimoine A | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| FR0010148981 | Carmignac Investissement A EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010149120 | Carmignac Sécurité AW EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010172767 | EdR SICAV - Euro Sustainable Credit A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010230490 | Lazard Credit Opportunities RC EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010286013 | Sextant Grand Large A | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| FR0010288308 | Groupama Avenir Euro NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010306142 | Carmignac Patrimoine E EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010312660 | Carmignac Investissement E EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010321810 | Echiquier Agenor Mid Cap Europe A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010547869 | Sextant PME A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010722348 | Groupama Global Active Equity NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010794792 | Candriam Diversified Futures Classique | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| FR0010829697 | AMUNDI TRESO 12 MOIS DP | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010839282 | Echiquier Short Term Credit SRI A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010859769 | Echiquier World Equity Growth A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0010950055 | AXA IM Euro 6M E | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0011170182 | Ofi Invest Precious Metals R | `REVIEW` | credit_missing|region_incomplete | `NEEDS_MANUAL_DATA` (Credit Rating) |
| FR0011253624 | R-co Valor C EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| FR0011261197 | R-co Valor F EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| FR0011288513 | Sycomore Sélection Crédit R | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0011365212 | Amundi Ultra Short Term Bond Responsible E C | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0011387299 | Allianz Euro Oblig Court Terme ISR RC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0013201001 | EdR SICAV - Euro Sustainable Credit R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0013219243 | EdR SICAV - Equity Euro Solve A EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| FR0013231453 | Ostrum Credit Ultra Short Plus I-C EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0013346079 | Groupama Ultra Short Term NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0013460920 | EdR SICAV - Short Duration Credit A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0013460961 | EdR SICAV - Short Duration Credit B EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0014008W22 | EdR SICAV - Millesima World 2028 A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR001400JGB5 | EdR SICAV Millesima Select 2028 A Eur | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR001400NTN5 | Lazard High Yield 2029 EC EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| FR0050000860 | Amundi Ultra Short Term Bond Responsible P C | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0003867441 | BNY Mellon Small Cap Euroland Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0004766675 | Comgest Growth Europe EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE000MI53C66 | Man Funds plc - Man Global Investment Grade Opportunities D H EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0031069499 | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0031333341 | Jupiter Asia Pacific Income Fund C USD Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0031573904 | Brandes Global Value Fund A Euro Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0031574647 | Brandes European Value Fund A Euro Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0031575271 | Brandes US Value Fund A Euro Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0032722484 | BNY Mellon Euroland Bond Fund EUR C Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE0034277479 | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B03HCZ61 | Vanguard Global Stock Index Fund Investor EUR Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B03HD191 | Vanguard Global Stock Index Fund EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B11XYW43 | PIMCO GIS Emerging Markets Bond Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B11XZ103 | PIMCO GIS Global Bond Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B11XZ871 | PIMCO GIS US High Yield Bond Fund E Class Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B11YFH93 | BNY Mellon Emerging Markets Debt Local Currency Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B18GC888 | Vanguard Global Bond Index Fund EUR Hedged Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B23S7K36 | BNY Mellon Brazil Equity Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B28YJQ65 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B2NXKW18 | Seilern World Growth EUR U R | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B3NLSS43 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund R Inc (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B3RW6Z61 | Nomura Funds Ireland plc - US High Yield Bond Fund Class A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B3V93F27 | BNY Mellon Global Equity Income Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B3VXGD32 | Polar Capital Funds PLC - Biotechnology Fund R Inc (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B4M05337 | Brown Advisory US Equity Growth $ P | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B4Z6MP99 | BNY Mellon Global Real Return Fund (EUR) C Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B4ZJ4188 | Comgest Growth Europe Opportunities EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B52VLZ70 | Polar Capital Funds PLC - Polar Capital Global Insurance Fund R Acc (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B53H0P79 | PIMCO GIS Global Advantage Fund E Class EUR (Partially Hedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B5ZW6Z28 | PIMCO GIS Emerging Local Bond Fund E Class EUR (Unhedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B84J9L26 | PIMCO GIS Income Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B87MS887 | Liontrust GF Special Situations Fund A1 Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B88WFS66 | Federated Hermes Asia ex-Japan Equity Fund Class R EUR Accumulating | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B8BPMF80 | Wellington Strategic European Equity Fund EUR D Ac | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B8J38129 | Algebris UCITS Funds plc - Algebris Financial Credit Fund R EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00B90VC092 | PIMCO European Short-Term Opportunities Fund E EUR Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BD2ZKT29 | Principal Global Investors Funds - Finisterre Unconstrained Emerging Market Fxd Inc Fd A Hdg Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BD4GTQ32 | FTGF ClearBridge Infrastructure Value Fund Class A Euro Accumulating | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BD5CTX77 | BNY Mellon Global Short-Dated High Yield Bond Fund EUR H Acc Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BDH6RQ67 | UTI India Dynamic Equity EURO Retail | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BDTYYP61 | Man Funds VI plc - Man High Yield Opportunities D EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BDZRWZ54 | Neuberger Berman Short Duration Emerging Market Debt Fund EUR A Accumulating Class | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BF0GL212 | Polar Capital Funds PLC - Artificial Intelligence Fund R USD Acc (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BF2FJG67 | PIMCO GIS Low Duration Opportunities Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BJ7B9456 | PIMCO GIS Global Low Duration Real Return Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BKSBDB61 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities R Acc (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BLP5S460 | JupiterMerian Global Equity Absolute Return Fund L (EUR) Hedged Acc | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| IE00BM95B621 | Polar Capital Funds PLC - Polar Capital Global Technology Fund R Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BMD7ZB71 | Neuberger Berman Next Generation Connectivity Fund EUR A Accumulating Class - Unhedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BMW2TK08 | Lazard Global Convertibles Recovery Fund BP Acc EUR Hedged | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.0855 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| IE00BNG2T811 | Neuberger Berman Short Duration Euro Bond Fund EUR A Accumulating Class | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BYR8H148 | Jupiter Merian World Equity Fund L EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BYX5NX33 | Fidelity MSCI World Index Fund EUR P Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BYX5P602 | Fidelity MSCI World Index Fund EUR P Acc (Hedged) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BYYPF474 | Aegon Global Diversified Income Fund EUR A Acc | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| IE00BYYPF581 | Aegon Global Diversified Income Fund EUR A Inc | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| IE00BZ18VT34 | BNY Mellon Global Infrastructure Income Fund EUR A Inc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| IE00BZ4D7648 | Polar Capital Funds PLC - Polar Capital Global Technology Fund R EUR Hedged Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0011889846 | Janus Henderson Horizon Euroland Fund A2 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0028119013 | Invesco Funds - Invesco Pan European Small Cap Equity Fund A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0034353002 | DWS Floating Rate Notes LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0048293368 | BL-Global 75 B EUR Acc | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU0072462186 | BlackRock Global Funds - European Value Fund A2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0073229253 | Morgan Stanley Investment Funds - Asia Equity Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0073235904 | Morgan Stanley Investment Funds - Short Maturity Euro Bond Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0077500055 | Candriam Bonds Euro Corporate 2036 Class C EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0080237943 | DWS Euro Ultra Short Fixed Income Fund NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0084617165 | Robeco Asia-Pacific Equities D € | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0086177085 | UBS (Lux) Bond Fund - Euro High Yield (EUR) P-acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0087412390 | DWS Concept DJE Alpha Renten Global LC | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0090845842 | BlackRock Global Funds - World Mining Fund E2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0093503497 | BlackRock Global Funds - ESG Multi-Asset Fund A2 | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0093503737 | BlackRock Global Funds - ESG Multi-Asset Fund E2 | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0093583077 | Candriam Money Market Euro C Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0094557526 | MFS Meridian Funds - European Research Fund A1 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0102219945 | Goldman Sachs Europe CORE Equity Portfolio Base Inc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0102737730 | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0102737904 | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund C Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0112467450 | Nordea 1 - Global Stable Equity Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0113257694 | Schroder International Selection Fund EURO Corporate Bond A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0114722738 | Fidelity Funds - Global Financial Services Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0114723033 | Fidelity Funds - Global Industrials Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115139569 | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115141201 | Invesco Funds - Invesco Pan European Equity Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115143082 | Invesco Funds - Invesco Asia Opportunities Equity Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115759606 | Fidelity Funds - America Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115765678 | Fidelity Funds - Iberia Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115769746 | Fidelity Funds - World Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0115773425 | Fidelity Funds - Global Technology Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117843481 | JPMorgan Funds - Taiwan Fund A (dist) USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117843721 | JPMorgan Funds - Taiwan Fund D (acc) USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117858596 | JPMorgan Funds - Europe Equity Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117858679 | JPMorgan Funds - Europe Strategic Growth Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117858752 | JPMorgan Funds - Europe Strategic Value Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117859560 | JPMorgan Funds - Europe Small Cap Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0117884675 | JPMorgan Funds - Europe Dynamic Technologies Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0119063039 | JPMorgan Funds - Europe Dynamic Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0119195963 | Goldman Sachs Patrimonial Balanced - P Cap EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0119620416 | Morgan Stanley Investment Funds - Global Brands Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0119750205 | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0119753308 | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund E Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0121204431 | Goldman Sachs Global Sustainable Equity - X Cap EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0121216526 | Goldman Sachs Patrimonial Aggressive - X Cap EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0125951151 | MFS Meridian Funds - European Value Fund A1 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0127786431 | Goldman Sachs Eurozone Equity Income - P Cap EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0128521001 | Templeton European Insights Fund Class N (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0132601682 | Morgan Stanley Investment Funds - Euro Corporate Bond Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0133264522 | Goldman Sachs Global Equity Income Portfolio E Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0133267202 | Goldman Sachs Emerging Markets Equity Portfolio E Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0133717503 | Schroder International Selection Fund EURO Corporate Bond A1 Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0137009238 | Vontobel Fund - TwentyFour Euro Short Term Bond C EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0144751095 | Candriam Bonds Euro High Yield Class N EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0145656715 | DWS Invest ESG Euro Bonds (Short) NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0151324935 | Candriam Bonds Credit Opportunities Class N EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0153585137 | Vontobel Fund - European Equity B EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0153925689 | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0157179127 | JPMorgan Investment Funds - Global Select Equity Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0161304786 | Schroder International Selection Fund European Value A1 Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0161305163 | Schroder International Selection Fund European Value A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0161305593 | Schroder International Selection Fund European Value B Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0162660350 | BlackRock Global Funds - Euro Corporate Bond Fund A1 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0165074666 | HSBC Global Investment Funds - Euroland Value AC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0165081950 | HSBC Global Investment Funds - Euroland Value EC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0165520114 | Candriam Bonds Global Inflation Short Duration Class C EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0169250635 | Generali Investments SICAV - Euro Bond Fund EX | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0170293632 | Candriam Bonds Global High Yield Class N EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0170473374 | Franklin European Total Return Fund A(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171275786 | BlackRock Global Funds - Emerging Markets Fund A2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171281750 | BlackRock Global Funds - European Value Fund A2 (USD) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171282212 | BlackRock Global Funds - European Value Fund A2 (GBP) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171283459 | BlackRock Global Funds - Global Allocation Fund A2 (EUR) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0171285587 | BlackRock Global Funds - Global Long-Horizon Equity Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171289902 | BlackRock Global Funds - Sustainable Energy Fund A2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171290074 | BlackRock Global Funds - Sustainable Energy Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171296949 | BlackRock Global Funds - US Flexible Equity Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171304552 | BlackRock Global Funds - World Energy Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171304719 | BlackRock Global Funds - World Financials Fund A2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171305443 | BlackRock Global Funds - World Financials Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171306680 | BlackRock Global Funds - World Gold Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171307068 | BlackRock Global Funds - World Healthscience Fund A2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0171309270 | BlackRock Global Funds - World Healthscience Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0172157280 | BlackRock Global Funds - World Mining Fund A2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0172157363 | BlackRock Global Funds - World Mining Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0173779223 | Nordea 1 - Danish Covered Bond Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0173782102 | Nordea 1 - Asia ex Japan Equity Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0177497491 | abrdn SICAV II-Euro Corporate Bond Fund A Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0181496216 | Schroder International Selection Fund Emerging Asia A1 Accumulation USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0181962126 | First Eagle Amundi International Fund Class FU-C Shares | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU0184627536 | AXA World Funds - Switzerland Equity A Capitalisation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0187079347 | Robeco Global Consumer Trends D EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0188151921 | Templeton Emerging Markets Fund N(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0200684180 | BlackRock Global Funds - Emerging Markets Bond Fund E2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0201075453 | Janus Henderson Pan European Fund A2 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0202403266 | Fidelity Active Strategy - FAST - Europe Fund A-ACC-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0203937692 | UBS (Lux) Bond SICAV - Convert Global (EUR) P-acc | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.0322 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU0203975437 | Robeco BP Global Premium Equities D EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0208853944 | JPMorgan Funds - Global Natural Resources Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0210531983 | JPMorgan Funds - Europe Strategic Value Fund A (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0210536198 | JPMorgan Funds - US Growth Fund A (acc) - USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0212178916 | BNP Paribas Funds Europe Small Cap Classic Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0217139020 | Pictet-Premium Brands P EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0217576833 | JPMorgan Funds - Emerging Markets Equity Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0224105477 | BlackRock Global Funds - Continental European Flexible Fund Class A2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0224105980 | BlackRock Global Funds - Continental European Flexible Fund E2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0227385266 | Nordea 1 - Stable Return Fund E EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0229084990 | BlackRock Global Funds - European Equity Transition Fund A2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0231205856 | Franklin India Fund N(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0231490524 | abrdn SICAV I - Indian Equity Fund A Acc USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0232524495 | AB SICAV I - American Growth Portfolio A EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0235308482 | Alken Fund - European Opportunities Class R | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0236738190 | Schroder International Selection Fund Japanese Equity B Accumulation EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0243957239 | Invesco Funds - Invesco Pan European High Income Fund A Accumulation EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0243957742 | Invesco Funds - Invesco Pan European High Income Fund E Accumulation EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0243958393 | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248167537 | Schroder International Selection Fund Global Equity Alpha A1 Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248168261 | Schroder International Selection Fund Global Equity Alpha B Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248168428 | Schroder International Selection Fund Global Equity Alpha A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248172537 | Schroder International Selection Fund Emerging Asia A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248173006 | Schroder International Selection Fund Emerging Asia B Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248174152 | Schroder International Selection Fund Emerging Asia A1 Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248181363 | Schroder International Selection Fund Latin American A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248183815 | Schroder International Selection Fund Latin American B Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248183906 | Schroder International Selection Fund Asian Opportunities B Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248184383 | Schroder International Selection Fund Latin American A1 Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0248184466 | Schroder International Selection Fund Asian Opportunities A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0251119078 | Fidelity Funds - Fidelity Target™ 2035 Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0251131362 | Fidelity Funds - Fidelity Target™ 2030 Fund A-Acc-EUR | `REVIEW` | class_exposure_tension:equity_asset_type_with_equity_0.4105 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU0251660279 | AXA World Funds - Euro Strategic Bonds E Capitalisation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0251661590 | AXA World Funds - Euro Long Duration Bonds E Capitalisation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0251807987 | BNP Paribas Funds Japan Small Cap Classic EUR Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0251853072 | AB SICAV I - International Health Care Portfolio Class A EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0252500524 | JPMorgan Funds - EUR Money Market VNAV Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0252970834 | BlackRock Global Funds - European Equity Transition Fund A2 (USD) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0254836850 | Robeco Capital Growth Funds - Robeco Emerging Stars Equities D EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0256839860 | Allianz Global Investors Fund - Allianz Europe Equity Growth CT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0260085492 | Jupiter European Select Class L EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0260869739 | Franklin U.S. Opportunities Fund A(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0261948227 | Fidelity Funds - Germany Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0261951957 | FF - Global Dividend Plus Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0261952682 | Fidelity Funds - Euro 50 Index Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0264738294 | Janus Henderson Horizon Global Property Equities Fund A2 EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0267388220 | Fidelity Funds - Euro Short Term Bond Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0267984697 | Invesco Funds - Invesco India Equity Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0270905242 | Pictet-Security R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0273148055 | DWS Invest Gold and Precious Metals Equities NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0273159177 | DWS Invest Gold and Precious Metals Equities LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0273690064 | Goldman Sachs Asia Equity Growth & Income - P Cap EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0275692696 | Fidelity Funds - US Equity Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0279459456 | Schroder International Selection Fund Global Emerging Market Opportunities A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0279460892 | Schroder International Selection Fund Global Smaller Companies A1 Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0280435388 | Pictet - Clean Energy Transition P EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0280435461 | Pictet-Clean Energy Transition R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0282719219 | CT (Lux) - Pan European Small Cap Opportunities Class AE (EUR Accumulation Shares) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0284394821 | DNCA Invest Évolutif B EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0289089384 | JPMorgan Funds - Europe Equity Plus Fund A (perf) (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0289214628 | JPMorgan Funds - Europe Equity Plus Fund D (perf) (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0293313325 | Allianz Global Investors Fund - Allianz GEM Equity High Dividend AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0293313671 | Allianz Global Investors Fund - Allianz GEM Equity High Dividend CT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0294249692 | Carmignac Portfolio Grande Europe E EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0300507208 | Generali Investments SICAV - Euro Future Leaders EX | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0300741732 | Franklin Natural Resources Fund A(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0302445910 | Schroder International Selection Fund Global Climate Change Equity A Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0302446645 | Schroder International Selection Fund Global Climate Change Equity A Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0302446991 | Schroder International Selection Fund Global Climate Change Equity B Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0309468980 | Nordea 1 - Latin American Equity Fund E EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0313923228 | BlackRock Strategic Funds - European Opportunities Extension Fund A2 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0318931192 | Fidelity Funds - China Focus Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0320896664 | Robeco BP US Premium Equities DH € | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0321373184 | Schroder International Selection Fund European Dividend Maximiser B Distribution | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0323041763 | Chahine Funds - Equity Europe R | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0326425351 | BlackRock Global Funds - World Mining Fund E2 EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0329070915 | Jupiter India Select Class L EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0329203656 | JPMorgan Investment Funds - Global Dividend Fund D (acc) EUR (hedged) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0329206832 | JPMorgan Investment Funds - Japan Strategic Value Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0329355670 | Robeco QI Emerging Markets Active Equities D € | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0329430986 | GAM Multistock - Luxury Brands Equity EUR E | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0329678410 | Fidelity Funds - Emerging Asia Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0331286574 | BlackRock Global Funds - Sustainable Energy Fund C2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0333810850 | Goldman Sachs India Equity Portfolio E Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0336084032 | Carmignac Pf Flexible Bond A EUR Acc | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.0000 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU0340559557 | Pictet-Timber P EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0345361124 | Fidelity Funds - Asia Pacific Opportunities Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0348529792 | Fidelity Active Strategy - FAST - Europe Fund E-ACC-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0348784041 | Allianz Global Investors Fund - Allianz Oriental Income AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0348926287 | Nordea 1 - Global Climate and Environment Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0348927251 | Nordea 1 - Global Climate and Environment Fund E EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0352312853 | Allianz Strategy 75 CT EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0353647737 | Fidelity Funds - European Dividend Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0353649352 | Fidelity Funds - Global Inflation-linked Bond Fund E-Acc-EUR (hedged) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0360646680 | BNP Paribas Funds Euro Defensive Equity Classic Capitalisation | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0365089902 | Jupiter India Select Class L USD A Inc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0365775922 | Schroder International Selection Fund Greater China A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0368678339 | Fidelity Funds - Pacific Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0384381660 | Morgan Stanley Investment Funds - QuantActive Global Infrastructure Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0387754996 | Robeco Global Stars Equities D EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0391944815 | Pictet-Global Megatrend Selection R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0398684661 | Goldman Sachs Alternative Beta - P Cap EUR (hedged i) | `REVIEW` | credit_missing|region_incomplete | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0399356780 | DWS Invest Latin American Equities LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0404220724 | JPMorgan Investment Funds - Global Income Fund D (div) EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0413376566 | BlackRock Global Funds - Emerging Markets Bond Fund A2 Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0413543058 | Fidelity Funds - Japan Value Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0415391431 | Bellevue Funds (Lux) - Bellevue Medtech & Services B EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0425308169 | BlackRock Global Funds - Global Inflation Linked Bond Fund A2 EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0430492750 | JPMorgan Funds - Euro Aggregate Bond Fund C (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0438336694 | BlackRock ESG Fixed Income Strategies Fund E2 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0447425785 | SIH FCP - Short Term EUR A Classic | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0455556406 | UBS (Lux) Bond SICAV - Global Inflation-linked (USD) (EUR hedged) P-acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0469270010 | AB FCP I - Asia Ex-Japan Equity Portfolio C EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0491217419 | Robeco Indian Equities D € | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0496368142 | Franklin Gold and Precious Metals Fund A(acc)EUR-H1 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0496369389 | Franklin Gold and Precious Metals Fund N(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0501220429 | Global Evolution Funds - Frontier Markets R EUR H | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0503631714 | Pictet - Global Environmental Opportunities P EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0522352516 | JPMorgan Funds - India Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0524465548 | Alken Fund - Small Cap Europe Class A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0524465977 | Alken Fund - European Opportunities Class A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0546917344 | Goldman Sachs Euro Long Duration Bond - P Cap EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0552029406 | Amundi Funds - Latin America Equity A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0552029661 | Amundi Funds - Latin America Equity G EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0552385295 | Morgan Stanley Investment Funds - Global Opportunity Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0554840230 | Robeco Global Consumer Trends Equities M | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0563745743 | Bestinver Tordesillas SICAV Iberia A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0565135745 | First Eagle Amundi International Fund Class AE-C Shares | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0565136552 | First Eagle Amundi International Fund Class FE-C Shares | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0568583420 | Amundi Funds - Equity Japan Target A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0568620560 | LU0568620560-Amundi Funds - Cash EUR A2 EUR (C).pdf | `ERROR` | portfolio_exposure_v2_missing | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| LU0568620727 | Amundi Funds - Cash EUR G2 EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0569862609 | UBAM - Global High Yield Solution AHC EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0570870567 | CT (Lux) - Global Smaller Companies AE (EUR Accumulation Shares) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0571100824 | Groupama Europe Convertible NC | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.1856|duration_missing | `NEEDS_MANUAL_DATA` (Duration) |
| LU0571101558 | Groupama Euro High Yield NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0583242994 | MFS Meridian Funds - Prudent Wealth Fund A1 EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0592699093 | Carmignac Portfolio Emerging Patrimoine E EUR Acc | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0594300096 | Fidelity Funds - China Consumer Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0594539719 | Candriam Bonds Emerging Markets Class C EUR Hedged Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0599946893 | DWS Concept Kaldemorgen EUR LC | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU0599947198 | DWS Concept Kaldemorgen EUR NC | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0602539867 | Nordea 1 - Emerging Sustainable Stars Equity Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0604766674 | Allianz Global Investors Fund - Allianz Global Metals and Mining AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0607225447 | CT (Lux) Global Convertible Bond Fund A Acc EUR Hdg | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.0943 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU0607512935 | Invesco Funds - Invesco Developed Small and Mid-Cap Equity Fund E Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0607513586 | Invesco Funds - Invesco Global Equity Income Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0607983896 | Nordea 1 - Alpha 15 MA Fund BP EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU0616839501 | DWS Invest Euro High Yield Corporates LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0616856935 | DWS Invest Brazilian Equities LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0616857313 | DWS Invest Brazilian Equities NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0628612748 | BlackRock Global Funds - European Equity Income Fund E2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0630951415 | Fidelity Funds - Emerging Asia Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0631859229 | Bellevue Funds (Lux) - Bellevue Entrepreneur Europe Small B EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0637302547 | Nordea 1 - Emerging Market Corporate Bond Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0637335638 | Nordea 1 - Indian Equity Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0658026512 | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0661986348 | JPMorgan Funds - Euroland Dynamic Fund D (perf) (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0690375182 | Fundsmith Equity Fund T EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0702159772 | Fidelity Funds - Asian Smaller Companies Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0704154706 | RAM (Lux) Systematic Funds - Emerging Markets Equities O EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0706127809 | UBS (Lux) Bond SICAV - Global Short Term Flexible (USD) (EUR hedged) P-acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0712123511 | Morgan Stanley Investment Funds - Global Fixed Income Opportunities Fund AH (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0733673288 | Nordea 1 - European Cross Credit Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0766123821 | Fidelity Funds - China Focus Fund E-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0769137737 | BlackRock Global Funds - Continental European Flexible Fund Class A2 (USD) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0772958525 | Nordea 1 - North American Sustainable Stars Equity Fund BP USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0795636256 | Schroder International Selection Fund Emerging Markets Hard Currency A Accumulation EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0813337002 | DWS Invest Latin American Equities NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0815263628 | Morgan Stanley Investment Funds - Emerging Leaders Equity Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0823394852 | BNP Paribas Funds Global Convertible Classic RH EUR Capitalisation | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.0212 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU0823411706 | BNP Paribas Funds Consumer InnovatorsClassic Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0823421689 | BNP Paribas Funds Disruptive Technology Classic Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0826452848 | DWS Invest II Global Equity High Conviction Fund LC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0826453226 | DWS Invest II Global Equity High Conviction Fund NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0842066523 | SIH FCP - Balanced A Classic | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU0849399786 | Schroder International Selection Fund EURO High Yield A Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0857700040 | Fidelity Funds - European Dividend Fund A-MINCOME(G)-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0861897477 | Abante Global Funds Spanish Opportunities Class B | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0862450516 | JPMorgan Funds - Emerging Markets Dividend Fund D (acc) EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0910636546 | Goldman Sachs Emerging Markets Debt Blend Portfolio Other Currency Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0910636892 | Goldman Sachs Emerging Markets Debt Blend Portfolio E Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0918140210 | T. Rowe Price Funds SICAV - US Smaller Companies Equity Fund A (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0922333322 | Fidelity Funds - Italy Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0926439992 | Vontobel Fund - Emerging Markets Debt H (hedged) EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0933684101 | Incometric Equam Global Value A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0935222900 | Natixis AM Funds - Ostrum Euro Inflation R/A (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0935230242 | Natixis AM Funds - Ostrum Europe MinVol RE/A (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0940719098 | UBAM - Global High Yield Solution RHC EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0986194024 | SIH FCP - Equity Europe A Classic | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0995119665 | Schroder International Selection Fund EURO Credit Conviction A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU0995119749 | Schroder International Selection Fund EURO Credit Conviction B Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1021288268 | AB FCP I - Mortgage Income Portfolio A2 EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1022658667 | Franklin Euro Short Duration Bond Fund A(acc)EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1066281574 | SIH FCP - Equity Spain A Classic | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1079477284 | Allianz Emerging Markets Short Duration Bond AT (H2-EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1080015693 | Edmond de Rothschild Fund - Emerging Credit A EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1088692675 | UBAM - Global Equity AC EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1089088741 | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1095739733 | First Eagle Amundi Income Builder Fund Class AE-QD Shares | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1103303167 | Edmond de Rothschild Fund - US Value A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1111642820 | Eleva European Selection A2 EUR acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1120766388 | Candriam Equities L Biotechnology Class C EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1161086159 | Amundi Funds - Emerging Markets Blended Bond A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1161526576 | Edmond de Rothschild Fund - Bond Allocation R EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1162516717 | BlackRock Systematic Global Equity Absolute Return Fund A2 EUR Hedged | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1164219682 | AXA World Funds - Euro Credit Total Return A Capitalisation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1164220854 | AXA World Funds - Euro Credit Total Return E Capitalisation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1165644672 | IVO Funds - IVO Emerging Markets Corporate Debt EUR R Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1206943596 | Fidelity Active Strategy - FAST - Emerging Markets Fund A-ACC-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1213836080 | Fidelity Funds - Global Technology Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1223083087 | Schroder International Selection Fund Global Gold A Accumulation EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1223084051 | Schroder International Selection Fund Global Gold A Accumulation PLN Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1244893696 | Edmond de Rothschild Fund - Big Data A-EUR accumulating | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1244895394 | Edmond de Rothschild Fund - Big Data R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1245469744 | Flossbach von Storch - Multiple Opportunities II ET | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1245470593 | Flossbach von Storch - Multi Asset Defensive ET | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1254412460 | abrdn SICAV I - Indian Bond Fund A Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1276000236 | Edmond de Rothschild Fund - Income Europe R EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1279334483 | Pictet - Robotics R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1295551144 | Capital Group New Perspective Fund (LUX) B (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1298174530 | CT (Lux) - Global Multi Asset Income Class AE (EUR Accumulation Shares) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1299306321 | Carmignac Portfolio Sécurité AW EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1299311164 | Carmignac Portfolio Investissement A EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1299311834 | Carmignac Portfolio Investissement E EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1301026388 | Sycomore Fund SICAV - Sycomore Europe Happy@Work RC EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1304666057 | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 75 CT EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1317704135 | Carmignac Portfolio Long-Short European Equities E EUR Acc | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1321847805 | BlackRock Strategic Funds - Emerging Markets Equity Strategies Fund E2 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1330191542 | Magallanes Value Investors UCITS European Equity R EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1333148903 | Azvalor Lux SICAV Azvalor International R | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1340702932 | MFS Meridian Funds - Global Opportunistic Bond Fund A1 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1353951376 | AXA World Funds - Global Inflation Short Duration Bonds E Capitalisation EUR (Hedged) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1362999481 | Robeco High Yield Bonds D € | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1372006947 | Cobas LUX SICAV - Cobas Selection Fund Class P Acc EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1373035234 | BlackRock Strategic Funds - BSF Systematic Style Factor Fund E2 EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1378878430 | Morgan Stanley Investment Funds - Asia Opportunity Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1383852487 | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT2 EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1391767586 | Fidelity Funds - Global Financial Services Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1442549025 | MFS Meridian Funds - Prudent Capital Fund A1 EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1481179858 | Capital Group New World Fund (LUX) B (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1481583711 | Flossbach von Storch - Bond Opportunities RT | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1486845537 | Oddo BHF Euro Credit Short Duration CR-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1499628912 | Amundi S.F. - Diversified Short-Term Bond Select E EUR ND | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1529955046 | Eurizon Fund - Bond Aggregate RMB Class R EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1542714578 | Goldman Sachs Europe Sustainable Equity - X Cap EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1548496022 | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 15 AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1548497699 | Allianz Global Investors Fund - Allianz Global Artificial Intelligence AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1578889864 | Ninety One Global Strategy Fund - Global Gold Fund A Acc EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1582984149 | M&G (Lux) European Inflation Linked Corporate Bond Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1582988306 | M&G (Lux) Dynamic Allocation Fund EUR B Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1594335520 | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 75 AT EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1623762843 | Carmignac Pf Credit A EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1665237704 | M&G (Lux) Global Listed Infrastructure Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670618187 | M&G (Lux) Asian Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670618690 | M&G (Lux) Global Emerging Markets Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670626446 | M&G (Lux) Japan Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670631016 | M&G (Lux) Emerging Markets Bond Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670631289 | M&G (Lux) Emerging Markets Bond Fund EUR A-H Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670707527 | M&G (Lux) European Strategic Value Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670708764 | M&G (Lux) Global Convertibles Fund EUR B Acc | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.1153 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU1670710075 | M&G (Lux) Global Dividend Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670715975 | M&G (Lux) Japan Smaller Companies Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670718219 | M&G (Lux) Short Dated Corporate Bond Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670722161 | M&G (Lux) Global Floating Rate High Yield Fund EUR A-H Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1670724373 | M&G (Lux) Optimal Income Fund EUR A Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1679113404 | UBS (Lux) Bond SICAV - Floating Rate Income (USD) (EUR hedged) P-acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1694212348 | Nordea 1 - Low Duration European Covered Bond Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1694789451 | DNCA Invest Alpha Bonds A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1697013008 | SIH FCP - Flexible Fixed Income USD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1697016019 | Sigma Investment House FCP - Selection AggressiveClass A EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1697016365 | Sigma Investment House FCP - Selection Defensive Class A EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1697016878 | Sigma Investment House FCP - Selection Conservative Class A EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1697017256 | Sigma Investment House FCP - Selection Moderate Class A EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1697017686 | Sigma Investment House FCP - Selection Dynamic Class A EUR | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1697018064 | Sigma Investment House FCP - Best Morgan Stanley Class A EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1697018494 | Sigma Investment House FCP - Best JP Morgan Class A EUR | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1706854152 | Amundi S.F. - Diversified Short-Term Bond Select A EUR ND | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1717592262 | Groupama Global Inflation Short Duration NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1738492658 | Aviva Investors - Short Duration Global High Yield Bond Fund Ah EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1740985814 | DWS Strategic Allocation Dynamic LD | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1762221155 | Invesco Funds - Invesco Global Founders & Owners Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1775950477 | Invesco Funds - Invesco Asian Equity Fund E Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1819480192 | Echiquier Artificial Intelligence B EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1829329819 | CT (Lux) - Pan European Smaller Companies 1E (EUR Accumulation Shares) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1832969650 | Morgan Stanley Investment Funds - Euro Corporate Bond - Duration Hedged Fund A | `REVIEW` | class_exposure_tension:fixed_income_asset_type_with_bond_0.1651 | `PARSER_BUG_REVIEW` (Asset Class Tension) |
| LU1838941372 | Candriam Bonds Floating Rate Notes C EUR Cap | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1868537090 | DWS Invest ESG Dynamic Opportunities LC | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1873127366 | JPMorgan Liquidity Funds - EUR Liquidity LVNAV Fund A (acc) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1882457143 | Amundi Funds - Emerging Markets Corporate High Yield Bond A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1882462655 | Amundi Funds - Emerging Markets Short Term Bond A2 EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1882462739 | Amundi Funds - Emerging Markets Short Term Bond A2 EUR Hgd (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1882475392 | Amundi Funds - Euro Multi-Asset Target Income A2 EUR (C) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1883318740 | Amundi Funds - Global Equity Responsible A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1883327816 | Amundi Funds - Global Multi-Asset A EUR (C) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1883329432 | Amundi Funds - Global Multi-Asset Conservative A EUR (C) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1883330521 | Amundi Funds - Global Multi-Asset Target Income A2 EUR (C) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1883334275 | Amundi Funds - Global Subordinated Bond A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1883340322 | Amundi Funds - Pioneer Flexible Opportunities A EUR (C) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1883342377 | Amundi Funds - Global Equity A EUR (C) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1894680757 | Amundi Funds - Income Opportunities A2 EUR (C) | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1897556517 | Groupama Global Disruption NC | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1899018953 | Sigma Investment House FCP - Best Blackrock Class A EUR Accumulation | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1899019175 | Sigma Investment House FCP - Smart Horizon Class A EUR Accumulation | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1902444584 | CPR Invest - Climate Bonds Euro - A EUR - Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1915690918 | Nordea 1 - Active Rates Opportunities Fund Fund E EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1919971074 | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1931535931 | Allianz Pet and Animal Wellbeing AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1939214695 | Nordea 1 - Global Diversity Engagement Fund BP EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1951921383 | Allianz Global Investors Fund - Allianz Credit Opportunities AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU1961009468 | DWS Strategic Allocation Balance NC | `REVIEW` | credit_missing|duration_missing | `NEEDS_MANUAL_DATA` (Credit + Duration) |
| LU1966822956 | Cartesio Funds Income R | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU1983299162 | Schroder International Selection Fund Global Alternative Energy A Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2002383896 | Allianz Global Investors Fund - Allianz Credit Opportunities Plus AT EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2016064201 | Schroder International Selection Fund Global Alternative Energy A Accumulation EUR Hedged | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2050411763 | BlackRock Global Funds - Emerging Markets Equity Income Fund A2 (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2050544563 | DWS ESG Multi Asset Dynamic LC | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU2050860480 | Fidelity Funds - UK Special Situations Fund A-ACC-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2050929277 | Capital Group New Economy Fund (LUX) B (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2092176515 | BlueBox Funds - BlueBox Global Technology Fund Class C EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2094235707 | Goldman Sachs Global Future Technology Leaders Equity Portfolio Class E Shares | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2098772366 | Candriam Bonds Credit Alpha C EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2131365186 | UBS (Lux) Equity Fund - China Opportunity (USD) P EUR acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2133220793 | Robeco Sustainable Asian Stars Equities DL EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2145461757 | Robeco Smart Energy D-EUR Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2145463373 | Robeco Smart Energy M2-EUR Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2146190835 | Robeco Sustainable Water D-EUR Capitalisation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2210151341 | Fidelity Funds - Absolute Return Global Equity Fund A-PF-Acc-Euro (Euro/USD hedged) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2222028099 | Merchbanc FCP Renta Fija Flex A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2267099674 | BlackRock Global Funds - China Bond Fund Class A2 USD (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2278574558 | Buy & Hold Luxembourg B&H Equity Class 2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2278574715 | Buy & Hold Luxembourg B&H Flexible Class 2 | `REVIEW` | credit_missing | `NEEDS_MANUAL_DATA` (Credit Rating) |
| LU2278574988 | Buy & Hold Luxembourg B&H Bond Class 2 | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2295319300 | Morgan Stanley Investment Funds - Global Brands Fund A (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2295320068 | Morgan Stanley Investment Funds - Global Insight Fund A (EUR) | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2337806421 | Morgan Stanley Investment Funds - Global Endurance Fund A EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2357235493 | Incometric Fund Nartex Equity Fund A Cap EUR Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2357235576 | Incometric Fund Nartex Equity Fund R Cap EUR Accumulation | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2482630162 | M&G European Credit Investment Fund Class P EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2504555777 | Fidelity Funds - Global Industrials Fund A-Acc-EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2601038578 | Invesco Funds - Invesco Global Founders & Owners Fund A Accumulation EUR | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU2784406998 | Morgan Stanley Investment Funds - Emerging Markets Debt Opportunities Fund A | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| LU3038481936 | Hamco SICAV - Global Value R EUR Acc | `ACCEPT` | None | `CANDIDATE_FOR_WRITE_GATE` |
| UNKNOWN | DE000A0X7541-Acatis Value Event Fonds A.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | IE00B986FT65-Neuberger Berman Emerging Market Debt - Hard Currency Fund EUR A Accumulating Class.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0117858166-JPMorgan Funds - Euroland Equity Fund D (acc) EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0189895229-Schroder International Selection Fund Global High Yield B Accumulation EUR Hedged.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0284396289-DNCA Invest Value Europe Class B shares EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0352312184-Allianz Strategy 50 CT EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0512121004-DNCA Invest Eurose Class B shares EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0778324086-Fidelity Funds - Asian Special Situations Fund E-Acc-EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0920839429-Allianz Global Investors Fund - Allianz Europe Equity Growth Select CT EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU0995386439-EDM InversionSpanish Equity R EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1061675168-Goldman Sachs Frontier Markets Debt (Hard Currency) - X Cap EUR (hedged i).pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1103307408-Goldman Sachs Absolute Return Tracker Portfolio Other Currency Acc EUR-Hedged.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1191877379-BlackRock Global Funds - European High Yield Bond Fund A2.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1278917452-DWS Invest CROCI Sectors Plus LC.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1278917536-DWS Invest CROCI Sectors Plus NC.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1769941003-DWS Invest CROCI World Value LC.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1814994353-Azvalor Lux SICAV Altum Faith - Consistent Equity R.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1899018870-Sigma Investment House FCP - Best M&G Class A EUR Accumulation.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1917163617-BlackRock Global Funds - FinTech Fund E2.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1951204046-Natixis International Funds (Lux) I - Mirova Thematic Meta RA (EUR).pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1965927921-DWS Invest ESG Floating Rate Notes LC.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU1982200609-DWS Invest Corporate Green Bonds LC.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2240056015-Lonvia Mid-Cap Europe Retail.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2240056445-Lonvia Mid-Cap Euro Retail.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2338974699-Natixis International Funds (Lux) I - WCM Select Global Growth Equity Fund FA (EUR).pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2348336004-FF - Climate Solutions Fund E-ACC-EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2375689580-Sigma Investment House FCP - Global Equity A EUR Income.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2376061086-FF - Climate Solutions Fund A-Acc-EUR.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2697545163-BlackRock Global Funds - Euro High Yield Fixed Maturity Bond Fund 2027 Class A2.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2697545247-BGF Euro Investment Grade Fixed Maturity Bond Fund 2028 A2.pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |
| UNKNOWN | LU2743151057-Natixis International Funds (Lux) I - Ossiam Shiller Barclays CAPE® US Fund RA (EUR).pdf | `ERROR` | Gemini no devolviÃƒÂ³ un JSON objeto parseable | `BLOCKED_DO_NOT_WRITE` (LLM failure) |

---

## 6. Warnings y Errores Detectados

### Resumen de Motivos de REVIEW:
* **credit_missing**: 64 fondos
* **credit_missing|duration_missing**: 20 fondos
* **credit_missing|region_incomplete**: 2 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.0855**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.0322**: 1 fondos
* **class_exposure_tension:equity_asset_type_with_equity_0.4105**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.0000**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.1856|duration_missing**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.0943**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.0212**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.1153**: 1 fondos
* **class_exposure_tension:fixed_income_asset_type_with_bond_0.1651**: 1 fondos

### Resumen de Motivos de ERROR:
* **Gemini no devolviÃƒÂ³ un JSON objeto parseable**: 31 fondos
* **portfolio_exposure_v2_missing**: 1 fondos

---

## 7. Campos Prohibidos e Invariantes

Durante el procesamiento y validación del artifact JSON generado, se comprobaron las siguientes restricciones de seguridad de forma automatizada:
1. **Cero escrituras en manual.***: Ninguna clave en los payloads propuestos contiene la cadena `manual`, `manual.costs` ni `manual.costs.retrocession`.
2. **Preservación de manual.costs.retrocession**: El campo `fields_preserved` incluye explícitamente `["manual", "manual.costs", "manual.costs.retrocession"]`.
3. **economic_exposure no sobreescrito**: El objeto `portfolio_exposure_v2` en los payloads no introduce ni sobreescribe `economic_exposure`.
4. **Escala de porcentajes correctos (asset_mix)**: Todas las asignaciones en `portfolio.asset_allocation` y `portfolio_exposure_v2` están correctamente normalizadas en la escala `0..100` (ningún valor fuera de escala o representado en base decimal `0..1` de forma inconsistente).
5. **would_write**: El valor en la raíz del artifact `would_write` es estrictamente `false`.

---

## 8. Candidatos a Write Gate

Un total de **522** fondos se clasificaron con status `ACCEPT` o `ACCEPT_WITH_WARNINGS` sin generar alarmas críticas de consistencia ni requerir campos manuales ausentes. Estos fondos son candidatos óptimos para ser procesados a través del **Write Gate** en una fase futura:
* Ver la lista completa en la tabla superior con status `ACCEPT`.

---

## 9. Fondos que Necesitan Datos Manuales (REVIEW)

Un total de **95** fondos resultaron en status `REVIEW` y requieren intervención humana o aportes manuales complementarios antes de poder pasar a write:
* **Falta de Credit Quality Rating**: 86 fondos. Necesitan la matriz de rating de crédito para activos de Renta Fija.
* **Falta de Duración Efectiva**: 21 fondos. Requieren el valor de duración efectiva (`fixed_income.effective_duration`).
* **Inconsistencias de Exposición (Tensión)**: 9 fondos. El parser detectó tensiones entre la clase de activo detectada y las asignaciones del portfolio (por ejemplo, fondos clasificados como Renta Variable con exposición principal a bonos o viceversa).

---

## 10. Recomendación de Siguiente Paso

1. **Revisión Humana**: Validar el documento generado y el artifact JSON `parser_dry_run_latest.json`.
2. **Corrección de Errores por LLM**: Para los 31 fondos en estado `ERROR` por fallos de parseo del JSON de Gemini (por ejemplo, `DE000A0X7541`, `IE00B986FT65`, `LU0117858166`), se recomienda realizar una re-ejecución aislada o proveer un override manual si el informe Morningstar original de 1 página presenta formato extraño.
3. **Resolución de Datos Manuales**: Complementar los fondos de Renta Fija que entraron en `REVIEW` debido a falta de datos de rating de crédito o duración, ingresándolos a la sección `manual` correspondiente en Firebase.

---

## 11. Confirmaciones Absolutas de Seguridad

* **Firestore writes = 0**: **CONFIRMADO** (Ninguna escritura en base de datos real).
* **Parser write = NO**: **CONFIRMADO** (El script se ejecutó estrictamente en modo `--dry-run`).
* **BDB-FONDOS-CORE tocado = NO**: **CONFIRMADO** (No se modificó ningún archivo de lógica de Suitability, Optimizer, o Core).
* **Evidence Layer reactivada = NO**: **CONFIRMADO** (La Evidence Layer permaneció inactiva, no se indexaron capturas PNG ni otros metadatos complementarios).
* **Capturas PNG usadas = NO**: **CONFIRMADO** (Solo se utilizaron los PDFs de entrada Morningstar estándar).
* **Deploy = NO**: **CONFIRMADO** (No se ejecutó deploy de Firebase).
* **Commit = NO**: **CONFIRMADO** (No se realizaron commits en Git).
* **Push = NO**: **CONFIRMADO** (No se realizó push a remoto).

---
*Fin del Reporte.*
