# BDB CSV Recentering And funds_v3 Update Plan

Generated at UTC: `2026-05-06T19:08:51.943327+00:00`

## Scope

- Operational project: `C:\Users\oanti\Documents\BDB-FONDOS`
- Target collection: `funds_v3`
- Excluded project: `C:\Users\oanti\Documents\BDB-FONDOS-CORE`
- Excluded collection: `funds_core_v1`
- Excluded sources: CORE artifacts, CSV-13/14/15/16/17 CORE chain, PDF parser payloads
- Execution mode: dry-run plan only

No Firestore write, rollback, deploy, Firebase CLI deploy, CORE access, or parser-PDF flow is part of this block.

## CSV Sources Found

Requested master filenames:

- `fondos_master_merged_final.csv`: NOT_FOUND
- `fondos_master_union_todas_fuentes.csv`: NOT_FOUND
- `fondos_conflictos_fuentes.csv`: NOT_FOUND
- `fondos_pendientes_pdf_reales.csv`: NOT_FOUND
- `fondos_resumen_estados.csv`: NOT_FOUND

Selected in-project source for this dry-run:

- `data/work/fondos_absolutamente_todos_los_campos.csv`
- Reason: richest real fund CSV present in `BDB-FONDOS`; the named master datasets were not found.
- Rows: 670
- Unique ISINs: 670
- Headers: 326

Relevant CSV inventory:

- `data/work/fondos.csv`: rows=670, unique_isins=670, delimiter=`;`
- `data/work/fondos_absolutamente_todos_los_campos.csv`: rows=670, unique_isins=670, delimiter=`,`
- `data/work/fondos_all_fields.csv`: rows=670, unique_isins=670, delimiter=`,`
- `data/work/rosario.csv`: rows=212, unique_isins=0, delimiter=`;`
- `data/work/subcategory_sectors_mapping.csv`: rows=13, unique_isins=0, delimiter=`,`
- `data/work/subcategory_tokens_mapping.csv`: rows=49, unique_isins=0, delimiter=`,`
- `docs/audits/legacy/audit_inconsistent_derived.csv`: rows=56, unique_isins=56, delimiter=`,`
- `docs/audits/legacy/audit_unknown_subtypes.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_audit/funds_low_confidence.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_audit/funds_low_risk_unsafe.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_audit/funds_unknown_or_ambiguous.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_audit/funds_with_conflicts.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_audit/funds_without_exposure_v2.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_audit/funds_without_v2.csv`: rows=0, unique_isins=0, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts.csv`: rows=19, unique_isins=19, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_164447.csv`: rows=333, unique_isins=333, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165656.csv`: rows=385, unique_isins=385, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165835.csv`: rows=385, unique_isins=385, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_165927.csv`: rows=385, unique_isins=385, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_170027.csv`: rows=385, unique_isins=385, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_202632.csv`: rows=81, unique_isins=81, delimiter=`,`
- `docs/audits/taxonomy_v2_review/all_conflicts_20260312_210718.csv`: rows=31, unique_isins=31, delimiter=`,`
- `docs/audits/taxonomy_v2_review/sample_review_50.csv`: rows=50, unique_isins=50, delimiter=`,`
- `functions_python/scripts/subcategory_sectors_mapping.csv`: rows=13, unique_isins=0, delimiter=`,`
- `functions_python/scripts/subcategory_tokens_mapping.csv`: rows=43, unique_isins=0, delimiter=`,`

## funds_v3 Read-Only Audit

- Total docs in `funds_v3`: 670
- `manual.costs.retrocession` present: 670 / 670
- `classification_v2` top-level present: 670 / 670
- `portfolio_exposure_v2` top-level present: 670 / 670
- `ms` top-level present: 670 / 670
- `derived` top-level present: 670 / 670

Legacy relevant field counts are recorded in `bdb_csv_funds_v3_audit_summary.json`.

## CSV vs funds_v3 Cross-Check

- CSV unique ISINs: 670
- funds_v3 document IDs: 670
- Intersection: 670
- CSV ISINs not in funds_v3: 0
- funds_v3 docs not in selected CSV: 0

## Operation Classification

- INSERT_NEW: 0
- UPDATE_MISSING_ONLY: 0
- REVIEW_CONFLICT: 427
- SKIP_ALREADY_COMPLETE: 243
- BLOCKED: 0

Rules:

- `INSERT_NEW`: CSV ISIN does not exist in `funds_v3`; requires a separate reviewed payload and explicit approval.
- `UPDATE_MISSING_ONLY`: CSV has values for fields missing in `funds_v3`; future writes, if any, must be missing-only.
- `REVIEW_CONFLICT`: CSV and Firestore both have values but differ; never overwrite automatically.
- `SKIP_ALREADY_COMPLETE`: Compared values are already present or CSV offers no safe missing-only enrichment.
- `BLOCKED`: Duplicate/malformed CSV rows or unsafe context.

## No-Overwrite Policy

The dry-run treats populated `funds_v3` data as authoritative. Fields already present under these areas must not be overwritten automatically:

- `manual.*`
- `classification_v2.*`
- `portfolio_exposure_v2.*`
- `ms.*`
- `derived.*`
- `std_perf.*`
- `quality.*`
- `data_quality.*`
- `metadata.*`
- `last_sync`
- `updatedAt`
- `schema_version`

Conflicts are review-only. This block generated only local artifacts.

## Artifacts

- `artifacts/bdb_csv_recenter/bdb_csv_context_diagnosis.json`
- `artifacts/bdb_csv_recenter/bdb_csv_funds_v3_audit_summary.json`
- `artifacts/bdb_csv_recenter/bdb_csv_update_candidates_preview.csv`
- `artifacts/bdb_csv_recenter/bdb_csv_update_plan_dry_run.json`

## Conflict Analysis

- `REVIEW_CONFLICT` total: 427
- Timestamp/protected metadata-only conflicts: 426
- Non-timestamp conflicts: 1
- `manual.costs.retrocession` conflicts: 1

The timestamp-only conflicts are not enrichment candidates. They are protected metadata/currentness differences and must not be written back from CSV automatically. The substantive protected-field conflict is `LU0172157363`, where CSV has `manual.costs.retrocession=0` and live Firestore has `manual.costs.retrocession=1`; this requires manual review and no overwrite.

## Validation Notes

- Firebase access used Admin SDK `collection.stream()` against `funds_v3` only.
- The selected CSV set was cross-checked against `data/work/fondos.csv`, `data/work/fondos_all_fields.csv`, and `data/work/fondos_absolutamente_todos_los_campos.csv` when present.
- Local artifacts were written only inside `BDB-FONDOS`.
- CORE artifacts were not read or used.

## Next Block Gate

Recommended next block: `BDB-CSV-1` should review this dry-run output and decide whether to prepare a narrowly scoped `UPDATE_MISSING_ONLY` package for `funds_v3`. Any real Firestore write requires explicit human approval in a separate block.
