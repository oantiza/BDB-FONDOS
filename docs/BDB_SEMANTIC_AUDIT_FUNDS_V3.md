# BDB-SEM-0 Read-Only Semantic Audit Of funds_v3

Generated at UTC: `2026-05-07T04:20:21.037545+00:00`

## Objective

Audit `funds_v3` semantically, in read-only mode, after the CSV recentering/freeze blocks. The goal is to detect financial or taxonomic issues that could affect optimizer behavior, reporting, filters, or auditability.

## Scope

- Operational project: `C:\Users\oanti\Documents\BDB-FONDOS`
- Target collection: `funds_v3`
- Documents audited: 670
- Expected documents: 670
- Expected count matched: `true`
- Excluded project: `C:\Users\oanti\Documents\BDB-FONDOS-CORE`
- Excluded collection: `funds_core_v1`
- Excluded flows: parser PDF, batch updates, rollback, deploy

## Methodology

- Read Firestore with Admin SDK using `collection.stream()` only.
- Use `portfolio_exposure_v2.asset_mix` when populated; otherwise use `portfolio_exposure_v2.economic_exposure` as a read-only fallback signal.
- Check top-level asset allocation sums against the 95-105 range after scale interpretation.
- Detect possible 0-1 versus 0-100 scale confusion.
- Compare `classification_v2` against effective exposure buckets.
- Check region/sector totals for sleeve-level versus fund-level interpretation.
- Compare `derived` against `classification_v2` and effective exposure.
- Inspect parser/MS provenance and previous quality/classification/exposure warnings.

## Severity Model

- `HIGH`: can contaminate optimizer, has invalid asset mix, or shows strong classification/exposure contradiction.
- `MEDIUM`: affects reporting, filters, parser auditability, region/sector interpretation, or fallback taxonomy.
- `LOW`: incomplete metadata or informational previous-warning signals.

## Summary

- HIGH flag instances: 459
- MEDIUM flag instances: 686
- LOW flag instances: 1385
- Docs with any flag: 670
- Docs with no flags: 0
- Unique HIGH ISINs: 450
- Unique MEDIUM ISINs: 497
- Unique LOW ISINs: 670

Exposure source counts:

```json
{
  "asset_mix": 450,
  "economic_exposure": 220
}
```

## Flags By Type

- `PREVIOUS_RELEVANT_QUALITY_WARNINGS`: 612
- `PORTFOLIO_EXPOSURE_WARNINGS_PRESENT`: 454
- `ASSET_MIX_SCALE_0_1_SUSPECTED`: 450
- `CLASSIFICATION_WARNINGS_PRESENT`: 318
- `DERIVED_REGION_TOTAL_SUSPICIOUS`: 272
- `ASSET_MIX_MISSING_USING_ECONOMIC_EXPOSURE`: 220
- `EQUITY_REGIONS_LOOK_LIKE_RV_SLEEVE_NOT_FUND_LEVEL`: 139
- `DERIVED_CONTRADICTS_CLASSIFICATION_V2`: 19
- `CLASSIFICATION_PRIMARY_SOURCE_FALLBACK_OR_LEGACY`: 9
- `MORNINGSTAR_CATEGORY_MISSING`: 9
- `CLASSIFICATION_EXPOSURE_STRONG_CONFLICT`: 7
- `DERIVED_SECTOR_TOTAL_SUSPICIOUS`: 7
- `MIXED_WITHOUT_USABLE_LOOKTHROUGH`: 4
- `EQUITY_WITH_MODERATE_LOW_EQUITY_EXPOSURE`: 3
- `ALTERNATIVE_DOMINATED_BY_RF_CASH`: 2
- `ALTERNATIVE_WITH_HIGH_RF_CASH`: 1
- `EQUITY_REGIONS_SUM_GT_105`: 1
- `EQUITY_SECTORS_LOOK_LIKE_RV_SLEEVE_NOT_FUND_LEVEL`: 1
- `MS_REPORT_DATE_MISSING`: 1
- `PARSER_VERSION_MISSING`: 1

## Top 20 Issues

- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `BE0946564383` DPAM B - Equities NewGems Sustainable B Cap: raw_sum=1; raw_components={"cash": 0.002, "equity": 0.998, "fixed_income": 0.0, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `BE0947853660` DPAM B - Equities US Dividend Sustainable B EUR Cap: raw_sum=1; raw_components={"cash": 0.0141, "equity": 0.9859, "fixed_income": 0.0, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `DE0008490962` DWS Deutschland LC: raw_sum=1; raw_components={"cash": 0.0363, "equity": 0.9637, "fixed_income": 0.0, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0112231016` Avantage Fund B FI: raw_sum=1; raw_components={"cash": 0.0261, "equity": 0.7453, "fixed_income": 0.2286, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0112602000` Azvalor Managers FI: raw_sum=0.9999; raw_components={"cash": 0.1382, "equity": 0.8533, "fixed_income": 0.0, "other": 0.0084}; normalized_sum=99.99
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0114633003` Panda Agriculture & Water Fund FI: raw_sum=1; raw_components={"cash": 0.0805, "equity": 0.9195, "fixed_income": 0.0, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0116419005` Cartera Renta Fija Horizonte 2026 FI: raw_sum=1; raw_components={"cash": 0.2407, "equity": 0.0, "fixed_income": 0.7391, "other": 0.0202}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0124880032` UBS Renta Fija 0-5 B FI: raw_sum=1; raw_components={"cash": 0.0, "equity": 0.0, "fixed_income": 0.989315, "other": 0.010685}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0125240038` Trea Renta Fija Ahorro S FI: raw_sum=1; raw_components={"cash": 0.0839, "equity": 0.0, "fixed_income": 0.9103, "other": 0.0058}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0125323008` Gestión Value A FI: raw_sum=1; raw_components={"cash": 0.0582, "equity": 0.5765, "fixed_income": 0.0, "other": 0.3653}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0137381036` Gesconsult Renta Variable Iberia A FI: raw_sum=1; raw_components={"cash": 0.012, "equity": 0.9331, "fixed_income": 0.0549, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0138217031` Gesconsult Renta Fija Flexible A FI: raw_sum=0.9999; raw_components={"cash": 0.0593, "equity": 0.095, "fixed_income": 0.8456, "other": 0.0}; normalized_sum=99.99
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0138911039` Gesconsult Renta Variable Eurozona FI: raw_sum=1; raw_components={"cash": 0.0117, "equity": 0.9703, "fixed_income": 0.018, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0138914033` Merch-Fontemar FI: raw_sum=1.0001; raw_components={"cash": 0.0, "equity": 0.2454, "fixed_income": 0.6898, "other": 0.0649}; normalized_sum=100.01
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0138922002` Gesconsult Horizonte 2025 FI: raw_sum=1; raw_components={"cash": 0.1092, "equity": 0.0, "fixed_income": 0.8908, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0138936036` Fondibas FI: raw_sum=1; raw_components={"cash": 0.0427, "equity": 0.1889, "fixed_income": 0.7684, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0140643034` GVC Gaesco Europa FI: raw_sum=1; raw_components={"cash": 0.0069, "equity": 0.9931, "fixed_income": 0.0, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0140986011` Gesconsult Oportunidad Renta Fija A FI: raw_sum=1; raw_components={"cash": 0.0386, "equity": 0.0, "fixed_income": 0.8335, "other": 0.1279}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0141113037` GVC Gaesco Japón A FI: raw_sum=1; raw_components={"cash": 0.0359, "equity": 0.9641, "fixed_income": 0.0, "other": 0.0}; normalized_sum=100
- `HIGH` `ASSET_MIX_SCALE_0_1_SUSPECTED` `ES0141116030` Hamco Global Value Fund R FI: raw_sum=1; raw_components={"cash": 0.0246, "equity": 0.8417, "fixed_income": 0.1232, "other": 0.0105}; normalized_sum=100

## Artifacts

- `artifacts\bdb_semantic_audit\bdb_semantic_audit_summary.json`
- `artifacts\bdb_semantic_audit\bdb_semantic_audit_detail.csv`
- `artifacts\bdb_semantic_audit\bdb_semantic_audit_high_priority.csv`
- `artifacts\bdb_semantic_audit\bdb_semantic_audit_flags_by_type.json`
- `docs\BDB_SEMANTIC_AUDIT_FUNDS_V3.md`

## Read-Only Confirmation

- Firestore write executed: `false`
- Firestore operation used: `collection.stream only`
- Rollback executed: `false`
- Deploy executed: `false`
- Firebase CLI deploy executed: `false`
- CORE used: `false`
- `funds_core_v1` used: `false`
- Parser PDF used: `false`
- Batch update used: `false`
- Documents modified in Firestore: `0`

## Recommendation

Next block should be `BDB-SEM-1`, a review-only triage of HIGH issues first, then MEDIUM reporting/taxonomy issues. No correction package should be prepared until the triage explicitly approves exact ISIN/field actions.
