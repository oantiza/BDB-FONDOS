# BDB-PARSER-FIRST-WRITE-1 - Controlled Parser Write

Fecha: 2026-05-08

Proyecto validado: `C:\Users\oanti\Documents\BDB-FONDOS`

Decision: `FIRST_WRITE_SUCCESS`

## Confirmaciones

- Firestore write ejecutado: si, limitado a 2 ISINs.
- Coleccion destino: `funds_v3`.
- ISINs escritos: `IE0003867441`, `ES0165142003`.
- ISINs saltados: ninguno.
- No se escribieron otros ISINs.
- No se hizo deploy.
- No se hizo push.
- No se hizo commit.
- No se llamo Gemini real.
- No se tocaron credenciales.
- No se tocaron retrocesiones.
- No se leyo ni modifico `C:\Users\oanti\Documents\BDB-FONDOS-CORE`.

## Prechecks

Documentacion leida:

- `docs/BDB_PARSER_FIRST_WRITE_REVIEW_0_APPROVAL_RECOMMENDATION.md`
- `docs/BDB_PARSER_POLICY_0_WRITE_REVIEW_CANON.md`
- `docs/BDB_PARSER_WRITE_SNAPSHOT_1_READONLY_DIFF.md`

Manifests leidos:

- `artifacts/bdb_parser_audit/write_gate_snapshot_1/write_approval_manifest.json`
- `artifacts/bdb_parser_audit/write_gate_snapshot_1/rollback_manifest.json`
- `artifacts/bdb_parser_audit/write_gate_snapshot_1/post_write_verification_plan.json`
- `artifacts/bdb_parser_audit/write_gate_snapshot_1/diff_manifest.json`
- `artifacts/bdb_parser_audit/write_gate_snapshot_1/snapshot_manifest.json`

Resultado precheck:

- `IE0003867441`: `WRITE_CANDIDATE`, `ACCEPT`.
- `ES0165142003`: `WRITE_CANDIDATE`, `ACCEPT_WITH_WARNINGS`.
- `BLOCKED`: ninguno entre aprobados.
- `REVIEW`: ninguno entre aprobados.
- Snapshots disponibles: si.
- Rollback snapshots completos: si.
- Post-write verification plan disponible: si.
- Campos prohibidos en proposed payload: 0.
- Campos prohibidos en changed fields: 0.

El manifest base tenia 5 candidatos; el write fue restringido explicitamente a:

- `IE0003867441`
- `ES0165142003`

Quedaron fuera:

- `LU0208853944`
- `LU0252500524`
- `LU1670724373`

## Comando Ejecutado

```bash
node MORNINGSTAR_PDF_PARSER/bin/apply_write_gate_controlled.js \
  --write \
  --confirm-write \
  --approve-isin IE0003867441 \
  --approve-isin ES0165142003 \
  --approval-manifest artifacts/bdb_parser_audit/write_gate_snapshot_1/write_approval_manifest.json \
  --rollback-manifest artifacts/bdb_parser_audit/write_gate_snapshot_1/rollback_manifest.json \
  --diff-manifest artifacts/bdb_parser_audit/write_gate_snapshot_1/diff_manifest.json \
  --snapshot-manifest artifacts/bdb_parser_audit/write_gate_snapshot_1/snapshot_manifest.json \
  --post-write-verification-plan artifacts/bdb_parser_audit/write_gate_snapshot_1/post_write_verification_plan.json \
  --output-dir artifacts/bdb_parser_audit/first_write_1 \
  --max-write-candidates 2 \
  --collection funds_v3 \
  --project bdb-fondos
```

## Campos Actualizados

`IE0003867441`:

- `classification_v2.equity_style_box`
- `derived.style_bias.equity.style`
- `derived.style_bias.equity.style_box_cell`
- `derived.style_bias.equity.style_weights_total`
- `ms.equity_style.style.blend`
- `ms.equity_style.style.growth`
- `ms.equity_style.style.value`
- `ms.equity_style.style_box_cell`
- `ms.holdings_top10`
- `ms.objective`
- `portfolio_exposure_v2.equity_styles`
- `quality.parsed_at` como `serverTimestamp()`
- `quality.parser_version`
- `updatedAt` como `serverTimestamp()`

`ES0165142003`:

- `ms.holdings_top10`
- `ms.rating_stars`
- `ms.sustainability_rating`
- `quality.parsed_at` como `serverTimestamp()`
- `quality.parser_version`
- `quality.warnings`
- `updatedAt` como `serverTimestamp()`

## Campos Preservados

Verificacion post-write:

| ISIN | manual.* | manual.costs | manual.costs.retrocession | portfolio_exposure_v2.economic_exposure | asset_mix sum |
| --- | --- | --- | --- | --- | --- |
| IE0003867441 | preservado | preservado | preservado | preservado | 1.0 |
| ES0165142003 | preservado | preservado | preservado | preservado | 1.0 |

## Artifacts Generados

Carpeta:

- `artifacts/bdb_parser_audit/first_write_1/`

Archivos:

- `first_write_execution_manifest.json`
- `first_write_post_verification.json`
- `first_write_applied_diff.json`
- `first_write_rollback_manifest.json`
- `first_write_precheck.json`

Resumen:

- `write_executed=true`
- `written_isins=["IE0003867441","ES0165142003"]`
- `skipped_isins=[]`
- `post_write_verification_result=PASS`
- `rollback_available=true`

## Validaciones Ejecutadas

```bash
node --check MORNINGSTAR_PDF_PARSER/bin/apply_write_gate_controlled.js
node MORNINGSTAR_PDF_PARSER/tests/test_first_write_controlled.js
node --check MORNINGSTAR_PDF_PARSER/src/lib/write_gate.js
node --check MORNINGSTAR_PDF_PARSER/bin/prepare_write_gate_dry_run.js
node MORNINGSTAR_PDF_PARSER/tests/test_parser_write_gate.js
node tests/parser_write_gate/test_parser_write_gate.js
```

Resultado: PASS.

Busqueda estatica:

- No hay `set` destructivo.
- No hay `delete`.
- No hay `batch.commit`.
- No hay `bulkWriter`.
- El write real usa `docRef.update(patch)` con patch limitado a los changed fields aprobados.

## Rollback

Rollback automatico: no ejecutado.

Rollback disponible: si, en:

- `artifacts/bdb_parser_audit/first_write_1/first_write_rollback_manifest.json`

El rollback manifest contiene snapshots previos y campos restaurables para ambos ISINs.

## Resultado Final

`FIRST_WRITE_SUCCESS`
