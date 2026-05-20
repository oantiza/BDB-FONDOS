# BDB Morningstar PDF Updated Batch Write Gate 0

**Fecha de generación**: 2026-05-20 18:47 (local)
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-GATE-0

> [!IMPORTANT]
> Este documento es un **manifest de aprobación humana**. `would_write = false` en toda esta fase.
> Ningún dato ha sido escrito en Firestore. El Write Gate requiere aprobación explícita del usuario antes de proceder.

---

## 1. Origen de Datos

| Campo | Valor |
| :--- | :--- |
| **Source artifact** | `MORNINGSTAR_PDF_PARSER/SALIDA/parser_dry_run_latest.json` |
| **Timestamp parser** | `2026-05-20T16:34:57.851Z` |
| **dry_run** | `True` |
| **would_write** | `False` |
| **ACCEPT candidates file** | `MORNINGSTAR_PDF_PARSER/SALIDA/write_gate_candidates_accept_0.json` |
| **REVIEW excluded file** | `MORNINGSTAR_PDF_PARSER/SALIDA/review_required_0.json` |
| **ERROR excluded file** | `MORNINGSTAR_PDF_PARSER/SALIDA/error_blocked_0.json` |

---

## 2. Validaciones de Candidatos

| Check | Resultado |
| :--- | :--- |
| Total candidatos ACCEPT cargados | **522** |
| Esperados | **522** |
| Coincide | **✓ SÍ** |
| ISINs REVIEW excluidos | **95** |
| ISINs ERROR excluidos | **32** |
| Overlap ACCEPT ∩ REVIEW | **0 (debe ser 0)** |
| Overlap ACCEPT ∩ ERROR | **0 (debe ser 0)** |
| Violaciones de invariantes | **0 (debe ser 0)** |

---

## 3. Invariantes de Seguridad

| Invariante | Estado |
| :--- | :--- |
| `would_write = false` en parser | **✓ CONFIRMADO** |
| `dry_run = true` en parser | **✓ CONFIRMADO** |
| `manual` en `fields_preserved` | **✓ CONFIRMADO** |
| `manual.costs` en `fields_preserved` | **✓ CONFIRMADO** |
| `manual.costs.retrocession` en `fields_preserved` | **✓ CONFIRMADO** |
| `manual.*` ausente en `fields_to_update` | **✓ CONFIRMADO** |
| `economic_exposure` no sobreescrito | **✓ CONFIRMADO** |
| Firestore writes ejecutados | **0 — CONFIRMADO** |
| Write Gate ejecutado | **NO — CONFIRMADO** |
| Deploy ejecutado | **NO — CONFIRMADO** |
| Commit realizado | **NO — CONFIRMADO** |
| Push realizado | **NO — CONFIRMADO** |

---

## 4. Campos que se Actualizarían

Los siguientes campos serían escritos en `funds_v3/{isin}` si el Write Gate es aprobado:

| Campo | Descripción |
| :--- | :--- |
| `classification_v2` | Clasificación de activos v2 (asset_type, subtype, region, style) |
| `currency` | Divisa del fondo |
| `derived` | Campos derivados de clasificación (asset_class, asset_subtype, primary_region) |
| `isin` | ISIN del fondo (confirmación) |
| `ms` | Datos Morningstar: cartera, rating, sectores, regiones, RF, holdings, coste, objetivo |
| `name` | Nombre del fondo |
| `portfolio_exposure_v2` | Exposición de cartera v2 (asset_mix, bond_types, credit, duration, equity_regions) |
| `quality` | Metadata de calidad del parseo (parser_version, pdf_hash, warnings) |
| `updatedAt` | Timestamp de actualización |

### Campos PRESERVADOS (nunca sobreescritos):

| Campo | Protección |
| :--- | :--- |
| `manual` | **NUNCA se toca** |
| `manual.costs` | **NUNCA se toca** |
| `manual.costs.retrocession` | **NUNCA se toca** |

---

## 5. Distribución por Clase de Activo

| Clase de Activo (derived) | Fondos |
| :--- | ---: |
| `RV` | **330** |
| `RF` | **166** |
| `Mixto` | **12** |
| `Monetario` | **12** |
| `Alternativos` | **2** |

**Total**: 522 fondos

---

## 6. Distribución por asset_type (classification_v2)

| Asset Type v2 | Fondos |
| :--- | ---: |
| `equity` | **330** |
| `fixed_income` | **166** |
| `allocation` | **12** |
| `money_market` | **12** |
| `alternative` | **2** |

---

## 7. Distribución por Región Principal

| Región | Fondos |
| :--- | ---: |
| `Global` | **287** |
| `Europa` | **100** |
| `Emergentes` | **55** |
| `USA` | **45** |
| `Asia` | **25** |
| `Japón` | **10** |

---

## 8. Plan de Rollback

En caso de aprobación futura del Write Gate y necesidad de rollback:

1. **Pre-condición obligatoria antes de cualquier write**: Capturar snapshot completo de `funds_v3` para los 522 ISINs candidatos y almacenarlo en `MORNINGSTAR_PDF_PARSER/SALIDA/pre_write_snapshot_0.json`.
2. **Rollback automático**: Restaurar el documento `funds_v3/{isin}` a partir del snapshot previo.
3. **Campos siempre preservados**: `manual`, `manual.costs`, `manual.costs.retrocession` NUNCA se tocan; no requieren rollback.
4. **Auditoria**: El campo `updatedAt` del snapshot previo permite identificar el momento exacto del último estado válido.
5. **Ejecución de rollback**: Usar un script de write controlado con flag `--rollback --source=pre_write_snapshot_0.json` (por implementar si necesario).

---

## 9. Tabla Completa de Candidatos al Write Gate

> Todos los 522 fondos listados tienen `gate_status = PENDING_HUMAN_APPROVAL` y `would_write = false`.
> El campo `payload_hash` es un SHA-256 truncado (16 hex chars) del payload propuesto para trazabilidad.

