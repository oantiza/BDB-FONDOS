"""
audit_taxonomy_v2.py — V2 Classification & Exposure Audit

Reads all funds_v3 docs and generates:
1. Console summary
2. reports/taxonomy_v2_audit/summary.json
3. reports/taxonomy_v2_audit/coverage_report.md
4. reports/taxonomy_v2_audit/funds_without_v2.csv
5. reports/taxonomy_v2_audit/funds_without_exposure_v2.csv
6. reports/taxonomy_v2_audit/funds_low_confidence.csv
7. reports/taxonomy_v2_audit/funds_with_conflicts.csv
8. reports/taxonomy_v2_audit/funds_low_risk_unsafe.csv
9. reports/taxonomy_v2_audit/funds_unknown_or_ambiguous.csv

Usage:
  python scripts/audit_taxonomy_v2.py
  python scripts/audit_taxonomy_v2.py --limit 50
"""

import os
import sys
import json
import csv
from datetime import datetime, timezone
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─── Firebase Init ───────────────────────────────────────────────────────

db = None


def init_firebase():
    global db
    if db is not None:
        return
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        key_paths = [
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "scripts",
                "serviceAccountKey.json",
            ),
            os.path.join(os.path.dirname(__file__), "serviceAccountKey.json"),
            "./serviceAccountKey.json",
            "../serviceAccountKey.json",
        ]
        for kp in key_paths:
            if os.path.exists(kp):
                cred = credentials.Certificate(kp)
                firebase_admin.initialize_app(cred)
                print(f"[INIT] Firebase initialized with key: {kp}")
                break
        else:
            firebase_admin.initialize_app()
            print("[INIT] Firebase initialized with default credentials")
    db = firestore.client()


# ─── AUDIT FLAGS ─────────────────────────────────────────────────────────

ALL_FLAGS = [
    "NO_V2_CLASSIFICATION",
    "NO_EXPOSURE_V2",
    "NO_METRICS_AND_NO_EXPOSURE",
    "EQUITY_WITHOUT_STYLE_BOX",
    "FI_WITHOUT_DURATION",
    "FI_WITHOUT_CREDIT",
    "ALLOCATION_WITHOUT_EXPOSURE",
    "LOW_CONFIDENCE",
    "V2_LEGACY_TYPE_CONFLICT",
    "LOW_RISK_UNSAFE",
    "UNKNOWN_ASSET_TYPE",
    "UNKNOWN_SUBTYPE",
    "MISSING_REGION_PRIMARY",
    "EXCESSIVE_WARNINGS",
    "EMERGING_LOW_RISK_CONFLICT",
    "SECTOR_FUND_LOW_RISK_CONFLICT",
    "HIGH_YIELD_LOW_RISK_CONFLICT",
    "CONVERTIBLE_LOW_RISK_CONFLICT",
]


