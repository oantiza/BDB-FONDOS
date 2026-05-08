# BDB-SEM-2 Asset Mix Fix Plan Dry-Run

Generated at UTC: `2026-05-07T04:41:43.686095+00:00`

## Objective

Create an exact dry-run plan to correct the 450 deterministic `portfolio_exposure_v2.asset_mix` scale candidates identified in BDB-SEM-1. This block does not write to Firestore.

## Problem Confirmed

BDB-SEM-1 classified all 450 `ASSET_MIX_SCALE_0_1_SUSPECTED` ISINs as `HIGH_CONFIDENCE_SCALE_FIX`: current raw sums are between `0.95` and `1.05`, and multiplying components by 100 gives proposed sums between `95` and `105`.

## Correction Rule

- Field: `portfolio_exposure_v2.asset_mix`
- Rule: `MULTIPLY_BY_100`
- Components: `equity`, `bond`, `cash`, `other`
- Confidence: `HIGH`
- Write allowed in this block: `false`

The rule is deterministic because every candidate has numeric, non-negative components, a current sum near `1`, and a proposed x100 sum near `100`.

## Optimizer Scale Contract

- Runtime internal scale: `0-1 decimal fractions`
- Runtime input tolerance: `accepts both 0-1 and 0-100 for exposure components`
- Optimizer converts to 0-1 internally: `true`
- Asset mix precedence: `portfolio_exposure_v2.asset_mix is read before economic_exposure when present`
- Runtime effect of a single patch: `neutral for optimizer vectors; both 0.998 and 99.8 become 0.998 before final normalization`

Evidence reviewed:

- `functions_python/services/portfolio/utils.py` lines 134-138: _as_fraction divides values with abs(value) > 1.5 by 100 and clamps to 0..1
- `functions_python/services/portfolio/utils.py` lines 245-283: get_v2_asset_mix reads asset_mix first, falls back to economic_exposure/v2_exposure, then returns decimal or percent based on as_percent
- `functions_python/services/portfolio/optimizer_core.py` lines 67-103: optimizer exposure vectors come from get_effective_asset_mix and are decimal fractions
- `functions_python/api/endpoints_portfolio.py` lines 75-115: backend fetches funds_v3 metadata, computes get_v2_asset_mix(as_percent=True) for v2_exposure, and passes raw portfolio_exposure_v2 to optimizer metadata
- `frontend/src/utils/normalizer.ts` lines 203-209, 280-303: UI normalizeExposurePct converts <=1.5 to percent by multiplying by 100 and leaves 0-100 values unchanged
- `frontend/src/hooks/usePortfolioActions.ts` lines 29-143: frontend optimization payload sends minimal asset metadata; backend funds_v3 metadata remains authoritative for V2 exposure

## Expected Optimizer Impact

The current optimizer should produce equivalent exposure vectors before and after a single 0-1 to 0-100 storage patch because `_as_fraction` converts percent-like inputs back to decimals and `get_v2_asset_mix` normalizes the vector. The expected operational benefit is contract clarity for reporting/storage consumers, not a change in optimizer math.

## Risks

- Risk of not correcting: raw consumers that expect 0-100 may understate allocations by roughly 100x.
- Risk of double scale in optimizer runtime: `NO`.
- Operational rerun risk: `YES if a future write script blindly multiplies already-corrected 0-100 values`.
- Guard required: `before any real write, assert current_sum between 0.95 and 1.05 and proposed_sum between 95 and 105 for every ISIN`.
- Non-runtime conflict: parser/ingest validation currently encodes 0-1 semantics, so any real write block should explicitly resolve or scope that contract before mutation.

## Validations

- Total candidates: 450
- Current sum all 0.95-1.05: `true`
- Proposed sum all 95-105: `true`
- No REVIEW/BLOCKED candidates: `true`
- write_allowed false for all: `true`
- Proposed sum min/max: `99.99` / `100.93`

## Tests Executed

- Backend optimizer/suitability: `.\venv\Scripts\python.exe -m pytest tests\test_optimizer_core.py tests\test_bucket_constraints_dedup.py tests\test_suitability_v2.py` -> `58 passed`.
- Backend suitability with system Python: `python -m pytest tests\test_suitability_v2.py` -> `47 passed`.
- Frontend mixed funds: `npm test -- --run src\__tests__\mixedFunds.test.ts` -> `19 passed`.
- Frontend V2 helpers: `npm test -- --run src\__tests__\v2Helpers.test.ts` -> `28 passed, 2 failed`; failures are existing taxonomy display/raw subtype expectations, not asset_mix scale logic.

## Top 20 Patch Preview

- `BE0946564383` DPAM B - Equities NewGems Sustainable B Cap: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `BE0947853660` DPAM B - Equities US Dividend Sustainable B EUR Cap: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `DE0008490962` DWS Deutschland LC: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0112231016` Avantage Fund B FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0112602000` Azvalor Managers FI: current_sum=0.9999, proposed_sum=99.99, write_allowed=false
- `ES0114633003` Panda Agriculture & Water Fund FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0116419005` Cartera Renta Fija Horizonte 2026 FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0124880032` UBS Renta Fija 0-5 B FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0125240038` Trea Renta Fija Ahorro S FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0125323008` Gestión Value A FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0137381036` Gesconsult Renta Variable Iberia A FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0138217031` Gesconsult Renta Fija Flexible A FI: current_sum=0.9999, proposed_sum=99.99, write_allowed=false
- `ES0138911039` Gesconsult Renta Variable Eurozona FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0138914033` Merch-Fontemar FI: current_sum=1.0001, proposed_sum=100.01, write_allowed=false
- `ES0138922002` Gesconsult Horizonte 2025 FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0138936036` Fondibas FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0140643034` GVC Gaesco Europa FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0140986011` Gesconsult Oportunidad Renta Fija A FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0141113037` GVC Gaesco Japón A FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false
- `ES0141116030` Hamco Global Value Fund R FI: current_sum=1.0, proposed_sum=100.0, write_allowed=false

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

## Artifacts

- `artifacts\bdb_semantic_audit\bdb_sem_2_asset_mix_fix_plan_summary.json`
- `artifacts\bdb_semantic_audit\bdb_sem_2_asset_mix_fix_plan_detail.csv`
- `artifacts\bdb_semantic_audit\bdb_sem_2_asset_mix_patch_preview.json`
- `artifacts\bdb_semantic_audit\bdb_sem_2_optimizer_scale_contract_review.json`
- `docs\BDB_SEM_2_ASSET_MIX_FIX_PLAN_DRY_RUN.md`

## Recommendation

Next block should be `BDB-SEM-3` only after explicit human approval. It should re-read each candidate immediately before write, assert current sum is still `0.95`-`1.05`, abort on any already-0-100 value, and apply no update unless all guards pass.
