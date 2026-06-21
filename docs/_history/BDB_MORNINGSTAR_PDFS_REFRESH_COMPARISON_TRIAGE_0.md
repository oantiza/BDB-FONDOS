# BDB-MORNINGSTAR-PDFS-REFRESH-COMPARISON-TRIAGE-0

Fecha de ejecucion: 2026-05-18T17:48:38.628Z

## Resumen ejecutivo

- Fuente usada: `artifacts/bdb_parser_audit/morningstar_pdfs_refresh_firestore_comparison_0.json`.
- Propuestas analizadas: 619. Encontradas en `funds_v3`: 617. No encontradas: 2.
- Resultado comparador: 0 NO_CHANGE, 83 LOW_RISK_UPDATE, 534 REVIEW_REQUIRED, 0 BLOCKED, 2 NOT_FOUND_IN_FUNDS_V3.
- Campos prohibidos detectados: NO. No aparecen `manual.*`, `manual.costs.retrocession`, `retrocession` ni `portfolio_exposure_v2.economic_exposure` en rutas comparadas/propuestas.
- Diagnostico: no hay BLOCKER real. El volumen alto de REVIEW viene sobre todo de comparador conservador ante cambios de `classification_v2` y `portfolio_exposure_v2`.
- Lote pequeno apto para futuro write gate: los 83 LOW_RISK_UPDATE, previo muestreo humano. Los 534 REVIEW y los 2 NOT_FOUND quedan fuera.

## Controles de seguridad

- Gemini calls = 0.
- Firestore writes = 0.
- Parser/PDF reparse = 0.
- PDFs movidos = 0.
- Deploy = NO. Commit = NO. Push = NO.
- `BDB-FONDOS-CORE` no tocado. `funds_core_v1` no usado.

## NOT_FOUND_IN_FUNDS_V3

| ISIN | Nombre | Categoria | Divisa | Resumen propuesta | Recomendacion |
| --- | --- | --- | --- | --- | --- |
| LU0171281750 | BlackRock Global Funds - European Value Fund A2 (USD) | RV Europa Cap. Grande Value | USD | report=2026-05-17; cartera=2026-04-30; mix={"equity":0.9697,"bond":0.0009,"cash":0.0294,"other":0} | Revisar alta manual o ignorar/excluir; no apto para write gate automatico. |
| LU0171282212 | BlackRock Global Funds - European Value Fund A2 (GBP) | RV Europa Cap. Grande Value | GBP | report=2026-05-17; cartera=2026-04-30; mix={"equity":0.9697,"bond":0.0009,"cash":0.0294,"other":0} | Revisar alta manual o ignorar/excluir; no apto para write gate automatico. |

## LOW_RISK_UPDATE

Los 83 LOW_RISK no traen `risk_flags` ni campos prohibidos. Son candidatos razonables para un write gate posterior pequeno, con revision humana por muestra. Los grupos son solapados: un mismo fondo puede contar en varias familias de cambio.

| Grupo | PDFs |
| --- | --- |
| date_refresh | 83 |
| holdings_refresh | 79 |
| asset_allocation_or_asset_mix | 81 |
| fixed_income_credit_duration_yield | 65 |
| sector_region_style | 54 |
| ratings_esg | 50 |
| quality_or_hash | 65 |
| other | 0 |

### Top 20 LOW_RISK por impacto

