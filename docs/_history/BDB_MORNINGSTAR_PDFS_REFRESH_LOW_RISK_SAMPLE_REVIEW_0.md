# BDB-MORNINGSTAR-PDFS-REFRESH-LOW-RISK-SAMPLE-REVIEW-0

Fecha de ejecucion: 2026-05-18T17:52:41.865Z

## Resumen

- LOW_RISK_UPDATE totales: 83.
- Muestra revisada: 18 ISINs.
- Cobertura: renta variable 7, renta fija 9, mixtos 2.
- Cobertura funcional: holdings 15, asset allocation/asset mix 17, credito/duracion/yield 12, ratings/ESG 12.
- Campos prohibidos detectados en la muestra: NO.
- Riesgo principal: algunos LOW_RISK tienen muchos campos refrescados; sigue siendo refresh normal, pero conviene gate pequeno y revisable.
- Recomendacion: apto para write gate pequeno = SI, limitado estrictamente a LOW_RISK_UPDATE y con revision humana previa.

## Seguridad

- Gemini calls = 0.
- Firestore writes = 0.
- Parser/PDF reparse = 0.
- PDFs movidos = 0.
- Deploy = NO. Commit = NO. Push = NO.
- `BDB-FONDOS-CORE` no tocado. `funds_core_v1` no usado.
- `manual.*`, `manual.costs.retrocession` y `portfolio_exposure_v2.economic_exposure` no tocados.

## Muestra seleccionada

| ISIN | Nombre | Tipo | Categoria | Cambios | Familias |
| --- | --- | --- | --- | --- | --- |
| LU1883329432 | Amundi Funds - Global Multi-Asset Conservative A EUR (C) | mixtos | Mixtos Defensivos EUR | 112 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style |
| LU0227385266 | Nordea 1 - Stable Return Fund E EUR | mixtos | Mixtos Moderados EUR | 99 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style, ratings_esg |
| IE00BYX5NX33 | Fidelity MSCI World Index Fund EUR P Acc | renta_variable | RV Global Cap. Grande Blend | 107 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style |
| ES0114633003 | Panda Agriculture & Water Fund FI | renta_variable | Sector Equity Agriculture | 106 | date_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU1330191542 | Magallanes Value Investors UCITS European Equity R EUR | renta_variable | RV Europa Cap. Mediana | 96 | date_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU0391944815 | Pictet-Global Megatrend Selection R EUR | renta_variable | RV Global Cap. Med/Peq | 95 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style |
| LU0112467450 | Nordea 1 - Global Stable Equity Fund BP EUR | renta_variable | RV Global Cap. Grande Value | 94 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style, ratings_esg |
| LU0353647737 | Fidelity Funds - European Dividend Fund A-Acc-EUR | renta_variable | RV Europa Alto Dividendo | 83 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style, ratings_esg |
| LU1694789451 | DNCA Invest Alpha Bonds A EUR | renta_fija | Global Flexible Bond | 47 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU2482630162 | M&G European Credit Investment Fund Class P EUR Acc | renta_fija | RF Deuda Corporativa EUR | 47 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU1022658667 | Franklin Euro Short Duration Bond Fund A(acc)EUR | renta_fija | RF Diversificada Corto Plazo EUR | 46 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU0243958393 | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR | renta_fija | RF Deuda Corporativa EUR | 45 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU0658026512 | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E | renta_fija | RF Bonos Alto Rendimiento EUR | 45 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU1919971074 | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR | renta_fija | RF Global Emergente - Sesgo EUR | 45 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, quality_or_hash |
| FR0013201001 | EdR SICAV - Euro Sustainable Credit R EUR | renta_fija | RF Deuda Corporativa EUR | 44 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| LU1299306321 | Carmignac Portfolio Sécurité AW EUR Acc | renta_fija | RF Diversificada Corto Plazo EUR | 44 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, quality_or_hash |
| ES0142167032 | SIH Renta Fija A FI | renta_fija | RF Diversificada EUR | 43 | date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash |
| ES0112602000 | Azvalor Managers FI | renta_variable | Global Small-Cap Equity | 6 | date_refresh, fixed_income_credit_duration_yield, quality_or_hash |

## Revision por ISIN

### LU1883329432 - Amundi Funds - Global Multi-Asset Conservative A EUR (C)

