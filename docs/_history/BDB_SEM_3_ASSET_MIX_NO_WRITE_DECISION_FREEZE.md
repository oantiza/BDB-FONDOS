# BDB-SEM-3 Asset Mix No-Write Decision Freeze

Generated at UTC: `2026-05-07T04:48:49.7974905Z`

## Objective

Freeze the decision to not execute a mass write for the `portfolio_exposure_v2.asset_mix` scale issue at this time.

## Problem Found

BDB-SEM-1 and BDB-SEM-2 confirmed that 450 funds have `portfolio_exposure_v2.asset_mix` stored in 0-1 scale. A deterministic correction exists: multiply `equity`, `bond`, `cash`, and `other` by 100.

SEM-2 also confirmed:

- Total candidates: `450`
- Proposed rule: `MULTIPLY_BY_100`
- All candidates had `current_sum` between `0.95` and `1.05`
- All proposed sums were between `95` and `105`
- `write_allowed=false` for all rows

## Why No Write Now

The current optimizer runtime already accepts both 0-1 and 0-100 exposure inputs. It converts values greater than `1.5` by dividing by 100, then normalizes the exposure vector to sum `1.0`.

That means the expected optimizer impact of changing storage from 0-1 to 0-100 is `NEUTRAL` for the current runtime. A mass write would add operational risk without improving optimizer math today.

## Optimizer Impact

- Runtime internal scale: `0-1`
- Runtime input tolerance: accepts both `0-1` and `0-100`
- Impact of one guarded 0-1 to 0-100 patch: neutral
- Runtime double-scale risk: `NO`

## Operational Risk

The main risk is not optimizer runtime interpretation. The main risk is operational: a repeated or non-idempotent write could multiply already-corrected values again, turning `99.8` into `9980`.

Therefore, any future correction must be idempotent and guarded.

## Future Condition For Correction

A future correction may be considered only with:

- Explicit human approval
- A canonical storage-scale decision
- A script that re-reads each document immediately before write
- Guard: apply only if current sum is still between `0.95` and `1.05`
- Abort if any candidate is already in 0-100 scale
- Per-ISIN patch preview and rollback-independent audit trail

## Read-Only Confirmation

- Firestore write executed: `false`
- Rollback executed: `false`
- Deploy executed: `false`
- Firebase CLI deploy executed: `false`
- CORE used: `false`
- `funds_core_v1` used: `false`
- Parser PDF used: `false`
- Batch update used: `false`
- Documents modified: `0`

## Decision

Final decision for this block: `NO WRITE NOW`.

Reason: `optimizer_accepts_both_scales_and_normalizes`.

Future action: `canonicalize_only_with_idempotent_guard`.

## Next Recommended Block

`BDB-SEM-4` should be contract hardening only: define the canonical storage scale and idempotent write preconditions before any approved mutation.
