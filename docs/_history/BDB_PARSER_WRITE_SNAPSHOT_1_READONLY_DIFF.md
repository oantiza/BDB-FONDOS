# BDB-PARSER-WRITE-SNAPSHOT-1 - Read-Only Snapshot and Real Diff

Nota BDB-PARSER-ROOT-ORG-0: la ubicacion operativa nueva es `MORNINGSTAR_PDF_PARSER/`. Los comandos nuevos viven en `MORNINGSTAR_PDF_PARSER/bin/` y las carpetas visibles son `ENTRADA/` y `SALIDA/`.

Fecha: 2026-05-08

Proyecto validado: `C:\Users\oanti\Documents\BDB-FONDOS`

Decision: `PARSER_WRITE_SNAPSHOT_READY_WITH_WARNINGS`

## Objetivo

Generar snapshots actuales de `funds_v3` y diffs reales para un lote pequeno de candidatos del parser Morningstar, sin escribir en Firestore.

## Confirmaciones

- Firestore: solo lectura.
- Writes Firestore: 0.
- `--write`: no usado.
- `--confirm-write`: no usado.
- Deploy: no ejecutado.
- Push: no ejecutado.
- Commit: no ejecutado.
- Gemini real: no llamado.
- Credenciales: no impresas ni modificadas.
- `BDB-FONDOS-CORE`: no leido ni modificado.

## ISINs Seleccionados

Se eligieron 5 ISINs del lote mediano con `policy_status` `ACCEPT` o `ACCEPT_WITH_WARNINGS`, excluyendo `BLOCKED` y `REVIEW`.

| ISIN | Nombre | Policy | Tipo | Criterio |
| --- | --- | --- | --- | --- |
| IE0003867441 | BNY Mellon Small Cap Euroland Fund EUR A Acc | ACCEPT | equity | Unico ACCEPT del lote, warning no bloqueante |
| LU0208853944 | JPMorgan Funds - Global Natural Resources Fund D (acc) - EUR | ACCEPT_WITH_WARNINGS | equity | Warnings bajos, sector recursos |
| ES0165142003 | Mutuafondo Corto Plazo D FI | ACCEPT_WITH_WARNINGS | fixed_income | RF con warnings bajos |
| LU1670724373 | M&G (Lux) Optimal Income Fund EUR A Acc | ACCEPT_WITH_WARNINGS | allocation | Allocation, warnings bajos |
| LU0252500524 | JPMorgan Funds - EUR Money Market VNAV Fund D (acc) - EUR | ACCEPT_WITH_WARNINGS | money_market | Monetario, util para validar preservacion |

## Comando Ejecutado

```bash
node scripts/MORNINGSTAR_PDF_PARSER/prepare_write_gate_dry_run.js \
  --parser-artifact artifacts/bdb_parser_audit/parser_dry_run_latest.json \
  --classification artifacts/bdb_parser_audit/parser_dryrun_medium_policy_classification.json \
  --output-dir artifacts/bdb_parser_audit/write_gate_snapshot_1 \
  --fetch-snapshots \
  --only-isin IE0003867441,LU0208853944,ES0165142003,LU1670724373,LU0252500524 \
  --max-write-candidates 5 \
  --snapshot-limit 5 \
  --collection funds_v3 \
  --project bdb-fondos
```

## Artifacts

Carpeta:

- `artifacts/bdb_parser_audit/write_gate_snapshot_1/`

Archivos:

- `snapshot_manifest.json`
- `diff_manifest.json`
- `write_approval_manifest.json`
- `rollback_manifest.json`
- `post_write_verification_plan.json`
- `snapshots/ES0165142003.json`
- `snapshots/IE0003867441.json`
- `snapshots/LU0208853944.json`
- `snapshots/LU0252500524.json`
- `snapshots/LU1670724373.json`

## Resultado Global

- Snapshots solicitados: 5.
- Snapshots generados: 5.
- Documentos encontrados: 5.
- Lookup: `document_id` para los 5.
- `WRITE_CANDIDATE`: 5.
- `REVIEW_REQUIRES_EXPLICIT_APPROVAL`: 0.
- `BLOCKED_NEVER_WRITE`: 0.
- `write_executed`: false.
- `dry_run`: true.

## Diff Real Por ISIN

