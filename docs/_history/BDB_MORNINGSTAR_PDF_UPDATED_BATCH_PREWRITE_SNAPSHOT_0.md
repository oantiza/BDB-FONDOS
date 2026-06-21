# BDB Morningstar PDF Updated Batch Pre-Write Snapshot 0

**Fecha de generacion**: 2026-05-20T16:58:23.974Z
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-PREWRITE-SNAPSHOT-0

> [!IMPORTANT]
> Este documento registra un **snapshot de solo lectura** de los 522 fondos ACCEPT en Firestore `funds_v3`.
> **Firestore writes = 0**. Ningun campo ha sido modificado.

---

## 1. Estado Git Inicial

```
git status verificado antes de ejecucion (ver consola)
```

Archivos no commiteados relevantes:
- `MORNINGSTAR_PDF_PARSER/SALIDA/write_gate_manifest_0.json`
- `docs/BDB_MORNINGSTAR_PDF_UPDATED_BATCH_WRITE_GATE_0.md`
- `docs/BDB_MORNINGSTAR_PDF_UPDATED_BATCH_PREWRITE_SNAPSHOT_0.md` (este documento)

---

## 2. Total ISINs Esperados vs Leidos

| Metrica | Valor |
|:---|:---|
| ISINs en manifest (esperados) | **522** |
| ISINs encontrados en Firestore | **520** |
| ISINs faltantes en Firestore | **2** |
| REVIEW excluidos | **95** |
| ERROR excluidos | **32** |
| Overlap ACCEPT ∩ REVIEW | **0** |
| Overlap ACCEPT ∩ ERROR | **0** |

---

## 3. ISINs Faltantes

### ISINs Missing en Firestore

| # | ISIN |
|:---|:---|
| 1 | `LU0171281750` |
| 2 | `LU0171282212` |

> [!WARNING]
> Estos 2 ISINs NO existen en funds_v3. Deben ser excluidos del Write Gate hasta revisión manual.


---

## 4. Hash del Snapshot

| Campo | Valor |
|:---|:---|
| **Snapshot global hash (SHA-256)** | `03ba51120fde0fb471fddbb4ba73917835637c34fe0f42e7cd2156cc569c1ce9` |
| **Per-ISIN hashes** | 520 hashes generados |
| **Archivo de hashes** | `artifacts/morningstar_pdf_updated_batch/prewrite_snapshot_0/prewrite_snapshot_hashes.json` |

> Cada hash per-ISIN es un SHA-256 truncado (16 hex chars) del documento JSON serializado.
> El hash global es el SHA-256 completo del snapshot JSON entero.

---

## 5. Distribucion por Clase de Activo (estado ACTUAL en Firestore)

| Clase de Activo | Fondos |
|:---|---:|
| `RV` | **327** |
| `RF` | **169** |
| `Mixto` | **14** |
| `Monetario` | **8** |
| `Alternativos` | **2** |

**Total**: 520 fondos

---

## 6. Plan de Rollback

| Campo | Valor |
|:---|:---|
| **Estrategia** | Full document restore desde snapshot |
| **Archivo fuente** | `snapshot_funds_v3_before_write.json` |
| **ISINs restaurables** | **520** |
| **ISINs no restaurables** | **2** (no existian antes) |
| **Campos siempre preservados** | `manual`, `manual.costs`, `manual.costs.retrocession` |

### Proceso de rollback:
1. Cargar `snapshot_funds_v3_before_write.json`
2. Para cada ISIN, restaurar el documento completo en `funds_v3/{isin}`
3. Verificar hash post-restore contra `prewrite_snapshot_hashes.json`
4. Los campos `manual.*` NUNCA son tocados por el Write Gate; no requieren rollback

---

## 7. Confirmacion: Ningun Campo Escrito

| Invariante | Estado |
|:---|:---|
| Firestore writes de actualizacion | **0 — CONFIRMADO** |
| Campos funds_v3 modificados | **0 — CONFIRMADO** |
| Parser write ejecutado | **NO — CONFIRMADO** |
| BDB-FONDOS-CORE tocado | **NO — CONFIRMADO** |
| Evidence Layer reactivada | **NO — CONFIRMADO** |
| Capturas PNG usadas | **NO — CONFIRMADO** |
| Deploy | **NO — CONFIRMADO** |
| Commit | **NO — CONFIRMADO** |
| Push | **NO — CONFIRMADO** |

---

## 8. Recomendacion para Siguiente Bloque

1. **Revisar los 2 ISINs faltantes** antes de proceder.
2. **Write Gate controlado batch de 25** solo para los 520 ISINs existentes.
3. **Crear fondos faltantes** en funds_v3 manualmente si procede.

---

## 9. Tabla de ISINs con Hash Pre-Write

