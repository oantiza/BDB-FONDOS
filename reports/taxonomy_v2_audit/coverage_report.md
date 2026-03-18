# V2 Taxonomy Audit â Coverage Report

**Run ID:** `audit_20260315_201750`
**Date:** 2026-03-15T20:17:51.989083+00:00
**Total Funds:** 669

---

## A. Totals

| Metric | Count | % |
|--------|------:|---:|
| With `classification_v2` | 669 | 100% |
| With `portfolio_exposure_v2` | 669 | 100% |
| With both | 669 | 100% |
| Without V2 | 0 | 0% |
| Without exposure | 0 | 0% |
| Low confidence | 0 | 0% |
| With warnings | 238 | 35% |
| Critical warnings (â¥2) | 22 | 3% |

## B. Distribution by Asset Type

| Type | Count |
|------|------:|
| EQUITY | 340 |
| FIXED_INCOME | 192 |
| MIXED | 97 |
| MONETARY | 7 |
| ALTERNATIVE | 13 |
| COMMODITIES | 17 |
| REAL_ESTATE | 3 |
| UNKNOWN | 0 |

## C. Field Coverage (among V2 funds)

| Field | Coverage | Denominator |
|-------|----------|-------------|
| `region_primary` | 551/669 | All V2 |
| `asset_subtype` | 625/669 | All V2 |
| `equity_style_box` | 142/340 | Equity funds |
| `market_cap_bias` | 338/340 | Equity funds |
| `fi_credit_bucket` | 162/192 | FI funds |
| `fi_duration_bucket` | 162/192 | FI funds |

## D. Low Risk Profile Safety

| Metric | Count |
|--------|------:|
| Suitable for low risk | 143 |
| Blocked for low risk | 526 |
| Low risk conflicts | 0 |

## E. Residual Risks

| Metric | Count |
|--------|------:|
| Legacy fallback only | 0 |
| V2 vs Legacy conflict | 0 |
| Ambiguous funds | 24 |
| Unknown type | 0 |

## F. Audit Flags Distribution

| Flag | Count |
|------|------:|
| `NO_V2_CLASSIFICATION` | 0 |
| `NO_EXPOSURE_V2` | 0 |
| `NO_METRICS_AND_NO_EXPOSURE` | 0 |
| `EQUITY_WITHOUT_STYLE_BOX` | 198 |
| `FI_WITHOUT_DURATION` | 30 |
| `FI_WITHOUT_CREDIT` | 30 |
| `ALLOCATION_WITHOUT_EXPOSURE` | 0 |
| `LOW_CONFIDENCE` | 0 |
| `V2_LEGACY_TYPE_CONFLICT` | 0 |
| `LOW_RISK_UNSAFE` | 0 |
| `UNKNOWN_ASSET_TYPE` | 0 |
| `UNKNOWN_SUBTYPE` | 24 |
| `MISSING_REGION_PRIMARY` | 118 |
| `EXCESSIVE_WARNINGS` | 22 |
| `EMERGING_LOW_RISK_CONFLICT` | 0 |
| `SECTOR_FUND_LOW_RISK_CONFLICT` | 0 |
| `HIGH_YIELD_LOW_RISK_CONFLICT` | 0 |
| `CONVERTIBLE_LOW_RISK_CONFLICT` | 0 |

## G. Output Files

| File | Rows | Description |
|------|-----:|-------------|
| `funds_without_v2.csv` | 0 | Funds with no `classification_v2` |
| `funds_without_exposure_v2.csv` | 0 | Funds with no `portfolio_exposure_v2` |
| `funds_low_confidence.csv` | 0 | Confidence < 0.6 |
| `funds_with_conflicts.csv` | 0 | V2 vs legacy type conflict |
| `funds_low_risk_unsafe.csv` | 0 | Potentially dangerous for low risk |
| `funds_unknown_or_ambiguous.csv` | 24 | Unknown type, subtype, or low confidence |