- Tipo: mixtos. Categoria: Mixtos Defensivos EUR.
- Campos cambiados segun comparador: 112. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-30 |
| ms.portfolio.asset_allocation.equity | 26.05 | 26.22 |
| ms.portfolio.asset_allocation.bond | 88.65 | 90.65 |
| ms.portfolio.asset_allocation.other | 8.33 | 7.59 |
| ms.holdings_top10 | [2Y T-Note (CBT) Dec 25 (12.78); Amundi IS MSCI Emerg Mkts Swp... (3.74); Italy (Republic Of)... (3.32); ... +7] | [5Y T-Note (CBT) Jun 26 (15.29); 2Y T-Note (CBT) Jun 26 (10.59); United States Treasury Notes... (4.45); ... +7] |
| ms.holdings_stats.top10_weight | 36.66 | 48.36 |
| ms.equity_style.style_box_cell | Large-Blend | null |
| ms.equity_style.style.blend | (sin dato) | 0 |
| ms.equity_style.style.growth | (sin dato) | 0 |
| ms.equity_style.style.value | (sin dato) | 0 |
| ms.holdings_stats.holdings_count_bond | 288 | 307 |
| ms.holdings_stats.holdings_count_equity | 141 | 139 |
| ms.regions.detail.asia | (sin dato) | 19.01 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU0227385266 - Nordea 1 - Stable Return Fund E EUR

- Tipo: mixtos. Categoria: Mixtos Moderados EUR.
- Campos cambiados segun comparador: 99. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style, ratings_esg.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-30 |
| ms.rating_stars | 4 | null |
| ms.medalist_rating | Neutral | null |
| ms.portfolio.asset_allocation.equity | 65.78 | 50.35 |
| ms.portfolio.asset_allocation.bond | 55.06 | 52.91 |
| ms.holdings_top10 | [Future on 5 Year Treasury... (26.12); Future on 10 Year Treasury... (20.23); Euro Bund Future Dec... (4.66); ... +7] | [Euro Bund Future June... (19.94); 5 Year Treasury Note Future... (18.51); Long Gilt Future June... (4.1); ... +7] |
| ms.holdings_stats.top10_weight | 70 | 59.93 |
| derived.portfolio_exposure.asset_allocation_total.bond | 55.06 | 52.91 |
| derived.portfolio_exposure.asset_allocation_total.equity | 65.78 | 50.35 |
| derived.portfolio_exposure.equity_sectors_total.technology | 20.1879 | 12.8946 |
| derived.top_sector_weight | 30.69 | 25.61 |
| ms.equity_style.style_box_cell | Large-Blend | null |
| ms.holdings_stats.holdings_count_bond | 16 | 17 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### IE00BYX5NX33 - Fidelity MSCI World Index Fund EUR P Acc

- Tipo: renta_variable. Categoria: RV Global Cap. Grande Blend.
- Campos cambiados segun comparador: 107. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-29 | 2026-05-17 |
| ms.portfolio.as_of | 2025-12-26 | 2026-05-14 |
| ms.portfolio.asset_allocation.equity | 98.39 | 99.07 |
| ms.portfolio.asset_allocation.cash | 1.56 | 0.89 |
| ms.portfolio.asset_allocation.other | 0.05 | 0.03 |
| ms.holdings_top10 | [NVIDIA Corp (5.35); Apple Inc (4.69); Microsoft Corp (3.98); ... +7] | [NVIDIA Corp (6.05); Apple Inc (4.87); Microsoft Corp (3.29); ... +7] |
| ms.holdings_stats.top10_weight | 26.8 | 27.51 |
| derived.top_sector_weight | 28.05 | 30.24 |
| ms.equity_style.market_cap.giant | 47.12 | 48.86 |
| ms.equity_style.market_cap.large | 35.53 | 34.4 |
| ms.equity_style.market_cap.mid | 16.86 | 16.25 |
| ms.equity_style.market_cap.small | 0.5 | 0.49 |
| ms.equity_style.style_box_cell | Large-Blend | null |
| ms.holdings_stats.holdings_count_equity | 1319 | 1310 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### ES0114633003 - Panda Agriculture & Water Fund FI

