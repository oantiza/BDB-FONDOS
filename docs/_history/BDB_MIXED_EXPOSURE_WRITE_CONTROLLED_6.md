# BDB_MIXED_EXPOSURE_WRITE_CONTROLLED_6

## Summary

Third review-required batch (Batch 6 / Lote 6) of the MIXED funds exposure migration.
**HIGH-DELTA BATCH**: Contains 4 out of 5 funds with equity changes exceeding ±20 percentage points.

- **Date**: 2026-05-11
- **ISINs updated**: 5
- **Post-verification**: ALL PASS
- **Prohibited fields**: ALL INTACT
- **Total MIXED corrected after this batch**: 45/60

## High-Delta Cases Acknowledgement

This batch contains significant equity exposure changes that were individually reviewed and approved.
All changes correct a generic 50/50 default to the actual Morningstar portfolio asset allocation.

| ISIN | Fund Name | Old eq% | New eq% | Δ equity | Rationale |
|------|-----------|---------|---------|----------|-----------|
| LU0119195963 | Goldman Sachs Patrimonial Balanced - P Cap EUR | 50.0 | 38.7 | -11.3pp | MODERATE_ALLOCATION. MS sum=108.7% (slight leverage). Genuinely more defensive than 50/50. Bond=49.2%, other=12.1% (alternatives). Coherent with "Balanced" name. |
| ES0118537002 | Olea Neutral FI | 50.0 | 15.5 | **-34.5pp** | MODERATE_ALLOCATION. MS sum=100%. Market-neutral strategy with very low net equity. Name "Neutral" confirms strategy. Coherent. |
| LU2050544563 | DWS ESG Multi Asset Dynamic LC | 50.0 | 76.1 | **+26.1pp** | FLEXIBLE_ALLOCATION. MS sum=100%. "Dynamic" in name signals high-equity tilt. Equity-dominated multi-asset. Coherent. |
| LU0284394821 | DNCA Invest Évolutif B EUR | 50.0 | 71.5 | **+21.5pp** | FLEXIBLE_ALLOCATION. MS sum=106.4% (minor leverage). Flexible with equity tilt. "Évolutif" = growth-oriented flexible. Coherent. |
| ES0114904008 | Brightgate Focus A FI | 50.0 | 85.6 | **+35.6pp** | FLEXIBLE_ALLOCATION. MS sum=100%. Concentrated high-conviction equity fund. Classified as flexible but essentially equity. Coherent. |

## Why Each Change Is Approved Despite High Delta

### ES0118537002 — Olea Neutral FI (Δ = -34.5pp)
The old 50% equity was a generic default. Olea Neutral is a **market-neutral strategy** — its name explicitly says "Neutral". MS data shows only 15.5% net equity, with 64.9% bonds and 13.8% cash. The suitability engine should reflect this fund's true conservative nature, not a fabricated 50/50.

### LU2050544563 — DWS ESG Multi Asset Dynamic LC (Δ = +26.1pp)
"Dynamic" in the fund name signals an aggressive equity allocation. MS shows 76.1% equity, consistent with a dynamic multi-asset fund. The old 50/50 understated risk; this correction ensures suitability filters appropriately.

### LU0284394821 — DNCA Invest Évolutif B EUR (Δ = +21.5pp)
"Évolutif" (evolutionary/growth) signals a growth-oriented flexible allocation. MS data shows 71.5% equity with minor leverage (sum=106.4%). The change reflects the fund's actual risk profile.

### ES0114904008 — Brightgate Focus A FI (Δ = +35.6pp)
Brightgate Focus is a **concentrated high-conviction equity fund** classified as FLEXIBLE_ALLOCATION. MS data shows 85.6% equity, 0% bonds, 10.9% cash. This is effectively an equity fund and the suitability engine must reflect that to protect conservative investors.

### LU0119195963 — Goldman Sachs Patrimonial Balanced (Δ = -11.3pp)
The smallest delta. MS shows 38.7% equity vs the old 50%, with meaningful allocation to alternatives (12.1% other). The fund is more defensive than the generic 50/50 suggested.

## Confirmation: 50/50 Persisted vs Morningstar Real

All 5 funds had the **same bug**: `economic_exposure = {equity: 50.0, bond: 50.0, cash: 0.0, other: 0.0}` with `exposure_confidence: 0.45`. This was the generic fallback from `EXPOSURE_INFERRED_FROM_CLASSIFICATION` when the taxonomy script lacked MS portfolio data.

The Morningstar `ms.portfolio.assetAllocation` data was already present in each fund's Firestore document but was **not being used** to compute `portfolio_exposure_v2.economic_exposure`. This batch corrects that gap.

## Fields Updated

Per ISIN:
- `portfolio_exposure_v2.economic_exposure` → MS-derived values
- `portfolio_exposure_v2.exposure_confidence` → 0.85
- `portfolio_exposure_v2.warnings` → `["EXPOSURE_SOURCE_MS_PORTFOLIO"]`
- `portfolio_exposure_v2.computed_at` → write timestamp

## Fields Verified Intact (Post-Write)

For all 5 ISINs:
- ✅ `manual` — intact
- ✅ `manual.costs` — intact
- ✅ `manual.costs.retrocession` — intact
- ✅ `classification_v2` — intact
- ✅ `ms` — intact
- ✅ `derived` — intact
- ✅ `std_perf` — intact

## Test Results

```
62 passed in 1.73s
- test_mixed_exposure_ms_portfolio.py: 11 passed
- test_mixed_funds_lookthrough_contract.py: 4 passed
- test_suitability_v2.py: 47 passed
```

## Rollback

Available at: `artifacts/bdb_mixed_exposure_fix/write_gate_6/rollback_manifest.json`
Contains original values for all 5 ISINs to restore `economic_exposure`, `exposure_confidence`, and `warnings`.

## Progress Summary

| Batch | Count | Type | Status |
|-------|-------|------|--------|
| 1 | 10 | Low-risk | ✅ Complete |
| 2 | 5 | Low-risk | ✅ Complete |
| 3 | 15 | Low-risk | ✅ Complete |
| 4 | 5 | Review-required | ✅ Complete |
| 5 | 5 | Review-required | ✅ Complete |
| **6** | **5** | **Review-required (HIGH-DELTA)** | **✅ Complete** |
| **Total** | **45/60** | | |

### Remaining (15 funds)
- 9 APPROVE (auto-correctable)
- 3 REVIEW_MANUAL (require manual analysis)
- 2 HOLD (blocked)
- 1 sin MS data
