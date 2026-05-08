# BDB-PARSER-DRYRUN-MEDIUM-0 - Medium Dry-Run Policy Classification

## Fecha

2026-05-07

## Ruta validada

`C:\Users\oanti\Documents\BDB-FONDOS`

`C:\Users\oanti\Documents\BDB-FONDOS-CORE` no fue leido, tocado ni modificado.

## Objetivo

Ejecutar el parser Morningstar sobre un lote mediano de PDFs reales, sin writes a Firestore, y clasificar los resultados con la politica `BDB-PARSER-POLICY-0`.

## Politica aplicada

- Documento: `docs/BDB_PARSER_POLICY_0_WRITE_REVIEW_CANON.md`
- Artifact: `artifacts/bdb_parser_audit/parser_policy_0_write_review_canon.json`
- Decision previa: `PARSER_POLICY_READY`

Estados aplicados:

- `ACCEPT`
- `ACCEPT_WITH_WARNINGS`
- `REVIEW`
- `BLOCKED`

## Criterio de seleccion

Se seleccionaron 28 PDFs desde `data/processed_pdfs/ok/`, cruzando ISINs con `data/canonical/<ISIN>.json` local, sin Firestore.

Cobertura buscada:

- renta variable global/regional.
- renta fija.
- mixtos/allocation.
- monetarios.
- oro/metales/mineria/recursos naturales.
- alternativos.
- real estate.
- distintos domicilios, gestoras y fechas.