- Tipo: renta_variable. Categoria: Sector Equity Agriculture.
- Campos cambiados segun comparador: 106. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2026-03-11 | 2026-05-17 |
| ms.portfolio.as_of | 2026-01-31 | 2026-03-30 |
| ms.sustainability_rating | 0 | null |
| ms.portfolio.asset_allocation.equity | 91.95 | 90.96 |
| ms.portfolio.asset_allocation.cash | 8.05 | 9.04 |
| ms.fixed_income.credit_quality.aaa | (sin dato) | 0 |
| ms.fixed_income.credit_quality.a | (sin dato) | 0 |
| ms.fixed_income.credit_quality.bbb | (sin dato) | 0 |
| ms.equity_style.market_cap.large | 4.66 | 4.1 |
| ms.equity_style.market_cap.micro | 26.76 | 22.26 |
| ms.equity_style.market_cap.mid | 27.77 | 34.18 |
| ms.equity_style.market_cap.small | 40.81 | 39.46 |
| ms.fixed_income.credit_quality.aa | (sin dato) | 0 |
| ms.fixed_income.credit_quality.b | (sin dato) | 0 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU1330191542 - Magallanes Value Investors UCITS European Equity R EUR

- Tipo: renta_variable. Categoria: RV Europa Cap. Mediana.
- Campos cambiados segun comparador: 96. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-11 | 2026-05-17 |
| ms.portfolio.as_of | 2025-11-29 | 2026-04-30 |
| ms.rating_stars | 5 | 4 |
| ms.sustainability_rating | null | 0 |
| ms.portfolio.asset_allocation.equity | 93.18 | 90.34 |
| ms.portfolio.asset_allocation.cash | 6.82 | 9.66 |
| ms.fixed_income.credit_quality.aaa | (sin dato) | 0 |
| ms.fixed_income.credit_quality.a | (sin dato) | 0 |
| ms.fixed_income.credit_quality.bbb | (sin dato) | 0 |
| ms.fixed_income.maturity_allocation.1_3 | (sin dato) | 0 |
| ms.equity_style.market_cap.giant | 0.89 | 0 |
| ms.equity_style.market_cap.large | 28.35 | 28.75 |
| ms.equity_style.market_cap.micro | 1.08 | 0.85 |
| ms.equity_style.market_cap.mid | 58.54 | 55.78 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU0391944815 - Pictet-Global Megatrend Selection R EUR

- Tipo: renta_variable. Categoria: RV Global Cap. Med/Peq.
- Campos cambiados segun comparador: 95. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2026-01-11 | 2026-05-17 |
| ms.portfolio.as_of | 2025-11-30 | 2026-04-30 |
| ms.portfolio.asset_allocation.equity | 97.94 | 97.06 |
| ms.portfolio.asset_allocation.bond | 0.13 | 0.08 |
| ms.portfolio.asset_allocation.cash | 1.93 | 2.86 |
| ms.holdings_top10 | [Thermo Fisher Scientific Inc (1.99); Alphabet Inc Class A (1.62); Ecolab Inc (1.36); ... +7] | [Broadcom Inc (2.02); Alphabet Inc Class A (1.62); Thermo Fisher Scientific Inc (1.47); ... +7] |
| derived.portfolio_exposure.asset_allocation_total.bond | 0.13 | 0.08 |
| derived.portfolio_exposure.asset_allocation_total.cash | 1.93 | 2.86 |
| derived.portfolio_exposure.asset_allocation_total.equity | 97.94 | 97.06 |
| derived.portfolio_exposure.equity_sectors_total.technology | 31.9774 | 32.3307 |
| derived.top_sector_weight | 32.65 | 33.31 |
| ms.equity_style.market_cap.giant | 18.85 | 19.56 |
| ms.equity_style.market_cap.large | 37.07 | 33.88 |
| ms.equity_style.market_cap.micro | 2.46 | 1.84 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU0112467450 - Nordea 1 - Global Stable Equity Fund BP EUR