| ISIN | Nombre | Status | Clase | Type v2 | Región | Fecha PDF | Hash Payload |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| BE0943877671 | DPAM B - Bonds Eur Government B Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `67a034fd35b6f453` |
| BE0946564383 | DPAM B - Equities NewGems Sustainable B Cap | `ACCEPT` | RV | equity | Global | 2026-05-17 | `0e3e42b167608d7a` |
| BE0947853660 | DPAM B - Equities US Dividend Sustainable B EUR Cap | `ACCEPT` | RV | equity | USA | 2026-05-17 | `2381a931911a6277` |
| DE0008490962 | DWS Deutschland LC | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `609113b2388cad59` |
| ES0111166031 | Atl Capital Corto Plazo A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `7c2998cdd902f3f3` |
| ES0112602000 | Azvalor Managers FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `536c26f71ae6c88b` |
| ES0114633003 | Panda Agriculture & Water Fund FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `de0e2c9ca298233a` |
| ES0114904008 | Brightgate Focus A FI | `ACCEPT` | Mixto | allocation | USA | 2026-05-17 | `d635a340a2f49822` |
| ES0116419005 | Cartera Renta Fija Horizonte 2026 FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `dbb1170b22bdc8b3` |
| ES0116567035 | Cartesio X FI | `ACCEPT` | Mixto | allocation | Europa | 2026-05-17 | `c66bf8223f4651f3` |
| ES0116848005 | Global Allocation R FI | `ACCEPT` | Mixto | allocation | Global | 2026-05-16 | `71df91989f2c4c64` |
| ES0124880032 | UBS Renta Fija 0-5 B FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `a71c07c3ebfad12e` |
| ES0125240038 | Trea Renta Fija Ahorro S FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `daa0d676cdaba530` |
| ES0125323008 | Gestión Value A FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `3b8adc5fbc36a59a` |
| ES0126542036 | Amundi Corto Plazo A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `be854a9d46826f5b` |
| ES0126547035 | UBS Duración 0-2 B FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `9c2d8b63224d3ad1` |
| ES0127097030 | Dux Rentinver Renta Fija FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `1e02c38f7e514bc2` |
| ES0127795005 | EDM Renta R FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `699d039258f79327` |
| ES0137381036 | Gesconsult Renta Variable Iberia A FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `10f1c1b62d795bd2` |
| ES0138217031 | Gesconsult Renta Fija Flexible A FI | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `11444d34b539c05e` |
| ES0138911039 | Gesconsult Renta Variable Eurozona FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `f8b06bc47e55dd37` |
| ES0138922002 | Gesconsult Horizonte 2027 FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `1a2d8ad6e300a7b6` |
| ES0138922036 | Gesconsult Corto Plazo A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `f5e84639f252c964` |
| ES0140643034 | GVC Gaesco Europa FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `715503b641d12ad6` |
| ES0140986011 | Gesconsult Oportunidad Renta Fija A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `4f0c033fe09bef0a` |
| ES0141113037 | GVC Gaesco Japón A FI | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `3cab6e0a39b403af` |
| ES0141580037 | SIH Ahorro A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `c9c4f895149d005e` |
| ES0141991002 | Gestión Talento FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `074a0a17ae4bfc16` |
| ES0142167032 | SIH Renta Fija A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `94164e8a48526cb2` |
| ES0146309002 | Horos Value Internacional FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `9e3f6c3933c0ac6a` |
| ES0155142005 | Intermoney Variable Euro A FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `847a624673be9e0c` |
| ES0155598008 | UBS Corto Plazo A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `186ccfa6ddc80aaa` |
| ES0155598032 | UBS Corto Plazo B FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `ccce9ca80ddc8283` |
| ES0156873004 | A&G Renta Fija Corto Plazo FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `44017c021ed5e47e` |
| ES0159201013 | Magallanes Iberian Equity M FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `b16e637756134406` |
| ES0159259011 | Magallanes European Equity M FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `d1f9ea3bd8397add` |
| ES0160873008 | March Pagarés A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `639c0b3e9d645bd4` |
| ES0161032034 | March Renta Fija Corto Plazo A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `84127a2205e3d7a3` |
| ES0162295002 | Cartera Renta Fija Horizonte 2027 FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `56e3abd8112072ff` |
| ES0162333035 | Merchrenta FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `82155eb67d080f22` |
| ES0162368007 | Metavalor Internacional I FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f2e28505042ee98e` |
| ES0165142003 | Mutuafondo Corto Plazo D FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `80d262773bbcfc10` |
| ES0165142037 | Mutuafondo Corto Plazo A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `a80f178c0a02fadf` |
| ES0165242001 | Myinvestor S&P500 Equiponderado FI | `ACCEPT` | RV | equity | USA | 2026-05-17 | `683743954a3a3398` |
| ES0167238023 | Estela Global Equities R FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `9ccb860efcceb8a0` |
| ES0168662031 | Trea Renta Fija FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `c29b88937ed942a4` |
| ES0168673038 | EDM Ahorro R FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `c2dd012685460959` |
| ES0168799056 | Gestión Boutique IV Alclam US Equities FI | `ACCEPT` | RV | equity | USA | 2026-05-17 | `9d3c7f0981375f72` |
| ES0170138038 | Santalucía Renta Fija B FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `3b161ce7afb0b82e` |
| ES0170141008 | Santalucía Quality Acciones Europeas B FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `b7c06c15d9f7ddf1` |
| ES0176954008 | Renta 4 Renta Fija R FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `4d2ab833e7dc9879` |
| ES0182631004 | Polar Renta Fija A FI | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `ba0386b8cb6c097d` |
| ES0182769002 | Valentum E FI | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `4584fb52ddad0a61` |
| ES0184949008 | Sigma Investment House Megatrends A FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `bdef401b4e6ab7d4` |
| ES0184949016 | Sigma Investment House Megatrends B FI | `ACCEPT` | RV | equity | Global | 2026-05-17 | `db5abbefef665e5a` |
| FI0008800511 | Evli Short Corporate Bond B | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `635ef856a72937ac` |
| FI0008811997 | Evli Nordic Corporate Bond B | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `e77e2c98396c9ebf` |
| FR0000174310 | Lazard Small Caps Euro SRI I | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `cfc40f6c66e0e0a3` |
| FR0000989626 | Groupama Trésorerie IC | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `7db6df8ebb2333b6` |
| FR0000989899 | Oddo BHF Avenir CR-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `1b455b2436725779` |
| FR0007008750 | R-co Conviction Credit Euro C EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `67d4555467112f0f` |
| FR0010148981 | Carmignac Investissement A EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-16 | `d22e7d4578163552` |
| FR0010149120 | Carmignac Sécurité AW EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `5393d3d04158eed2` |
| FR0010172767 | EdR SICAV - Euro Sustainable Credit A EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `a51505723cb77330` |
| FR0010230490 | Lazard Credit Opportunities RC EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `00c90dcd89de1afd` |
| FR0010288308 | Groupama Avenir Euro NC | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `87f0c4c819250488` |
| FR0010306142 | Carmignac Patrimoine E EUR Acc | `ACCEPT` | Mixto | allocation | USA | 2026-05-17 | `f82129c11d70756e` |
| FR0010312660 | Carmignac Investissement E EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `edf54c10c8adb480` |
| FR0010321810 | Echiquier Agenor Mid Cap Europe A | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `def44a0441bb32cc` |
| FR0010547869 | Sextant PME A | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `254de21745d5b8dd` |
| FR0010722348 | Groupama Global Active Equity NC | `ACCEPT` | RV | equity | Global | 2026-05-17 | `056353d850f6bb14` |
| FR0010829697 | AMUNDI TRESO 12 MOIS DP | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `5cb7b70b1b083358` |
| FR0010839282 | Echiquier Short Term Credit SRI A | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `18654c289273397e` |
| FR0010859769 | Echiquier World Equity Growth A | `ACCEPT` | RV | equity | Global | 2026-05-17 | `1882837ade578e5b` |
| FR0010950055 | AXA IM Euro 6M E | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `a5d852c7a8a28c22` |
| FR0011288513 | Sycomore Sélection Crédit R | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `77b2961bfb733b3c` |
| FR0011365212 | Amundi Ultra Short Term Bond Responsible E C | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `089e198f5baf6c6b` |
| FR0011387299 | Allianz Euro Oblig Court Terme ISR RC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `9bf1dd713fb16372` |
| FR0013201001 | EdR SICAV - Euro Sustainable Credit R EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `c70dbcd9dc4c3aef` |
| FR0013231453 | Ostrum Credit Ultra Short Plus I-C EUR | `ACCEPT` | RF | fixed_income | USA | 2026-05-17 | `aadd81e4d2dccc5b` |
| FR0013346079 | Groupama Ultra Short Term NC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `f4c136bf1725b36d` |
| FR0013460920 | EdR SICAV - Short Duration Credit A EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `37c77087e141a943` |
| FR0013460961 | EdR SICAV - Short Duration Credit B EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `e1324a2fb1539737` |
| FR0014008W22 | EdR SICAV - Millesima World 2028 A EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `0b3e9bbd404f1fc3` |
| FR001400JGB5 | EdR SICAV Millesima Select 2028 A Eur | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `6464bde2893b8368` |
| FR001400NTN5 | Lazard High Yield 2029 EC EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `e7dda0f8bac84626` |
| FR0050000860 | Amundi Ultra Short Term Bond Responsible P C | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `44c1002e00e5ce6d` |
| IE0003867441 | BNY Mellon Small Cap Euroland Fund EUR A Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `51e7c806a78eb30e` |
| IE0004766675 | Comgest Growth Europe EUR Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `efc0a88ed774a290` |
| IE000MI53C66 | Man Funds plc - Man Global Investment Grade Opportunities D H EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `3acded427ade49bf` |
| IE0031069499 | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `583ad958cabdacfb` |
| IE0031333341 | Jupiter Asia Pacific Income Fund C USD Acc | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `0f32c2658945c27e` |
| IE0031573904 | Brandes Global Value Fund A Euro Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c04cca0d30395f63` |
| IE0031574647 | Brandes European Value Fund A Euro Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `68a03713a1006ac4` |
| IE0031575271 | Brandes US Value Fund A Euro Acc | `ACCEPT` | RV | equity | USA | 2026-05-17 | `b9342fffea2be8ff` |
| IE0032722484 | BNY Mellon Euroland Bond Fund EUR C Acc | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `7d251dca32b613ad` |
| IE0034277479 | AXA IM Equity Trust - AXA IM All Country Asia Pacific Ex-Japan Small Cap Equity QI | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `6f38c331b1b6e230` |
| IE00B03HCZ61 | Vanguard Global Stock Index Fund Investor EUR Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f2d1f42b48fd3fab` |
| IE00B03HD191 | Vanguard Global Stock Index Fund EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `d237306031edb884` |
| IE00B11XYW43 | PIMCO GIS Emerging Markets Bond Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `9dddc0bd3987f18d` |
| IE00B11XZ103 | PIMCO GIS Global Bond Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `4b6c9f19d5633347` |
| IE00B11XZ871 | PIMCO GIS US High Yield Bond Fund E Class Accumulation | `ACCEPT` | RF | fixed_income | USA | 2026-05-17 | `22cbd01a668c9d2d` |
| IE00B11YFH93 | BNY Mellon Emerging Markets Debt Local Currency Fund EUR A Acc | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `595d42350247586e` |
| IE00B18GC888 | Vanguard Global Bond Index Fund EUR Hedged Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `c14f69e953a00fb7` |
| IE00B23S7K36 | BNY Mellon Brazil Equity Fund EUR A Acc | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `1b4543caaeec4685` |
| IE00B28YJQ65 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `5061aa127c56530c` |
| IE00B2NXKW18 | Seilern World Growth EUR U R | `ACCEPT` | RV | equity | Global | 2026-05-17 | `7972ed2c31704abe` |
| IE00B3NLSS43 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund R Inc (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ac3e3c9b492979a2` |
| IE00B3RW6Z61 | Nomura Funds Ireland plc - US High Yield Bond Fund Class A EUR | `ACCEPT` | RF | fixed_income | USA | 2026-05-17 | `3ed9f20bcaef835e` |
| IE00B3V93F27 | BNY Mellon Global Equity Income Fund EUR A Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `87000a5a5f277022` |
| IE00B3VXGD32 | Polar Capital Funds PLC - Biotechnology Fund R Inc (EUR) | `ACCEPT` | RV | equity | USA | 2026-05-17 | `f18bdc047c4596e4` |
| IE00B4M05337 | Brown Advisory US Equity Growth $ P | `ACCEPT` | RV | equity | USA | 2026-05-17 | `7ecbf0f2156f954d` |
| IE00B4Z6MP99 | BNY Mellon Global Real Return Fund (EUR) C Acc | `ACCEPT` | Mixto | allocation | Global | 2026-05-17 | `1282051e8363f213` |
| IE00B4ZJ4188 | Comgest Growth Europe Opportunities EUR Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `eb68862601b4783b` |
| IE00B52VLZ70 | Polar Capital Funds PLC - Polar Capital Global Insurance Fund R Acc (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f73ae9b678d7d059` |
| IE00B53H0P79 | PIMCO GIS Global Advantage Fund E Class EUR (Partially Hedged) Accumulation | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `ca004a51eca03570` |
| IE00B5ZW6Z28 | PIMCO GIS Emerging Local Bond Fund E Class EUR (Unhedged) Accumulation | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `1513baaa2cfd21b9` |
| IE00B84J9L26 | PIMCO GIS Income Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `207025f51d949edf` |
| IE00B87MS887 | Liontrust GF Special Situations Fund A1 Acc EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `e149ef6af098de1b` |
| IE00B88WFS66 | Federated Hermes Asia ex-Japan Equity Fund Class R EUR Accumulating | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `990706139baa75aa` |
| IE00B8BPMF80 | Wellington Strategic European Equity Fund EUR D Ac | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `7add40ddb427bd03` |
| IE00B8J38129 | Algebris UCITS Funds plc - Algebris Financial Credit Fund R EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `1dec8979e469a4b4` |
| IE00B90VC092 | PIMCO European Short-Term Opportunities Fund E EUR Accumulation | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `d1fc72446ceab6a9` |
| IE00BD2ZKT29 | Principal Global Investors Funds - Finisterre Unconstrained Emerging Market Fxd Inc Fd A Hdg Acc EUR | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `fe8bdc5e9873b63e` |
| IE00BD4GTQ32 | FTGF ClearBridge Infrastructure Value Fund Class A Euro Accumulating | `ACCEPT` | RV | equity | Global | 2026-05-17 | `599ae2ae52357c28` |
| IE00BD5CTX77 | BNY Mellon Global Short-Dated High Yield Bond Fund EUR H Acc Hedged | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `9d8ded51dc4a2547` |
| IE00BDH6RQ67 | UTI India Dynamic Equity EURO Retail | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a269785fa662163d` |
| IE00BDTYYP61 | Man Funds VI plc - Man High Yield Opportunities D EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `102720eda6959734` |
| IE00BDZRWZ54 | Neuberger Berman Short Duration Emerging Market Debt Fund EUR A Accumulating Class | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `1237045bd4a744b5` |
| IE00BF0GL212 | Polar Capital Funds PLC - Artificial Intelligence Fund R USD Acc (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `79cfef7c82ec5a96` |
| IE00BF2FJG67 | PIMCO GIS Low Duration Opportunities Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `aa59f77e85a81d61` |
| IE00BJ7B9456 | PIMCO GIS Global Low Duration Real Return Fund E Class EUR (Hedged) Accumulation | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `5cd4a3d190d3afd8` |
| IE00BKSBDB61 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities R Acc (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c3a27a082a1269d3` |
| IE00BM95B621 | Polar Capital Funds PLC - Polar Capital Global Technology Fund R Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `fc7aebcd99feaead` |
| IE00BMD7ZB71 | Neuberger Berman Next Generation Connectivity Fund EUR A Accumulating Class - Unhedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `58b6f893c9293b89` |
| IE00BNG2T811 | Neuberger Berman Short Duration Euro Bond Fund EUR A Accumulating Class | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `2c1f3416eb5aa28b` |
| IE00BYR8H148 | Jupiter Merian World Equity Fund L EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `b3923fbd1506ccd9` |
| IE00BYVJR916 | Jupiter Gold & Silver Fund L EUR Acc | `ACCEPT` | RV | equity | USA | 2026-05-17 | `ee9c5fccb1acdcb7` |
| IE00BYX5NX33 | Fidelity MSCI World Index Fund EUR P Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ce764c5b20ecd579` |
| IE00BYX5P602 | Fidelity MSCI World Index Fund EUR P Acc (Hedged) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `cb73a254d9545350` |
| IE00BZ18VT34 | BNY Mellon Global Infrastructure Income Fund EUR A Inc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `69e1436f5dba141a` |
| IE00BZ4D7648 | Polar Capital Funds PLC - Polar Capital Global Technology Fund R EUR Hedged Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a18328e7bc424197` |
| LU0011889846 | Janus Henderson Horizon Euroland Fund A2 EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `ce86e7c2d5e74987` |
| LU0028119013 | Invesco Funds - Invesco Pan European Small Cap Equity Fund A Accumulation EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `f1d39e102d823684` |
| LU0034353002 | DWS Floating Rate Notes LC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `bfea471dea0aa0cf` |
| LU0072462186 | BlackRock Global Funds - European Value Fund A2 | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `e4d5ef537d56099a` |
| LU0073229253 | Morgan Stanley Investment Funds - Asia Equity Fund A | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `1c20d8ba80d85ef0` |
| LU0073235904 | Morgan Stanley Investment Funds - Short Maturity Euro Bond Fund A | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `071fc231d237be66` |
| LU0077500055 | Candriam Bonds Euro Corporate 2036 Class C EUR Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `03eb9e644868d2ca` |
| LU0080237943 | DWS Euro Ultra Short Fixed Income Fund NC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `52b8ea75631af629` |
| LU0084617165 | Robeco Asia-Pacific Equities D € | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `47c3cf3aa60d8fc2` |
| LU0086177085 | UBS (Lux) Bond Fund - Euro High Yield (EUR) P-acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `18e1f8cb173713d2` |
| LU0090845842 | BlackRock Global Funds - World Mining Fund E2 | `ACCEPT` | RV | equity | Global | 2026-05-17 | `55a14f1bc6cca95b` |
| LU0093583077 | Candriam Money Market Euro C Acc EUR | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `a81616d82a6c9e1c` |
| LU0094557526 | MFS Meridian Funds - European Research Fund A1 EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `4f451b4d345158a8` |
| LU0102219945 | Goldman Sachs Europe CORE Equity Portfolio Base Inc EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `0abbd89f5e394df5` |
| LU0102737730 | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund A Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `f06a82045dd32330` |
| LU0102737904 | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund C Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `dec4396bedf95c24` |
| LU0112467450 | Nordea 1 - Global Stable Equity Fund BP EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `70c582450cb61635` |
| LU0113257694 | Schroder International Selection Fund EURO Corporate Bond A Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `c02124d6550b31fd` |
| LU0114722738 | Fidelity Funds - Global Financial Services Fund E-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `32c45b2ba1d6f425` |
| LU0114723033 | Fidelity Funds - Global Industrials Fund E-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `76950f40d3e66404` |
| LU0115139569 | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `6ac1ad9ef7c22eee` |
| LU0115141201 | Invesco Funds - Invesco Pan European Equity Fund E Accumulation EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `fcd38a49b8f9f220` |
| LU0115143082 | Invesco Funds - Invesco Asia Opportunities Equity Fund E Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `b27ff828462d902e` |
| LU0115759606 | Fidelity Funds - America Fund E-Acc-EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `29aa2f0aaaa6a426` |
| LU0115765678 | Fidelity Funds - Iberia Fund E-Acc-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `c2c357d6a7ba5a1e` |
| LU0115769746 | Fidelity Funds - World Fund E-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `1f390f56ded18176` |
| LU0115773425 | Fidelity Funds - Global Technology Fund E-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `553c65b030ee62da` |
| LU0117843481 | JPMorgan Funds - Taiwan Fund A (dist) USD | `ACCEPT` | RV | equity | Asia | 2026-05-16 | `e48a746ed8d95ed8` |
| LU0117843721 | JPMorgan Funds - Taiwan Fund D (acc) USD | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `bda346c40a0d7074` |
| LU0117858596 | JPMorgan Funds - Europe Equity Fund D (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `64cbbc1c6f365f11` |
| LU0117858679 | JPMorgan Funds - Europe Strategic Growth Fund D (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `899c9f511aab0e61` |
| LU0117858752 | JPMorgan Funds - Europe Strategic Value Fund D (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `2ea68e78e9358c8e` |
| LU0117859560 | JPMorgan Funds - Europe Small Cap Fund D (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `96e8d8aadcbf5507` |
| LU0117884675 | JPMorgan Funds - Europe Dynamic Technologies Fund D (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `06c7af71ef00d24c` |
| LU0119063039 | JPMorgan Funds - Europe Dynamic Fund D (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `89f23c7ac1a2e744` |
| LU0119620416 | Morgan Stanley Investment Funds - Global Brands Fund A | `ACCEPT` | RV | equity | Global | 2026-05-17 | `8a674d9380992582` |
| LU0119750205 | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund A Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `b357d5d12d7ba7a8` |
| LU0119753308 | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund E Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `192808415d7626cf` |
| LU0121204431 | Goldman Sachs Global Sustainable Equity - X Cap EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `deaa6eb46005475a` |
| LU0125951151 | MFS Meridian Funds - European Value Fund A1 EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `15d2bac2abd62fb8` |
| LU0127786431 | Goldman Sachs Eurozone Equity Income - P Cap EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `c9f08713f94a1ed0` |
| LU0128521001 | Templeton European Insights Fund Class N (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `23bb3c44a81bf671` |
| LU0132601682 | Morgan Stanley Investment Funds - Euro Corporate Bond Fund A | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `3faed0fc41596185` |
| LU0133264522 | Goldman Sachs Global Equity Income Portfolio E Acc EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a137ad28c8b69618` |
| LU0133267202 | Goldman Sachs Emerging Markets Equity Portfolio E Acc EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `ec7de2f1a1824d04` |
| LU0133717503 | Schroder International Selection Fund EURO Corporate Bond A1 Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `d91efc22e4f74fa7` |
| LU0137009238 | Vontobel Fund - TwentyFour Euro Short Term Bond C EUR Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `151ce6912979a1ba` |
| LU0144751095 | Candriam Bonds Euro High Yield Class N EUR Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `a33299295a65c536` |
| LU0145656715 | DWS Invest ESG Euro Bonds (Short) NC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `8e790d6fef03eb71` |
| LU0151324935 | Candriam Bonds Credit Opportunities Class N EUR Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `70f1bc845be64645` |
| LU0153585137 | Vontobel Fund - European Equity B EUR Cap | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `1b7a9d255c36047d` |
| LU0153925689 | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `4b23abfe89bc301f` |
| LU0157179127 | JPMorgan Investment Funds - Global Select Equity Fund D (acc) EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `070bee79d67bcc2d` |
| LU0161304786 | Schroder International Selection Fund European Value A1 Accumulation EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `9dceba9d98a83581` |
| LU0161305163 | Schroder International Selection Fund European Value A Accumulation EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `0739f7502ac51c9d` |
| LU0161305593 | Schroder International Selection Fund European Value B Accumulation EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `4fffaf9ad736a711` |
| LU0162660350 | BlackRock Global Funds - Euro Corporate Bond Fund A1 | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `661bd32ae881f4ee` |
| LU0165074666 | HSBC Global Investment Funds - Euroland Value AC | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `4644df8ed347870a` |
| LU0165081950 | HSBC Global Investment Funds - Euroland Value EC | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `9736c75dc682c289` |
| LU0165520114 | Candriam Bonds Global Inflation Short Duration Class C EUR Cap | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `f5fcf9c31249c206` |
| LU0169250635 | Generali Investments SICAV - Euro Bond Fund EX | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `652d5429c48c2d31` |
| LU0170293632 | Candriam Bonds Global High Yield Class N EUR Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `bb03b0bb66329ee9` |
| LU0170473374 | Franklin European Total Return Fund A(acc)EUR | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `f624ab62ac7c525a` |
| LU0171275786 | BlackRock Global Funds - Emerging Markets Fund A2 (EUR) | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `021d0087f8c4e679` |
| LU0171281750 | BlackRock Global Funds - European Value Fund A2 (USD) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `8065d03aea6c28be` |
| LU0171282212 | BlackRock Global Funds - European Value Fund A2 (GBP) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `748e21d6dd8521fd` |
| LU0171285587 | BlackRock Global Funds - Global Long-Horizon Equity Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ef06b4b3b25d3b7d` |
| LU0171289902 | BlackRock Global Funds - Sustainable Energy Fund A2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `8acdb1e09adfe6af` |
| LU0171290074 | BlackRock Global Funds - Sustainable Energy Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `fab09ac807656d08` |
| LU0171296949 | BlackRock Global Funds - US Flexible Equity Fund E2 (EUR) | `ACCEPT` | RV | equity | USA | 2026-05-17 | `15f522653936c607` |
| LU0171304552 | BlackRock Global Funds - World Energy Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `cbfc03d4610e4bdd` |
| LU0171304719 | BlackRock Global Funds - World Financials Fund A2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `e53c1868a70e01a1` |
| LU0171305443 | BlackRock Global Funds - World Financials Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `2e66afa07023cb0e` |
| LU0171306680 | BlackRock Global Funds - World Gold Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `80f1f1719bed4c71` |
| LU0171307068 | BlackRock Global Funds - World Healthscience Fund A2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `bea4cc0b72961db7` |
| LU0171309270 | BlackRock Global Funds - World Healthscience Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `1ea96f51ba100ede` |
| LU0172157280 | BlackRock Global Funds - World Mining Fund A2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `14551a8425b8f439` |
| LU0172157363 | BlackRock Global Funds - World Mining Fund E2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `cb38ee7dba417151` |
| LU0173779223 | Nordea 1 - Danish Covered Bond Fund BP EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `44ae0f64384661b4` |
| LU0173782102 | Nordea 1 - Asia ex Japan Equity Fund BP EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `81d723cba1ac501c` |
| LU0177497491 | abrdn SICAV II-Euro Corporate Bond Fund A Acc EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `7644c90c3f3d2837` |
| LU0181496216 | Schroder International Selection Fund Emerging Asia A1 Accumulation USD | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `436d43d83b8e34ad` |
| LU0184627536 | AXA World Funds - Switzerland Equity A Capitalisation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `aec1d6ee1ef1e623` |
| LU0187079347 | Robeco Global Consumer Trends D EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `992b3a8eade14b13` |
| LU0188151921 | Templeton Emerging Markets Fund N(acc)EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `8275bf2cd60c6556` |
| LU0200684180 | BlackRock Global Funds - Emerging Markets Bond Fund E2 (EUR) | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `52314b32e9264afd` |
| LU0201075453 | Janus Henderson Pan European Fund A2 EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `8739fd7784949a41` |
| LU0202403266 | Fidelity Active Strategy - FAST - Europe Fund A-ACC-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `0e74dea1d87762a5` |
| LU0203975437 | Robeco BP Global Premium Equities D EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `65af0efff78df44c` |
| LU0208853944 | JPMorgan Funds - Global Natural Resources Fund D (acc) EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `382149986e9b02c2` |
| LU0210531983 | JPMorgan Funds - Europe Strategic Value Fund A (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `3835046ab00e6165` |
| LU0210536198 | JPMorgan Funds - US Growth Fund A (acc) - USD | `ACCEPT` | RV | equity | USA | 2026-05-17 | `c197be41f095c826` |
| LU0212178916 | BNP Paribas Funds Europe Small Cap Classic Capitalisation | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `139e4d2b58328c67` |
| LU0217139020 | Pictet-Premium Brands P EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c6432d0a4f9d59b6` |
| LU0217576833 | JPMorgan Funds - Emerging Markets Equity Fund D (acc) EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `8f8a69bf8afed18d` |
| LU0224105477 | BlackRock Global Funds - Continental European Flexible Fund Class A2 | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `370757b0e7b36e27` |
| LU0224105980 | BlackRock Global Funds - Continental European Flexible Fund E2 | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `7ee3b4c1ab919153` |
| LU0227385266 | Nordea 1 - Stable Return Fund E EUR | `ACCEPT` | Mixto | allocation | USA | 2026-05-17 | `545545dd267dee24` |
| LU0229084990 | BlackRock Global Funds - European Equity Transition Fund A2 | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `5aae8715eb5afd9c` |
| LU0231205856 | Franklin India Fund N(acc)EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `331f8b18e58b6d90` |
| LU0231490524 | abrdn SICAV I - Indian Equity Fund A Acc USD | `ACCEPT` | RV | equity | Global | 2026-05-17 | `676ec191ceea0e44` |
| LU0232524495 | AB SICAV I - American Growth Portfolio A EUR Acc | `ACCEPT` | RV | equity | USA | 2026-05-17 | `7d95e5e658256609` |
| LU0235308482 | Alken Fund - European Opportunities Class R | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `0aedd6b9d9adc63d` |
| LU0236738190 | Schroder International Selection Fund Japanese Equity B Accumulation EUR Hedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c114c16e85fe432c` |
| LU0243958393 | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `879a8b170b19b1b4` |
| LU0248167537 | Schroder International Selection Fund Global Equity Alpha A1 Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-16 | `41aa36cb803cc9ef` |
| LU0248168261 | Schroder International Selection Fund Global Equity Alpha B Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `e2582c9ae68ddab1` |
| LU0248168428 | Schroder International Selection Fund Global Equity Alpha A Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `8e26ed3c0fe4a2cf` |
| LU0248172537 | Schroder International Selection Fund Emerging Asia A Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `035d35061557db05` |
| LU0248173006 | Schroder International Selection Fund Emerging Asia B Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-16 | `d29ad1b1299d2663` |
| LU0248174152 | Schroder International Selection Fund Emerging Asia A1 Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `bb43e6b41c6253f7` |
| LU0248181363 | Schroder International Selection Fund Latin American A Accumulation EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `c6f1f40c147fe3ff` |
| LU0248183815 | Schroder International Selection Fund Latin American B Accumulation EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `bcff53510086998d` |
| LU0248183906 | Schroder International Selection Fund Asian Opportunities B Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `c8daa051a461e629` |
| LU0248184383 | Schroder International Selection Fund Latin American A1 Accumulation EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `f3f649fb490f700c` |
| LU0248184466 | Schroder International Selection Fund Asian Opportunities A Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `2f900a3130a9c10f` |
| LU0251119078 | Fidelity Funds - Fidelity Target™ 2035 Fund A-Acc-EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `42981f8592c294ab` |
| LU0251660279 | AXA World Funds - Euro Strategic Bonds E Capitalisation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-16 | `57709192fbac3464` |
| LU0251661590 | AXA World Funds - Euro Long Duration Bonds E Capitalisation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `659ac91b36dfd983` |
| LU0251807987 | BNP Paribas Funds Japan Small Cap Classic EUR Capitalisation | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `6f93aa0d4d969b79` |
| LU0251853072 | AB SICAV I - International Health Care Portfolio Class A EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `75a9f844637bd52e` |
| LU0252500524 | JPMorgan Funds - EUR Money Market VNAV Fund D (acc) EUR | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `ceb6638663a074f4` |
| LU0252970834 | BlackRock Global Funds - European Equity Transition Fund A2 (USD) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `a901be5b2329c9a4` |
| LU0254836850 | Robeco Capital Growth Funds - Robeco Emerging Stars Equities D EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `9c1d65baf2d16717` |
| LU0256839860 | Allianz Global Investors Fund - Allianz Europe Equity Growth CT EUR | `ACCEPT` | RV | equity | Europa | 2026-05-16 | `8ff366a67f4c3ab3` |
| LU0260085492 | Jupiter European Select Class L EUR Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `db0391bdaca1d0d7` |
| LU0260869739 | Franklin U.S. Opportunities Fund A(acc)EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `fc1d81a843387304` |
| LU0261948227 | Fidelity Funds - Germany Fund A-Acc-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `f418ba615b9db01e` |
| LU0261951957 | FF - Global Dividend Plus Fund A-Acc-EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `1351cce79f9e7578` |
| LU0261952682 | Fidelity Funds - Euro 50 Index Fund A-Acc-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-16 | `cfb97fa489c2c814` |
| LU0267388220 | Fidelity Funds - Euro Short Term Bond Fund A-Acc-EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `c72ebd4e872a7d37` |
| LU0267984697 | Invesco Funds - Invesco India Equity Fund E Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c3f7e8a575440534` |
| LU0270905242 | Pictet-Security R EUR | `ACCEPT` | RV | equity | Global | 2026-05-16 | `b10d80e24e101221` |
| LU0273148055 | DWS Invest Gold and Precious Metals Equities NC | `ACCEPT` | RV | equity | USA | 2026-05-17 | `de37b59b5f47e6c6` |
| LU0273159177 | DWS Invest Gold and Precious Metals Equities LC | `ACCEPT` | RV | equity | USA | 2026-05-17 | `a51f429ec7f2453d` |
| LU0273690064 | Goldman Sachs Asia Equity Growth & Income - P Cap EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `950e850caae3b187` |
| LU0275692696 | Fidelity Funds - US Equity Fund A-Acc-EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `eae0fcaf675468e6` |
| LU0279459456 | Schroder International Selection Fund Global Emerging Market Opportunities A Accumulation EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `3e6c56b6924c9512` |
| LU0279460892 | Schroder International Selection Fund Global Smaller Companies A1 Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `8486269caff85bf0` |
| LU0280435388 | Pictet - Clean Energy Transition P EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `204cf3ad329ccad5` |
| LU0280435461 | Pictet-Clean Energy Transition R EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `6aac6daced17212e` |
| LU0282719219 | CT (Lux) - Pan European Small Cap Opportunities Class AE (EUR Accumulation Shares) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `618504af3c738192` |
| LU0289089384 | JPMorgan Funds - Europe Equity Plus Fund A (perf) (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `f2cf6eab468bd9b8` |
| LU0289214628 | JPMorgan Funds - Europe Equity Plus Fund D (perf) (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `0b3f6498cf0ef734` |
| LU0293313325 | Allianz Global Investors Fund - Allianz GEM Equity High Dividend AT EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `c3a13b0219694b66` |
| LU0293313671 | Allianz Global Investors Fund - Allianz GEM Equity High Dividend CT EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `858e729e17a3f062` |
| LU0294249692 | Carmignac Portfolio Grande Europe E EUR Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `d1800fc74b4af96f` |
| LU0300507208 | Generali Investments SICAV - Euro Future Leaders EX | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `dff1f0db6f19edfd` |
| LU0300741732 | Franklin Natural Resources Fund A(acc)EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `e3260883ab008fe1` |
| LU0302445910 | Schroder International Selection Fund Global Climate Change Equity A Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `9f84d839dd7ba5a1` |
| LU0302446645 | Schroder International Selection Fund Global Climate Change Equity A Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c288440b70818866` |
| LU0302446991 | Schroder International Selection Fund Global Climate Change Equity B Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `5e261c6f4a21adba` |
| LU0309468980 | Nordea 1 - Latin American Equity Fund E EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `34c659a1bcd437ae` |
| LU0313923228 | BlackRock Strategic Funds - European Opportunities Extension Fund A2 EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `44a233eceb0a7810` |
| LU0318931192 | Fidelity Funds - China Focus Fund A-Acc-EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `5e08adea005ef38e` |
| LU0320896664 | Robeco BP US Premium Equities DH € | `ACCEPT` | RV | equity | USA | 2026-05-17 | `5c489cba5bd2baef` |
| LU0321373184 | Schroder International Selection Fund European Dividend Maximiser B Distribution | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `8d3c770301f85a51` |
| LU0323041763 | Chahine Funds - Equity Europe R | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `f0367074ea2ac61f` |
| LU0326425351 | BlackRock Global Funds - World Mining Fund E2 EUR Hedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a671a61efed73a13` |
| LU0329070915 | Jupiter India Select Class L EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f766ef46d6157825` |
| LU0329203656 | JPMorgan Investment Funds - Global Dividend Fund D (acc) EUR (hedged) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `b2b50f9f8cf27a29` |
| LU0329206832 | JPMorgan Investment Funds - Japan Strategic Value Fund D (acc) EUR | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `0aef81bd51d93833` |
| LU0329355670 | Robeco QI Emerging Markets Active Equities D € | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `5f17889f7de31e6e` |
| LU0329430986 | GAM Multistock - Luxury Brands Equity EUR E | `ACCEPT` | RV | equity | Global | 2026-05-17 | `34d8ea2ce82ff3c5` |
| LU0329678410 | Fidelity Funds - Emerging Asia Fund A-Acc-EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `dc922fdca380f191` |
| LU0331286574 | BlackRock Global Funds - Sustainable Energy Fund C2 (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `0cdbf81a7a7442ff` |
| LU0333810850 | Goldman Sachs India Equity Portfolio E Acc EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `38a839d488363db9` |
| LU0340559557 | Pictet-Timber P EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `3e6cc49fa655e42e` |
| LU0345361124 | Fidelity Funds - Asia Pacific Opportunities Fund A-Acc-EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `537ac578a3742f83` |
| LU0348529792 | Fidelity Active Strategy - FAST - Europe Fund E-ACC-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `b716fc4602d10655` |
| LU0348784041 | Allianz Global Investors Fund - Allianz Oriental Income AT EUR | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `7ee2df4c47711c27` |
| LU0348926287 | Nordea 1 - Global Climate and Environment Fund BP EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `46df53ac917ad246` |
| LU0348927251 | Nordea 1 - Global Climate and Environment Fund E EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `e8f1db844fe824e1` |
| LU0353647737 | Fidelity Funds - European Dividend Fund A-Acc-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `f6372dd5c5538ae3` |
| LU0353649352 | Fidelity Funds - Global Inflation-linked Bond Fund E-Acc-EUR (hedged) | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `fd49113afed02b59` |
| LU0365089902 | Jupiter India Select Class L USD A Inc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a52f45c070c2f7ab` |
| LU0365775922 | Schroder International Selection Fund Greater China A Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `d74d8c4f6086a4e4` |
| LU0368678339 | Fidelity Funds - Pacific Fund A-Acc-EUR | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `f458d45401726c2e` |
| LU0384381660 | Morgan Stanley Investment Funds - QuantActive Global Infrastructure Fund A | `ACCEPT` | RV | equity | Global | 2026-05-17 | `9686ccb89fc84877` |
| LU0387754996 | Robeco Global Stars Equities D EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `67cd8ebf992e2102` |
| LU0391944815 | Pictet-Global Megatrend Selection R EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `07d7edd683e54e45` |
| LU0399356780 | DWS Invest Latin American Equities LC | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `56d739a7fa9fdcc5` |
| LU0413376566 | BlackRock Global Funds - Emerging Markets Bond Fund A2 Hedged | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `c48b659cae147501` |
| LU0413543058 | Fidelity Funds - Japan Value Fund A-Acc-EUR | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `f79d97484fcfb45c` |
| LU0415391431 | Bellevue Funds (Lux) - Bellevue Medtech & Services B EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `c0eb2317ba3e19d9` |
| LU0425308169 | BlackRock Global Funds - Global Inflation Linked Bond Fund A2 EUR Hedged | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `7bccf5ae93c561ed` |
| LU0430492750 | JPMorgan Funds - Euro Aggregate Bond Fund C (acc) EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `04b8e060d8db0a75` |
| LU0438336694 | BlackRock ESG Fixed Income Strategies Fund E2 EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `53b0e4a9a77d22ef` |
| LU0447425785 | SIH FCP - Short Term EUR A Classic | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `664e5476c8e566d6` |
| LU0455556406 | UBS (Lux) Bond SICAV - Global Inflation-linked (USD) (EUR hedged) P-acc | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `6c44555e54c30d27` |
| LU0469270010 | AB FCP I - Asia Ex-Japan Equity Portfolio C EUR Acc | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `15ca7e0902d2dffd` |
| LU0491217419 | Robeco Indian Equities D € | `ACCEPT` | RV | equity | Global | 2026-05-17 | `92f57618942a5004` |
| LU0496368142 | Franklin Gold and Precious Metals Fund A(acc)EUR-H1 | `ACCEPT` | RV | equity | USA | 2026-05-17 | `425d9679876d7fbe` |
| LU0496369389 | Franklin Gold and Precious Metals Fund N(acc)EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `dcbd46c9ed565d1a` |
| LU0501220429 | Global Evolution Funds - Frontier Markets R EUR H | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `c1fe5e9d3524b63d` |
| LU0503631714 | Pictet - Global Environmental Opportunities P EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `578370aea4fa1c20` |
| LU0522352516 | JPMorgan Funds - India Fund D (acc) EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `635ea5f9dc3aa16b` |
| LU0524465548 | Alken Fund - Small Cap Europe Class A | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `5ae90bdc712acc11` |
| LU0524465977 | Alken Fund - European Opportunities Class A | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `55767a0b1364ef80` |
| LU0546917344 | Goldman Sachs Euro Long Duration Bond - P Cap EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `6f5f1f2c33835c0a` |
| LU0552029406 | Amundi Funds - Latin America Equity A EUR (C) | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `0e7f1c81dd0ce162` |
| LU0552029661 | Amundi Funds - Latin America Equity G EUR (C) | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `7d1e31ea1f07c981` |
| LU0552385295 | Morgan Stanley Investment Funds - Global Opportunity Fund A | `ACCEPT` | RV | equity | Global | 2026-05-17 | `e2fe982ea623dd7f` |
| LU0554840230 | Robeco Global Consumer Trends Equities M | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ae42d839de0dcca7` |
| LU0563745743 | Bestinver Tordesillas SICAV Iberia A | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `daab2d446be0ca0f` |
| LU0565136552 | First Eagle Amundi International Fund Class FE-C Shares | `ACCEPT` | Mixto | allocation | Global | 2026-05-17 | `f5011384f3216ea8` |
| LU0568583420 | Amundi Funds - Equity Japan Target A EUR (C) | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `a540865f1f9573a1` |
| LU0568620727 | Amundi Funds - Cash EUR G2 EUR (C) | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `cc6409b7618c5d48` |
| LU0569862609 | UBAM - Global High Yield Solution AHC EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `1809ddd33e1a29c1` |
| LU0570870567 | CT (Lux) - Global Smaller Companies AE (EUR Accumulation Shares) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `5c4d83aa1124c014` |
| LU0571101558 | Groupama Euro High Yield NC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `23a02cfe69f8b176` |
| LU0594300096 | Fidelity Funds - China Consumer Fund A-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ca6c01cb072f4772` |
| LU0594539719 | Candriam Bonds Emerging Markets Class C EUR Hedged Cap | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `e1237e05a4f2d43a` |
| LU0602539867 | Nordea 1 - Emerging Sustainable Stars Equity Fund BP EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `495d40c6b4643ab0` |
| LU0604766674 | Allianz Global Investors Fund - Allianz Global Metals and Mining AT EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ace0fc79788c574c` |
| LU0607512935 | Invesco Funds - Invesco Developed Small and Mid-Cap Equity Fund E Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `7db8d213912441ef` |
| LU0607513586 | Invesco Funds - Invesco Global Equity Income Fund E Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `8a0951c438221e4c` |
| LU0616839501 | DWS Invest Euro High Yield Corporates LC | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `eb805411d369e305` |
| LU0616856935 | DWS Invest Brazilian Equities LC | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `10b3c0823a9f74bf` |
| LU0616857313 | DWS Invest Brazilian Equities NC | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `302a8f869983e06d` |
| LU0628612748 | BlackRock Global Funds - European Equity Income Fund E2 | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `7a805887c95f54ec` |
| LU0630951415 | Fidelity Funds - Emerging Asia Fund E-Acc-EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `1807c45508e637ab` |
| LU0631859229 | Bellevue Funds (Lux) - Bellevue Entrepreneur Europe Small B EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `734d19d3aa8522b5` |
| LU0637302547 | Nordea 1 - Emerging Market Corporate Bond Fund BP EUR | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `f5d9d0c496aca7c6` |
| LU0637335638 | Nordea 1 - Indian Equity Fund BP EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `1b00b09facb3f6d2` |
| LU0658026512 | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `b3a8903e0004fcc4` |
| LU0661986348 | JPMorgan Funds - Euroland Dynamic Fund D (perf) (acc) EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `e082142f56c87b2d` |
| LU0690375182 | Fundsmith Equity Fund T EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `b1c64432b0faef24` |
| LU0702159772 | Fidelity Funds - Asian Smaller Companies Fund A-Acc-EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `e5a9277bb9338b72` |
| LU0704154706 | RAM (Lux) Systematic Funds - Emerging Markets Equities O EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `d3e1979bc561b485` |
| LU0706127809 | UBS (Lux) Bond SICAV - Global Short Term Flexible (USD) (EUR hedged) P-acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `484632ce3e322a75` |
| LU0712123511 | Morgan Stanley Investment Funds - Global Fixed Income Opportunities Fund AH (EUR) | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `f3a3c4be01191bfb` |
| LU0733673288 | Nordea 1 - European Cross Credit Fund BP EUR | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `cb87f420ef386006` |
| LU0766123821 | Fidelity Funds - China Focus Fund E-Acc-EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `e56617e27afd37f0` |
| LU0769137737 | BlackRock Global Funds - Continental European Flexible Fund Class A2 (USD) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `bc62e55837bbd054` |
| LU0772958525 | Nordea 1 - North American Sustainable Stars Equity Fund BP USD | `ACCEPT` | RV | equity | USA | 2026-05-17 | `c5a273eb21794842` |
| LU0795636256 | Schroder International Selection Fund Emerging Markets Hard Currency A Accumulation EUR Hedged | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `abce52f593413788` |
| LU0813337002 | DWS Invest Latin American Equities NC | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `7486712b8a5d282d` |
| LU0815263628 | Morgan Stanley Investment Funds - Emerging Leaders Equity Fund A | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `9b3fbea9c9f03f5d` |
| LU0823411706 | BNP Paribas Funds Consumer InnovatorsClassic Capitalisation | `ACCEPT` | RV | equity | USA | 2026-05-17 | `2ee1c0287123d008` |
| LU0823421689 | BNP Paribas Funds Disruptive Technology Classic Capitalisation | `ACCEPT` | RV | equity | USA | 2026-05-17 | `62152d54fa287799` |
| LU0826452848 | DWS Invest II Global Equity High Conviction Fund LC | `ACCEPT` | RV | equity | Global | 2026-05-17 | `7b0f175498bb995a` |
| LU0826453226 | DWS Invest II Global Equity High Conviction Fund NC | `ACCEPT` | RV | equity | Global | 2026-05-17 | `51e51caad2c6c1ba` |
| LU0849399786 | Schroder International Selection Fund EURO High Yield A Accumulation | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `217efd59b112f1ee` |
| LU0857700040 | Fidelity Funds - European Dividend Fund A-MINCOME(G)-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `3e47944744c31f26` |
| LU0861897477 | Abante Global Funds Spanish Opportunities Class B | `ACCEPT` | RV | equity | Global | 2026-05-17 | `335024df5e432d81` |
| LU0862450516 | JPMorgan Funds - Emerging Markets Dividend Fund D (acc) EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `79139e0d977310a7` |
| LU0910636546 | Goldman Sachs Emerging Markets Debt Blend Portfolio Other Currency Acc EUR | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `b828df1a61662bbc` |
| LU0910636892 | Goldman Sachs Emerging Markets Debt Blend Portfolio E Acc EUR | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `5f622137adde4497` |
| LU0918140210 | T. Rowe Price Funds SICAV - US Smaller Companies Equity Fund A (EUR) | `ACCEPT` | RV | equity | USA | 2026-05-17 | `7a4b92ab393fff8f` |
| LU0922333322 | Fidelity Funds - Italy Fund A-Acc-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-16 | `fa3212aa93e70c12` |
| LU0926439992 | Vontobel Fund - Emerging Markets Debt H (hedged) EUR Cap | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `56ac3d383b0b1240` |
| LU0933684101 | Incometric Equam Global Value A | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `19bd4a7f5c3f65f7` |
| LU0935222900 | Natixis AM Funds - Ostrum Euro Inflation R/A (EUR) | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `094babbc19fabf5d` |
| LU0935230242 | Natixis AM Funds - Ostrum Europe MinVol RE/A (EUR) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `ebb742a44bc76de3` |
| LU0940719098 | UBAM - Global High Yield Solution RHC EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `7acb4953029bbabc` |
| LU0986194024 | SIH FCP - Equity Europe A Classic | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `9defca74cf161c46` |
| LU0995119665 | Schroder International Selection Fund EURO Credit Conviction A Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `02fd486a56b478b5` |
| LU0995119749 | Schroder International Selection Fund EURO Credit Conviction B Accumulation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `0f96f2ff34d2aab3` |
| LU1021288268 | AB FCP I - Mortgage Income Portfolio A2 EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `fd0b1489257979e4` |
| LU1022658667 | Franklin Euro Short Duration Bond Fund A(acc)EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `0699532414aaa51a` |
| LU1066281574 | SIH FCP - Equity Spain A Classic | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `0fdd1a0751529dfd` |
| LU1079477284 | Allianz Emerging Markets Short Duration Bond AT (H2-EUR) | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `3e6b13735140f160` |
| LU1080015693 | Edmond de Rothschild Fund - Emerging Credit A EUR Hedged | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `ea7d5d96c05179f2` |
| LU1088692675 | UBAM - Global Equity AC EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `ba10a22668f950b9` |
| LU1089088741 | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT EUR | `ACCEPT` | RF | fixed_income | USA | 2026-05-17 | `7d35402af5cce6cd` |
| LU1103303167 | Edmond de Rothschild Fund - US Value A EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `7785820b9bdac003` |
| LU1111642820 | Eleva European Selection A2 EUR acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `70ecc2fa0b608126` |
| LU1120766388 | Candriam Equities L Biotechnology Class C EUR Cap | `ACCEPT` | RV | equity | USA | 2026-05-17 | `8d305547ba1df2a7` |
| LU1161086159 | Amundi Funds - Emerging Markets Blended Bond A EUR (C) | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `c1af84495fabdf99` |
| LU1161526576 | Edmond de Rothschild Fund - Bond Allocation R EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `73c04607dd3f077c` |
| LU1164219682 | AXA World Funds - Euro Credit Total Return A Capitalisation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `cc5a0d857f65ae9a` |
| LU1164220854 | AXA World Funds - Euro Credit Total Return E Capitalisation EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `18260cad0f4c52f0` |
| LU1165644672 | IVO Funds - IVO Emerging Markets Corporate Debt EUR R Acc | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `86af38ca52ff3051` |
| LU1206943596 | Fidelity Active Strategy - FAST - Emerging Markets Fund A-ACC-EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `f02730e9eedc4916` |
| LU1213836080 | Fidelity Funds - Global Technology Fund A-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-16 | `f8ac22bc634918b5` |
| LU1223083087 | Schroder International Selection Fund Global Gold A Accumulation EUR Hedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `68b9a9f03dba7b94` |
| LU1223084051 | Schroder International Selection Fund Global Gold A Accumulation PLN Hedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `d9bc421470b9a0f5` |
| LU1244893696 | Edmond de Rothschild Fund - Big Data A-EUR accumulating | `ACCEPT` | RV | equity | USA | 2026-05-17 | `25c78f5b6c8417c7` |
| LU1244895394 | Edmond de Rothschild Fund - Big Data R EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `9bf47614c1b1dccf` |
| LU1254412460 | abrdn SICAV I - Indian Bond Fund A Acc EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `5eea6df5811b38eb` |
| LU1279334483 | Pictet - Robotics R EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `c44cdb256001bbc2` |
| LU1295551144 | Capital Group New Perspective Fund (LUX) B (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c7058e0369074465` |
| LU1298174530 | CT (Lux) - Global Multi Asset Income Class AE (EUR Accumulation Shares) | `ACCEPT` | Mixto | allocation | Global | 2026-05-17 | `570b98dfc2ff4327` |
| LU1299306321 | Carmignac Portfolio Sécurité AW EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `4790597e561578c5` |
| LU1299311164 | Carmignac Portfolio Investissement A EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `5d5a1a04ba75e879` |
| LU1299311834 | Carmignac Portfolio Investissement E EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f6d7918f8072fd1d` |
| LU1301026388 | Sycomore Fund SICAV - Sycomore Europe Happy@Work RC EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `9b11d8eb218c0d01` |
| LU1321847805 | BlackRock Strategic Funds - Emerging Markets Equity Strategies Fund E2 EUR | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `77154175ff9dbc6f` |
| LU1330191542 | Magallanes Value Investors UCITS European Equity R EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `1fd2809a2400addf` |
| LU1333148903 | Azvalor Lux SICAV Azvalor International R | `ACCEPT` | RV | equity | Global | 2026-05-17 | `fad92525d5668019` |
| LU1340702932 | MFS Meridian Funds - Global Opportunistic Bond Fund A1 EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `d95204944854bd4c` |
| LU1353951376 | AXA World Funds - Global Inflation Short Duration Bonds E Capitalisation EUR (Hedged) | `ACCEPT` | Monetario | money_market | Global | 2026-05-16 | `0d20c20ec8d43008` |
| LU1362999481 | Robeco High Yield Bonds D € | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `f4113afdc0dbf105` |
| LU1372006947 | Cobas LUX SICAV - Cobas Selection Fund Class P Acc EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `51a9a3db3f93f953` |
| LU1373035234 | BlackRock Strategic Funds - BSF Systematic Style Factor Fund E2 EUR Hedged | `ACCEPT` | Alternativos | alternative | Global | 2026-05-17 | `78b81c2542a24268` |
| LU1378878430 | Morgan Stanley Investment Funds - Asia Opportunity Fund A | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `729b880589b9b4b5` |
| LU1383852487 | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT2 EUR | `ACCEPT` | RF | fixed_income | USA | 2026-05-17 | `966bcc1d08da7627` |
| LU1391767586 | Fidelity Funds - Global Financial Services Fund A-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `186d0b36a3f4545d` |
| LU1481179858 | Capital Group New World Fund (LUX) B (EUR) | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `48377ae32e602056` |
| LU1481583711 | Flossbach von Storch - Bond Opportunities RT | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `ae4cc080b527df7d` |
| LU1486845537 | Oddo BHF Euro Credit Short Duration CR-EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `4fd916adc7ba59fd` |
| LU1499628912 | Amundi S.F. - Diversified Short-Term Bond Select E EUR ND | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `549fdcb0ab5cda94` |
| LU1529955046 | Eurizon Fund - Bond Aggregate RMB Class R EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `64117e4c354ad542` |
| LU1542714578 | Goldman Sachs Europe Sustainable Equity - X Cap EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `dce965636cfba6b5` |
| LU1548496022 | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 15 AT EUR | `ACCEPT` | Mixto | allocation | Global | 2026-05-17 | `80005c165f48b1c0` |
| LU1548497699 | Allianz Global Investors Fund - Allianz Global Artificial Intelligence AT EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `00bf3f34677f5302` |
| LU1578889864 | Ninety One Global Strategy Fund - Global Gold Fund A Acc EUR Hedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `cdff3b3f03bb6368` |
| LU1582984149 | M&G (Lux) European Inflation Linked Corporate Bond Fund EUR A Acc | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `8f994888922d5c6f` |
| LU1582988306 | M&G (Lux) Dynamic Allocation Fund EUR B Acc | `ACCEPT` | Mixto | allocation | Emergentes | 2026-05-17 | `5e1a540690aeafe7` |
| LU1623762843 | Carmignac Pf Credit A EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `8ee76fdba09017fd` |
| LU1665237704 | M&G (Lux) Global Listed Infrastructure Fund EUR A Acc | `ACCEPT` | RV | equity | Global | 2026-05-16 | `8c42e45e75fbe631` |
| LU1670618187 | M&G (Lux) Asian Fund EUR A Acc | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `2667f36e8a5643bd` |
| LU1670618690 | M&G (Lux) Global Emerging Markets Fund EUR A Acc | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `75995ec7ecd45946` |
| LU1670626446 | M&G (Lux) Japan Fund EUR A Acc | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `e63b3dd27c249411` |
| LU1670631016 | M&G (Lux) Emerging Markets Bond Fund EUR A Acc | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `282bda4e8ea68da0` |
| LU1670631289 | M&G (Lux) Emerging Markets Bond Fund EUR A-H Acc | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `0692cdfc05baa5db` |
| LU1670707527 | M&G (Lux) European Strategic Value Fund EUR A Acc | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `18c8416eeefebb09` |
| LU1670710075 | M&G (Lux) Global Dividend Fund EUR A Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `24b488f61b8ed36b` |
| LU1670715975 | M&G (Lux) Japan Smaller Companies Fund EUR A Acc | `ACCEPT` | RV | equity | Japón | 2026-05-17 | `9e32e592f61390f0` |
| LU1670718219 | M&G (Lux) Short Dated Corporate Bond Fund EUR A Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `87c01bbcadea4c29` |
| LU1670722161 | M&G (Lux) Global Floating Rate High Yield Fund EUR A-H Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `044d69955d00c7f6` |
| LU1670724373 | M&G (Lux) Optimal Income Fund EUR A Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `598287f3a48198bf` |
| LU1679113404 | UBS (Lux) Bond SICAV - Floating Rate Income (USD) (EUR hedged) P-acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `1167d276821d99d3` |
| LU1694212348 | Nordea 1 - Low Duration European Covered Bond Fund BP EUR | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `f5127ee999ea0d8b` |
| LU1694789451 | DNCA Invest Alpha Bonds A EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `73b37d4cfe1934b6` |
| LU1697013008 | SIH FCP - Flexible Fixed Income USD | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `e0337ac0942bf197` |
| LU1697016365 | Sigma Investment House FCP - Selection Defensive Class A EUR | `ACCEPT` | Mixto | allocation | USA | 2026-05-17 | `a990709f017bfebd` |
| LU1706854152 | Amundi S.F. - Diversified Short-Term Bond Select A EUR ND | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `d42df04cc5a7eeb7` |
| LU1717592262 | Groupama Global Inflation Short Duration NC | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `5a2c4cf46aff5dcf` |
| LU1738492658 | Aviva Investors - Short Duration Global High Yield Bond Fund Ah EUR Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `6b97fda025f87bb9` |
| LU1740985814 | DWS Strategic Allocation Dynamic LD | `ACCEPT` | Mixto | allocation | Global | 2026-05-17 | `f0fd7f1bb4832d83` |
| LU1762221155 | Invesco Funds - Invesco Global Founders & Owners Fund E Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `b7cf3c6e6b2cfb9c` |
| LU1775950477 | Invesco Funds - Invesco Asian Equity Fund E Accumulation EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `cc811e1d36486827` |
| LU1819480192 | Echiquier Artificial Intelligence B EUR | `ACCEPT` | RV | equity | USA | 2026-05-17 | `db3f8597a4971603` |
| LU1829329819 | CT (Lux) - Pan European Smaller Companies 1E (EUR Accumulation Shares) | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `3182bf43c03701dc` |
| LU1838941372 | Candriam Bonds Floating Rate Notes C EUR Cap | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `47b7a96e257cbca3` |
| LU1873127366 | JPMorgan Liquidity Funds - EUR Liquidity LVNAV Fund A (acc) | `ACCEPT` | Monetario | money_market | Global | 2026-05-17 | `90b399567f61f5a0` |
| LU1882457143 | Amundi Funds - Emerging Markets Corporate High Yield Bond A EUR (C) | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `71e270324d574e0f` |
| LU1882462655 | Amundi Funds - Emerging Markets Short Term Bond A2 EUR (C) | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `344c1ed5c4b306db` |
| LU1882462739 | Amundi Funds - Emerging Markets Short Term Bond A2 EUR Hgd (C) | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `7b8d00bcdf2c8287` |
| LU1883318740 | Amundi Funds - Global Equity Responsible A EUR (C) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f7c2eb2dff6d82ec` |
| LU1883334275 | Amundi Funds - Global Subordinated Bond A EUR (C) | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `0bab2c1f524c05cc` |
| LU1883342377 | Amundi Funds - Global Equity A EUR (C) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a9608a085b8c1df1` |
| LU1897556517 | Groupama Global Disruption NC | `ACCEPT` | RV | equity | Global | 2026-05-16 | `224242fd06ccb7d0` |
| LU1902444584 | CPR Invest - Climate Bonds Euro - A EUR - Acc | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `8b93e21b1091bf19` |
| LU1915690918 | Nordea 1 - Active Rates Opportunities Fund Fund E EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `b1329406237bffba` |
| LU1919971074 | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-17 | `7abbdf457c483f16` |
| LU1931535931 | Allianz Pet and Animal Wellbeing AT EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `e14f6f4df5b8b415` |
| LU1939214695 | Nordea 1 - Global Diversity Engagement Fund BP EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `84b03dacadcf48d0` |
| LU1951921383 | Allianz Global Investors Fund - Allianz Credit Opportunities AT EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `1f5635b40ff65f56` |
| LU1983299162 | Schroder International Selection Fund Global Alternative Energy A Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `38724d12bcc20c89` |
| LU2002383896 | Allianz Global Investors Fund - Allianz Credit Opportunities Plus AT EUR | `ACCEPT` | RF | fixed_income | USA | 2026-05-17 | `e032b90a97b7216d` |
| LU2016064201 | Schroder International Selection Fund Global Alternative Energy A Accumulation EUR Hedged | `ACCEPT` | RV | equity | Global | 2026-05-17 | `d0f55b2d1da44ba6` |
| LU2050411763 | BlackRock Global Funds - Emerging Markets Equity Income Fund A2 (EUR) | `ACCEPT` | RV | equity | Emergentes | 2026-05-17 | `23ceacacd575093b` |
| LU2050860480 | Fidelity Funds - UK Special Situations Fund A-ACC-EUR | `ACCEPT` | RV | equity | Europa | 2026-05-17 | `dff754204dbced74` |
| LU2050929277 | Capital Group New Economy Fund (LUX) B (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `c3586f6fcc8943f9` |
| LU2092176515 | BlueBox Funds - BlueBox Global Technology Fund Class C EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `f9c191a248b14744` |
| LU2094235707 | Goldman Sachs Global Future Technology Leaders Equity Portfolio Class E Shares | `ACCEPT` | RV | equity | Global | 2026-05-17 | `46f85867438dd275` |
| LU2098772366 | Candriam Bonds Credit Alpha C EUR | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `934c3a1a096dd50b` |
| LU2131365186 | UBS (Lux) Equity Fund - China Opportunity (USD) P EUR acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `185f49d4d056feac` |
| LU2133220793 | Robeco Sustainable Asian Stars Equities DL EUR | `ACCEPT` | RV | equity | Asia | 2026-05-17 | `d073df61c19556c5` |
| LU2145461757 | Robeco Smart Energy D-EUR Capitalisation | `ACCEPT` | RV | equity | Global | 2026-05-16 | `9673d511241731e9` |
| LU2145463373 | Robeco Smart Energy M2-EUR Capitalisation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `610883ee6cb96f1c` |
| LU2146190835 | Robeco Sustainable Water D-EUR Capitalisation | `ACCEPT` | RV | equity | USA | 2026-05-17 | `4af29a53cc6a93a6` |
| LU2210151341 | Fidelity Funds - Absolute Return Global Equity Fund A-PF-Acc-Euro (Euro/USD hedged) | `ACCEPT` | Alternativos | alternative | Global | 2026-05-17 | `f936ab9109f58817` |
| LU2222028099 | Merchbanc FCP Renta Fija Flex A | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `601dfc5bd42cddf4` |
| LU2267099674 | BlackRock Global Funds - China Bond Fund Class A2 USD (EUR) | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `4c2634090cab9346` |
| LU2278574558 | Buy & Hold Luxembourg B&H Equity Class 2 | `ACCEPT` | RV | equity | Global | 2026-05-17 | `4e46150a04fb4c38` |
| LU2278574988 | Buy & Hold Luxembourg B&H Bond Class 2 | `ACCEPT` | RF | fixed_income | Global | 2026-05-17 | `d153bba19545b375` |
| LU2295319300 | Morgan Stanley Investment Funds - Global Brands Fund A (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `aa4f3e4a7aeda9b5` |
| LU2295320068 | Morgan Stanley Investment Funds - Global Insight Fund A (EUR) | `ACCEPT` | RV | equity | Global | 2026-05-17 | `a8d63c1c235ef598` |
| LU2337806421 | Morgan Stanley Investment Funds - Global Endurance Fund A EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `2c673a39780b8805` |
| LU2357235493 | Incometric Fund Nartex Equity Fund A Cap EUR Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `d54424a19c14f0c0` |
| LU2357235576 | Incometric Fund Nartex Equity Fund R Cap EUR Accumulation | `ACCEPT` | RV | equity | Global | 2026-05-17 | `9b5a84f04a2cd1b8` |
| LU2482630162 | M&G European Credit Investment Fund Class P EUR Acc | `ACCEPT` | RF | fixed_income | Europa | 2026-05-17 | `ee6dfd9688096076` |
| LU2504555777 | Fidelity Funds - Global Industrials Fund A-Acc-EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `e9765a00d8522df6` |
| LU2601038578 | Invesco Funds - Invesco Global Founders & Owners Fund A Accumulation EUR | `ACCEPT` | RV | equity | Global | 2026-05-17 | `25d222b0726d8111` |
| LU2784406998 | Morgan Stanley Investment Funds - Emerging Markets Debt Opportunities Fund A | `ACCEPT` | RF | fixed_income | Emergentes | 2026-05-16 | `12a52c216c0e82db` |
| LU3038481936 | Hamco SICAV - Global Value R EUR Acc | `ACCEPT` | RV | equity | Global | 2026-05-17 | `db4722944438973a` |

---

## 10. Confirmaciones Absolutas de Seguridad

* **Firestore writes = 0**: **CONFIRMADO** (Ninguna escritura en base de datos real).
* **Write ejecutado = NO**: **CONFIRMADO** (Este documento es solo un manifest de aprobación).
* **REVIEW incluidos = 0**: **CONFIRMADO** (Los 95 fondos REVIEW están completamente excluidos).
* **ERROR incluidos = 0**: **CONFIRMADO** (Los 32 fondos ERROR/BLOCKED están completamente excluidos).
* **Overlap ACCEPT ∩ REVIEW = 0**: **CONFIRMADO**.
* **Overlap ACCEPT ∩ ERROR = 0**: **CONFIRMADO**.
* **BDB-FONDOS-CORE tocado = NO**: **CONFIRMADO**.
* **Evidence Layer reactivada = NO**: **CONFIRMADO**.
* **Capturas PNG usadas = NO**: **CONFIRMADO**.
* **Deploy = NO**: **CONFIRMADO**.
* **Commit = NO**: **CONFIRMADO**.
* **Push = NO**: **CONFIRMADO**.

---

## 11. Próximos Pasos (Requieren Aprobación Humana)

1. **Revisar este manifest** y el archivo `MORNINGSTAR_PDF_PARSER/SALIDA/write_gate_manifest_0.json`.
2. **Capturar snapshot pre-write** de los 522 ISINs en Firestore antes de ejecutar.
3. **Aprobar el Write Gate** indicando explícitamente qué ISINs o grupos se autorizan.
4. **Ejecutar el Write Gate controlado** con el script correspondiente (aún por implementar).
5. **Verificar post-write** comparando el snapshot pre-write con el estado resultante en Firestore.

---

*Fin del documento de Write Gate 0 — Estado: PENDING_HUMAN_APPROVAL — would_write: false*
