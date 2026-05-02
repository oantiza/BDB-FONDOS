#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path
from collections import Counter


EXCLUDE_RULES = {
    "history_not_ok",
}

LIMIT_RULES = {
    "region_unknown",
    "HEURISTIC_STYLE_DEDUCTION",
    "FI_UNKNOWN_DURATION_BUCKET",
    "FI_UNKNOWN_CREDIT_BUCKET",
    "FI_UNKNOWN_SUBTYPE",
    "REGION_PRIMARY_BORDERLINE",
}


def classify_fund(f):
    cls = f.get("classification_v2", {}) or {}
    exp = f.get("portfolio_exposure_v2", {}) or {}
    metrics = f.get("metrics", {}) or {}

    reasons = set()

    if metrics.get("history_ok") is False:
        reasons.add("history_not_ok")

    warnings = set(cls.get("warnings", [])) | set(exp.get("warnings", []))

    for w in warnings:
        if w in LIMIT_RULES:
            reasons.add(w)

    if (cls.get("region_primary") or "").upper() == "UNKNOWN":
        reasons.add("region_unknown")

    if any(r in EXCLUDE_RULES for r in reasons):
        return "EXCLUDED", sorted(reasons)

    if reasons:
        return "LIMITED", sorted(reasons)

    return "FULL", []


def build_record(f):
    cls = f.get("classification_v2", {}) or {}
    exp = f.get("portfolio_exposure_v2", {}) or {}
    metrics = f.get("metrics", {}) or {}

    status, reasons = classify_fund(f)

    return {
        "id": f.get("id"),
        "name": f.get("name"),
        "isin": f.get("isin"),
        "eligibility_status": status,
        "eligibility_reasons": reasons,
        "classification_v2": {
            "asset_type": cls.get("asset_type"),
            "asset_subtype": cls.get("asset_subtype"),
            "region_primary": cls.get("region_primary"),
            "commercial_type": cls.get("commercial_type"),
        },
        "portfolio_exposure_v2": {
            "equity": exp.get("equity"),
            "bond": exp.get("bond"),
            "cash": exp.get("cash"),
            "other": exp.get("other"),
            "equity_regions": exp.get("equity_regions"),
            "equity_styles": exp.get("equity_styles"),
            "sectors": exp.get("sectors"),
            "bond_types": exp.get("bond_types"),
            "credit": exp.get("credit"),
            "duration": exp.get("duration"),
        },
        "metrics": {
            "history_ok": metrics.get("history_ok"),
            "volatility": metrics.get("volatility"),
            "cagr": metrics.get("cagr"),
            "sharpe": metrics.get("sharpe"),
        },
    }


def main():
    base_dir = Path(__file__).resolve().parents[2]
    input_path = base_dir / "funds_v3.json"

    output_dir = base_dir / "optimizer_universe"
    output_dir.mkdir(exist_ok=True)

    with open(input_path, "r", encoding="utf-8") as f:
        funds = json.load(f)

    records = [build_record(f) for f in funds]

    counts = Counter(r["eligibility_status"] for r in records)
    reason_counter = Counter()
    for r in records:
        for reason in r["eligibility_reasons"]:
            reason_counter[reason] += 1

    full_records = [r for r in records if r["eligibility_status"] == "FULL"]
    limited_records = [r for r in records if r["eligibility_status"] == "LIMITED"]
    excluded_records = [r for r in records if r["eligibility_status"] == "EXCLUDED"]

    full_ids = [r["id"] for r in full_records if r.get("id")]
    limited_ids = [r["id"] for r in limited_records if r.get("id")]
    excluded_ids = [r["id"] for r in excluded_records if r.get("id")]

    with open(output_dir / "funds_eligibility_full.json", "w", encoding="utf-8") as f:
        json.dump(full_records, f, ensure_ascii=False, indent=2)

    with open(output_dir / "funds_eligibility_limited.json", "w", encoding="utf-8") as f:
        json.dump(limited_records, f, ensure_ascii=False, indent=2)

    with open(output_dir / "funds_eligibility_excluded.json", "w", encoding="utf-8") as f:
        json.dump(excluded_records, f, ensure_ascii=False, indent=2)

    with open(output_dir / "funds_full_ids.json", "w", encoding="utf-8") as f:
        json.dump(full_ids, f, ensure_ascii=False, indent=2)

    with open(output_dir / "funds_limited_ids.json", "w", encoding="utf-8") as f:
        json.dump(limited_ids, f, ensure_ascii=False, indent=2)

    with open(output_dir / "funds_excluded_ids.json", "w", encoding="utf-8") as f:
        json.dump(excluded_ids, f, ensure_ascii=False, indent=2)

    summary = {
        "total": len(records),
        "counts": dict(counts),
        "reasons": dict(reason_counter),
        "policy": {
            "FULL": "entra por defecto en optimización",
            "LIMITED": "entra solo si se permite universo ampliado o sin restricciones finas",
            "EXCLUDED": "no entra en optimización",
        },
    }

    with open(output_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print("\n=== OPTIMIZER UNIVERSE BUILD ===")
    print(f"TOTAL: {len(records)}")
    print(f"FULL: {counts['FULL']}")
    print(f"LIMITED: {counts['LIMITED']}")
    print(f"EXCLUDED: {counts['EXCLUDED']}")

    print("\nMotivos LIMITED/EXCLUDED:")
    for k, v in sorted(reason_counter.items(), key=lambda x: -x[1]):
        print(f"{k}: {v}")

    print(f"\nArchivos generados en: {output_dir}")


if __name__ == "__main__":
    main()