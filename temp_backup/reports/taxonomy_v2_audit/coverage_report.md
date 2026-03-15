# V2 Taxonomy Audit — Coverage Report

**Run ID:** `audit_20260312_124926`
**Date:** 2026-03-12T12:49:27.764585+00:00
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
| Low confidence | 4 | 0% |
| With warnings | 139 | 20% |
| Critical warnings (≥2) | 0 | 0% |

## B. Distribution by Asset Type

| Type | Count |
|------|------:|
| EQUITY | 349 |
| FIXED_INCOME | 179 |
| MIXED | 94 |
| MONETARY | 6 |
| ALTERNATIVE | 5 |
| COMMODITIES | 0 |
| REAL_ESTATE | 1 |
| UNKNOWN | 35 |

## C. Field Coverage (among V2 funds)

| Field | Coverage | Denominator |
|-------|----------|-------------|
| `region_primary` | 467/669 | All V2 |
| `asset_subtype` | 464/669 | All V2 |
| `equity_style_box` | 96/349 | Equity funds |
| `market_cap_bias` | 344/349 | Equity funds |
| `fi_credit_bucket` | 99/179 | FI funds |
| `fi_duration_bucket` | 129/179 | FI funds |

## D. Low Risk Profile Safety

| Metric | Count |
|--------|------:|
| Suitable for low risk | 63 |
| Blocked for low risk | 606 |
| Low risk conflicts | 0 |

## E. Residual Risks

| Metric | Count |
|--------|------:|
| Legacy fallback only | 0 |
| V2 vs Legacy conflict | 0 |
| Ambiguous funds | 194 |
| Unknown type | 35 |

## F. Audit Flags Distribution

| Flag | Count |
|------|------:|
| `NO_V2_CLASSIFICATION` | 0 |
| `NO_EXPOSURE_V2` | 0 |
| `NO_METRICS_AND_NO_EXPOSURE` | 0 |
| `EQUITY_WITHOUT_STYLE_BOX` | 253 |
| `FI_WITHOUT_DURATION` | 50 |
| `FI_WITHOUT_CREDIT` | 80 |
| `ALLOCATION_WITHOUT_EXPOSURE` | 0 |
| `LOW_CONFIDENCE` | 4 |
| `V2_LEGACY_TYPE_CONFLICT` | 0 |
| `LOW_RISK_UNSAFE` | 0 |
| `UNKNOWN_ASSET_TYPE` | 35 |
| `UNKNOWN_SUBTYPE` | 159 |
| `MISSING_REGION_PRIMARY` | 202 |
| `EXCESSIVE_WARNINGS` | 0 |
| `EMERGING_LOW_RISK_CONFLICT` | 0 |
| `SECTOR_FUND_LOW_RISK_CONFLICT` | 0 |
| `HIGH_YIELD_LOW_RISK_CONFLICT` | 0 |
| `CONVERTIBLE_LOW_RISK_CONFLICT` | 0 |

## G. Output Files

| File | Rows | Description |
|------|-----:|-------------|
| `funds_without_v2.csv` | 0 | Funds with no `classification_v2` |
| `funds_without_exposure_v2.csv` | 0 | Funds with no `portfolio_exposure_v2` |
| `funds_low_confidence.csv` | 4 | Confidence < 0.6 |
| `funds_with_conflicts.csv` | 0 | V2 vs legacy type conflict |
| `funds_low_risk_unsafe.csv` | 0 | Potentially dangerous for low risk |
| `funds_unknown_or_ambiguous.csv` | 194 | Unknown type, subtype, or low confidence |
