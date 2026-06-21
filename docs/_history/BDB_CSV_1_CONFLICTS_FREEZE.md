# BDB-CSV-1 Conflict Freeze

Generated at UTC: `2026-05-06T20:09:03.383489+00:00`

## Scope

- Operational project: `C:\Users\oanti\Documents\BDB-FONDOS`
- Target collection: `funds_v3`
- Source block: `BDB-CSV-0` dry-run artifacts
- Excluded project: `C:\Users\oanti\Documents\BDB-FONDOS-CORE`
- Excluded collection: `funds_core_v1`
- Excluded sources: CORE artifacts, parser PDF payloads, CSV-13/14/15/16/17 CORE chain

This block freezes conflicts only. It does not create a write payload.

## Safety

- Firestore write executed: `false`
- Firestore read executed in this block: `false`
- Rollback executed: `false`
- Deploy executed: `false`
- Firebase CLI deploy executed: `false`
- CORE used: `false`

## Frozen Counts

- Total frozen conflicts: 427
- Unique frozen conflict ISINs: 427
- Substantive review conflicts: 1
- Timestamp/protected metadata-only conflicts: 426

By category:

- `SUBSTANTIVE_PROTECTED_FIELD`: 1
- `TIMESTAMP_METADATA_ONLY`: 426

By field:

- `derived.last_classified`: 3
- `manual.costs.retrocession`: 1
- `quality.last_repaired_at`: 136
- `quality.sectors_normalized_at`: 383

## Substantive Review Freeze

- `LU0172157363` BlackRock Global Funds - World Mining Fund E2 (EUR): manual.costs.retrocession: CSV=0 :: FIRESTORE=1 || quality.sectors_normalized_at: CSV=2026-01-25 07:45:06.163000+00:00 :: FIRESTORE=2026-01-25T07:45:06.163000+00:00

The substantive row remains frozen as review-only. It must not be included in an automatic update package and must not overwrite live `funds_v3` without a separate explicit approval.

## Source Hashes

- `artifacts/bdb_csv_recenter/bdb_csv_context_diagnosis.json`: `1e29209115809be7e26bda3b0a438f064127da62de9fe76ac70602c4572e8074`
- `artifacts/bdb_csv_recenter/bdb_csv_funds_v3_audit_summary.json`: `98d00e2717ee75e562bf8eebb8c3ad7e6c55f212b4ab7edfea40dcf4c4ad9f88`
- `artifacts/bdb_csv_recenter/bdb_csv_update_candidates_preview.csv`: `58cf50b13c8b63d1e21f17ca0bd62129a2c6feca8e7b5967a4df4358ae30c060`
- `artifacts/bdb_csv_recenter/bdb_csv_update_plan_dry_run.json`: `c310f5707f43a7c4172456c0ec0d48f4388a1ee69f1cd789fa892c063a875adb`
- `data/work/fondos_absolutamente_todos_los_campos.csv`: `2bc14f521412c29270ce439b51c8581b99a39e89c3fd0534e9998f37666673a7`

## Artifacts

- `artifacts/bdb_csv_recenter/bdb_csv_1_conflicts_freeze_summary.json`
- `artifacts/bdb_csv_recenter/bdb_csv_1_conflicts_freeze_manifest.json`
- `artifacts/bdb_csv_recenter/bdb_csv_1_conflicts_freeze_details.csv`
- `artifacts/bdb_csv_recenter/bdb_csv_1_conflicts_freeze_substantive_review.csv`

## Gate

No conflict row is eligible for automatic writing. Any later write package must exclude this freeze set unless a new human-approved review block explicitly removes an item from conflict freeze.