| ISIN | Decision | Changed | Unchanged | Forbidden fields | Retro preservada | Economic exposure preservada |
| --- | --- | ---: | ---: | --- | --- | --- |
| ES0165142003 | WRITE_CANDIDATE | 7 | 87 | 0 | si | si |
| IE0003867441 | WRITE_CANDIDATE | 14 | 120 | 0 | si | si |
| LU0208853944 | WRITE_CANDIDATE | 23 | 109 | 0 | si | si |
| LU0252500524 | WRITE_CANDIDATE | 8 | 86 | 0 | si | si |
| LU1670724373 | WRITE_CANDIDATE | 12 | 85 | 0 | si | si |

### Campos Que Cambiarian

`ES0165142003`:

- `ms.holdings_top10`
- `ms.rating_stars`
- `ms.sustainability_rating`
- `quality.parsed_at`
- `quality.parser_version`
- `quality.warnings`
- `updatedAt`

`IE0003867441`:

- `classification_v2.equity_style_box`
- `derived.style_bias.equity.*`
- `ms.equity_style.*`
- `ms.holdings_top10`
- `ms.objective`
- `portfolio_exposure_v2.equity_styles`
- `quality.parsed_at`
- `quality.parser_version`
- `updatedAt`

`LU0208853944`:

- `classification_v2.duration_bucket`
- `classification_v2.fixed_income_type`
- `classification_v2.sources_used`
- `classification_v2.warnings`
- `ms.fixed_income`
- `ms.holdings_top10`
- `ms.sustainability_rating`
- `portfolio_exposure_v2.bond_types`
- `portfolio_exposure_v2.duration`
- `portfolio_exposure_v2.equity_regions.*`
- `portfolio_exposure_v2.warnings`
- `quality.parsed_at`
- `quality.warnings`
- `updatedAt`

`LU0252500524`:

- `ms.fixed_income.effective_maturity`
- `ms.holdings_top10`
- `ms.rating_stars`
- `ms.sustainability_rating`
- `quality.parsed_at`
- `quality.parser_version`
- `quality.warnings`
- `updatedAt`

`LU1670724373`:

- `derived.portfolio_exposure.equity_regions_total.*`
- `ms.equity_style.style.*`
- `ms.holdings_top10`
- `ms.regions.detail`
- `portfolio_exposure_v2.equity_regions.*`
- `quality.parsed_at`
- `quality.warnings`
- `updatedAt`

## Preservacion de Campos Manuales y Economicos

Verificado en `diff_manifest.json`:

- `manual.*` no aparece en ningun proposed payload.
- `manual.costs.retrocession` no aparece en ningun proposed payload.
- `portfolio_exposure_v2.economic_exposure` no aparece en ningun proposed payload.
- `manual_fields_current_preserved`: true en los 5.
- `manual_costs_retrocession_current_preserved`: true en los 5.
- `economic_exposure_current_preserved`: true en los 5.

Esto significa que el write futuro, si se aprueba, debe ser parcial/merge y no destructivo.

## Exclusion REVIEW/BLOCKED

En este lote no se incluyeron `REVIEW` ni `BLOCKED`.

Regla vigente:

- `BLOCKED`: nunca candidato.
- `REVIEW`: solo candidato con aprobacion explicita por ISIN.
- `ACCEPT` / `ACCEPT_WITH_WARNINGS`: candidatos tras snapshot y diff, pero no write automatico.

## Validaciones Ejecutadas

```bash
node --check scripts/MORNINGSTAR_PDF_PARSER/lib/write_gate.js
node --check scripts/MORNINGSTAR_PDF_PARSER/prepare_write_gate_dry_run.js
node tests/parser_write_gate/test_parser_write_gate.js
```

Resultado:

- Syntax checks: PASS.
- Tests write gate: PASS.
- Firestore read-only snapshots: PASS.
- Writes: 0.

## Riesgos y Warnings

El estado es `READY_WITH_WARNINGS` porque 4 de 5 candidatos vienen de `ACCEPT_WITH_WARNINGS`.

Riesgos a revisar antes del primer write:

- `LU0208853944` cambia multiples regiones y campos FI, aunque es un fondo de recursos naturales.
- `LU1670724373` cambia regiones derivadas y regiones V2.
- Los campos `quality.parsed_at` y `updatedAt` cambiarian en todos o casi todos los candidatos.

## Recomendacion

El sistema queda listo para un primer write controlado futuro de 1-3 ISINs, no para lote amplio.

Primer set recomendado:

1. `IE0003867441`
2. `ES0165142003`
3. `LU0252500524`

Antes de escribir:

- revisar manualmente `write_approval_manifest.json`,
- aprobar explicitamente los ISINs,
- confirmar rollback manifest,
- ejecutar write con limite 1-3,
- ejecutar post-write verification inmediatamente.
