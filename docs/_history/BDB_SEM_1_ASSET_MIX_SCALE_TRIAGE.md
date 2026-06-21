# BDB-SEM-1 Asset Mix Scale Triage

Generated at UTC: `2026-05-07T04:31:46.263559+00:00`

## Objective

Review the `ASSET_MIX_SCALE_0_1_SUSPECTED` HIGH cohort from BDB-SEM-0 and classify whether each ISIN can be treated as a deterministic scale-fix candidate.

## Read-Only Confirmation

- Firestore read executed: `false`
- Firestore write executed: `false`
- Rollback executed: `false`
- Deploy executed: `false`
- Firebase CLI deploy executed: `false`
- CORE used: `false`
- `funds_core_v1` used: `false`
- Parser PDF used: `false`
- Batch update used: `false`
- Documents modified: `0`

## Problem Detected

SEM-0 found `ASSET_MIX_SCALE_0_1_SUSPECTED` on 450 `asset_mix` entries. The raw component sums are near `1`, while multiplying components by 100 gives a valid allocation sum near `100`.

## Decision Rule

- `HIGH_CONFIDENCE_SCALE_FIX`: raw_sum is between `0.95` and `1.05`, all four components are numeric/non-negative, and x100 sum is between `95` and `105`.
- `REVIEW_REQUIRED`: raw_sum is outside `0.95`-`1.05`, but x100 sum is between `95` and `105`.
- `BLOCKED`: missing/non-numeric/negative/out-of-range components, or x100 sum cannot be inferred safely.

## Counts

- Total analyzed: 450
- HIGH_CONFIDENCE_SCALE_FIX: 450
- REVIEW_REQUIRED: 0
- BLOCKED: 0

## Scale Mix Verification

- SEM-0 asset_mix docs: 450
- Scale-suspected asset_mix ISINs: 450
- Already 0-100 within scale-flag set: 0
- 0-1 within scale-flag set: 450
- Ambiguous within scale-flag set: 0

Interpretation: SEM-0 reported 450 asset_mix docs and 450 ASSET_MIX_SCALE_0_1_SUSPECTED flags, so within SEM-0 artifacts every asset_mix-bearing document is in the suspected 0-1 cohort.

## Optimizer Risk

If a consumer expects 0-100 but reads these values as-is, equity/fixed income/cash/other limits can be understated by roughly 100x. If a consumer expects 0-1 and a correction multiplies values without updating that contract, the inverse risk appears. The correction decision must therefore be tied to the optimizer payload contract, not only to storage shape.

## Top 20 Examples

- `HIGH_CONFIDENCE_SCALE_FIX` `BE0946564383` DPAM B - Equities NewGems Sustainable B Cap: raw_sum=1.0, x100_sum=100.0, equity_x100=99.8, fixed_income_x100=0.0, cash_x100=0.2, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `BE0947853660` DPAM B - Equities US Dividend Sustainable B EUR Cap: raw_sum=1.0, x100_sum=100.0, equity_x100=98.59, fixed_income_x100=0.0, cash_x100=1.41, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `DE0008490962` DWS Deutschland LC: raw_sum=1.0, x100_sum=100.0, equity_x100=96.37, fixed_income_x100=0.0, cash_x100=3.63, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0112231016` Avantage Fund B FI: raw_sum=1.0, x100_sum=100.0, equity_x100=74.53, fixed_income_x100=22.86, cash_x100=2.61, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0112602000` Azvalor Managers FI: raw_sum=0.9999, x100_sum=99.99, equity_x100=85.33, fixed_income_x100=0.0, cash_x100=13.82, other_x100=0.84
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0114633003` Panda Agriculture & Water Fund FI: raw_sum=1.0, x100_sum=100.0, equity_x100=91.95, fixed_income_x100=0.0, cash_x100=8.05, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0116419005` Cartera Renta Fija Horizonte 2026 FI: raw_sum=1.0, x100_sum=100.0, equity_x100=0.0, fixed_income_x100=73.91, cash_x100=24.07, other_x100=2.02
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0124880032` UBS Renta Fija 0-5 B FI: raw_sum=1.0, x100_sum=100.0, equity_x100=0.0, fixed_income_x100=98.9315, cash_x100=0.0, other_x100=1.0685
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0125240038` Trea Renta Fija Ahorro S FI: raw_sum=1.0, x100_sum=100.0, equity_x100=0.0, fixed_income_x100=91.03, cash_x100=8.39, other_x100=0.58
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0125323008` Gestión Value A FI: raw_sum=1.0, x100_sum=100.0, equity_x100=57.65, fixed_income_x100=0.0, cash_x100=5.82, other_x100=36.53
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0137381036` Gesconsult Renta Variable Iberia A FI: raw_sum=1.0, x100_sum=100.0, equity_x100=93.31, fixed_income_x100=5.49, cash_x100=1.2, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0138217031` Gesconsult Renta Fija Flexible A FI: raw_sum=0.9999, x100_sum=99.99, equity_x100=9.5, fixed_income_x100=84.56, cash_x100=5.93, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0138911039` Gesconsult Renta Variable Eurozona FI: raw_sum=1.0, x100_sum=100.0, equity_x100=97.03, fixed_income_x100=1.8, cash_x100=1.17, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0138914033` Merch-Fontemar FI: raw_sum=1.0001, x100_sum=100.01, equity_x100=24.54, fixed_income_x100=68.98, cash_x100=0.0, other_x100=6.49
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0138922002` Gesconsult Horizonte 2025 FI: raw_sum=1.0, x100_sum=100.0, equity_x100=0.0, fixed_income_x100=89.08, cash_x100=10.92, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0138936036` Fondibas FI: raw_sum=1.0, x100_sum=100.0, equity_x100=18.89, fixed_income_x100=76.84, cash_x100=4.27, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0140643034` GVC Gaesco Europa FI: raw_sum=1.0, x100_sum=100.0, equity_x100=99.31, fixed_income_x100=0.0, cash_x100=0.69, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0140986011` Gesconsult Oportunidad Renta Fija A FI: raw_sum=1.0, x100_sum=100.0, equity_x100=0.0, fixed_income_x100=83.35, cash_x100=3.86, other_x100=12.79
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0141113037` GVC Gaesco Japón A FI: raw_sum=1.0, x100_sum=100.0, equity_x100=96.41, fixed_income_x100=0.0, cash_x100=3.59, other_x100=0.0
- `HIGH_CONFIDENCE_SCALE_FIX` `ES0141116030` Hamco Global Value Fund R FI: raw_sum=1.0, x100_sum=100.0, equity_x100=84.17, fixed_income_x100=12.32, cash_x100=2.46, other_x100=1.05

## Artifacts

- `artifacts\bdb_semantic_audit\bdb_sem_1_asset_mix_scale_triage_summary.json`
- `artifacts\bdb_semantic_audit\bdb_sem_1_asset_mix_scale_triage_detail.csv`
- `artifacts\bdb_semantic_audit\bdb_sem_1_high_confidence_fix_candidates.csv`
- `artifacts\bdb_semantic_audit\bdb_sem_1_review_required.csv`
- `artifacts\bdb_semantic_audit\bdb_sem_1_blocked.csv`
- `docs\BDB_SEM_1_ASSET_MIX_SCALE_TRIAGE.md`

## Recommendation

Next block should be `BDB-SEM-2`, still review-only: produce an exact correction plan for the 450 deterministic candidates, verify downstream optimizer/reporting consumers expect 0-100, and require explicit approval before any Firestore write.