| ISIN | Nombre | Categoria | Cambios |
| --- | --- | --- | --- |
| LU1883329432 | Amundi Funds - Global Multi-Asset Conservative A EUR (C) | Mixtos Defensivos EUR | 112 |
| IE00BYX5NX33 | Fidelity MSCI World Index Fund EUR P Acc | RV Global Cap. Grande Blend | 107 |
| ES0114633003 | Panda Agriculture & Water Fund FI | Sector Equity Agriculture | 106 |
| LU0227385266 | Nordea 1 - Stable Return Fund E EUR | Mixtos Moderados EUR | 99 |
| LU1330191542 | Magallanes Value Investors UCITS European Equity R EUR | RV Europa Cap. Mediana | 96 |
| LU0391944815 | Pictet-Global Megatrend Selection R EUR | RV Global Cap. Med/Peq | 95 |
| LU0112467450 | Nordea 1 - Global Stable Equity Fund BP EUR | RV Global Cap. Grande Value | 94 |
| LU0153925689 | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc | RV Europa Cap. Grande Value | 89 |
| LU0161305163 | Schroder International Selection Fund European Value A Accumulation EUR | RV Europa Cap. Mediana | 86 |
| LU0115139569 | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR | RV Sector Consumo | 83 |
| LU0208853944 | JPMorgan Funds - Global Natural Resources Fund D (acc) EUR | RV Sector Recursos Naturales | 83 |
| LU0353647737 | Fidelity Funds - European Dividend Fund A-Acc-EUR | RV Europa Alto Dividendo | 83 |
| LU0260085492 | Jupiter European Select Class L EUR Acc | RV Europa Cap. Grande Blend | 82 |
| LU0309468980 | Nordea 1 - Latin American Equity Fund E EUR | RV Latinoamérica | 81 |
| ES0162368007 | Metavalor Internacional I FI | Global Small-Cap Equity | 80 |
| ES0165242001 | Myinvestor S&P500 Equiponderado FI | RV USA Cap. Grande Blend | 80 |
| LU0114723033 | Fidelity Funds - Global Industrials Fund E-Acc-EUR | RV Sector Materiales Insustriales | 78 |
| LU0321373184 | Schroder International Selection Fund European Dividend Maximiser B Distribution | RV Europa Alto Dividendo | 72 |
| IE00B28YJQ65 | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities Fund Inc (EUR) | RV Sector Salud | 63 |
| LU0119620416 | Morgan Stanley Investment Funds - Global Brands Fund A | RV Global Cap. Grande Blend | 61 |

## REVIEW_REQUIRED

Los 534 REVIEW se explican principalmente por cambios de exposicion y clasificacion. Los grupos siguientes tambien son solapados.

| Motivo | PDFs |
| --- | --- |
| category_change | 31 |
| asset_type_change | 480 |
| exposure_material_change | 532 |
| missing_current_field | 0 |
| missing_proposed_field | 18 |
| fund_not_found | 0 |
| semantic_tension | 480 |
| credit_duration_missing_or_changed | 434 |
| parser_conservatism | 139 |
| other | 0 |

### Risk flags REVIEW

| Flag | PDFs |
| --- | --- |
| classification_or_asset_type_changed | 480 |
| material_exposure_change | 394 |
| proposal_incomplete_relevant_fields | 18 |
| equity_classification_with_low_equity_exposure | 1 |

### Top 20 REVIEW por impacto