- Tipo: renta_variable. Categoria: RV Global Cap. Grande Value.
- Campos cambiados segun comparador: 94. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style, ratings_esg.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-31 |
| ms.rating_stars | 2 | 4 |
| ms.portfolio.asset_allocation.equity | 99.74 | 99.42 |
| ms.portfolio.asset_allocation.cash | 0.26 | 0.58 |
| ms.holdings_top10 | [Vinci SA (3.21); Sanofi SA (2.99); Cisco Systems Inc (2.72); ... +7] | [Deutsche Telekom AG (3.9); Sanofi SA (3.77); Vinci SA (3.74); ... +7] |
| ms.holdings_stats.top10_weight | 25.57 | 27.68 |
| derived.portfolio_exposure.asset_allocation_total.cash | 0.26 | 0.58 |
| derived.portfolio_exposure.asset_allocation_total.equity | 99.74 | 99.42 |
| derived.portfolio_exposure.equity_sectors_total.technology | 13.3253 | 12.1889 |
| derived.subcategories | [sector:healthcare] | [] |
| derived.top_sector_weight | 25.15 | 23.66 |
| ms.equity_style.market_cap.giant | 20.05 | 18.8 |
| ms.equity_style.market_cap.large | 39.55 | 35.69 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU0353647737 - Fidelity Funds - European Dividend Fund A-Acc-EUR

- Tipo: renta_variable. Categoria: RV Europa Alto Dividendo.
- Campos cambiados segun comparador: 83. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, sector_region_style, ratings_esg.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-30 |
| ms.medalist_rating | Silver | null |
| ms.portfolio.asset_allocation.equity | 95.24 | 94.92 |
| ms.portfolio.asset_allocation.bond | 0.28 | 0.21 |
| ms.portfolio.asset_allocation.cash | 1.59 | 2.51 |
| ms.portfolio.asset_allocation.other | 2.89 | 2.35 |
| ms.holdings_top10 | [Industria De Diseno Textil SA... (4.02); TotalEnergies SE (3.82); Koninklijke Ahold Delhaize NV (3.45); ... +7] | [TotalEnergies SE (5.44); Koninklijke Ahold Delhaize NV (4.28); AIB Group PLC (3.85); ... +7] |
| ms.holdings_stats.top10_weight | 33.39 | 37.26 |
| derived.portfolio_exposure.asset_allocation_total.bond | 0.28 | 0.21 |
| derived.portfolio_exposure.asset_allocation_total.cash | 1.59 | 2.51 |
| derived.portfolio_exposure.asset_allocation_total.equity | 95.24 | 94.92 |
| derived.portfolio_exposure.asset_allocation_total.other | 2.89 | 2.35 |
| derived.portfolio_exposure.equity_sectors_total.financial_services | 26.0196 | 31.5799 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU1694789451 - DNCA Invest Alpha Bonds A EUR

- Tipo: renta_fija. Categoria: Global Flexible Bond.
- Campos cambiados segun comparador: 47. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-09-29 | 2026-03-30 |
| ms.rating_stars | 5 | 4 |
| ms.portfolio.asset_allocation.equity | 0 | 0.01 |
| ms.portfolio.asset_allocation.bond | 68.21 | 70.62 |
| ms.portfolio.asset_allocation.cash | 31.73 | 29.86 |
| ms.portfolio.asset_allocation.other | 0.05 | 0 |
| portfolio_exposure_v2.asset_mix.equity | 0 | 0.0001 |
| portfolio_exposure_v2.asset_mix.bond | 0.6821 | 0.7062 |
| portfolio_exposure_v2.asset_mix.cash | 0.3173 | 0.2986 |
| ms.fixed_income.effective_duration | 5.78 | 3.94 |
| ms.fixed_income.effective_maturity | 10.11 | 8.68 |
| ms.fixed_income.credit_quality.aaa | 9.85 | 10.25 |
| ms.fixed_income.credit_quality.a | 13.82 | 18.9 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU2482630162 - M&G European Credit Investment Fund Class P EUR Acc