def compute_audit_flags(data: dict) -> list:
    """Compute audit flags for a single fund document."""
    flags = []
    v2 = data.get("classification_v2")
    exp_v2 = data.get("portfolio_exposure_v2")
    metrics = data.get("metrics", {})

    # ── Existence checks ──
    if not v2:
        flags.append("NO_V2_CLASSIFICATION")
        if not metrics:
            flags.append("NO_METRICS_AND_NO_EXPOSURE")
        return flags  # No further V2 checks possible

    if not exp_v2:
        flags.append("NO_EXPOSURE_V2")
        if not metrics:
            flags.append("NO_METRICS_AND_NO_EXPOSURE")

    asset_type = v2.get("asset_type", "UNKNOWN")
    asset_subtype = v2.get("asset_subtype", "UNKNOWN")
    region = v2.get("region_primary", "UNKNOWN")
    risk_bucket = v2.get("risk_bucket", "UNKNOWN")
    confidence = v2.get("classification_confidence", 0)
    warnings = v2.get("warnings", [])
    is_suitable_low = v2.get("is_suitable_low_risk", False)
    is_sector = v2.get("is_sector_fund", False)

    # ── Type / Subtype ──
    if asset_type == "UNKNOWN":
        flags.append("UNKNOWN_ASSET_TYPE")
    if asset_subtype == "UNKNOWN" and asset_type not in (
        "MONETARY",
        "ALTERNATIVE",
        "UNKNOWN",
    ):
        flags.append("UNKNOWN_SUBTYPE")

    # ── Region ──
    if region == "UNKNOWN":
        flags.append("MISSING_REGION_PRIMARY")

    # ── Confidence ──
    if confidence < 0.6:
        flags.append("LOW_CONFIDENCE")

    # ── Warnings ──
    if len(warnings) >= 2:
        flags.append("EXCESSIVE_WARNINGS")

    # ── Equity specifics ──
    if asset_type == "EQUITY":
        style_box = v2.get("equity_style_box", "UNKNOWN")
        if style_box == "UNKNOWN":
            flags.append("EQUITY_WITHOUT_STYLE_BOX")

    # ── Fixed Income specifics ──
    if asset_type == "FIXED_INCOME":
        if v2.get("fi_duration_bucket", "UNKNOWN") == "UNKNOWN":
            flags.append("FI_WITHOUT_DURATION")
        if v2.get("fi_credit_bucket", "UNKNOWN") == "UNKNOWN":
            flags.append("FI_WITHOUT_CREDIT")

    # ── Allocation specifics ──
    if asset_type == "MIXED":
        if not exp_v2 or not exp_v2.get("economic_exposure"):
            flags.append("ALLOCATION_WITHOUT_EXPOSURE")

    # ── V2 vs Legacy conflict ──
    derived_class = data.get("derived", {}).get("asset_class", "")
    if derived_class:
        d_up = derived_class.upper()
        v2_is_eq = asset_type == "EQUITY"
        v2_is_fi = asset_type == "FIXED_INCOME"
        leg_is_eq = "RV" in d_up and "VARIABLE" not in d_up or "RENTA VARIABLE" in d_up
        leg_is_fi = "RF" in d_up or "RENTA FIJA" in d_up
        if (v2_is_eq and leg_is_fi) or (v2_is_fi and leg_is_eq):
            flags.append("V2_LEGACY_TYPE_CONFLICT")

    # ── Low risk safety checks ──
    if is_suitable_low:
        # Check for dangerous funds that SHOULD NOT be marked as low-risk suitable
        if asset_type == "EQUITY":
            flags.append("LOW_RISK_UNSAFE")
        if "EMERGING" in asset_subtype:
            flags.append("EMERGING_LOW_RISK_CONFLICT")
        if is_sector:
            flags.append("SECTOR_FUND_LOW_RISK_CONFLICT")
        if "HIGH_YIELD" in asset_subtype:
            flags.append("HIGH_YIELD_LOW_RISK_CONFLICT")
        if "CONVERTIBLE" in asset_subtype:
            flags.append("CONVERTIBLE_LOW_RISK_CONFLICT")
    else:
        # Funds NOT low-risk suitable — also flag dangerous ones in high risk bucket
        if risk_bucket == "HIGH" and asset_type in ("EQUITY", "ALTERNATIVE"):
            pass  # expected, no flag
        # If fund was expected to be low-risk suitable but isn't
        if asset_type == "MONETARY" and not is_suitable_low:
            flags.append("LOW_RISK_UNSAFE")

    return flags


def build_fund_row(doc_id: str, data: dict, flags: list) -> dict:
    """Build a flat row for CSV export."""
    v2 = data.get("classification_v2", {})
    exp_v2 = data.get("portfolio_exposure_v2", {})
    eco = exp_v2.get("economic_exposure", {}) if exp_v2 else {}

    return {
        "isin": doc_id,
        "name": data.get("name", ""),
        "asset_type": v2.get("asset_type", ""),
        "asset_subtype": v2.get("asset_subtype", ""),
        "region_primary": v2.get("region_primary", ""),
        "risk_bucket": v2.get("risk_bucket", ""),
        "classification_confidence": v2.get("classification_confidence", ""),
        "exposure_confidence": exp_v2.get("exposure_confidence", "") if exp_v2 else "",
        "warnings": "; ".join(v2.get("warnings", [])),
        "audit_flags": "; ".join(flags),
        "is_suitable_low_risk": v2.get("is_suitable_low_risk", ""),
        "is_sector_fund": v2.get("is_sector_fund", ""),
        "sector_focus": v2.get("sector_focus", ""),
        "equity_style_box": v2.get("equity_style_box", ""),
        "market_cap_bias": v2.get("market_cap_bias", ""),
        "fi_credit_bucket": v2.get("fi_credit_bucket", ""),
        "fi_duration_bucket": v2.get("fi_duration_bucket", ""),
        "legacy_asset_class": data.get("derived", {}).get("asset_class", ""),
        "legacy_category": data.get("ms", {}).get(
            "category_morningstar", data.get("category_morningstar", "")
        ),
        "equity_exposure": eco.get("equity", ""),
        "bond_exposure": eco.get("bond", ""),
        "cash_exposure": eco.get("cash", ""),
        "other_exposure": eco.get("other", ""),
    }


# ─── MAIN AUDIT ──────────────────────────────────────────────────────────