## Comando ejecutado

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/dryrun_medium_input --limit 50 --concurrency 2 --output-dir artifacts/bdb_parser_audit --backup-root artifacts/bdb_parser_audit/dryrun_medium_0_work --processed artifacts/bdb_parser_audit/dryrun_medium_0_work/canonical --error artifacts/bdb_parser_audit/dryrun_medium_0_work/error --processed-pdfs artifacts/bdb_parser_audit/dryrun_medium_0_work/processed_pdfs/ok --review-pdfs artifacts/bdb_parser_audit/dryrun_medium_0_work/processed_pdfs/review --error-pdfs artifacts/bdb_parser_audit/dryrun_medium_0_work/processed_pdfs/error
```

No se uso `--write`.

No se uso `--confirm-write`.

## Confirmacion no-write

- `dry_run=true`
- `would_write=false`
- Firestore writes: 0
- Deploy: 0
- Push: 0
- Commit: 0
- Credenciales no impresas
- `manual.*` ausente en todos los payloads generados
- `manual.costs.retrocession` ausente
- `portfolio_exposure_v2.economic_exposure` ausente

## Gemini

Gemini real fue llamado para este lote mediano con `gemini-2.5-flash`.

Hubo 28 intentos de parseo y 27 payloads propuestos. Un PDF quedo bloqueado por `error_llm_json`.

El script no reporta tokens ni coste.

## Resultado runtime del parser

| Metrica | Valor |
|---------|-------|
| PDFs procesados | 28 |
| Runtime OK | 21 |
| Runtime REVIEW | 6 |
| Runtime ERROR | 1 |
| Payloads propuestos | 27 |

## Resultado por politica

| Estado politica | Count |
|-----------------|-------|
| ACCEPT | 1 |
| ACCEPT_WITH_WARNINGS | 17 |
| REVIEW | 9 |
| BLOCKED | 1 |

Decision del lote:

`PARSER_MEDIUM_DRYRUN_OK_WITH_WARNINGS`

El dry-run mediano fue util y clasificable, pero el lote completo no es candidato a write futuro sin excluir/reparsear el BLOCKED y revisar los REVIEW.

## Artifacts generados

- `artifacts/bdb_parser_audit/parser_dry_run_latest.json`
- `artifacts/bdb_parser_audit/dryrun_medium_0_work/`
- `artifacts/bdb_parser_audit/parser_dryrun_medium_policy_classification.json`
- `artifacts/bdb_parser_audit/parser_dryrun_medium_policy_classification.csv`

## Tabla resumida por ISIN

| ISIN | Tipo esperado | `asset_type` | `asset_subtype` | Region | Mix eq/bond/cash/other | Sum | Estado politica | Razon |
|------|---------------|--------------|-----------------|--------|--------------------------|-----|-----------------|-------|
| IE0003867441 | equity regional Eurozone small/mid | equity | THEMATIC_EQUITY | Europa | 0.9853 / 0 / 0.0147 / 0 | 1.0000 | ACCEPT | solo warning INFO de escala |
| ES0112602000 | equity global small-cap | equity | GLOBAL_EQUITY | Global | 0.8533 / 0 / 0.1382 / 0.0084 | 0.9999 | ACCEPT_WITH_WARNINGS | warnings LOW/INFO |
| ES0137381036 | equity regional Spain | equity | GLOBAL_EQUITY | Europa | 0.9331 / 0.0549 / 0.0120 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | warnings LOW/INFO |
| IE00BYVJR916 | gold/silver | equity | THEMATIC_EQUITY | USA | 0.9950 / 0 / 0 / 0.0050 | 1.0000 | ACCEPT_WITH_WARNINGS | oro/metales con equity alto |
| LU0011889846 | equity Eurozone | equity | EUROZONE_EQUITY | Europa | 0.9816 / 0 / 0.0184 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | warnings LOW/INFO |
| LU0090845842 | mining/resources | equity | THEMATIC_EQUITY | Global | 0.9750 / 0.0002 / 0.0247 / 0 | 0.9999 | ACCEPT_WITH_WARNINGS | mineria con equity alto |
| LU0171306680 | gold/precious metals | equity | THEMATIC_EQUITY | Global | 0.9293 / 0.0003 / 0.0344 / 0.0359 | 0.9999 | ACCEPT_WITH_WARNINGS | oro con equity alto |
| LU0208853944 | natural resources | equity | SECTOR_EQUITY_ENERGY | Global | 0.9740 / 0.0011 / 0.0249 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | recursos naturales con equity alto |
| LU0273690064 | equity Asia ex-Japan | equity | THEMATIC_EQUITY | Asia | 0.9884 / 0 / 0.0116 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | R14 OK: no mapea a Japon |
| LU0496368142 | gold/precious metals | equity | THEMATIC_EQUITY | USA | 0.9870 / 0.0006 / 0.0124 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | oro/metales con equity alto |
| ES0165142003 | fixed income ultra short | fixed_income | CORPORATE_BOND | Global | 0 / 0.8879 / 0.1121 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | runtime OK, sin credit_missing |
| FR0010149120 | fixed income short duration | fixed_income | CORPORATE_BOND | Global | 0 / 0.7217 / 0.2721 / 0.0062 | 1.0000 | ACCEPT_WITH_WARNINGS | runtime OK, warnings LOW/INFO |
| LU0910636892 | fixed income emerging debt | fixed_income | EMERGING_MARKETS_BOND | Emergentes | 0 / 1.0000 / 0 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | runtime OK, warnings LOW/INFO |
| LU0252500524 | money market | money_market | MONEY_MARKET | Global | 0 / 0 / 1.0000 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | monetario cash 100% |
| LU0568620560 | money market | money_market | MONEY_MARKET | Global | 0 / 0 / 1.0000 / 0 | 1.0000 | ACCEPT_WITH_WARNINGS | monetario cash 100% |
| ES0175316019 | alternative multistrategy | alternative | UNKNOWN | Europa | 0.2839 / 0.5179 / 0.1616 / 0.0366 | 1.0000 | ACCEPT_WITH_WARNINGS | runtime OK; alternative con bond alto sin credit_missing |
| FR0000989915 | real estate | real_asset | UNKNOWN | Europa | 0.9794 / 0.0049 / 0.0093 / 0.0064 | 1.0000 | ACCEPT_WITH_WARNINGS | real asset equity-like |
| ES0112231016 | allocation flexible | allocation | FLEXIBLE_ALLOCATION | Global | 0.7453 / 0.2286 / 0.0261 / 0 | 1.0000 | REVIEW | credit_missing con bond >20% |
| ES0116419005 | fixed term bond | fixed_income | CORPORATE_BOND | Global | 0 / 0.7391 / 0.2407 / 0.0202 | 1.0000 | REVIEW | credit_missing / fi_missing_credit_data en RF |
| ES0124880032 | fixed income short duration | fixed_income | CORPORATE_BOND | Global | 0 / 0.989315 / 0 / 0.010685 | 1.0000 | REVIEW | credit_missing / fi_missing_credit_data en RF |
| ES0175414012 | alternative multistrategy | alternative | UNKNOWN | Europa | 0.0915 / 0.6834 / 0.2016 / 0.0235 | 1.0000 | REVIEW | credit_missing con alternative bond >20% |
| ES0175437005 | alternative multistrategy | alternative | UNKNOWN | Europa | 0.0112 / 0.7454 / 0.2221 / 0.0213 | 1.0000 | REVIEW | credit_missing con alternative bond >20% |
| FR0000989626 | money market | money_market | MONEY_MARKET | Global | 0 / 0.1517 / 0.8483 / 0 | 1.0000 | REVIEW | credit_missing en monetario |
| IE00B4Z6MP99 | allocation flexible | allocation | FLEXIBLE_ALLOCATION | Global | 0.4375 / 0.3412 / 0.0135 / 0.2078 | 1.0000 | REVIEW | credit_missing con bond >20% |
| LU0264738294 | real estate global property | real_asset | UNKNOWN | USA | 0.9740 / 0 / 0.0159 / 0.0101 | 1.0000 | REVIEW | runtime review por credit_missing |
| LU1697016878 | allocation defensive | allocation | FLEXIBLE_ALLOCATION | USA | 0.2164 / 0.7632 / 0.0160 / 0.0045 | 1.0001 | REVIEW | credit_missing con bond >20% |
| LU0599946893 | allocation flexible | n/a | n/a | n/a | n/a | n/a | BLOCKED | `error_llm_json`: Gemini no devolvio JSON objeto parseable |

## Warnings agregados

| Warning | Count |
|---------|-------|
| `unknown_region_key` | 31 |
| `asset_mix_guardrail:detected_scale_0_100_divided_by_100` | 27 |
| `credit_missing` | 15 |
| `fi_missing_credit_data` | 15 |
| `asset_mix_guardrail:mixed_scale_signal_detected` | 10 |
| `regions_sum_overflow` | 10 |
| `fi_type_inference_weak` | 9 |
| `missing_regions` | 8 |
| `missing_sectors` | 8 |
| `region_incomplete` | 8 |
| `subtype_incompatible_with_asset_type` | 7 |
| `subtype_downgraded_to_safe_family` | 7 |
| `missing_rating_stars` | 4 |
| `fi_missing_duration_data` | 2 |
| `duration_missing` | 2 |
| `asset_mix_guardrail:asset_mix_rebased_to_sum_1` | 1 |
| `money_market_subtype_defaulted` | 1 |
| `regions_all_unrecognized` | 1 |
| `error_llm_json` | 1 |

## Analisis por tipo

### Equity global/regional

Los fondos equity quedaron mayoritariamente en `ACCEPT_WITH_WARNINGS`. Los warnings son sobre escala, regiones desconocidas o pequenos datos RF residuales. No hubo `asset_mix` fuera de rango.

### Renta fija

RF queda bien en asset mix: bond alto, equity 0. La politica eleva a `REVIEW` los casos con `credit_missing` o `fi_missing_credit_data`, porque la calidad crediticia es material para RF.

### Allocation

Los allocation con bond >20% y `credit_missing` pasan a `REVIEW`. Esto es coherente con la politica: no bloquea parseo, pero exige evaluacion humana antes de cualquier write futuro.

### Monetarios

Los monetarios cash 100% son coherentes. FR0000989626 cae en `REVIEW` por `credit_missing` en monetario; los otros monetarios quedan `ACCEPT_WITH_WARNINGS`.

### Oro, metales, mineria y recursos naturales

Los casos procesados reportaron equity alto en Morningstar, no el patron `equity=0 / other=100`. Por politica quedan `ACCEPT_WITH_WARNINGS`, no `REVIEW`. Sigue pendiente encontrar o forzar casos con `commodity_with_zero_equity` si existen.

### Alternativos

Los alternative multistrategy con bond alto y `credit_missing` quedan en `REVIEW`. Uno queda `ACCEPT_WITH_WARNINGS` porque runtime no emitio `credit_missing`.

### Real asset

Un real asset queda `ACCEPT_WITH_WARNINGS`; otro queda `REVIEW` porque el runtime lo marco con `credit_missing`. No hay bloqueo por asset_mix.

## R14 ex-Japan

El lote incluyo `LU0273690064`, categoria `RV Asia (ex-Japon)`.

Resultado:

- `region_primary = Asia`
- No mapea a Japon.
- Estado: `ACCEPT_WITH_WARNINGS`

Esto confirma que el fix de BDB-PARSER-REGION-0 sigue operativo en lote real con Gemini.

## Invariantes

| Invariante | Resultado |
|------------|-----------|
| `manual.*` ausente | PASS |
| `manual.costs.retrocession` ausente | PASS |
| `economic_exposure` ausente | PASS |
| `asset_mix` escala 0-1 | PASS |
| `asset_mix` suma 0.99-1.01 | PASS |
| Firestore writes | 0 |

## Conclusiones

- El parser es apto para seguir con dry-runs medianos.
- La politica offline permite separar de forma util `ACCEPT`, `ACCEPT_WITH_WARNINGS`, `REVIEW` y `BLOCKED`.
- El lote completo no debe ser candidato a write futuro tal cual: requiere excluir/reparsear `LU0599946893` y revisar 9 ISINs.
- No hay evidencia de contaminacion de `manual.*` ni de `economic_exposure`.
- El siguiente paso natural es diseñar un write gate real que consuma esta clasificacion y bloquee automaticamente cualquier `REVIEW`/`BLOCKED`.

## Decision

`PARSER_MEDIUM_DRYRUN_OK_WITH_WARNINGS`
