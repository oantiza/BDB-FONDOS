# BDB Morningstar PDF Updated Batch Write Controlled 100-1

**Fecha**: 2026-05-20T17:08:31.751Z
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-100-1

> [!IMPORTANT]
> Escritura controlada de **100 fondos** (posiciones 26-125) en Firestore `funds_v3`.
> Metodo: `update()` — NUNCA `set()`.

---

## 1. Progreso Acumulado

| Batch | Fondos | Estado |
|:---|---:|:---|
| Batch 0 (25-0) | 25 | COMPLETADO — 25 OK |
| **Batch 1 (100-1)** | **100** | **ESTE BATCH** |
| Restantes | 395 | Pendiente |
| Missing (excluidos) | 2 | LU0171281750, LU0171282212 |
| **Total escrito** | **125** | |

---

## 2. Exclusiones

| Exclusion | Cantidad | Aplicada |
|:---|---:|:---|
| Missing ISINs | 2 | SI — excluidos |
| REVIEW ISINs | 95 | SI — excluidos |
| ERROR ISINs | 32 | SI — excluidos |
| Batch 0 (ya escritos) | 25 | SI — offset 25 |

---

## 3. Resultado de Escritura

| Metrica | Valor |
|:---|:---|
| Writes ejecutados | **100/100** |
| Errores de escritura | **0** |
| Fondos creados | **0** |

---

## 4. Verificacion Post-Write

| Metrica | Valor |
|:---|:---|
| Docs re-leidos | **100** |
| OK | **100** |
| Warnings | **0** |
| Critical Failures | **0** |

---

## 5. Campos Preservados

| Campo | Estado |
|:---|:---|
| `manual` | **INTACTO — CONFIRMADO** |
| `manual.costs` | **INTACTO — CONFIRMADO** |
| `manual.costs.retrocession` | **INTACTO — CONFIRMADO** |

---

## 6. Tabla del Batch