- Tipo: renta_fija. Categoria: RF Deuda Corporativa EUR.
- Campos cambiados segun comparador: 47. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| name | European Specialist Investment Funds - M&G European Credit Investment Fund Class P EUR Acc | M&G European Credit Investment Fund Class P EUR Acc |
| ms.report_date | 2025-12-02 | 2026-05-16 |
| ms.portfolio.as_of | 2025-10-30 | 2026-04-30 |
| ms.rating_stars | 4 | 3 |
| ms.sustainability_rating | null | 0 |
| ms.portfolio.asset_allocation.bond | 95.18 | 91.98 |
| ms.portfolio.asset_allocation.cash | 4.68 | 8.02 |
| ms.portfolio.asset_allocation.other | 0.14 | 0 |
| portfolio_exposure_v2.asset_mix.bond | 0.9518 | 0.9198 |
| portfolio_exposure_v2.asset_mix.cash | 0.0468 | 0.0802 |
| ms.fixed_income.effective_duration | 4.51 | 4.5 |
| ms.fixed_income.credit_quality.aaa | 15 | 17.6 |
| ms.fixed_income.credit_quality.a | 38.37 | 37.45 |
| ms.fixed_income.credit_quality.bbb | 30.87 | 31.89 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU1022658667 - Franklin Euro Short Duration Bond Fund A(acc)EUR

- Tipo: renta_fija. Categoria: RF Diversificada Corto Plazo EUR.
- Campos cambiados segun comparador: 46. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-04-30 |
| ms.medalist_rating | Silver | null |
| ms.portfolio.asset_allocation.bond | 94.61 | 97.21 |
| ms.portfolio.asset_allocation.cash | 4.12 | 1.73 |
| ms.portfolio.asset_allocation.other | 1.27 | 1.07 |
| portfolio_exposure_v2.asset_mix.bond | 0.9461 | 0.9721 |
| portfolio_exposure_v2.asset_mix.cash | 0.0412 | 0.0173 |
| ms.fixed_income.effective_duration | 1.6 | 2.21 |
| ms.fixed_income.effective_maturity | 2.26 | 2.68 |
| ms.fixed_income.credit_quality.aaa | 32.73 | 28.14 |
| ms.fixed_income.credit_quality.a | 28.66 | 39.64 |
| ms.fixed_income.credit_quality.bbb | 19.35 | 18.51 |
| ms.fixed_income.maturity_allocation.1_3 | 47.77 | 52.52 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU0243958393 - Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR

- Tipo: renta_fija. Categoria: RF Deuda Corporativa EUR.
- Campos cambiados segun comparador: 45. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-04-30 |
| ms.medalist_rating | Silver | null |
| ms.portfolio.asset_allocation.bond | 95.73 | 97.93 |
| ms.portfolio.asset_allocation.cash | 3.59 | 1.75 |
| ms.portfolio.asset_allocation.other | 0.67 | 0.32 |
| portfolio_exposure_v2.asset_mix.bond | 0.9573 | 0.9793 |
| portfolio_exposure_v2.asset_mix.cash | 0.0359 | 0.0175 |
| ms.fixed_income.effective_duration | 5.43 | 5.2 |
| ms.fixed_income.effective_maturity | 6.27 | 5.86 |
| ms.fixed_income.credit_quality.aaa | 3.58 | 1.86 |
| ms.fixed_income.credit_quality.a | 26.16 | 27.11 |
| ms.fixed_income.credit_quality.bbb | 50.88 | 53.35 |
| ms.fixed_income.maturity_allocation.1_3 | 4.59 | 2.41 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU0658026512 - AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E

- Tipo: renta_fija. Categoria: RF Bonos Alto Rendimiento EUR.
- Campos cambiados segun comparador: 45. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| name | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E Capitalisation EUR | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-30 |
| ms.sustainability_rating | null | 0 |
| ms.portfolio.asset_allocation.bond | 94.95 | 96.27 |
| ms.portfolio.asset_allocation.cash | 3.75 | 3.31 |
| ms.portfolio.asset_allocation.other | 1.3 | 0.42 |
| portfolio_exposure_v2.asset_mix.bond | 0.9495 | 0.9627 |
| portfolio_exposure_v2.asset_mix.cash | 0.0375 | 0.0331 |
| ms.fixed_income.effective_duration | 1.42 | 1.87 |
| ms.fixed_income.effective_maturity | 1.72 | 2.17 |
| ms.fixed_income.credit_quality.a | 5.25 | 1.52 |
| ms.fixed_income.credit_quality.bbb | 10.44 | 8.1 |
| ms.fixed_income.maturity_allocation.1_3 | 49.81 | 43.16 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU1919971074 - abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR

- Tipo: renta_fija. Categoria: RF Global Emergente - Sesgo EUR.
- Campos cambiados segun comparador: 45. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-31 |
| ms.portfolio.asset_allocation.bond | 96.67 | 88.36 |
| ms.portfolio.asset_allocation.cash | 2.72 | 11.64 |
| ms.portfolio.asset_allocation.other | 0.61 | 0 |
| portfolio_exposure_v2.asset_mix.bond | 0.9667 | 0.8836 |
| portfolio_exposure_v2.asset_mix.cash | 0.0272 | 0.1164 |
| ms.fixed_income.effective_duration | 3.97 | 3.88 |
| ms.fixed_income.credit_quality.aaa | 0.08 | 1.29 |
| ms.fixed_income.credit_quality.a | 3.65 | 2.3 |
| ms.fixed_income.credit_quality.bbb | 3.08 | 7.88 |
| ms.fixed_income.maturity_allocation.1_3 | 15.71 | 13.19 |
| ms.fixed_income.coupon_allocation.0_4 | 3.73 | 4.63 |
| ms.holdings_top10 | [abrdn Liquidity-US Dollar Fund Z-1IncUSD (4.19); Republic Of Suriname Int 8.5%... (3.3); Suriname (Republic of) 7.95%2033-07-15 (3.27); ... +7] | [abrdn Liquidity-US Dollar Fund Z-1IncUSD (6.84); Ghana (Republic of) 5%2035-07-03 (3.48); Suriname (Republic of) 8.5%2035-11-06 (2.85); ... +7] |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### FR0013201001 - EdR SICAV - Euro Sustainable Credit R EUR

- Tipo: renta_fija. Categoria: RF Deuda Corporativa EUR.
- Campos cambiados segun comparador: 44. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-03-30 |
| ms.rating_stars | 4 | null |
| ms.medalist_rating | Silver | null |
| ms.portfolio.asset_allocation.bond | 98.28 | 97.2 |
| ms.portfolio.asset_allocation.cash | 0 | 2.8 |
| ms.portfolio.asset_allocation.other | 3.17 | 0 |
| portfolio_exposure_v2.asset_mix.bond | 0.968753 | 0.972 |
| portfolio_exposure_v2.asset_mix.cash | 0 | 0.028 |
| ms.fixed_income.credit_quality.aaa | (sin dato) | 0 |
| ms.fixed_income.credit_quality.a | (sin dato) | 0 |
| ms.fixed_income.credit_quality.bbb | (sin dato) | 0 |
| ms.fixed_income.maturity_allocation.1_3 | 8.66 | 10.26 |
| ms.fixed_income.coupon_allocation.0_4 | 49.76 | 48.04 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### LU1299306321 - Carmignac Portfolio Sécurité AW EUR Acc

- Tipo: renta_fija. Categoria: RF Diversificada Corto Plazo EUR.
- Campos cambiados segun comparador: 44. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2026-03-23 | 2026-05-17 |
| ms.portfolio.as_of | 2026-02-27 | 2026-04-30 |
| ms.portfolio.asset_allocation.bond | 75.86 | 80.24 |
| ms.portfolio.asset_allocation.cash | 23.94 | 19.56 |
| ms.portfolio.asset_allocation.other | 0.21 | 0.2 |
| portfolio_exposure_v2.asset_mix.bond | 0.7586 | 0.8024 |
| portfolio_exposure_v2.asset_mix.cash | 0.2394 | 0.1956 |
| ms.fixed_income.effective_duration | 2.04 | 2.36 |
| ms.fixed_income.effective_maturity | 2.98 | 3.06 |
| ms.fixed_income.credit_quality.aaa | 8.98 | 8.48 |
| ms.fixed_income.credit_quality.a | 31.22 | 33.41 |
| ms.fixed_income.credit_quality.bbb | 43.56 | 43.23 |
| ms.fixed_income.maturity_allocation.1_3 | 22.91 | 27 |
| ms.fixed_income.coupon_allocation.0_4 | 73.19 | 74.32 |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### ES0142167032 - SIH Renta Fija A FI