| ISIN | Nombre | Categoria | Cambios | Flags |
| --- | --- | --- | --- | --- |
| LU1882475392 | Amundi Funds - Euro Multi-Asset Target Income A2 EUR (C) | Mixtos Defensivos EUR | 157 | classification_or_asset_type_changed, material_exposure_change |
| LU1894680757 | Amundi Funds - Income Opportunities A2 EUR (C) | Mixtos Moderados USD | 157 | classification_or_asset_type_changed |
| LU1697018494 | Sigma Investment House FCP - Best JP Morgan Class A EUR | Mixtos Flexibles EUR | 153 | classification_or_asset_type_changed, material_exposure_change |
| LU1883327816 | Amundi Funds - Global Multi-Asset A EUR (C) | Mixtos Moderados EUR | 151 | classification_or_asset_type_changed, material_exposure_change |
| LU1883330521 | Amundi Funds - Global Multi-Asset Target Income A2 EUR (C) | Mixtos Defensivos USD | 151 | classification_or_asset_type_changed, material_exposure_change |
| LU0318931192 | Fidelity Funds - China Focus Fund A-Acc-EUR | RV China | 150 | classification_or_asset_type_changed, material_exposure_change |
| ES0125323008 | Gestión Value A FI | Global Small-Cap Equity | 146 | classification_or_asset_type_changed, material_exposure_change |
| ES0162949012 | Abante Índice Selección A FI | Mixtos Moderados EUR | 141 | classification_or_asset_type_changed, material_exposure_change |
| LU0251119078 | Fidelity Funds - Fidelity Target™ 2035 Fund A-Acc-EUR | Fecha Objetivo 2031-2035 | 140 | classification_or_asset_type_changed, material_exposure_change |
| LU1697016019 | Sigma Investment House FCP - Selection AggressiveClass A EUR | EAA Fund EUR Flexible Allocation-Global | 140 | classification_or_asset_type_changed |
| LU0121216526 | Goldman Sachs Patrimonial Aggressive - X Cap EUR | Mixtos Agresivos EUR | 139 | classification_or_asset_type_changed, material_exposure_change |
| LU0583242994 | MFS Meridian Funds - Prudent Wealth Fund A1 EUR | Mixtos Moderados USD | 139 | classification_or_asset_type_changed, material_exposure_change |
| LU3038481936 | Hamco SICAV - Global Value R EUR Acc | Global Small-Cap Equity | 139 | classification_or_asset_type_changed, material_exposure_change |
| ES0141991002 | Gestión Talento FI | Global Small-Cap Equity | 138 | classification_or_asset_type_changed, material_exposure_change |
| DE000DWS17J0 | DWS ESG Dynamic Opportunities LC | Mixtos Agresivos EUR | 137 | classification_or_asset_type_changed, material_exposure_change |
| LU1481179858 | Capital Group New World Fund (LUX) B (EUR) | RV Global Emergente | 137 | classification_or_asset_type_changed, material_exposure_change |
| LU1697017686 | Sigma Investment House FCP - Selection Dynamic Class A EUR | Mixtos Agresivos EUR | 136 | classification_or_asset_type_changed |
| LU1740985814 | DWS Strategic Allocation Dynamic LD | Mixtos Agresivos EUR | 136 | classification_or_asset_type_changed, material_exposure_change |
| FR0010286013 | Sextant Grand Large A | Mixtos Moderados EUR | 135 | classification_or_asset_type_changed, material_exposure_change |
| LU1594335520 | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 75 AT EUR | Mixtos Agresivos EUR | 134 | classification_or_asset_type_changed |

## Interpretacion

- Cambios realmente peligrosos: no se detecta blocker real ni campos prohibidos. Si hay riesgo, esta en la semantica de clasificacion/exposicion, no en escritura sobre campos vetados.
- Comparador demasiado estricto: si. 480 REVIEW saltan por `classification_or_asset_type_changed` y 394 por `material_exposure_change`; 532 tienen algun cambio de exposicion/material.
- Campos nuevos o faltantes: impacto pequeno. Solo 18 REVIEW tienen `proposal_incomplete_relevant_fields`; no hay `missing_current_field` detectado por este artefacto.
- Cambios normales Morningstar: muy probable en fechas, cartera, sectores, regiones, estilo, credito y duracion. La cartera pasa a fecha 2026-04-30 en la mayoria.
- Diferencias de formato/nombres: aparecen en algunos LOW_RISK (`name`) y en categorias Morningstar puntuales, pero no explican el grueso.

## Recomendacion

1. No lanzar write gate sobre los 534 REVIEW_REQUIRED todavia.
2. Preparar, en un bloque separado y solo si se autoriza, un gate pequeno para los 83 LOW_RISK_UPDATE.
3. Ajustar el comparador antes de escribir REVIEW: separar refresh normal de cartera/exposicion de cambios reales de tipo de activo/categoria.
4. Tratar `LU0171281750` y `LU0171282212` como alta manual/ignorar, nunca como update automatico.

## Artefacto JSON

Creado: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_pdfs_refresh_comparison_triage_0.json`

## Validacion final

- total_proposals = 619.
- encontrados/no encontrados en funds_v3 = 617 / 2.
- no_change = 0.
- low_risk_update = 83.
- review_required = 534.
- blocked = 0.
- forbidden_fields_detected = false.
- Firestore writes = 0. Gemini calls = 0. PDFs movidos = 0.
- Deploy = NO. Commit = NO. Push = NO.