def run_audit(limit: int = 0):
    init_firebase()
    run_id = datetime.now(timezone.utc).strftime("audit_%Y%m%d_%H%M%S")
    print(f"\n{'=' * 60}")
    print("  TAXONOMY V2 AUDIT")
    print(f"  Run ID: {run_id}")
    print(f"  Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"{'=' * 60}\n")

    query = db.collection("funds_v3")
    if limit > 0:
        query = query.limit(limit)

    # ── Collection containers ──
    all_rows = []
    without_v2 = []
    without_exp = []
    low_confidence = []
    conflicts = []
    low_risk_unsafe = []
    unknown_ambiguous = []

    # ── Aggregate counters ──
    stats = {
        "run_id": run_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        # A. Totals
        "total_funds": 0,
        "with_classification_v2": 0,
        "with_portfolio_exposure_v2": 0,
        "with_both": 0,
        "without_v2": 0,
        "without_exposure": 0,
        "low_confidence_count": 0,
        "warning_count": 0,
        "critical_warning_count": 0,
        # B. Distribution by asset_type
        "asset_type_dist": defaultdict(int),
        # C. Coverage by field
        "region_primary_coverage": 0,
        "equity_style_box_coverage": 0,
        "fi_credit_bucket_coverage": 0,
        "fi_duration_bucket_coverage": 0,
        "market_cap_bias_coverage": 0,
        "subtype_coverage": 0,
        # Denominators
        "equity_count": 0,
        "fi_count": 0,
        # D. Low risk
        "low_risk_allowed_count": 0,
        "low_risk_blocked_count": 0,
        "low_risk_conflict_count": 0,
        # E. Risks
        "legacy_fallback_count": 0,
        "v2_legacy_conflict_count": 0,
        "ambiguous_funds_count": 0,
        "unknown_type_count": 0,
        # Flags distribution
        "flag_distribution": defaultdict(int),
    }

    funds_stream = query.stream()
    for doc in funds_stream:
        stats["total_funds"] += 1
        data = doc.to_dict()
        doc_id = doc.id
        v2 = data.get("classification_v2")
        exp_v2 = data.get("portfolio_exposure_v2")

        # Compute flags
        flags = compute_audit_flags(data)
        for f in flags:
            stats["flag_distribution"][f] += 1

        # Build row
        row = build_fund_row(doc_id, data, flags)
        all_rows.append(row)

        # ── Count totals ──
        has_v2 = bool(v2)
        has_exp = bool(exp_v2)

        if has_v2:
            stats["with_classification_v2"] += 1
        else:
            stats["without_v2"] += 1
            stats["legacy_fallback_count"] += 1
            without_v2.append(row)

        if has_exp:
            stats["with_portfolio_exposure_v2"] += 1
        else:
            stats["without_exposure"] += 1
            without_exp.append(row)

        if has_v2 and has_exp:
            stats["with_both"] += 1

        if has_v2:
            at = v2.get("asset_type", "UNKNOWN")
            stats["asset_type_dist"][at] += 1

            conf = v2.get("classification_confidence", 1.0)
            if conf < 0.6:
                stats["low_confidence_count"] += 1
                low_confidence.append(row)

            ws = v2.get("warnings", [])
            if ws:
                stats["warning_count"] += 1
                if len(ws) >= 2:
                    stats["critical_warning_count"] += 1

            # Coverage
            if v2.get("region_primary", "UNKNOWN") != "UNKNOWN":
                stats["region_primary_coverage"] += 1
            if v2.get("asset_subtype", "UNKNOWN") != "UNKNOWN":
                stats["subtype_coverage"] += 1
            if at == "EQUITY":
                stats["equity_count"] += 1
                if v2.get("equity_style_box", "UNKNOWN") != "UNKNOWN":
                    stats["equity_style_box_coverage"] += 1
                if v2.get("market_cap_bias", "UNKNOWN") != "UNKNOWN":
                    stats["market_cap_bias_coverage"] += 1
            if at == "FIXED_INCOME":
                stats["fi_count"] += 1
                if v2.get("fi_credit_bucket", "UNKNOWN") != "UNKNOWN":
                    stats["fi_credit_bucket_coverage"] += 1
                if v2.get("fi_duration_bucket", "UNKNOWN") != "UNKNOWN":
                    stats["fi_duration_bucket_coverage"] += 1

            # Low risk
            if v2.get("is_suitable_low_risk"):
                stats["low_risk_allowed_count"] += 1
            else:
                stats["low_risk_blocked_count"] += 1

            if at == "UNKNOWN":
                stats["unknown_type_count"] += 1

        # ── Categorize into CSV buckets ──
        if "V2_LEGACY_TYPE_CONFLICT" in flags:
            stats["v2_legacy_conflict_count"] += 1
            conflicts.append(row)

        danger_flags = {
            "LOW_RISK_UNSAFE",
            "EMERGING_LOW_RISK_CONFLICT",
            "SECTOR_FUND_LOW_RISK_CONFLICT",
            "HIGH_YIELD_LOW_RISK_CONFLICT",
            "CONVERTIBLE_LOW_RISK_CONFLICT",
        }
        if flags and danger_flags & set(flags):
            stats["low_risk_conflict_count"] += 1
            low_risk_unsafe.append(row)

        ambig_flags = {
            "UNKNOWN_ASSET_TYPE",
            "UNKNOWN_SUBTYPE",
            "LOW_CONFIDENCE",
            "NO_METRICS_AND_NO_EXPOSURE",
        }
        if flags and ambig_flags & set(flags):
            stats["ambiguous_funds_count"] += 1
            unknown_ambiguous.append(row)

        if stats["total_funds"] % 100 == 0:
            print(f"  ... audited {stats['total_funds']} funds ...")

    stats["finished_at"] = datetime.now(timezone.utc).isoformat()

    # Convert defaultdicts to regular dicts for JSON
    stats["asset_type_dist"] = dict(stats["asset_type_dist"])
    stats["flag_distribution"] = dict(stats["flag_distribution"])

    # ── OUTPUT ────────────────────────────────────────────────────────────
    out_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..",
        "reports",
        "taxonomy_v2_audit",
    )
    os.makedirs(out_dir, exist_ok=True)
    print(f"\n  Output directory: {out_dir}")

    # 1. summary.json
    summary_path = os.path.join(out_dir, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, default=str)
    print(f"  [OK] summary.json ({stats['total_funds']} funds)")

    # 2-8. CSVs
    csv_fields = [
        "isin",
        "name",
        "asset_type",
        "asset_subtype",
        "region_primary",
        "risk_bucket",
        "classification_confidence",
        "exposure_confidence",
        "warnings",
        "audit_flags",
        "is_suitable_low_risk",
        "is_sector_fund",
        "sector_focus",
        "equity_style_box",
        "market_cap_bias",
        "fi_credit_bucket",
        "fi_duration_bucket",
        "legacy_asset_class",
        "legacy_category",
        "equity_exposure",
        "bond_exposure",
        "cash_exposure",
        "other_exposure",
    ]

    def write_csv(filename, rows):
        path = os.path.join(out_dir, filename)
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_fields)
            writer.writeheader()
            for r in rows:
                writer.writerow(r)
        print(f"  [OK] {filename} ({len(rows)} rows)")

    write_csv("funds_without_v2.csv", without_v2)
    write_csv("funds_without_exposure_v2.csv", without_exp)
    write_csv("funds_low_confidence.csv", low_confidence)
    write_csv("funds_with_conflicts.csv", conflicts)
    write_csv("funds_low_risk_unsafe.csv", low_risk_unsafe)
    write_csv("funds_unknown_or_ambiguous.csv", unknown_ambiguous)

    # 9. coverage_report.md
    total = stats["total_funds"] or 1  # avoid div by 0
    with_v2 = stats["with_classification_v2"]
    eq_count = stats["equity_count"] or 1
    fi_count = stats["fi_count"] or 1

    md = f"""# V2 Taxonomy Audit — Coverage Report

**Run ID:** `{run_id}`
**Date:** {stats["finished_at"]}
**Total Funds:** {stats["total_funds"]}

---

## A. Totals

| Metric | Count | % |
|--------|------:|---:|
| With `classification_v2` | {with_v2} | {with_v2 * 100 // total}% |
| With `portfolio_exposure_v2` | {stats["with_portfolio_exposure_v2"]} | {stats["with_portfolio_exposure_v2"] * 100 // total}% |
| With both | {stats["with_both"]} | {stats["with_both"] * 100 // total}% |
| Without V2 | {stats["without_v2"]} | {stats["without_v2"] * 100 // total}% |
| Without exposure | {stats["without_exposure"]} | {stats["without_exposure"] * 100 // total}% |
| Low confidence | {stats["low_confidence_count"]} | {stats["low_confidence_count"] * 100 // total}% |
| With warnings | {stats["warning_count"]} | {stats["warning_count"] * 100 // total}% |
| Critical warnings (≥2) | {stats["critical_warning_count"]} | {stats["critical_warning_count"] * 100 // total}% |

## B. Distribution by Asset Type

| Type | Count |
|------|------:|
"""
    for at in [
        "EQUITY",
        "FIXED_INCOME",
        "MIXED",
        "MONETARY",
        "ALTERNATIVE",
        "COMMODITIES",
        "REAL_ESTATE",
        "UNKNOWN",
    ]:
        c = stats["asset_type_dist"].get(at, 0)
        md += f"| {at} | {c} |\n"

    md += f"""
## C. Field Coverage (among V2 funds)

| Field | Coverage | Denominator |
|-------|----------|-------------|
| `region_primary` | {stats["region_primary_coverage"]}/{with_v2} | All V2 |
| `asset_subtype` | {stats["subtype_coverage"]}/{with_v2} | All V2 |
| `equity_style_box` | {stats["equity_style_box_coverage"]}/{stats["equity_count"]} | Equity funds |
| `market_cap_bias` | {stats["market_cap_bias_coverage"]}/{stats["equity_count"]} | Equity funds |
| `fi_credit_bucket` | {stats["fi_credit_bucket_coverage"]}/{stats["fi_count"]} | FI funds |
| `fi_duration_bucket` | {stats["fi_duration_bucket_coverage"]}/{stats["fi_count"]} | FI funds |

## D. Low Risk Profile Safety

| Metric | Count |
|--------|------:|
| Suitable for low risk | {stats["low_risk_allowed_count"]} |
| Blocked for low risk | {stats["low_risk_blocked_count"]} |
| Low risk conflicts | {stats["low_risk_conflict_count"]} |

## E. Residual Risks

| Metric | Count |
|--------|------:|
| Legacy fallback only | {stats["legacy_fallback_count"]} |
| V2 vs Legacy conflict | {stats["v2_legacy_conflict_count"]} |
| Ambiguous funds | {stats["ambiguous_funds_count"]} |
| Unknown type | {stats["unknown_type_count"]} |

## F. Audit Flags Distribution

| Flag | Count |
|------|------:|
"""
    for flag in ALL_FLAGS:
        c = stats["flag_distribution"].get(flag, 0)
        md += f"| `{flag}` | {c} |\n"

    md += f"""
## G. Output Files

| File | Rows | Description |
|------|-----:|-------------|
| `funds_without_v2.csv` | {len(without_v2)} | Funds with no `classification_v2` |
| `funds_without_exposure_v2.csv` | {len(without_exp)} | Funds with no `portfolio_exposure_v2` |
| `funds_low_confidence.csv` | {len(low_confidence)} | Confidence < 0.6 |
| `funds_with_conflicts.csv` | {len(conflicts)} | V2 vs legacy type conflict |
| `funds_low_risk_unsafe.csv` | {len(low_risk_unsafe)} | Potentially dangerous for low risk |
| `funds_unknown_or_ambiguous.csv` | {len(unknown_ambiguous)} | Unknown type, subtype, or low confidence |
"""

    report_path = os.path.join(out_dir, "coverage_report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md)
    print("  [OK] coverage_report.md")

    # ── Console summary ──
    print(f"\n{'=' * 60}")
    print("  AUDIT COMPLETE")
    print(f"{'=' * 60}")
    print(f"  Total Funds:           {stats['total_funds']}")
    print(
        f"  With classification_v2: {stats['with_classification_v2']} ({stats['with_classification_v2'] * 100 // total}%)"
    )
    print(
        f"  With exposure_v2:       {stats['with_portfolio_exposure_v2']} ({stats['with_portfolio_exposure_v2'] * 100 // total}%)"
    )
    print(f"  Without V2:             {stats['without_v2']}")
    print(f"  Low confidence:         {stats['low_confidence_count']}")
    print(f"  Conflicts:              {stats['v2_legacy_conflict_count']}")
    print(f"  Low risk conflicts:     {stats['low_risk_conflict_count']}")
    print(f"  Unknown type:           {stats['unknown_type_count']}")
    print("\n  Asset Type Distribution:")
    for k, v in sorted(stats["asset_type_dist"].items()):
        print(f"    {k:20s} : {v}")
    print("\n  Flags:")
    for f in ALL_FLAGS:
        c = stats["flag_distribution"].get(f, 0)
        if c > 0:
            print(f"    {f:40s} : {c}")
    print(f"\n  All reports saved to: {out_dir}")
    print(f"  Finished: {stats['finished_at']}")

    return stats


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="V2 Taxonomy Audit")
    parser.add_argument(
        "--limit", type=int, default=0, help="Limit number of funds to audit (0 = all)"
    )
    args = parser.parse_args()
    run_audit(limit=args.limit)