| ISIN | Nombre | Clase Actual | updatedAt | Hash Pre-Write |
|:---|:---|:---|:---|:---|
| `BE0943877671` | DPAM B - Bonds Eur Government B Cap | RF | 2026-03-15T18:47:36 | `33b82927b94246bb` |
| `BE0946564383` | DPAM B - Equities NewGems Sustainable B Cap | RV | 2026-04-22T16:48:50 | `b14e722c81894ade` |
| `BE0947853660` | DPAM B - Equities US Dividend Sustainable B EUR Cap | RV | 2026-04-22T09:29:07 | `5bac1f4fd4d66daa` |
| `DE0008490962` | DWS Deutschland LC | RV | 2026-04-22T09:27:45 | `86e0863998371848` |
| `ES0111166031` | Atl Capital Corto Plazo A FI | RF | 2026-03-15T18:47:36 | `461268b7ee75d8f8` |
| `ES0112602000` | Azvalor Managers FI | RV | [object Object] | `1736a7a7c6f754cf` |
| `ES0114633003` | Panda Agriculture & Water Fund FI | RV | [object Object] | `d3edb193d1c196e2` |
| `ES0114904008` | Brightgate Focus A FI | Mixto | 2026-03-15T18:47:36 | `48a88b4da490c182` |
| `ES0116419005` | Cartera Renta Fija Horizonte 2026 FI | RF | 2026-04-22T16:39:15 | `38ad5f0cbcc40c03` |
| `ES0116567035` | Cartesio X FI | Mixto | 2026-03-15T18:47:36 | `bab27edad3eeffce` |
| `ES0116848005` | Global Allocation R FI | Mixto | 2026-03-15T18:47:36 | `b70e4ace76ce901c` |
| `ES0124880032` | UBS Renta Fija 0-5 B FI | RF | [object Object] | `fda09aa639885215` |
| `ES0125240038` | Trea Renta Fija Ahorro S FI | RF | [object Object] | `9b5ca4597597f87f` |
| `ES0125323008` | Gestión Value A FI | RV | 2026-04-22T09:02:45 | `7c8b118b9e66cd31` |
| `ES0126542036` | Amundi Corto Plazo A FI | RF | 2026-03-15T18:47:36 | `5c3ed82a72df122a` |
| `ES0126547035` | UBS Duración 0-2 B FI | RF | 2026-03-15T18:47:36 | `9546fbdddb39f480` |
| `ES0127097030` | Dux Rentinver Renta Fija FI | RF | 2026-03-15T18:47:36 | `9a61ed8f18e25082` |
| `ES0127795005` | EDM Renta R FI | RF | 2026-03-15T18:47:36 | `4c97b9bbac2f5477` |
| `ES0137381036` | Gesconsult Renta Variable Iberia A FI | RV | 2026-04-22T09:24:28 | `47b8ef8de10c0cb3` |
| `ES0138217031` | Gesconsult Renta Fija Flexible A FI | RF | 2026-04-22T09:25:32 | `50441ca09c647814` |
| `ES0138911039` | Gesconsult Renta Variable Eurozona FI | RV | 2026-04-22T09:25:32 | `a2907d6812de17f2` |
| `ES0138922002` | Gesconsult Horizonte 2025 FI | RF | 2026-04-22T16:48:50 | `c560734b8870ef35` |
| `ES0138922036` | Gesconsult Corto Plazo A FI | RF | 2026-03-15T18:47:36 | `26513820c2c7e31e` |
| `ES0140643034` | GVC Gaesco Europa FI | RV | 2026-04-22T16:53:45 | `acbd126586dc93eb` |
| `ES0140986011` | Gesconsult Oportunidad Renta Fija A FI | RF | 2026-04-22T09:25:32 | `1268d28f3e1bfe1b` |
| `ES0141113037` | GVC Gaesco Japón A FI | RV | 2026-04-22T16:47:17 | `989744fa54ea5e4c` |
| `ES0141580037` | SIH Ahorro A FI | RF | [object Object] | `729846107122edc5` |
| `ES0141991002` | Gestión Talento FI | RV | 2026-04-22T09:13:41 | `c35e07c5d15635b1` |
| `ES0142167032` | SIH Renta Fija A FI | RF | [object Object] | `618401df39c6bb33` |
| `ES0146309002` | Horos Value Internacional FI | RV | 2026-04-22T16:40:45 | `ecdda64311b6d6cd` |
| `ES0155142005` | Intermoney Variable Euro A FI | RV | 2026-04-22T09:06:43 | `64b5ac61a611191f` |
| `ES0155598008` | UBS Corto Plazo A FI | RF | 2026-03-15T18:47:36 | `af4cc3c67a9f6e8d` |
| `ES0155598032` | UBS Corto Plazo B FI | RF | 2026-03-15T18:47:36 | `010dafba862d5da9` |
| `ES0156873004` | A&G Renta Fija Corto Plazo FI | RF | 2026-03-15T18:47:36 | `0215aa1fa5dddda8` |
| `ES0159201013` | Magallanes Iberian Equity M FI | RV | 2026-04-22T09:27:45 | `22faba64e283082b` |
| `ES0159259011` | Magallanes European Equity M FI | RV | 2026-04-22T09:27:45 | `a90d7639b2183605` |
| `ES0160873008` | March Pagarés A FI | RF | 2026-03-15T18:47:36 | `d45af188667128d8` |
| `ES0161032034` | March Renta Fija Corto Plazo A FI | RF | 2026-03-15T18:47:36 | `5c091f08210f493d` |
| `ES0162295002` | Cartera Renta Fija Horizonte 2027 FI | RF | 2026-04-22T16:39:15 | `bc91baff7781f742` |
| `ES0162333035` | Merchrenta FI | RF | [object Object] | `2d021ee88357a43b` |
| `ES0162368007` | Metavalor Internacional I FI | RV | [object Object] | `eb4a3f45f64ae119` |
| `ES0165142003` | Mutuafondo Corto Plazo D FI | RF | 2026-05-08T04:39:38 | `67e5f5ad3fb49368` |
| `ES0165142037` | Mutuafondo Corto Plazo A FI | RF | 2026-03-15T18:47:36 | `f5b8c68d74b6380f` |
| `ES0165242001` | Myinvestor S&P500 Equiponderado FI | RV | [object Object] | `21d804c1dbb86d80` |
| `ES0167238023` | Estela Global Equities R FI | RV | 2026-04-22T16:53:45 | `44853f7c89a11f5a` |
| `ES0168662031` | Trea Renta Fija FI | RF | [object Object] | `2a73d8bd0ed2f416` |
| `ES0168673038` | EDM Ahorro R FI | RF | 2026-03-15T18:47:36 | `e18051a2a409b646` |
| `ES0168799056` | Gestión Boutique IV Alclam US Equities FI | RV | 2026-04-22T16:53:45 | `4b77525367902f28` |
| `ES0170138038` | Santalucía Renta Fija B FI | RF | [object Object] | `1cc953737d432c80` |
| `ES0170141008` | Santalucía Quality Acciones Europeas B FI | RV | 2026-04-22T16:42:40 | `cb0b95db1b98c849` |
| `ES0176954008` | Renta 4 Renta Fija R FI | RF | 2026-04-22T16:51:09 | `5dcd93e3e9475129` |
| `ES0182631004` | Polar Renta Fija A FI | RF | 2026-03-15T18:47:36 | `a00540741ed5e0a1` |
| `ES0182769002` | Valentum E FI | RV | 2026-04-22T09:27:45 | `583ade1b2a952762` |
| `ES0184949008` | Sigma Investment House Megatrends A FI | RV | 2026-04-22T16:51:09 | `0a0bda685e184f2c` |
| `ES0184949016` | Sigma Investment House Megatrends B FI | RV | 2026-04-22T09:16:33 | `e833745e85688cb1` |
| `FI0008800511` | Evli Short Corporate Bond B | RF | 2026-03-15T18:47:36 | `5197a72d62ad3f39` |
| `FI0008811997` | Evli Nordic Corporate Bond B | RF | [object Object] | `e21d4766b51d3356` |
| `FR0000174310` | Lazard Small Caps Euro SRI I | RV | 2026-04-22T16:42:40 | `7b31d78b9f3d9732` |
| `FR0000989626` | Groupama Trésorerie IC | Monetario | 2026-04-22T16:45:26 | `b1d8c8f4f38fe1fb` |
| `FR0000989899` | Oddo BHF Avenir CR-EUR | RV | 2026-04-22T09:27:45 | `277dcd0c5e1c5bd1` |
| `FR0007008750` | R-co Conviction Credit Euro C EUR | RF | 2026-03-15T18:47:36 | `ecb76020c715f455` |
| `FR0010148981` | Carmignac Investissement A EUR Acc | RV | 2026-04-22T16:42:40 | `0a766400673edd00` |
| `FR0010149120` | Carmignac Sécurité AW EUR Acc | RF | [object Object] | `db8ea60c3b3267a3` |
| `FR0010172767` | EdR SICAV - Euro Sustainable Credit A EUR | RF | 2026-03-15T18:47:36 | `132eedb03284d625` |
| `FR0010230490` | Lazard Credit Opportunities RC EUR | RF | 2026-04-22T09:24:28 | `5d016a13c2a73be6` |
| `FR0010288308` | Groupama Avenir Euro NC | RV | 2026-04-22T09:30:25 | `c99fa44fcff2ed0c` |
| `FR0010306142` | Carmignac Patrimoine E EUR Acc | Mixto | 2026-03-15T18:47:36 | `0a27fef8c26993d9` |
| `FR0010312660` | Carmignac Investissement E EUR Acc | RV | 2026-04-22T16:53:45 | `8584a9d915e75881` |
| `FR0010321810` | Echiquier Agenor SRI Mid Cap Europe A | RV | 2026-04-22T09:30:25 | `3817c754650953fb` |
| `FR0010547869` | Sextant PME A | RV | 2026-04-22T09:06:43 | `6a898a0471bdc42a` |
| `FR0010722348` | Groupama Global Active Equity NC | RV | 2026-03-15T18:47:36 | `bdf3313f9d049447` |
| `FR0010829697` | Amundi Enhanced Ultra Short Term Bond Select P-C | RF | 2026-03-15T18:47:36 | `3a027f8f44b60ea3` |
| `FR0010839282` | Echiquier Short Term Credit SRI A | RF | 2026-03-15T18:47:36 | `c23cef6a28687486` |
| `FR0010859769` | Echiquier World Equity Growth A | RV | 2026-04-22T16:48:50 | `45c171c63e2e5d79` |
| `FR0010950055` | AXA IM Euro 6M E | RF | 2026-03-15T18:47:36 | `a5015ebc43bfa97d` |
| `FR0011288513` | Sycomore Sélection Crédit R | RF | [object Object] | `89d05f55dddb5307` |
| `FR0011365212` | Amundi Ultra Short Term Bond Responsible E C | RF | 2026-03-15T18:47:36 | `e47afa1be50b63a5` |
| `FR0011387299` | Allianz Euro Oblig Court Terme ISR RC | RF | 2026-03-15T18:47:36 | `94091c2a5cdbb3d4` |
| `FR0013201001` | EdR SICAV - Euro Sustainable Credit R EUR | RF | [object Object] | `2bc31fc5fed99372` |
| `FR0013231453` | Ostrum Credit Ultra Short Plus I-C EUR | RF | 2026-03-15T18:47:36 | `ce528c240b36060d` |
| `FR0013346079` | Groupama Ultra Short Term NC | RF | 2026-03-15T18:47:36 | `c42b3d41142d80d4` |
| `FR0013460920` | EdR SICAV - Short Duration Credit A EUR | RF | [object Object] | `02f361b4eadaddd4` |
| `FR0013460961` | EdR SICAV - Short Duration Credit B EUR | RF | [object Object] | `fce1674e259d4c7a` |
| `FR0014008W22` | EdR SICAV - Millesima World 2028 A EUR | RF | 2026-04-22T16:45:26 | `9b3f4b8cf776711b` |
| `FR001400JGB5` | EdR SICAV Millesima Select 2028 A Eur | RF | 2026-04-22T16:54:57 | `5c2cb09e65f53c95` |
| `FR001400NTN5` | Lazard High Yield 2029 EC EUR | RF | [object Object] | `ffabf3ae98eec8f5` |
| `FR0050000860` | Amundi Ultra Short Term Bond Responsible P C | RF | 2026-03-15T18:47:36 | `a47e759a3d266f5a` |
| `IE0003867441` | BNY Mellon Small Cap Euroland Fund EUR A Acc | RV | 2026-05-08T04:39:38 | `c319bdb20518b605` |
| `IE0004766675` | Comgest Growth Europe EUR Acc | RV | 2026-04-22T16:51:09 | `a3149db2ff811c3f` |
| `IE000MI53C66` | Man Funds plc - Man Global Investment Grade Opportunities D H EUR | RF | [object Object] | `fc5de17be6d5b493` |
| `IE0031069499` | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | RV | 2026-03-15T18:47:36 | `148f81fb167c0b06` |
| `IE0031333341` | Jupiter Asia Pacific Income Fund C USD Acc | RV | 2026-04-22T16:45:26 | `7a01a13751f97d59` |
| `IE0031573904` | Brandes Global Value Fund A Euro Acc | RV | 2026-04-22T16:49:36 | `ecac51816c6952a4` |
| `IE0031574647` | Brandes European Value Fund A Euro Acc | RV | 2026-04-22T16:43:51 | `f231bf7a00cfa234` |
| `IE0031575271` | Brandes US Value Fund A Euro Acc | RV | 2026-04-22T09:30:25 | `c381773c1a52709c` |
| `IE0032722484` | BNY Mellon Euroland Bond Fund EUR C Acc | RF | [object Object] | `7559730c9f064ed3` |
| `IE0034277479` | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | RV | 2026-03-15T18:47:36 | `7b02877921683b95` |
| `IE00B03HCZ61` | Vanguard Global Stock Index Fund Investor EUR Accumulation | RV | 2026-04-22T16:53:45 | `a41d6b92f6bb83cd` |
| `IE00B03HD191` | Vanguard Global Stock Index Fund EUR Acc | RV | 2026-04-22T09:25:32 | `b2a4692230cc1040` |
| `IE00B11XYW43` | PIMCO GIS Emerging Markets Bond Fund E Class EUR (Hedged) Accumulation | RF | 2026-03-15T18:47:36 | `39cdce3d7097f9c9` |
| `IE00B11XZ103` | PIMCO GIS Global Bond Fund E Class EUR (Hedged) Accumulation | RF | 2026-04-22T16:45:26 | `01c23744e370adec` |
| `IE00B11XZ871` | PIMCO GIS US High Yield Bond Fund E Class Accumulation | RF | [object Object] | `928270881fb6abac` |
| `IE00B11YFH93` | BNY Mellon Emerging Markets Debt Local Currency Fund EUR A Acc | RF | 2026-04-22T09:26:35 | `9a5226be711dd20f` |
| `IE00B18GC888` | Vanguard Global Bond Index Fund EUR Hedged Acc | RF | [object Object] | `bc561f1d6a3a3611` |
| `IE00B23S7K36` | BNY Mellon Brazil Equity Fund EUR A Acc | RV | 2026-04-22T09:06:43 | `79282ec9f517ef94` |
| `IE00B28YJQ65` | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) | RV | [object Object] | `87b6162301ee4b63` |
| `IE00B2NXKW18` | Seilern World Growth EUR U R | RV | 2026-04-22T09:30:25 | `be8a08a66f7a8dcb` |
| `IE00B3NLSS43` | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund R Inc (EUR) | RV | 2026-04-22T09:30:25 | `d999ca241c3932bb` |
| `IE00B3RW6Z61` | Nomura Funds Ireland plc - US High Yield Bond Fund Class A EUR | RF | 2026-03-15T18:47:36 | `3fdcf9e9a42e75b1` |
| `IE00B3V93F27` | BNY Mellon Global Equity Income Fund EUR A Acc | RV | 2026-04-22T16:42:40 | `9a1e9a7f1e7461c9` |
| `IE00B3VXGD32` | Polar Capital Funds PLC - Biotechnology Fund R Inc (EUR) | RV | 2026-04-22T09:30:25 | `39be5aff56f3b2bb` |
| `IE00B4M05337` | Brown Advisory US Equity Growth $ P | RV | 2026-04-22T16:52:35 | `0402345db980164f` |
| `IE00B4Z6MP99` | BNY Mellon Global Real Return Fund (EUR) C Acc | Mixto | 2026-04-22T16:48:50 | `e12267c19fb2a3b5` |
| `IE00B4ZJ4188` | Comgest Growth Europe Opportunities EUR Acc | RV | 2026-04-22T16:54:57 | `438e3d07dcea8964` |
| `IE00B52VLZ70` | Polar Capital Funds PLC - Polar Capital Global Insurance Fund R Acc (EUR) | RV | 2026-04-22T16:39:15 | `3ab245aaf80a1775` |
| `IE00B53H0P79` | PIMCO GIS Global Advantage Fund E Class EUR (Partially Hedged) Accumulation | RF | [object Object] | `a12005e0e1bbbdde` |
| `IE00B5ZW6Z28` | PIMCO GIS Emerging Local Bond Fund E Class EUR (Unhedged) Accumulation | RF | [object Object] | `185aa0e957773577` |
| `IE00B84J9L26` | PIMCO GIS Income Fund E Class EUR (Hedged) Accumulation | RF | [object Object] | `0b93f92ad478163c` |
| `IE00B87MS887` | Liontrust GF Special Situations Fund A1 Acc EUR | RV | 2026-04-22T16:53:45 | `d8f5ac4d419b8900` |
| `IE00B88WFS66` | Federated Hermes Asia ex-Japan Equity Fund Class R EUR Accumulating | RV | 2026-04-22T16:43:51 | `ad747f130c4e9ba2` |
| `IE00B8BPMF80` | Wellington Strategic European Equity Fund EUR D Ac | RV | 2026-04-22T16:45:26 | `88bdee4e37f0f3b7` |
| `IE00B8J38129` | Algebris UCITS Funds plc - Algebris Financial Credit Fund R EUR Acc | RF | 2026-04-22T09:26:35 | `6d254c7ceb8f85e4` |
| `IE00B90VC092` | PIMCO European Short-Term Opportunities Fund E EUR Accumulation | RF | [object Object] | `1ef0853901608aae` |
| `IE00BD2ZKT29` | Principal Global Investors Funds - Finisterre Unconstrained Emerging Market Fxd Inc Fd A Hdg Acc EUR | RF | 2026-03-15T18:47:36 | `6e02c0039f4e0443` |
| `IE00BD4GTQ32` | FTGF ClearBridge Infrastructure Value Fund Class A Euro Accumulating | RV | 2026-04-22T16:56:48 | `88be78a68aaa1b2c` |
| `IE00BD5CTX77` | BNY Mellon Global Short-Dated High Yield Bond Fund EUR H Acc Hedged | RF | [object Object] | `10c771e60d72ce18` |
| `IE00BDH6RQ67` | UTI India Dynamic Equity EURO Retail | RV | 2026-04-22T16:39:15 | `3e8bfe5a8dcaf91a` |
| `IE00BDTYYP61` | Man Funds VI plc - Man High Yield Opportunities D EUR | RF | 2026-03-15T18:47:36 | `97c555b56de162ba` |
| `IE00BDZRWZ54` | Neuberger Berman Short Duration Emerging Market Debt Fund EUR A Accumulating Class | RF | [object Object] | `9cc454a1678c91e6` |
| `IE00BF0GL212` | Polar Capital Funds PLC - Artificial Intelligence Fund R USD Acc (EUR) | RV | 2026-04-22T09:24:28 | `063b20e50591adbd` |
| `IE00BF2FJG67` | PIMCO GIS Low Duration Opportunities Fund E Class EUR (Hedged) Accumulation | RF | [object Object] | `7c2062a74f7f0a8c` |
| `IE00BJ7B9456` | PIMCO GIS Global Low Duration Real Return Fund E Class EUR (Hedged) Accumulation | Monetario | 2026-03-15T18:47:36 | `e506a056e009a98b` |
| `IE00BKSBDB61` | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities R Acc (EUR) | RV | 2026-04-22T09:25:32 | `4c82f142e4608cc6` |
| `IE00BM95B621` | Polar Capital Funds PLC - Polar Capital Global Technology Fund R Acc | RV | 2026-04-22T09:24:28 | `73716092bf6cda7c` |
| `IE00BMD7ZB71` | Neuberger Berman Next Generation Connectivity Fund EUR A Accumulating Class - Unhedged | RV | 2026-04-22T09:30:25 | `ec3f711275bbf5f4` |
| `IE00BNG2T811` | Neuberger Berman Short Duration Euro Bond Fund EUR A Accumulating Class | RF | 2026-03-15T18:47:36 | `872f3ffbda8f43f4` |
| `IE00BYR8H148` | Jupiter Merian World Equity Fund L EUR Acc | RV | 2026-03-15T18:47:36 | `feda1a6d2afd7ce7` |
| `IE00BYVJR916` | Jupiter Gold & Silver Fund L EUR Acc | RV | 2026-04-22T16:52:35 | `45a5db9d3199f573` |
| `IE00BYX5NX33` | Fidelity MSCI World Index Fund EUR P Acc | RV | [object Object] | `8beba946b98daccf` |
| `IE00BYX5P602` | Fidelity MSCI World Index Fund EUR P Acc (Hedged) | RV | 2026-04-22T16:47:17 | `eb11328d8dfee731` |
| `IE00BZ18VT34` | BNY Mellon Global Infrastructure Income Fund EUR A Inc | RV | 2026-03-15T18:47:36 | `696bc3afd1b5a033` |
| `IE00BZ4D7648` | Polar Capital Funds PLC - Polar Capital Global Technology Fund R EUR Hedged Accumulation | RV | 2026-04-22T16:47:17 | `43b0b645f014c8d2` |
| `LU0011889846` | Janus Henderson Horizon Euroland Fund A2 EUR | RV | 2026-04-22T09:27:45 | `caa74bcd3e12dd39` |
| `LU0028119013` | Invesco Funds - Invesco Pan European Small Cap Equity Fund A Accumulation EUR | RV | 2026-04-22T16:43:51 | `9f11b213a88f3eb9` |
| `LU0034353002` | DWS Floating Rate Notes LC | RF | 2026-04-22T09:06:43 | `7137991e140afdb3` |
| `LU0072462186` | BlackRock Global Funds - European Value Fund A2 | RV | 2026-04-22T09:02:45 | `624ce4eea61a72df` |
| `LU0073229253` | Morgan Stanley Investment Funds - Asia Equity Fund A | RV | 2026-04-22T16:45:26 | `45f9e46acb6620a9` |
| `LU0073235904` | Morgan Stanley Investment Funds - Short Maturity Euro Bond Fund A | RF | [object Object] | `cf402cd825bd607f` |
| `LU0077500055` | Candriam Bonds Euro Long Term Class C EUR Cap | RF | 2026-03-15T18:47:36 | `277587b949fb5072` |
| `LU0080237943` | DWS Euro Ultra Short Fixed Income Fund NC | RF | [object Object] | `75332f8971a7f4f2` |
| `LU0084617165` | Robeco Asia-Pacific Equities D € | RV | 2026-04-22T16:42:40 | `2fa04361d5bd69fa` |
| `LU0086177085` | UBS (Lux) Bond Fund - Euro High Yield (EUR) P-acc | RF | 2026-04-22T16:56:48 | `5429a1c7778ec62c` |
| `LU0090845842` | BlackRock Global Funds - World Mining Fund E2 | RV | 2026-04-22T16:52:35 | `da1ccf35e3f2c577` |
| `LU0093583077` | Candriam Money Market Euro C Acc EUR | Monetario | 2026-04-22T09:25:32 | `64ee801e442305b2` |
| `LU0094557526` | MFS Meridian Funds - European Research Fund A1 EUR | RV | 2026-04-22T09:29:07 | `87eecf6375ce2ce3` |
| `LU0102219945` | Goldman Sachs Europe CORE Equity Portfolio Base Inc EUR | RV | 2026-03-15T18:47:36 | `e9f1480110a6d562` |
| `LU0102737730` | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund A Accumulation EUR | RF | 2026-03-15T18:47:36 | `da6f51c2255ce4bb` |
| `LU0102737904` | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund C Accumulation EUR | RF | 2026-03-15T18:47:36 | `55539f1524dc7ba9` |
| `LU0112467450` | Nordea 1 - Global Stable Equity Fund BP EUR | RV | [object Object] | `4e21c04abd00d42d` |
| `LU0113257694` | Schroder International Selection Fund EURO Corporate Bond A Accumulation EUR | RF | 2026-03-15T18:47:36 | `8c756ddb867d7098` |
| `LU0114722738` | Fidelity Funds - Global Financial Services Fund E-Acc-EUR | RV | 2026-03-15T18:47:36 | `5403e860bfce83bb` |
| `LU0114723033` | Fidelity Funds - Global Industrials Fund E-Acc-EUR | RV | [object Object] | `a3de47032ad7abfc` |
| `LU0115139569` | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR | RV | [object Object] | `d7059c37d67aa61a` |
| `LU0115141201` | Invesco Funds - Invesco Pan European Equity Fund E Accumulation EUR | RV | 2026-04-22T09:27:45 | `bb3cf9e47d95115b` |
| `LU0115143082` | Invesco Funds - Invesco Asia Opportunities Equity Fund E Accumulation EUR | RV | 2026-04-22T16:56:48 | `6d28e2ff4ee0910a` |
| `LU0115759606` | Fidelity Funds - America Fund E-Acc-EUR | RV | 2026-04-22T16:47:17 | `431095f14a6baaae` |
| `LU0115765678` | Fidelity Funds - Iberia Fund E-Acc-EUR | RV | 2026-04-22T09:27:45 | `ac119e0efef6db26` |
| `LU0115769746` | Fidelity Funds - World Fund E-Acc-EUR | RV | 2026-04-22T09:02:45 | `3b4c76a41dbc0b6e` |
| `LU0115773425` | Fidelity Funds - Global Technology Fund E-Acc-EUR | RV | 2026-03-15T18:47:36 | `6fecb11a1a038ac6` |
| `LU0117843481` | JPMorgan Funds - Taiwan Fund A (dist) - USD | RV | 2026-04-22T16:53:45 | `6be60d6b9a4f6276` |
| `LU0117843721` | JPMorgan Funds - Taiwan Fund D (acc) - USD | RV | 2026-04-22T16:49:36 | `b0ab8eded04bc852` |
| `LU0117858596` | JPMorgan Funds - Europe Equity Fund D (acc) - EUR | RV | 2026-04-22T16:47:17 | `818920006326772a` |
| `LU0117858679` | JPMorgan Funds - Europe Strategic Growth Fund D (acc) - EUR | RV | 2026-03-15T18:47:36 | `e560535fbae06dc6` |
| `LU0117858752` | JPMorgan Funds - Europe Strategic Value Fund D (acc) - EUR | RV | 2026-04-22T16:40:45 | `a9fc9d12b9cfd477` |
| `LU0117859560` | JPMorgan Funds - Europe Small Cap Fund D (acc) - EUR | RV | 2026-04-22T16:43:51 | `f8c778b0ef0fb975` |
| `LU0117884675` | JPMorgan Funds - Europe Dynamic Technologies Fund D (acc) - EUR | RV | 2026-04-22T16:39:15 | `40f9ccaa8558ab19` |
| `LU0119063039` | JPMorgan Funds - Europe Dynamic Fund D (acc) - EUR | RV | 2026-04-22T16:42:40 | `9bb3f7ab1c8ada75` |
| `LU0119620416` | Morgan Stanley Investment Funds - Global Brands Fund A | RV | [object Object] | `e8b051d5f3ebd51a` |
| `LU0119750205` | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund A Acc | RV | 2026-04-22T16:53:45 | `50ac75d103a2a3b8` |
| `LU0119753308` | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund E Acc | RV | 2026-04-22T16:40:45 | `21349b0677ec0b19` |
| `LU0121204431` | Goldman Sachs Global Sustainable Equity - X Cap EUR | RV | 2026-04-22T16:48:50 | `ad07fa916827b67b` |
| `LU0125951151` | MFS Meridian Funds - European Value Fund A1 EUR | RV | 2026-04-22T16:53:45 | `138904f125bc703a` |
| `LU0127786431` | Goldman Sachs Eurozone Equity Income - P Cap EUR | RV | 2026-04-22T16:41:48 | `65cbd9524d6fe7a8` |
| `LU0128521001` | Templeton European Insights Fund Class N (acc) EUR | RV | 2026-04-22T16:45:26 | `c12c4dc2691b54e0` |
| `LU0132601682` | Morgan Stanley Investment Funds - Euro Corporate Bond Fund A | RF | [object Object] | `9292bdebdae90d0d` |
| `LU0133264522` | Goldman Sachs Global Equity Income Portfolio E Acc EUR | RV | 2026-03-15T18:47:36 | `38e315e68df83363` |
| `LU0133267202` | Goldman Sachs Emerging Markets Equity Portfolio E Acc EUR | RV | 2026-04-22T09:29:07 | `599bd3a11d7c07e2` |
| `LU0133717503` | Schroder International Selection Fund EURO Corporate Bond A1 Accumulation EUR | RF | [object Object] | `2b4c8bd06dfd34a6` |
| `LU0137009238` | Vontobel Fund - Euro Short Term Bond C EUR Cap | RF | 2026-04-22T09:26:35 | `82adc75935bf156c` |
| `LU0144751095` | Candriam Bonds Euro High Yield Class N EUR Cap | RF | 2026-04-22T09:02:45 | `a6a8ae4ec1d8d646` |
| `LU0145656715` | DWS Invest ESG Euro Bonds (Short) NC | RF | [object Object] | `5a8716ed6aec5d76` |
| `LU0151324935` | Candriam Bonds Credit Opportunities Class N EUR Cap | RF | [object Object] | `d24394a6eee6ecf9` |
| `LU0153585137` | Vontobel Fund - European Equity B EUR Cap | RV | 2026-04-22T16:45:26 | `0b9a7fbac5aaeab6` |
| `LU0153925689` | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc | RV | [object Object] | `9b73eb4479b13b6a` |
| `LU0157179127` | JPMorgan Investment Funds - Global Select Equity Fund D (acc) EUR | RV | 2026-04-22T16:49:36 | `050bd1e683b8f946` |
| `LU0161304786` | Schroder International Selection Fund European Value A1 Accumulation EUR | RV | 2026-04-22T16:41:48 | `5bcf1e6863345cd4` |
| `LU0161305163` | Schroder International Selection Fund European Value A Accumulation EUR | RV | [object Object] | `328355bd7f94949d` |
| `LU0161305593` | Schroder International Selection Fund European Value B Accumulation EUR | RV | 2026-04-22T16:41:48 | `359ab92740f6d0a6` |
| `LU0162660350` | BlackRock Global Funds - Euro Corporate Bond Fund A1 | RF | [object Object] | `741ea90ce563c9e1` |
| `LU0165074666` | HSBC Global Investment Funds - Euroland Value AC | RV | 2026-04-22T16:40:45 | `ffc2f2b3c7664015` |
| `LU0165081950` | HSBC Global Investment Funds - Euroland Value EC | RV | 2026-04-22T16:40:45 | `c6277bb3d6c31b1a` |
| `LU0165520114` | Candriam Bonds Global Inflation Short Duration Class C EUR Cap | RF | 2026-03-15T18:47:36 | `890c9c40a8261d3d` |
| `LU0169250635` | Generali Investments SICAV - Euro Bond Fund EX | RF | 2026-03-15T18:47:36 | `185bd1179ae50512` |
| `LU0170293632` | Candriam Bonds Global High Yield Class N EUR Cap | RF | 2026-03-15T18:47:36 | `43355f694c504f6a` |
| `LU0170473374` | Franklin European Total Return Fund A(acc)EUR | RF | [object Object] | `bf49722d249a5220` |
| `LU0171275786` | BlackRock Global Funds - Emerging Markets Fund A2 (EUR) | RV | 2026-04-22T09:29:07 | `7143f7eeb4e70760` |
| `LU0171285587` | BlackRock Global Funds - Global Long-Horizon Equity Fund E2 (EUR) | RV | 2026-04-22T16:48:50 | `ffb05686d93bfe30` |
| `LU0171289902` | BlackRock Global Funds - Sustainable Energy Fund A2 (EUR) | RV | 2026-04-22T16:43:51 | `fdece264f53d546e` |
| `LU0171290074` | BlackRock Global Funds - Sustainable Energy Fund E2 (EUR) | RV | 2026-04-22T16:42:40 | `871cc8034ce61957` |
| `LU0171296949` | BlackRock Global Funds - US Flexible Equity Fund E2 (EUR) | RV | 2026-04-22T16:53:45 | `226fa431f9d2d97b` |
| `LU0171304552` | BlackRock Global Funds - World Energy Fund E2 (EUR) | RV | 2026-04-22T16:39:15 | `0f92395f29a94c25` |
| `LU0171304719` | BlackRock Global Funds - World Financials Fund A2 (EUR) | RV | 2026-04-22T16:41:48 | `de34b80548cbb052` |
| `LU0171305443` | BlackRock Global Funds - World Financials Fund E2 (EUR) | RV | 2026-04-22T16:41:48 | `6be9912bebee36fc` |
| `LU0171306680` | BlackRock Global Funds - World Gold Fund E2 (EUR) | RV | 2026-04-22T09:30:25 | `96eebc5397be3697` |
| `LU0171307068` | BlackRock Global Funds - World Healthscience Fund A2 (EUR) | RV | 2026-03-15T18:47:36 | `9882f4c977b6f4c2` |
| `LU0171309270` | BlackRock Global Funds - World Healthscience Fund E2 (EUR) | RV | 2026-04-22T16:39:15 | `0cdd8b5c51d45502` |
| `LU0172157280` | BlackRock Global Funds - World Mining Fund A2 (EUR) | RV | 2026-04-22T16:40:45 | `f41641c63135b6c1` |
| `LU0172157363` | BlackRock Global Funds - World Mining Fund E2 (EUR) | RV | 2026-04-22T16:53:45 | `67cdfe1dbe7488d2` |
| `LU0173779223` | Nordea 1 - Danish Covered Bond Fund BP EUR | RF | 2026-03-15T18:47:36 | `661f54d8e3e8cc00` |
| `LU0173782102` | Nordea 1 - Asia ex Japan Equity Fund BP EUR | RV | 2026-03-15T18:47:36 | `a784db74bff5c953` |
| `LU0177497491` | abrdn SICAV II-Euro Corporate Bond Fund A Acc EUR | RF | [object Object] | `01a077aa88e6780b` |
| `LU0181496216` | Schroder International Selection Fund Emerging Asia A1 Accumulation USD | RV | 2026-04-22T16:54:57 | `83bbc21feb4ddbf9` |
| `LU0184627536` | AXA World Funds - Switzerland Equity A Capitalisation EUR | RV | 2026-04-22T09:27:45 | `60937a70683e4b09` |
| `LU0187079347` | Robeco Global Consumer Trends D EUR | RV | 2026-04-22T09:29:07 | `462fc9bed06550e8` |
| `LU0188151921` | Templeton Emerging Markets Fund N(acc)EUR | RV | 2026-04-18T22:53:48 | `67b5adacf404451b` |
| `LU0200684180` | BlackRock Global Funds - Emerging Markets Bond Fund E2 (EUR) | RF | 2026-03-15T18:47:36 | `100cc9692a3df427` |
| `LU0201075453` | Janus Henderson Pan European Fund A2 EUR | RV | 2026-04-22T16:43:51 | `889ad4e893c8deac` |
| `LU0202403266` | Fidelity Active Strategy - FAST - Europe Fund A-ACC-EUR | RV | 2026-04-22T09:30:25 | `5ef4edff789dc1aa` |
| `LU0203975437` | Robeco BP Global Premium Equities D EUR | RV | 2026-04-22T09:02:45 | `0d8e4f03f8471eb3` |
| `LU0208853944` | JPMorgan Funds - Global Natural Resources Fund D (acc) - EUR | RV | 2026-04-22T16:41:48 | `3a4626c4a4193da1` |
| `LU0210531983` | JPMorgan Funds - Europe Strategic Value Fund A (acc) - EUR | RV | 2026-04-22T09:02:45 | `112938cb834f2e8c` |
| `LU0210536198` | JPMorgan Funds - US Growth Fund A (acc) - USD | RV | 2026-04-22T16:51:09 | `e9c54cc1d2e0f559` |
| `LU0212178916` | BNP Paribas Funds Europe Small Cap Classic Capitalisation | RV | 2026-04-22T16:41:48 | `3e5a5c6d7fa424db` |
| `LU0217139020` | Pictet-Premium Brands P EUR | RV | 2026-04-22T16:39:15 | `b1b363a97bc5e204` |
| `LU0217576833` | JPMorgan Funds - Emerging Markets Equity Fund D (acc) - EUR | RV | 2026-04-22T16:43:51 | `53a53638e0f9aa01` |
| `LU0224105477` | BlackRock Global Funds - Continental European Flexible Fund Class A2 | RV | 2026-04-22T16:53:45 | `d1b8ad69a8f8a7cf` |
| `LU0224105980` | BlackRock Global Funds - Continental European Flexible Fund E2 | RV | 2026-04-22T16:53:45 | `1d757fbf3f53aa98` |
| `LU0227385266` | Nordea 1 - Stable Return Fund E EUR | Mixto | [object Object] | `5d762b243ff12224` |
| `LU0229084990` | BlackRock Global Funds - European Equity Transition Fund A2 | RV | 2026-03-15T18:47:36 | `19b70539b44616c4` |
| `LU0231205856` | Franklin India Fund N(acc)EUR | RV | 2026-04-22T16:56:48 | `8a1b49c8b89a091a` |
| `LU0231490524` | abrdn SICAV I - Indian Equity Fund A Acc USD | RV | 2026-04-22T16:52:35 | `c90068ac39d695fc` |
| `LU0232524495` | AB - American Growth Portfolio A EUR Acc | RV | 2026-04-22T09:29:07 | `92739c9d8586bd19` |
| `LU0235308482` | Alken Fund - European Opportunities Class R | RV | 2026-04-22T16:53:45 | `e4002a61d8a196cb` |
| `LU0236738190` | Schroder International Selection Fund Japanese Equity B Accumulation EUR Hedged | RV | 2026-04-22T16:47:17 | `9e0f175da41b19a3` |
| `LU0243958393` | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR | RF | [object Object] | `e009d309f40b767c` |
| `LU0248167537` | Schroder International Selection Fund Global Equity Alpha A1 Accumulation EUR | RV | 2026-03-15T18:47:36 | `f5c075f36ac62619` |
| `LU0248168261` | Schroder International Selection Fund Global Equity Alpha B Accumulation EUR | RV | 2026-03-15T18:47:36 | `77307a4301bc5b5a` |
| `LU0248168428` | Schroder International Selection Fund Global Equity Alpha A Accumulation EUR | RV | 2026-03-15T18:47:36 | `e594c25b5272c16c` |
| `LU0248172537` | Schroder International Selection Fund Emerging Asia A Accumulation EUR | RV | 2026-04-22T16:42:40 | `311b2ae9963e4155` |
| `LU0248173006` | Schroder International Selection Fund Emerging Asia B Accumulation EUR | RV | 2026-04-22T16:42:40 | `3a6b665afdba9cd1` |
| `LU0248174152` | Schroder International Selection Fund Emerging Asia A1 Accumulation EUR | RV | 2026-04-22T16:42:40 | `78dd5f5c23008468` |
| `LU0248181363` | Schroder International Selection Fund Latin American A Accumulation EUR | RV | 2026-04-22T09:29:07 | `6cce4046192747c5` |
| `LU0248183815` | Schroder International Selection Fund Latin American B Accumulation EUR | RV | 2026-04-22T16:41:48 | `14528d9e43d5550a` |
| `LU0248183906` | Schroder International Selection Fund Asian Opportunities B Accumulation EUR | RV | 2026-04-22T09:30:25 | `49069a7b73f685da` |
| `LU0248184383` | Schroder International Selection Fund Latin American A1 Accumulation EUR | RV | 2026-04-22T16:41:48 | `a2885774915b0fec` |
| `LU0248184466` | Schroder International Selection Fund Asian Opportunities A Accumulation EUR | RV | 2026-04-22T16:43:51 | `d04fb75d7a5924b0` |
| `LU0251119078` | Fidelity Funds - Fidelity Target™ 2035 Fund A-Acc-EUR | RV | 2026-03-15T18:47:36 | `48e93aab77de0499` |
| `LU0251660279` | AXA World Funds - Euro Strategic Bonds E Capitalisation EUR | RF | 2026-03-15T18:47:36 | `3f62921f8e52cdd5` |
| `LU0251661590` | AXA World Funds - Euro Long Duration Bonds E Capitalisation EUR | RF | 2026-03-15T18:47:36 | `9b1e1bd3feba6fc2` |
| `LU0251807987` | BNP Paribas Funds Japan Small Cap Classic EUR Capitalisation | RV | 2026-04-22T16:42:40 | `2fdfd5fc87bf2754` |
| `LU0251853072` | AB SICAV I-International Health Care Portfolio Class A EUR Acc | RV | 2026-04-22T16:39:15 | `d2e614ac492adf5b` |
| `LU0252500524` | JPMorgan Funds - EUR Money Market VNAV Fund D (acc) - EUR | Monetario | 2026-04-22T09:02:45 | `adc519a0a0c7ea17` |
| `LU0252970834` | BlackRock Global Funds - European Equity Transition Fund A2 (USD) | RV | 2026-03-15T18:47:36 | `d7756f083a2e52c7` |
| `LU0254836850` | Robeco Capital Growth Funds - Robeco Emerging Stars Equities D EUR | RV | 2026-04-22T16:40:45 | `50fafad631fcd5eb` |
| `LU0256839860` | Allianz Global Investors Fund - Allianz Europe Equity Growth CT EUR | RV | 2026-04-22T16:54:57 | `4b9dce96d06fbb8e` |
| `LU0260085492` | Jupiter European Growth Class L EUR Acc | RV | 2026-04-22T09:27:45 | `b3117652aa938afe` |
| `LU0260869739` | Franklin U.S. Opportunities Fund A(acc)EUR | RV | 2026-04-22T09:30:25 | `6f7e4123cb7842aa` |
| `LU0261948227` | Fidelity Funds - Germany Fund A-Acc-EUR | RV | 2026-04-22T16:41:48 | `29b7dee7ba8f85ac` |
| `LU0261951957` | FF - Global Dividend Plus Fund A-Acc-EUR | RV | 2026-03-15T18:47:36 | `70742805a051fedc` |
| `LU0261952682` | Fidelity Funds - Euro 50 Index Fund A-Acc-EUR | RV | 2026-04-22T16:47:17 | `fa75966885f6f3ab` |
| `LU0267388220` | Fidelity Funds - Euro Short Term Bond Fund A-Acc-EUR | RF | 2026-03-15T18:47:36 | `7b1831e7e6848c2c` |
| `LU0267984697` | Invesco Funds - Invesco India Equity Fund E Accumulation EUR | RV | 2026-04-22T16:56:48 | `ac8cdca35df22935` |
| `LU0270905242` | Pictet-Security R EUR | RV | 2026-04-22T16:39:15 | `7d02e28ca090504c` |
| `LU0273148055` | DWS Invest Gold and Precious Metals Equities NC | RV | 2026-04-22T07:50:00 | `fd805c7bf09929af` |
| `LU0273159177` | DWS Invest Gold and Precious Metals Equities LC | RV | 2026-04-22T16:56:48 | `0559cc8bc6084a87` |
| `LU0273690064` | Goldman Sachs Asia Equity Growth & Income - P Cap EUR | RV | 2026-04-22T16:41:48 | `c9a1668990a1f845` |
| `LU0275692696` | Fidelity Funds - American Growth Fund A-Acc-EUR | RV | 2026-03-15T18:47:36 | `8d5ea126d0ab7156` |
| `LU0279459456` | Schroder International Selection Fund Global Emerging Market Opportunities A Accumulation EUR | RV | 2026-04-22T16:42:40 | `3b9da019799ce763` |
| `LU0279460892` | Schroder International Selection Fund Global Smaller Companies A1 Accumulation | RV | 2026-04-22T16:51:09 | `e0548028469ccdbe` |
| `LU0280435388` | Pictet - Clean Energy Transition P EUR | RV | 2026-04-22T16:43:51 | `6387bd3e3a53e6c6` |
| `LU0280435461` | Pictet-Clean Energy Transition R EUR | RV | 2026-04-22T16:42:40 | `8938de58a542b587` |
| `LU0282719219` | CT (Lux) - Pan European Small Cap Opportunities Class AE (EUR Accumulation Shares) | RV | 2026-04-22T16:45:26 | `98682c3674d2e796` |
| `LU0289089384` | JPMorgan Funds - Europe Equity Plus Fund A (perf) (acc) - EUR | RV | 2026-04-22T09:29:07 | `23237fe88dbfaea6` |
| `LU0289214628` | JPMorgan Funds - Europe Equity Plus Fund D (perf) (acc) - EUR | RV | 2026-04-22T09:24:28 | `b08866b5da998dec` |
| `LU0293313325` | Allianz Global Investors Fund - Allianz GEM Equity High Dividend AT EUR | RV | 2026-04-22T16:43:51 | `e8f87a3cb02070fe` |
| `LU0293313671` | Allianz Global Investors Fund - Allianz GEM Equity High Dividend CT EUR | RV | 2026-04-22T16:43:51 | `6e85a40d00dd3a66` |
| `LU0294249692` | Carmignac Portfolio Grande Europe E EUR Acc | RV | 2026-04-22T16:42:40 | `541c327c9f046340` |
| `LU0300507208` | Generali Investments SICAV - Euro Future Leaders EX | RV | 2026-04-22T09:06:43 | `1e4e44fb7ed77e79` |
| `LU0300741732` | Franklin Natural Resources Fund A(acc)EUR | RV | 2026-04-22T16:56:48 | `a2a45db34f17f67f` |
| `LU0302445910` | Schroder International Selection Fund Global Climate Change Equity A Accumulation | RV | 2026-04-22T16:54:57 | `1c5cf85118fdc85e` |
| `LU0302446645` | Schroder International Selection Fund Global Climate Change Equity A Accumulation | RV | 2026-03-15T18:47:36 | `d2a698e92f13291c` |
| `LU0302446991` | Schroder International Selection Fund Global Climate Change Equity B Accumulation | RV | 2026-03-15T18:47:36 | `9d28703806433790` |
| `LU0309468980` | Nordea 1 - Latin American Equity Fund E EUR | RV | [object Object] | `996d6e66b8521622` |
| `LU0313923228` | BlackRock Strategic Funds - European Opportunities Extension Fund A2 EUR | RV | 2026-04-22T09:02:45 | `61445599256a7064` |
| `LU0318931192` | Fidelity Funds - China Focus Fund A-Acc-EUR | RV | 2026-03-15T18:47:36 | `4ab5d17062bd3791` |
| `LU0320896664` | Robeco BP US Premium Equities DH € | RV | 2026-04-22T16:47:17 | `22ffaded7b5e5303` |
| `LU0321373184` | Schroder International Selection Fund European Dividend Maximiser B Distribution | RV | [object Object] | `04dfc9dfb5b265c6` |
| `LU0323041763` | Digital Funds Stars Europe R | RV | 2026-04-22T09:06:43 | `0ba41c840c56567b` |
| `LU0326425351` | BlackRock Global Funds - World Mining Fund E2 EUR Hedged | RV | 2026-04-22T16:52:35 | `ce75c4d3d90d7050` |
| `LU0329070915` | Jupiter India Select Class L EUR Acc | RV | 2026-03-15T18:47:36 | `b85d48937a74dea7` |
| `LU0329203656` | JPM Global Dividend D (acc) - EUR (hedged) | RV | 2026-04-22T16:45:26 | `52dc054c165bef0c` |
| `LU0329206832` | JPMorgan Investment Funds - Japan Strategic Value Fund D (acc) - EUR | RV | 2026-04-22T16:41:48 | `dd1fa1a731c3f223` |
| `LU0329355670` | Robeco QI Emerging Markets Active Equities D € | RV | 2026-04-22T09:32:56 | `4af178a1dcf221af` |
| `LU0329430986` | GAM Multistock - Luxury Brands Equity EUR E | RV | 2026-04-22T09:32:56 | `c63a913a3ae6727c` |
| `LU0329678410` | Fidelity Funds - Emerging Asia Fund A-Acc-EUR | RV | 2026-04-22T16:42:40 | `3462d860d138c098` |
| `LU0331286574` | BlackRock Global Funds - Sustainable Energy Fund C2 (EUR) | RV | 2026-04-22T16:43:51 | `4d2651e75846bf15` |
| `LU0333810850` | Goldman Sachs India Equity Portfolio E Acc EUR | RV | 2026-04-22T16:39:15 | `a32692714cc1c1d6` |
| `LU0340559557` | Pictet-Timber P EUR | RV | 2026-04-22T16:52:35 | `8816026b97b5cb5a` |
| `LU0345361124` | Fidelity Funds - Asia Pacific Opportunities Fund A-Acc-EUR | RV | 2026-04-22T09:29:07 | `9c8709103b2a97cb` |
| `LU0348529792` | Fidelity Active Strategy - FAST - Europe Fund E-ACC-EUR | RV | 2026-04-22T09:29:07 | `fb8a8eca3fd3f2ab` |
| `LU0348784041` | Allianz Global Investors Fund - Allianz Oriental Income AT EUR | RV | 2026-04-22T09:29:07 | `8f0bd52103d40103` |
| `LU0348926287` | Nordea 1 - Global Climate and Environment Fund BP EUR | RV | 2026-04-18T15:31:26 | `cbc75a8481467e8d` |
| `LU0348927251` | Nordea 1 - Global Climate and Environment Fund E EUR | RV | 2026-04-22T16:40:45 | `0ff71d6de39958a5` |
| `LU0353647737` | Fidelity Funds - European Dividend Fund A-Acc-EUR | RV | [object Object] | `51c855704f534482` |
| `LU0353649352` | Fidelity Funds - Global Inflation-linked Bond Fund E-Acc-EUR (hedged) | RF | 2026-03-15T18:47:36 | `60972b84a5d70ac2` |
| `LU0365089902` | Jupiter India Select Class L USD A Inc | RV | 2026-04-22T16:54:57 | `8ec10a88ceae23e6` |
| `LU0365775922` | Schroder International Selection Fund Greater China A Accumulation EUR | RV | 2026-04-22T16:42:40 | `bef1d0194e1d7817` |
| `LU0368678339` | Fidelity Funds - Pacific Fund A-Acc-EUR | RV | 2026-04-22T16:48:50 | `6c18c614aab386bf` |
| `LU0384381660` | Morgan Stanley Investment Funds - QuantActive Global Infrastructure Fund A | RV | 2026-04-22T09:29:07 | `16b5f127b78ff385` |
| `LU0387754996` | Robeco Global Stars Equities D EUR | RV | 2026-04-22T16:45:26 | `43bab859e356a2b7` |
| `LU0391944815` | Pictet-Global Megatrend Selection R EUR | RV | [object Object] | `cf87a94a3f59d6e9` |
| `LU0399356780` | DWS Invest Latin American Equities LC | RV | 2026-04-22T16:40:45 | `ab1556f58f89bb5c` |
| `LU0413376566` | BlackRock Global Funds - Emerging Markets Bond Fund A2 Hedged | RF | 2026-04-22T09:24:28 | `a9ebf0261bd4b9d2` |
| `LU0413543058` | Fidelity Funds - Japan Value Fund A-Acc-EUR | RV | 2026-04-22T16:41:48 | `0cc3795826e9e705` |
| `LU0415391431` | Bellevue Funds (Lux) - Bellevue Medtech & Services B EUR | RV | 2026-03-15T18:47:36 | `9a57defa90150426` |
| `LU0425308169` | BlackRock Global Funds - Global Inflation Linked Bond Fund A2 EUR Hedged | RF | 2026-03-15T18:47:36 | `36413914ffdf1206` |
| `LU0430492750` | JPMorgan Funds - Euro Aggregate Bond Fund C (acc) - EUR | RF | 2026-04-22T16:49:36 | `eec61e2c34b7c225` |
| `LU0438336694` | BlackRock ESG Fixed Income Strategies Fund E2 EUR | RF | 2026-04-22T09:32:56 | `43990cc90b42f462` |
| `LU0447425785` | SIH FCP - Short Term EUR A Classic | RF | [object Object] | `fa41f0ab073c40b7` |
| `LU0455556406` | UBS (Lux) Bond SICAV - Global Inflation-linked (USD) (EUR hedged) P-acc | Monetario | 2026-03-15T18:47:36 | `98ab9985f201fb3c` |
| `LU0469270010` | AB - Asia Ex-Japan Equity Portfolio C EUR Acc | RV | 2026-04-22T09:06:43 | `e30dc3f07fcb0769` |
| `LU0491217419` | Robeco Indian Equities D € | RV | 2026-03-15T18:47:36 | `1960590ed95607ba` |
| `LU0496368142` | Franklin Gold & Precious Metals Fund A(acc)EUR-H1 | RV | 2026-04-22T09:27:45 | `1222c2a4fbd73ef0` |
| `LU0496369389` | Franklin Gold & Precious Metals Fund N(acc)EUR | RV | 2026-04-22T16:52:35 | `07d4de8f620ed7b4` |
| `LU0501220429` | Global Evolution Funds Frontier Markets R EUR | RF | 2026-04-22T16:56:48 | `af7e1bb8b7ba7f03` |
| `LU0503631714` | Pictet - Global Environmental Opportunities P EUR | RV | 2026-03-15T18:47:36 | `0f8e09d8c8b3c8fc` |
| `LU0522352516` | JPMorgan Funds - India Fund D (acc) - EUR | RV | 2026-04-22T16:56:48 | `2a88c66709befe2b` |
| `LU0524465548` | Alken Fund - Small Cap Europe Class A | RV | 2026-04-22T09:06:43 | `2d6cab9cf58b2a78` |
| `LU0524465977` | Alken Fund - European Opportunities Class A | RV | 2026-04-22T16:53:45 | `28683556021d9542` |
| `LU0546917344` | Goldman Sachs Euro Long Duration Bond - P Cap EUR | RF | 2026-03-15T18:47:36 | `6bfd99ffdbf732e5` |
| `LU0552029406` | Amundi Funds - Latin America Equity A EUR (C) | RV | 2026-04-22T16:40:45 | `d76e198b3d985c4e` |
| `LU0552029661` | Amundi Funds - Latin America Equity G EUR (C) | RV | 2026-04-22T16:40:45 | `bcd1075feb751e01` |
| `LU0552385295` | Morgan Stanley Investment Funds - Global Opportunity Fund A | RV | 2026-04-22T16:47:17 | `36e5dd3fcdabb351` |
| `LU0554840230` | Robeco Global Consumer Trends Equities M € | RV | 2026-04-22T16:39:15 | `32014e22bb1e570b` |
| `LU0563745743` | Bestinver Tordesillas SICAV Iberia A | RV | 2026-04-22T16:40:45 | `2eb4d4ff03ec1002` |
| `LU0565136552` | First Eagle Amundi International Fund Class FE-C Shares | Mixto | 2026-03-15T18:47:36 | `cbad97fd2f378731` |
| `LU0568583420` | Amundi Funds - Equity Japan Target A EUR (C) | RV | [object Object] | `81beaa0b197f3621` |
| `LU0568620727` | Amundi Funds - Cash EUR G2 EUR (C) | Monetario | 2026-04-22T16:53:45 | `2b853cf4f0ab8c3b` |
| `LU0569862609` | UBAM - Global High Yield Solution AHC EUR | RF | 2026-03-15T18:47:36 | `19fed34f0e6fe714` |
| `LU0570870567` | CT (Lux) - Global Smaller Companies AE (EUR Accumulation Shares) | RV | 2026-04-22T16:47:17 | `6ae05d8017d112e6` |
| `LU0571101558` | Groupama Euro High Yield NC | RF | [object Object] | `01821e0503619aab` |
| `LU0594300096` | Fidelity Funds - China Consumer Fund A-Acc-EUR | RV | 2026-04-22T09:29:07 | `7e58e2c49ee8c9a9` |
| `LU0594539719` | Candriam Bonds Emerging Markets Class C EUR Hedged Cap | RF | 2026-04-22T09:24:28 | `1864bb0e119e129e` |
| `LU0602539867` | Nordea 1 - Emerging Sustainable Stars Equity Fund BP EUR | RV | 2026-04-22T16:47:17 | `29f6bf3577a63f6b` |
| `LU0604766674` | Allianz Global Investors Fund - Allianz Global Metals and Mining AT EUR | RV | 2026-04-22T16:40:45 | `386473fa4fefc33d` |
| `LU0607512935` | Invesco Funds - Invesco Developed Small and Mid-Cap Equity Fund E Accumulation | RV | 2026-04-22T16:48:50 | `c137f93bbf40f9a9` |
| `LU0607513586` | Invesco Funds - Invesco Global Equity Income Fund E Accumulation EUR | RV | 2026-04-22T09:13:41 | `6f09e34c6f9c610d` |
| `LU0616839501` | DWS Invest Euro High Yield Corporates LC | RF | 2026-04-22T16:56:48 | `58e680cc90c92068` |
| `LU0616856935` | DWS Invest Brazilian Equities LC | RV | 2026-04-22T16:40:45 | `8a27a59d4c5f372b` |
| `LU0616857313` | DWS Invest Brazilian Equities NC | RV | 2026-04-22T09:30:25 | `847f5546b88c2cd3` |
| `LU0628612748` | BlackRock Global Funds - European Equity Income Fund E2 | RV | 2026-04-22T16:39:15 | `7d42da27b03b7c06` |
| `LU0630951415` | Fidelity Funds - Emerging Asia Fund E-Acc-EUR | RV | 2026-04-22T16:48:50 | `ae61d6663176c331` |
| `LU0631859229` | Bellevue Funds (Lux) - Bellevue Entrepreneur Europe Small B EUR | RV | 2026-04-22T09:30:25 | `20abf33db7803e35` |
| `LU0637302547` | Nordea 1 - Emerging Market Corporate Bond Fund BP EUR | RF | 2026-03-15T18:47:36 | `1c26924b5617a5f1` |
| `LU0637335638` | Nordea 1 - Indian Equity Fund BP EUR | RV | 2026-04-22T16:54:57 | `31160468948e134a` |
| `LU0658026512` | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E Capitalisation EUR | RF | 2026-04-22T09:26:35 | `de9d9f8cd6d71ca8` |
| `LU0661986348` | JPMorgan Funds - Euroland Dynamic Fund D (perf) (acc) - EUR | RV | 2026-04-22T16:41:48 | `997c3406e6bdde76` |
| `LU0690375182` | Fundsmith Equity Fund T EUR Acc | RV | [object Object] | `d12674ab08b2f132` |
| `LU0702159772` | Fidelity Funds - Asian Smaller Companies Fund A-Acc-EUR | RV | 2026-04-22T16:45:26 | `8b30344ac945c9b1` |
| `LU0704154706` | RAM (Lux) Systematic Funds - Emerging Markets Equities O EUR | RV | 2026-04-22T09:06:43 | `e0d8f60245be057a` |
| `LU0706127809` | UBS (Lux) Bond SICAV - Global Short Term Flexible (USD) (EUR hedged) P-acc | RF | 2026-03-15T18:47:36 | `4846e5ea8e9d61d1` |
| `LU0712123511` | Morgan Stanley Investment Funds - Global Fixed Income Opportunities Fund AH (EUR) | RF | [object Object] | `b589ebb18ff76849` |
| `LU0733673288` | Nordea 1 - European Cross Credit Fund BP EUR | RF | [object Object] | `ce0eb9b1c11b233b` |
| `LU0766123821` | Fidelity Funds - China Focus Fund E-Acc-EUR | RV | 2026-03-15T18:47:36 | `9ef0b65b3528d39a` |
| `LU0769137737` | BlackRock Global Funds - Continental European Flexible Fund Class A2 (USD) | RV | 2026-04-22T16:54:57 | `5075d50c04f8a905` |
| `LU0772958525` | Nordea 1 - North American Sustainable Stars Equity Fund BP USD | RV | 2026-04-22T16:54:57 | `58afb787ce2f0807` |
| `LU0795636256` | Schroder International Selection Fund Emerging Markets Hard Currency A Accumulation EUR Hedged | RF | 2026-03-15T18:47:36 | `13782075769d3228` |
| `LU0813337002` | DWS Invest Latin American Equities NC | RV | 2026-04-22T09:06:43 | `187b486d72d8235b` |
| `LU0815263628` | Morgan Stanley Investment Funds - Emerging Leaders Equity Fund A | RV | 2026-04-22T16:45:26 | `98f450680e83014c` |
| `LU0823411706` | BNP Paribas Funds Consumer InnovatorsClassic Capitalisation | RV | 2026-04-22T09:30:25 | `6d37b8f589bf0d32` |
| `LU0823421689` | BNP Paribas Funds Disruptive Technology Classic Capitalisation | RV | 2026-04-22T09:32:56 | `42b68b254e8b3fe6` |
| `LU0826452848` | DWS Invest II Global Equity High Conviction Fund LC | RV | 2026-04-22T16:43:51 | `bfe746c3347fefde` |
| `LU0826453226` | DWS Invest II Global Equity High Conviction Fund NC | RV | 2026-04-22T09:13:41 | `f0844b861719ad42` |
| `LU0849399786` | Schroder International Selection Fund EURO High Yield A Accumulation | RF | 2026-03-15T18:47:36 | `f370109b6236dcda` |
| `LU0857700040` | Fidelity Funds - European Dividend Fund A-MINCOME(G)-EUR | RV | 2026-04-22T09:02:45 | `141e77c579332967` |
| `LU0861897477` | Abante Global Funds Spanish Opportunities Class B | RV | 2026-04-22T16:53:45 | `10d51b1399556dfa` |
| `LU0862450516` | JPMorgan Funds - Emerging Markets Dividend Fund D (acc) - EUR | RV | 2026-04-22T16:43:51 | `fffffcd4683f6787` |
| `LU0910636546` | Goldman Sachs Emerging Markets Debt Blend Portfolio Other Currency Acc EUR | RF | 2026-03-15T18:47:36 | `5126c19dde0af8ef` |
| `LU0910636892` | Goldman Sachs Emerging Markets Debt Blend Portfolio E Acc EUR | RF | [object Object] | `98b8f0fb454fd8a8` |
| `LU0918140210` | T. Rowe Price Funds SICAV - US Smaller Companies Equity Fund A (EUR) | RV | 2026-04-22T09:30:25 | `a923f8a49fa48330` |
| `LU0922333322` | Fidelity Funds - Italy Fund A-Acc-EUR | RV | 2026-04-22T09:27:45 | `7ba792982bdee84a` |
| `LU0926439992` | Vontobel Fund - Emerging Markets Debt H (hedged) EUR Cap | RF | [object Object] | `2c05b8fdfe9b7fa1` |
| `LU0933684101` | Incometric Equam Global Value A | RV | 2026-04-22T09:27:45 | `55b8cff5f940005c` |
| `LU0935222900` | Natixis AM Funds - Ostrum Euro Inflation R/A (EUR) | RF | 2026-03-15T18:47:36 | `5f69aa6d2695470e` |
| `LU0935230242` | Natixis AM Funds - Ostrum Europe MinVol RE/A (EUR) | RV | 2026-04-22T09:27:45 | `3fcd627233c6061a` |
| `LU0940719098` | UBAM - Global High Yield Solution RHC EUR | RF | 2026-03-15T18:47:36 | `0795519af7d993a3` |
| `LU0986194024` | SIH FCP - Equity Europe A Classic | RV | 2026-04-22T09:16:33 | `9b59895724145c7a` |
| `LU0995119665` | Schroder International Selection Fund EURO Credit Conviction A Accumulation EUR | RF | 2026-03-15T18:47:36 | `9ace7270aa8492df` |
| `LU0995119749` | Schroder International Selection Fund EURO Credit Conviction B Accumulation EUR | RF | [object Object] | `de7af98078142259` |
| `LU1021288268` | AB - Mortgage Income Portfolio A2 EUR Acc | RF | 2026-04-22T16:51:09 | `4e34475d03d3a4a7` |
| `LU1022658667` | Franklin Euro Short Duration Bond Fund A(acc)EUR | RF | [object Object] | `1819fbd7007db324` |
| `LU1066281574` | SIH FCP - Equity Spain A Classic | RV | 2026-04-22T09:24:28 | `2c560de288db57b1` |
| `LU1079477284` | Allianz Emerging Markets Short Duration Bond AT (H2-EUR) | RF | 2026-03-15T18:47:36 | `79eed1ce4780e7ea` |
| `LU1080015693` | Edmond de Rothschild Fund - Emerging Credit A EUR Hedged | RF | [object Object] | `66e3a4940b90d079` |
| `LU1088692675` | UBAM - Global Equity AC EUR | RV | 2026-03-15T18:47:36 | `6df57e20f553059f` |
| `LU1089088741` | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT EUR | RF | 2026-03-15T18:47:36 | `e55e36b8ca8dec56` |
| `LU1103303167` | Edmond de Rothschild Fund - US Value A EUR | RV | 2026-04-22T16:54:57 | `35565254b302ea23` |
| `LU1111642820` | Eleva European Selection A2 EUR acc | RV | 2026-04-22T09:06:43 | `b28885c14a4a9ecb` |
| `LU1120766388` | Candriam Equities L Biotechnology Class C EUR Cap | RV | 2026-04-22T16:41:48 | `deccade53cabd99f` |
| `LU1161086159` | Amundi Funds - Emerging Markets Blended Bond A EUR (C) | RF | [object Object] | `8845f5e8d263960e` |
| `LU1161526576` | Edmond de Rothschild Fund - Bond Allocation R EUR Acc | RF | 2026-04-22T09:16:33 | `e58fd35ec8aa15c9` |
| `LU1164219682` | AXA World Funds - Euro Credit Total Return A Capitalisation EUR | RF | [object Object] | `36eba22e26a2e9ed` |
| `LU1164220854` | AXA World Funds - Euro Credit Total Return E Capitalisation EUR | RF | [object Object] | `74da46baa6608c63` |
| `LU1165644672` | IVO Funds - IVO Emerging Markets Corporate Debt EUR R Acc | RF | [object Object] | `21b11e927e112764` |
| `LU1206943596` | Fidelity Active Strategy - FAST - Emerging Markets Fund A-ACC-EUR | RV | 2026-04-22T16:40:45 | `2b489605cf133dad` |
| `LU1213836080` | Fidelity Funds - Global Technology Fund A-Acc-EUR | RV | 2026-04-22T09:30:25 | `eda28cf9a67dfa18` |
| `LU1223083087` | Schroder International Selection Fund Global Gold A Accumulation EUR Hedged | RV | 2026-04-22T09:27:45 | `07d4d5abd6311a62` |
| `LU1223084051` | Schroder International Selection Fund Global Gold A Accumulation PLN Hedged | RV | 2026-04-22T09:29:07 | `58db00119fa3c8d6` |
| `LU1244893696` | Edmond de Rothschild Fund - Big Data A-EUR accumulating | RV | 2026-04-22T16:54:57 | `41ebca8d5a5c267a` |
| `LU1244895394` | Edmond de Rothschild Fund - Big Data R EUR | RV | 2026-04-22T09:32:56 | `acbd773ca0c65183` |
| `LU1254412460` | abrdn SICAV I - Indian Bond Fund A Acc EUR | RF | 2026-04-22T16:58:44 | `02c45aee46871caa` |
| `LU1279334483` | Pictet - Robotics R EUR | RV | 2026-04-22T16:54:57 | `d39f10848f0b1bb1` |
| `LU1295551144` | Capital Group New Perspective Fund (LUX) B (EUR) | RV | 2026-04-22T16:51:09 | `e9ec2064f7ab53d1` |
| `LU1298174530` | CT (Lux) - Global Multi Asset Income Class AE (EUR Accumulation Shares) | Mixto | 2026-03-15T18:47:36 | `e02d468534eabcbb` |
| `LU1299306321` | Carmignac Portfolio Sécurité AW EUR Acc | RF | [object Object] | `9844c60404619c7f` |
| `LU1299311164` | Carmignac Portfolio Investissement A EUR Acc | RV | 2026-04-22T16:42:40 | `b6d0e371e3b3f178` |
| `LU1299311834` | Carmignac Portfolio Investissement E EUR Acc | RV | 2026-04-22T16:48:50 | `6736bf9bf2b415a8` |
| `LU1301026388` | Sycomore Fund SICAV - Sycomore Europe Happy@Work RC EUR | RV | 2026-04-22T09:06:43 | `e1ea24deeefe9029` |
| `LU1321847805` | BlackRock Strategic Funds - Emerging Markets Equity Strategies Fund E2 EUR | RV | 2026-04-22T09:30:25 | `42f35128179e0415` |
| `LU1330191542` | Magallanes Value Investors UCITS European Equity R EUR | RV | [object Object] | `1047edc793c98e01` |
| `LU1333148903` | Azvalor Lux SICAV Azvalor International R | RV | 2026-04-22T16:42:40 | `7b29b185fc8ffaae` |
| `LU1340702932` | MFS Meridian Funds - Global Opportunistic Bond Fund A1 EUR | RF | 2026-04-22T09:26:35 | `cce94f51f881fdf3` |
| `LU1353951376` | AXA World Funds - Global Inflation Short Duration Bonds E Capitalisation EUR (Hedged) | RF | 2026-03-15T18:47:36 | `25870c1ef041e1d8` |
| `LU1362999481` | Robeco High Yield Bonds D € | RF | 2026-04-22T09:26:35 | `4368cf4aa04bfa80` |
| `LU1372006947` | Cobas LUX SICAV - Cobas Selection Fund Class P Acc EUR | RV | 2026-04-22T16:48:50 | `099508984a463b2d` |
| `LU1373035234` | BlackRock Strategic Funds - BSF Systematic Style Factor Fund E2 EUR Hedged | Alternativos | 2026-03-15T18:47:36 | `b04a06078778d3f5` |
| `LU1378878430` | Morgan Stanley Investment Funds - Asia Opportunity Fund A | RV | 2026-04-22T16:54:57 | `c1fb804211e3fa7b` |
| `LU1383852487` | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT2 EUR | RF | 2026-03-15T18:47:36 | `57c4a076a2cf9c9d` |
| `LU1391767586` | Fidelity Funds - Global Financial Services Fund A-Acc-EUR | RV | 2026-04-22T09:29:07 | `68f1d72c90ebc51c` |
| `LU1481179858` | Capital Group New World Fund (LUX) B (EUR) | RV | 2026-03-15T18:47:36 | `11457897ff303b9d` |
| `LU1481583711` | Flossbach von Storch - Bond Opportunities RT | RF | [object Object] | `12542ad10da29cc7` |
| `LU1486845537` | ODDO BHF Euro Credit Short Duration CR-EUR | RF | 2026-04-22T09:02:45 | `acb4c5ef559e47cc` |
| `LU1499628912` | Amundi S.F. - Diversified Short-Term Bond Select E EUR ND | RF | 2026-03-15T18:47:36 | `717538e6d89d472f` |
| `LU1529955046` | Eurizon Fund - Bond Aggregate RMB Class R EUR Acc | RF | 2026-04-22T09:27:45 | `f2fa30ca209e0e8f` |
| `LU1542714578` | Goldman Sachs Europe Sustainable Equity - X Cap EUR | RV | 2026-04-22T09:13:41 | `d7c52741c9b59909` |
| `LU1548496022` | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 15 AT EUR | Mixto | 2026-03-15T18:47:36 | `4e9bb0e9e1d1cecc` |
| `LU1548497699` | Allianz Global Investors Fund - Allianz Global Artificial Intelligence AT EUR | RV | 2026-04-22T16:51:09 | `61464af6304089f9` |
| `LU1578889864` | Ninety One Global Strategy Fund - Global Gold Fund A Acc EUR Hedged(Reference) | RV | 2026-04-22T09:30:25 | `8b064e3c0f9d0d9b` |
| `LU1582984149` | M&G (Lux) European Inflation Linked Corporate Bond Fund EUR A Acc | RF | 2026-03-15T18:47:36 | `2b864b877e6e2df7` |
| `LU1582988306` | M&G (Lux) Dynamic Allocation Fund EUR B Acc | Mixto | 2026-04-22T09:26:35 | `6a9b970a91075016` |
| `LU1623762843` | Carmignac Pf Credit A EUR Acc | RF | 2026-04-22T09:24:28 | `6575a97d1f05c415` |
| `LU1665237704` | M&G (Lux) Global Listed Infrastructure Fund EUR A Acc | RV | 2026-04-22T09:29:07 | `2d94daa257748d4d` |
| `LU1670618187` | M&G (Lux) Asian Fund EUR A Acc | RV | 2026-04-22T16:41:48 | `48a3ca363dc74f7a` |
| `LU1670618690` | M&G (Lux) Global Emerging Markets Fund EUR A Acc | RV | 2026-04-22T16:41:48 | `8fb7c62203c120f6` |
| `LU1670626446` | M&G (Lux) Japan Fund EUR A Acc | RV | 2026-04-22T16:43:51 | `b2ea67edd0f54de2` |
| `LU1670631016` | M&G (Lux) Emerging Markets Bond Fund EUR A Acc | RF | 2026-03-15T18:47:36 | `afbf9d16d30c2a98` |
| `LU1670631289` | M&G (Lux) Emerging Markets Bond Fund EUR A-H Acc | RF | 2026-03-15T18:47:36 | `ee7f84766080a16a` |
| `LU1670707527` | M&G (Lux) European Strategic Value Fund EUR A Acc | RV | 2026-04-22T16:40:45 | `03b644b53fe4982f` |
| `LU1670710075` | M&G (Lux) Global Dividend Fund EUR A Acc | RV | 2026-04-22T16:45:26 | `0ec8cd29db357778` |
| `LU1670715975` | M&G (Lux) Japan Smaller Companies Fund EUR A Acc | RV | 2026-04-22T16:51:09 | `f195825d364e16fe` |
| `LU1670718219` | M&G (Lux) Short Dated Corporate Bond Fund EUR A Acc | RF | 2026-03-15T18:47:36 | `9c40e47aff6c4cef` |
| `LU1670722161` | M&G (Lux) Global Floating Rate High Yield Fund EUR A-H Acc | RF | 2026-04-22T16:58:44 | `4533b54517e72c45` |
| `LU1670724373` | M&G (Lux) Optimal Income Fund EUR A Acc | Mixto | 2026-04-22T16:45:26 | `4fa95ad6de5a56b6` |
| `LU1679113404` | UBS (Lux) Bond SICAV - Floating Rate Income (USD) (EUR hedged) P-acc | RF | 2026-03-15T18:47:36 | `86c613f6a08474cd` |
| `LU1694212348` | Nordea 1 - Low Duration European Covered Bond Fund BP EUR | RF | 2026-04-22T16:58:44 | `ae37580cb7ecf7cc` |
| `LU1694789451` | DNCA Invest Alpha Bonds A EUR | RF | [object Object] | `183d7efdc84cbe9a` |
| `LU1697013008` | SIH FCP - Flexible Fixed Income USD | RF | [object Object] | `a81ce525f615037a` |
| `LU1697016365` | Sigma Investment House FCP - Selection Defensive Class A EUR | Mixto | 2026-03-15T18:47:36 | `d6cca067b2e19ed2` |
| `LU1706854152` | Amundi S.F. - Diversified Short-Term Bond Select A EUR ND | RF | 2026-04-22T16:52:35 | `fa1edbc30a1fd924` |
| `LU1717592262` | Groupama Global Inflation Short Duration NC | Monetario | 2026-03-15T18:47:36 | `f3dba59944a9ffb2` |
| `LU1738492658` | Aviva Investors - Short Duration Global High Yield Bond Fund Ah EUR Acc | RF | 2026-03-15T18:47:36 | `36066bc452e7ea81` |
| `LU1740985814` | DWS Strategic Allocation Dynamic LD | Mixto | 2026-03-15T18:47:36 | `377805d3ba523ff6` |
| `LU1762221155` | Invesco Funds - Invesco Global Founders & Owners Fund E Accumulation EUR | RV | 2026-04-22T09:13:41 | `f09e12e6fdace1f7` |
| `LU1775950477` | Invesco Funds - Invesco Asian Equity Fund E Accumulation EUR | RV | 2026-03-15T18:47:36 | `7c985fc72fef188f` |
| `LU1819480192` | Echiquier Artificial Intelligence B EUR | RV | 2026-04-22T09:30:25 | `995300f1a406dfa1` |
| `LU1829329819` | CT (Lux) - Pan European Smaller Companies 1E (EUR Accumulation Shares) | RV | 2026-04-22T16:51:09 | `32835c8cb25fa8b1` |
| `LU1838941372` | Candriam Bonds Floating Rate Notes C EUR Cap | RF | 2026-03-15T18:47:36 | `0569357ce084298c` |
| `LU1873127366` | JPMorgan Liquidity Funds - EUR Liquidity LVNAV Fund A (acc.) | Monetario | 2026-03-15T18:47:36 | `7260d6250c646b57` |
| `LU1882457143` | Amundi Funds - Emerging Markets Corporate High Yield Bond A EUR (C) | RF | [object Object] | `9c8be89473755129` |
| `LU1882462655` | Amundi Funds - Emerging Markets Short Term Bond A2 EUR (C) | RF | [object Object] | `b9b02cae4e383319` |
| `LU1882462739` | Amundi Funds - Emerging Markets Short Term Bond A2 EUR Hgd (C) | RF | 2026-04-22T16:56:48 | `7ded51872ff4185d` |
| `LU1883318740` | Amundi Funds - Global Equity Responsible A EUR (C) | RV | 2026-03-15T18:47:36 | `a5fbc589c9a688f2` |
| `LU1883334275` | Amundi Funds - Global Subordinated Bond A EUR (C) | RF | 2026-04-22T09:26:35 | `22b5f6d722b72d11` |
| `LU1883342377` | Amundi Funds - Global Equity A EUR (C) | RV | 2026-04-22T16:41:48 | `dfb368eddd60b882` |
| `LU1897556517` | Groupama Global Disruption NC | RV | 2026-03-15T18:47:36 | `c53900ddc19dcc4e` |
| `LU1902444584` | CPR Invest - Climate Bonds Euro - A EUR - Acc | RF | 2026-04-22T16:45:26 | `4cebabf5a860c99c` |
| `LU1915690918` | Nordea 1 - Active Rates Opportunities Fund Fund E EUR | RF | 2026-03-15T18:47:36 | `d787ab16db520b2e` |
| `LU1919971074` | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR | RF | [object Object] | `6ff55001b02c8e04` |
| `LU1931535931` | Allianz Pet and Animal Wellbeing AT EUR | RV | 2026-04-22T16:52:35 | `a83543f087987067` |
| `LU1939214695` | Nordea 1 - Global Diversity Engagement Fund BP EUR | RV | 2026-04-22T16:48:50 | `665342bce22cdd82` |
| `LU1951921383` | Allianz Global Investors Fund - Allianz Credit Opportunities AT EUR | RF | 2026-04-22T09:32:56 | `166faedf79f16684` |
| `LU1983299162` | Schroder International Selection Fund Global Alternative Energy A Accumulation | RV | 2026-04-22T16:54:57 | `62d2013fe351355f` |
| `LU2002383896` | Allianz Global Investors Fund - Allianz Credit Opportunities Plus AT EUR | RF | 2026-04-22T09:13:41 | `15bf920a2bad7d38` |
| `LU2016064201` | Schroder International Selection Fund Global Alternative Energy A Accumulation EUR Hedged | RV | 2026-04-22T16:47:17 | `7260fcdba2eaeb68` |
| `LU2050411763` | BlackRock Global Funds - Emerging Markets Equity Income Fund A2 (EUR) | RV | 2026-04-22T16:41:48 | `57a0aacdbfccfbdd` |
| `LU2050860480` | Fidelity Funds - UK Special Situations Fund A-ACC-EUR | RV | 2026-04-22T16:43:51 | `fe0b226e5e68aa98` |
| `LU2050929277` | Capital Group New Economy Fund (LUX) B (EUR) | RV | 2026-04-22T16:43:51 | `98b13614814fab11` |
| `LU2092176515` | BlueBox Funds - BlueBox Global Technology Fund Class C EUR Acc | RV | 2026-04-22T16:49:36 | `c1b2ddab09f90b42` |
| `LU2094235707` | Goldman Sachs Global Future Technology Leaders Equity Portfolio Class E Shares EUR Acc | RV | 2026-03-15T18:47:36 | `dfcd339450a7f37f` |
| `LU2098772366` | Candriam Bonds Credit Alpha C EUR | RF | 2026-04-22T16:39:15 | `f02a165d5b4dc370` |
| `LU2131365186` | UBS (Lux) Equity Fund - China Opportunity (USD) P EUR acc | RV | 2026-04-22T09:29:07 | `534ca87a3053a8cd` |
| `LU2133220793` | Robeco Sustainable Asian Stars Equities DL EUR | RV | 2026-04-22T16:43:51 | `f9861cedc5242d2b` |
| `LU2145461757` | Robeco Smart Energy D-EUR Capitalisation | RV | 2026-04-22T16:56:48 | `3415814629a001b0` |
| `LU2145463373` | Robeco Smart Energy M2-EUR Capitalisation | RV | 2026-04-22T09:06:43 | `2b342510c6c5e57a` |
| `LU2146190835` | Robeco Sustainable Water D-EUR Capitalisation | RV | 2026-04-22T09:30:25 | `6f5008e6316fd9f4` |
| `LU2210151341` | Fidelity Funds - Absolute Return Global Equity Fund A-PF-Acc-Euro (Euro/USD hedged) | Alternativos | 2026-03-15T18:47:36 | `4e345b065edd25c0` |
| `LU2222028099` | Merchbanc FCP Renta Fija Flex A | RF | 2026-03-15T18:47:36 | `0f23430c0010bc6c` |
| `LU2267099674` | BlackRock Global Funds - China Bond Fund Class A2 USD (EUR) | RF | 2026-03-15T18:47:36 | `75f14c3581039989` |
| `LU2278574558` | Buy & Hold Luxembourg B&H Equity Class 2 | RV | 2026-04-22T16:53:45 | `b05ad0f0e7785db8` |
| `LU2278574988` | Buy & Hold Luxembourg B&H Bond Class 2 | RF | 2026-04-22T16:51:09 | `c48e5aea8d758efa` |
| `LU2295319300` | Morgan Stanley Investment Funds - Global Brands Fund A (EUR) | RV | 2026-04-22T16:47:17 | `7f11bf7fe6bc815b` |
| `LU2295320068` | Morgan Stanley Investment Funds - Global Insight Fund A (EUR) | RV | 2026-04-22T16:48:50 | `bb424facdbaab756` |
| `LU2337806421` | Morgan Stanley Investment Funds - Global Endurance Fund A EUR Acc | RV | 2026-04-22T16:48:50 | `9406704ad85dacdb` |
| `LU2357235493` | Incometric Fund Nartex Equity Fund A Cap EUR Accumulation | RV | 2026-04-22T16:51:09 | `731ce6e0cd7e3247` |
| `LU2357235576` | Incometric Fund Nartex Equity Fund R Cap EUR Accumulation | RV | 2026-04-22T16:52:35 | `02019b6055dea9fe` |
| `LU2482630162` | European Specialist Investment Funds - M&G European Credit Investment Fund Class P EUR Acc | RF | 2026-04-22T09:25:32 | `41fbe2f26d873c19` |
| `LU2504555777` | Fidelity Funds - Global Industrials Fund A-Acc-EUR | RV | 2026-04-22T16:51:09 | `931c518e82e8f3fe` |
| `LU2601038578` | Invesco Funds - Invesco Global Founders & Owners Fund A Accumulation EUR | RV | 2026-04-22T16:45:26 | `0ea65e096a5dba57` |
| `LU2784406998` | Morgan Stanley Investment Funds - Emerging Markets Debt Opportunities Fund A | RF | 2026-04-22T09:27:45 | `aa92ba3f32531815` |
| `LU3038481936` | Hamco SICAV - Global Value R EUR Acc | Mixto | 2026-03-15T18:47:36 | `15eec6db1def3560` |

---

## 10. Archivos Generados

| Archivo | Descripcion |
|:---|:---|
| `snapshot_funds_v3_before_write.json` | Snapshot completo de 520 documentos de funds_v3 |
| `rollback_delete_or_restore_plan.json` | Plan de rollback con 520 entradas |
| `snapshot_summary.json` | Resumen de la operacion |
| `missing_in_firestore.json` | 2 ISINs faltantes |
| `prewrite_snapshot_hashes.json` | Hashes per-ISIN y hash global |

---

*Fin del documento de Pre-Write Snapshot 0 — Firestore writes: 0 — Modo: READ_ONLY*
