# BDB-PARSER-DRYRUN-1 - Single PDF Dry-Run

## Fecha

2026-05-07

## Ruta validada

`C:\Users\oanti\Documents\BDB-FONDOS`

`C:\Users\oanti\Documents\BDB-FONDOS-CORE` no fue leido, tocado ni modificado.

## PDF usado

`data/processed_pdfs/ok/ES0112602000__2025-12-29__19bfebfc.pdf`

Motivo de seleccion: PDF real ya existente, previamente clasificado como OK, fondo de renta variable global/small-cap y no oro/mineria.

## Comando ejecutado

```bash
node scripts/MORNINGSTAR_PDF_PARSER/cargador_lotes_v_2.js --dry-run --dir data/processed_pdfs/ok --only-isin ES0112602000 --limit 1 --concurrency 1 --output-dir artifacts/bdb_parser_audit --backup-root artifacts/bdb_parser_audit/dryrun_1_work --processed artifacts/bdb_parser_audit/dryrun_1_work/canonical --error artifacts/bdb_parser_audit/dryrun_1_work/error --processed-pdfs artifacts/bdb_parser_audit/dryrun_1_work/processed_pdfs/ok --review-pdfs artifacts/bdb_parser_audit/dryrun_1_work/processed_pdfs/review --error-pdfs artifacts/bdb_parser_audit/dryrun_1_work/processed_pdfs/error
```

No se uso `--write`.

No se uso `--confirm-write`.

## Confirmacion no-write

- `dry_run=true`
- `would_write=false`
- `write_review_to_firestore=false`
- No se inicializo writer Firestore.
- No se imprimieron secretos.
- No hubo deploy, push ni commit.

## Gemini

Gemini real fue llamado para este unico PDF.

Modelo indicado por el parser: `gemini-2.5-flash`.

El script no reporta tokens ni coste, por lo que no hay estimacion fiable emitida por runtime.

## Artifact generado

`artifacts/bdb_parser_audit/parser_dry_run_latest.json`

Work artifacts auxiliares:

- `artifacts/bdb_parser_audit/dryrun_1_work/canonical/ES0112602000.json`
- `artifacts/bdb_parser_audit/dryrun_1_work/work/parsed_ms/`
- `artifacts/bdb_parser_audit/dryrun_1_work/work/raw_llm/`
- `artifacts/bdb_parser_audit/dryrun_1_work/work/raw_text/`
- `artifacts/bdb_parser_audit/dryrun_1_work/work/manifests/batch_manifest.json`

## Resultado batch

| Campo | Valor |
|-------|-------|
| total_files | 1 |
| ok_count | 1 |
| review_count | 0 |
| error_count | 0 |
| ISIN | ES0112602000 |
| routing_status | ok |

## Resumen de campos extraidos

| Campo | Valor |
|-------|-------|
| `isin` | `ES0112602000` |
| `name` | `Azvalor Managers FI` |
| `ms.report_date` | `2025-12-29` |
| `ms.category_morningstar` | `Global Small-Cap Equity` |
| `classification_v2.asset_type` | `equity` |
| `classification_v2.asset_subtype` | `GLOBAL_EQUITY` |
| `classification_v2.market_cap_bias` | `small` |
| `derived.asset_class` | `RV` |
| `derived.primary_region` | `Global` |

## Escalas detectadas

`portfolio_exposure_v2.asset_mix` fue generado en escala 0-1:

| Bucket | Valor |
|--------|-------|
| equity | 0.8533 |
| bond | 0 |
| cash | 0.1382 |
| other | 0.0084 |
| sum | 0.9999 |

El parser no genero `portfolio_exposure_v2.economic_exposure`, consistente con el contrato actual: `economic_exposure` lo genera `populate_taxonomy_v2.py` en escala 0-100.

No se convirtieron retrocesiones.

No se modifico `manual`.

## Manual fields

El payload propuesto no contiene:

- `manual`
- `manual.costs`
- `manual.costs.retrocession`

El artifact conserva `fields_preserved`:

- `manual`
- `manual.costs`
- `manual.costs.retrocession`

## Fields to update propuestos

- `classification_v2`
- `currency`
- `derived`
- `isin`
- `ms`
- `name`
- `portfolio_exposure_v2`
- `quality`
- `updatedAt`

## Warnings

Quality warnings:

- `unknown_region_key:middle_east_africa`

Portfolio exposure warnings:

- `asset_mix_guardrail:detected_scale_0_100_divided_by_100:max_component=85.33`
- `asset_mix_guardrail:mixed_scale_signal_detected:min_positive_component=0.84,max_component=85.33`

Interpretacion: el parser detecto porcentajes Morningstar en escala 0-100 y normalizo `asset_mix` a 0-1. La senal de mixed-scale parece deberse a un componente pequeno expresado como 0.84% dentro de un vector 0-100; no bloqueo el routing y la suma final normalizada es 0.9999.

## Comparacion cualitativa con lo esperado

La clasificacion es coherente con el PDF esperado:

- Categoria Morningstar de RV global/small-cap.
- `classification_v2.asset_type=equity`.
- `asset_subtype=GLOBAL_EQUITY`.
- `market_cap_bias=small`.
- `asset_mix` mayoritariamente equity con cash residual.

Los warnings regionales y de escala merecen seguimiento, pero no indican write ni corrupcion de campos manuales.

## Decision

`PARSER_DRYRUN_OK_WITH_WARNINGS`

El parser queda listo para dry-run con lote pequeno, manteniendo revision explicita de warnings antes de cualquier write futuro.