| # | ISIN | Nombre | Clase | Write | Verify |
|:---|:---|:---|:---|:---|:---|
| 26 | `ES0141113037` | GVC Gaesco Japón A FI | RV | OK | OK |
| 27 | `ES0141580037` | SIH Ahorro A FI | RF | OK | OK |
| 28 | `ES0141991002` | Gestión Talento FI | RV | OK | OK |
| 29 | `ES0142167032` | SIH Renta Fija A FI | RF | OK | OK |
| 30 | `ES0146309002` | Horos Value Internacional FI | RV | OK | OK |
| 31 | `ES0155142005` | Intermoney Variable Euro A FI | RV | OK | OK |
| 32 | `ES0155598008` | UBS Corto Plazo A FI | RF | OK | OK |
| 33 | `ES0155598032` | UBS Corto Plazo B FI | RF | OK | OK |
| 34 | `ES0156873004` | A&G Renta Fija Corto Plazo FI | RF | OK | OK |
| 35 | `ES0159201013` | Magallanes Iberian Equity M FI | RV | OK | OK |
| 36 | `ES0159259011` | Magallanes European Equity M FI | RV | OK | OK |
| 37 | `ES0160873008` | March Pagarés A FI | RF | OK | OK |
| 38 | `ES0161032034` | March Renta Fija Corto Plazo A FI | RF | OK | OK |
| 39 | `ES0162295002` | Cartera Renta Fija Horizonte 2027 FI | RF | OK | OK |
| 40 | `ES0162333035` | Merchrenta FI | RF | OK | OK |
| 41 | `ES0162368007` | Metavalor Internacional I FI | RV | OK | OK |
| 42 | `ES0165142003` | Mutuafondo Corto Plazo D FI | RF | OK | OK |
| 43 | `ES0165142037` | Mutuafondo Corto Plazo A FI | RF | OK | OK |
| 44 | `ES0165242001` | Myinvestor S&P500 Equiponderado FI | RV | OK | OK |
| 45 | `ES0167238023` | Estela Global Equities R FI | RV | OK | OK |
| 46 | `ES0168662031` | Trea Renta Fija FI | RF | OK | OK |
| 47 | `ES0168673038` | EDM Ahorro R FI | RF | OK | OK |
| 48 | `ES0168799056` | Gestión Boutique IV Alclam US Equities FI | RV | OK | OK |
| 49 | `ES0170138038` | Santalucía Renta Fija B FI | RF | OK | OK |
| 50 | `ES0170141008` | Santalucía Quality Acciones Europeas B FI | RV | OK | OK |
| 51 | `ES0176954008` | Renta 4 Renta Fija R FI | RF | OK | OK |
| 52 | `ES0182631004` | Polar Renta Fija A FI | RF | OK | OK |
| 53 | `ES0182769002` | Valentum E FI | RV | OK | OK |
| 54 | `ES0184949008` | Sigma Investment House Megatrends A FI | RV | OK | OK |
| 55 | `ES0184949016` | Sigma Investment House Megatrends B FI | RV | OK | OK |
| 56 | `FI0008800511` | Evli Short Corporate Bond B | RF | OK | OK |
| 57 | `FI0008811997` | Evli Nordic Corporate Bond B | RF | OK | OK |
| 58 | `FR0000174310` | Lazard Small Caps Euro SRI I | RV | OK | OK |
| 59 | `FR0000989626` | Groupama Trésorerie IC | Monetario | OK | OK |
| 60 | `FR0000989899` | Oddo BHF Avenir CR-EUR | RV | OK | OK |
| 61 | `FR0007008750` | R-co Conviction Credit Euro C EUR | RF | OK | OK |
| 62 | `FR0010148981` | Carmignac Investissement A EUR Acc | RV | OK | OK |
| 63 | `FR0010149120` | Carmignac Sécurité AW EUR Acc | RF | OK | OK |
| 64 | `FR0010172767` | EdR SICAV - Euro Sustainable Credit A EUR | RF | OK | OK |
| 65 | `FR0010230490` | Lazard Credit Opportunities RC EUR | RF | OK | OK |
| 66 | `FR0010288308` | Groupama Avenir Euro NC | RV | OK | OK |
| 67 | `FR0010306142` | Carmignac Patrimoine E EUR Acc | Mixto | OK | OK |
| 68 | `FR0010312660` | Carmignac Investissement E EUR Acc | RV | OK | OK |
| 69 | `FR0010321810` | Echiquier Agenor Mid Cap Europe A | RV | OK | OK |
| 70 | `FR0010547869` | Sextant PME A | RV | OK | OK |
| 71 | `FR0010722348` | Groupama Global Active Equity NC | RV | OK | OK |
| 72 | `FR0010829697` | AMUNDI TRESO 12 MOIS DP | RF | OK | OK |
| 73 | `FR0010839282` | Echiquier Short Term Credit SRI A | RF | OK | OK |
| 74 | `FR0010859769` | Echiquier World Equity Growth A | RV | OK | OK |
| 75 | `FR0010950055` | AXA IM Euro 6M E | RF | OK | OK |
| 76 | `FR0011288513` | Sycomore Sélection Crédit R | RF | OK | OK |
| 77 | `FR0011365212` | Amundi Ultra Short Term Bond Responsible E C | RF | OK | OK |
| 78 | `FR0011387299` | Allianz Euro Oblig Court Terme ISR RC | RF | OK | OK |
| 79 | `FR0013201001` | EdR SICAV - Euro Sustainable Credit R EUR | RF | OK | OK |
| 80 | `FR0013231453` | Ostrum Credit Ultra Short Plus I-C EUR | RF | OK | OK |
| 81 | `FR0013346079` | Groupama Ultra Short Term NC | RF | OK | OK |
| 82 | `FR0013460920` | EdR SICAV - Short Duration Credit A EUR | RF | OK | OK |
| 83 | `FR0013460961` | EdR SICAV - Short Duration Credit B EUR | RF | OK | OK |
| 84 | `FR0014008W22` | EdR SICAV - Millesima World 2028 A EUR | RF | OK | OK |
| 85 | `FR001400JGB5` | EdR SICAV Millesima Select 2028 A Eur | RF | OK | OK |
| 86 | `FR001400NTN5` | Lazard High Yield 2029 EC EUR | RF | OK | OK |
| 87 | `FR0050000860` | Amundi Ultra Short Term Bond Responsible P C | RF | OK | OK |
| 88 | `IE0003867441` | BNY Mellon Small Cap Euroland Fund EUR A Acc | RV | OK | OK |
| 89 | `IE0004766675` | Comgest Growth Europe EUR Acc | RV | OK | OK |
| 90 | `IE000MI53C66` | Man Funds plc - Man Global Investment Grade Opportunities D H EUR | RF | OK | OK |
| 91 | `IE0031069499` | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | RV | OK | OK |
| 92 | `IE0031333341` | Jupiter Asia Pacific Income Fund C USD Acc | RV | OK | OK |
| 93 | `IE0031573904` | Brandes Global Value Fund A Euro Acc | RV | OK | OK |
| 94 | `IE0031574647` | Brandes European Value Fund A Euro Acc | RV | OK | OK |
| 95 | `IE0031575271` | Brandes US Value Fund A Euro Acc | RV | OK | OK |
| 96 | `IE0032722484` | BNY Mellon Euroland Bond Fund EUR C Acc | RF | OK | OK |
| 97 | `IE0034277479` | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | RV | OK | OK |
| 98 | `IE00B03HCZ61` | Vanguard Global Stock Index Fund Investor EUR Accumulation | RV | OK | OK |
| 99 | `IE00B03HD191` | Vanguard Global Stock Index Fund EUR Acc | RV | OK | OK |
| 100 | `IE00B11XYW43` | PIMCO GIS Emerging Markets Bond Fund E Class EUR (Hedged) Accumulation | RF | OK | OK |
| 101 | `IE00B11XZ103` | PIMCO GIS Global Bond Fund E Class EUR (Hedged) Accumulation | RF | OK | OK |
| 102 | `IE00B11XZ871` | PIMCO GIS US High Yield Bond Fund E Class Accumulation | RF | OK | OK |
| 103 | `IE00B11YFH93` | BNY Mellon Emerging Markets Debt Local Currency Fund EUR A Acc | RF | OK | OK |
| 104 | `IE00B18GC888` | Vanguard Global Bond Index Fund EUR Hedged Acc | RF | OK | OK |
| 105 | `IE00B23S7K36` | BNY Mellon Brazil Equity Fund EUR A Acc | RV | OK | OK |
| 106 | `IE00B28YJQ65` | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) | RV | OK | OK |
| 107 | `IE00B2NXKW18` | Seilern World Growth EUR U R | RV | OK | OK |
| 108 | `IE00B3NLSS43` | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund R Inc (EUR) | RV | OK | OK |
| 109 | `IE00B3RW6Z61` | Nomura Funds Ireland plc - US High Yield Bond Fund Class A EUR | RF | OK | OK |
| 110 | `IE00B3V93F27` | BNY Mellon Global Equity Income Fund EUR A Acc | RV | OK | OK |
| 111 | `IE00B3VXGD32` | Polar Capital Funds PLC - Biotechnology Fund R Inc (EUR) | RV | OK | OK |
| 112 | `IE00B4M05337` | Brown Advisory US Equity Growth $ P | RV | OK | OK |
| 113 | `IE00B4Z6MP99` | BNY Mellon Global Real Return Fund (EUR) C Acc | Mixto | OK | OK |
| 114 | `IE00B4ZJ4188` | Comgest Growth Europe Opportunities EUR Acc | RV | OK | OK |
| 115 | `IE00B52VLZ70` | Polar Capital Funds PLC - Polar Capital Global Insurance Fund R Acc (EUR) | RV | OK | OK |
| 116 | `IE00B53H0P79` | PIMCO GIS Global Advantage Fund E Class EUR (Partially Hedged) Accumulation | RF | OK | OK |
| 117 | `IE00B5ZW6Z28` | PIMCO GIS Emerging Local Bond Fund E Class EUR (Unhedged) Accumulation | RF | OK | OK |
| 118 | `IE00B84J9L26` | PIMCO GIS Income Fund E Class EUR (Hedged) Accumulation | RF | OK | OK |
| 119 | `IE00B87MS887` | Liontrust GF Special Situations Fund A1 Acc EUR | RV | OK | OK |
| 120 | `IE00B88WFS66` | Federated Hermes Asia ex-Japan Equity Fund Class R EUR Accumulating | RV | OK | OK |
| 121 | `IE00B8BPMF80` | Wellington Strategic European Equity Fund EUR D Ac | RV | OK | OK |
| 122 | `IE00B8J38129` | Algebris UCITS Funds plc - Algebris Financial Credit Fund R EUR Acc | RF | OK | OK |
| 123 | `IE00B90VC092` | PIMCO European Short-Term Opportunities Fund E EUR Accumulation | RF | OK | OK |
| 124 | `IE00BD2ZKT29` | Principal Global Investors Funds - Finisterre Unconstrained Emerging Market Fxd Inc Fd A Hdg Acc EUR | RF | OK | OK |
| 125 | `IE00BD4GTQ32` | FTGF ClearBridge Infrastructure Value Fund Class A Euro Accumulating | RV | OK | OK |

---

## 7. Confirmaciones de Seguridad

| Invariante | Estado |
|:---|:---|
| Firestore writes | **100** |
| Fondos creados | **0 — CONFIRMADO** |
| Missing ISINs tocados | **0 — CONFIRMADO** |
| REVIEW tocados | **0 — CONFIRMADO** |
| ERROR tocados | **0 — CONFIRMADO** |
| manual.* tocado | **NO — CONFIRMADO** |
| manual.costs.retrocession tocado | **NO — CONFIRMADO** |
| BDB-FONDOS-CORE tocado | **NO — CONFIRMADO** |
| Deploy | **NO — CONFIRMADO** |
| Commit | **NO — CONFIRMADO** |
| Push | **NO — CONFIRMADO** |

---

## 8. Rollback

Archivo: `artifacts/morningstar_pdf_updated_batch/write_controlled_100_1/rollback_batch_100_1.json`
Documentos: **100** (estado pre-write desde snapshot)

---

## 9. Recomendacion

> [!TIP]
> Los 100 writes se ejecutaron correctamente. manual.* intacto en todos los casos.

**Recomendacion**: Proceder con el batch restante de **395 ISINs**.

---

*Batch 1 (100 fondos) — Writes: 100 — Total acumulado: 125/520*