- Tipo: renta_fija. Categoria: RF Diversificada EUR.
- Campos cambiados segun comparador: 43. Rutas detalladas en muestra: 40.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, holdings_refresh, asset_allocation_or_asset_mix, fixed_income_credit_duration_yield, sector_region_style, ratings_esg, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-02 | 2026-05-17 |
| ms.portfolio.as_of | 2025-10-30 | 2026-04-30 |
| ms.sustainability_rating | null | 0 |
| ms.portfolio.asset_allocation.bond | 95.6 | 97.14 |
| ms.portfolio.asset_allocation.cash | 0.73 | 0.82 |
| ms.portfolio.asset_allocation.other | 3.67 | 2.04 |
| portfolio_exposure_v2.asset_mix.bond | 0.956 | 0.9714 |
| portfolio_exposure_v2.asset_mix.cash | 0.0073 | 0.0082 |
| ms.fixed_income.credit_quality.aaa | (sin dato) | 0 |
| ms.fixed_income.credit_quality.a | (sin dato) | 0 |
| ms.fixed_income.credit_quality.bbb | (sin dato) | 0 |
| ms.fixed_income.maturity_allocation.1_3 | 6.25 | 5.33 |
| ms.fixed_income.coupon_allocation.0_4 | 40.13 | 44.78 |
| ms.holdings_top10 | [Spain (Kingdom of) 0% 2025-11-03 (4.43); Italy (Republic Of) 3.15% 2034-04-15 (1.72); ACS Actividades De Construccion Y... (1.5); ... +7] | [Spain (Kingdom of) 5.15% 2026-05-04 (1.96); Italy (Republic Of) 3.15% 2034-04-15 (1.85); ACS Actividades De Construccion Y... (1.63); ... +7] |

Nota: 26 rutas adicionales quedan completas en el JSON para no hacer inmanejable el informe.

### ES0112602000 - Azvalor Managers FI

- Tipo: renta_variable. Categoria: Global Small-Cap Equity.
- Campos cambiados segun comparador: 6. Rutas detalladas en muestra: 6.
- Motivo LOW_RISK: classification=LOW_RISK_UPDATE en comparador Firestore; risk_flags=[]; material_changed_paths_sample=[]; forbidden_fields=[]; familias=date_refresh, fixed_income_credit_duration_yield, quality_or_hash.
- Campos prohibidos: NO.

| Campo | Valor actual | Valor propuesto |
| --- | --- | --- |
| ms.report_date | 2025-12-29 | 2026-05-17 |
| quality.source_pdf_hash | d22ef641b36ca83ba3528d7fc2a64b7e | 2f589c522cbfd18c90124313cd496715 |
| ms.fixed_income.coupon_allocation | {"0":0,"over_6":0,"0_4":0,"4_6":0} | null |
| ms.fixed_income.credit_quality | {"aa":0,"aaa":0,"bb":0,"a":0,"b":0,"bbb":0,"not_rated":0,"below_b":0} | null |
| ms.fixed_income.maturity_allocation | {"1_3":0,"3_5":0,"5_7":0,"7_10":0,"over_10":0} | null |
| ms.objective | Se busca encontrar las mejores oportunidades de inversión en renta variable global, delegando la gestión en los mejores gestores cumpliendo con estrictos requisitos de calidad, ... | Se busca encontrar las mejores oportunidades en renta variable global, delegando la gestión en los mejores gestores cumpliendo con estrictos requisitos de calidad, seleccionados... |

## Riesgos detectados

- HIGH_NUMBER_OF_LOW_RISK_CHANGED_PATHS_FOR_SAMPLE: LU1883329432, LU0227385266, IE00BYX5NX33, ES0114633003, LU1330191542, LU0391944815, LU0112467450.
- NAME_CHANGE_PRESENT_IN_SAMPLE: LU2482630162, LU0658026512.

## Recomendacion

- Apto para write gate pequeno: SI.
- Alcance recomendado: solo los 83 `LOW_RISK_UPDATE`.
- Mantener fuera: `REVIEW_REQUIRED`, `NOT_FOUND_IN_FUNDS_V3`, cualquier cambio futuro con `risk_flags` o campos prohibidos.
- Para el gate posterior, generar una lista cerrada de ISINs LOW_RISK y validar otra vez que no contiene `manual.*`, `retrocession` ni `portfolio_exposure_v2.economic_exposure`.

## Artefacto JSON

Creado: `C:\Users\oanti\Documents\BDB-FONDOS\artifacts\bdb_parser_audit\morningstar_pdfs_refresh_low_risk_sample_review_0.json`
