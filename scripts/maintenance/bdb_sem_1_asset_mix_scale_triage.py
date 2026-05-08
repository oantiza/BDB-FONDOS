#!/usr/bin/env python
"""BDB-SEM-1 asset_mix scale triage from SEM-0 artifacts only.

Review-only: reads local SEM-0 artifact files and writes local SEM-1 reports.
There is no Firestore access and no write/rollback/deploy path.
"""

from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_ID = "BDB-SEM-1"
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "bdb_semantic_audit"
DOC_PATH = ROOT / "docs" / "BDB_SEM_1_ASSET_MIX_SCALE_TRIAGE.md"

SEM0_SUMMARY_PATH = ARTIFACT_DIR / "bdb_semantic_audit_summary.json"
SEM0_DETAIL_PATH = ARTIFACT_DIR / "bdb_semantic_audit_detail.csv"
SEM0_HIGH_PATH = ARTIFACT_DIR / "bdb_semantic_audit_high_priority.csv"
SEM0_FLAGS_PATH = ARTIFACT_DIR / "bdb_semantic_audit_flags_by_type.json"

SUMMARY_PATH = ARTIFACT_DIR / "bdb_sem_1_asset_mix_scale_triage_summary.json"
DETAIL_PATH = ARTIFACT_DIR / "bdb_sem_1_asset_mix_scale_triage_detail.csv"
FIX_CANDIDATES_PATH = ARTIFACT_DIR / "bdb_sem_1_high_confidence_fix_candidates.csv"
REVIEW_REQUIRED_PATH = ARTIFACT_DIR / "bdb_sem_1_review_required.csv"
BLOCKED_PATH = ARTIFACT_DIR / "bdb_sem_1_blocked.csv"

TARGET_FLAG = "ASSET_MIX_SCALE_0_1_SUSPECTED"
CONF_HIGH = "HIGH_CONFIDENCE_SCALE_FIX"
CONF_REVIEW = "REVIEW_REQUIRED"
CONF_BLOCKED = "BLOCKED"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    if isinstance(value, str):
        raw = value.strip()
        if raw == "":
            return None
        try:
            parsed = float(raw)
        except ValueError:
            return None
        return parsed if math.isfinite(parsed) else None
    return None


def round6(value: float | None) -> float | None:
    return round(value, 6) if value is not None else None


def parse_evidence(evidence: str) -> tuple[float | None, dict[str, float | None], float | None, str]:
    raw_sum_match = re.search(r"raw_sum=([^;]+)", evidence or "")
    normalized_sum_match = re.search(r"normalized_sum=([^;]+)", evidence or "")
    components_match = re.search(r"raw_components=(\{.*?\})(?:;|$)", evidence or "")

    raw_sum = to_float(raw_sum_match.group(1)) if raw_sum_match else None
    normalized_sum = to_float(normalized_sum_match.group(1)) if normalized_sum_match else None
    if not components_match:
        return raw_sum, {}, normalized_sum, "raw_components_not_found"

    try:
        parsed = json.loads(components_match.group(1))
    except json.JSONDecodeError as exc:
        return raw_sum, {}, normalized_sum, f"raw_components_json_error:{exc}"

    components = {
        "equity": to_float(parsed.get("equity")),
        "fixed_income": to_float(parsed.get("fixed_income")),
        "cash": to_float(parsed.get("cash")),
        "other": to_float(parsed.get("other")),
    }
    return raw_sum, components, normalized_sum, ""


def classify_scale(raw_sum: float | None, normalized_sum_x100: float | None, components: dict[str, float | None]) -> tuple[str, str]:
    component_values = [components.get(k) for k in ("equity", "fixed_income", "cash", "other")]
    if raw_sum is None or normalized_sum_x100 is None:
        return CONF_BLOCKED, "raw_sum_or_normalized_sum_missing"
    if any(value is None for value in component_values):
        return CONF_BLOCKED, "one_or_more_components_missing"
    if any(value is not None and value < 0 for value in component_values):
        return CONF_BLOCKED, "negative_component"

    max_raw = max(abs(value or 0.0) for value in component_values)
    x100_components = [(value or 0.0) * 100.0 for value in component_values]
    if any(value > 105 for value in x100_components):
        return CONF_BLOCKED, "x100_component_out_of_range"

    if 0.95 <= raw_sum <= 1.05 and 95 <= normalized_sum_x100 <= 105 and max_raw <= 1.05:
        return CONF_HIGH, "raw_sum_0_1_and_x100_sum_valid"
    if normalized_sum_x100 is not None and 95 <= normalized_sum_x100 <= 105:
        return CONF_REVIEW, "x100_sum_valid_but_raw_sum_outside_0_95_1_05"
    return CONF_BLOCKED, "x100_sum_not_valid"


def scale_bucket(raw_sum: float | None, normalized_sum_x100: float | None) -> str:
    if raw_sum is None or normalized_sum_x100 is None:
        return "ambiguous"
    if 95 <= raw_sum <= 105:
        return "already_0_100"
    if 0.95 <= raw_sum <= 1.05 and 95 <= normalized_sum_x100 <= 105:
        return "scale_0_1"
    if 95 <= normalized_sum_x100 <= 105:
        return "scale_ambiguous"
    return "ambiguous"


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    generated_at = now_utc()
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)

    sem0_summary = json.loads(SEM0_SUMMARY_PATH.read_text(encoding="utf-8"))
    sem0_flags = json.loads(SEM0_FLAGS_PATH.read_text(encoding="utf-8"))
    detail_rows = load_csv(SEM0_DETAIL_PATH)
    high_rows = load_csv(SEM0_HIGH_PATH)

    scale_rows = [row for row in detail_rows if row.get("flag_type") == TARGET_FLAG]
    duplicate_counter = Counter(row.get("isin", "") for row in scale_rows)
    duplicate_isins = sorted(isin for isin, count in duplicate_counter.items() if count > 1)

    rows_by_isin: dict[str, dict[str, str]] = {}
    for row in scale_rows:
        isin = row.get("isin", "")
        if isin and isin not in rows_by_isin:
            rows_by_isin[isin] = row

    triage_rows: list[dict[str, Any]] = []
    for isin in sorted(rows_by_isin):
        row = rows_by_isin[isin]
        raw_sum, components, parsed_normalized_sum, parse_error = parse_evidence(row.get("evidence", ""))
        equity_raw = components.get("equity")
        fixed_income_raw = components.get("fixed_income")
        cash_raw = components.get("cash")
        other_raw = components.get("other")

        equity_x100 = equity_raw * 100.0 if equity_raw is not None else None
        fixed_income_x100 = fixed_income_raw * 100.0 if fixed_income_raw is not None else None
        cash_x100 = cash_raw * 100.0 if cash_raw is not None else None
        other_x100 = other_raw * 100.0 if other_raw is not None else None
        computed_normalized_sum = (
            sum(
                value
                for value in (equity_x100, fixed_income_x100, cash_x100, other_x100)
                if value is not None
            )
            if not any(value is None for value in (equity_x100, fixed_income_x100, cash_x100, other_x100))
            else None
        )
        normalized_sum_x100 = parsed_normalized_sum if parsed_normalized_sum is not None else computed_normalized_sum

        confidence, decision_reason = classify_scale(raw_sum, normalized_sum_x100, components)
        bucket = scale_bucket(raw_sum, normalized_sum_x100)

        triage_rows.append(
            {
                "audit_id": AUDIT_ID,
                "generated_at_utc": generated_at,
                "doc_id": row.get("doc_id", ""),
                "isin": isin,
                "name": row.get("name", ""),
                "source_flag": TARGET_FLAG,
                "confidence": confidence,
                "decision_reason": decision_reason,
                "scale_bucket": bucket,
                "raw_sum": round6(raw_sum),
                "normalized_sum_x100": round6(normalized_sum_x100),
                "computed_normalized_sum_x100": round6(computed_normalized_sum),
                "equity_raw": round6(equity_raw),
                "fixed_income_raw": round6(fixed_income_raw),
                "cash_raw": round6(cash_raw),
                "other_raw": round6(other_raw),
                "equity_x100": round6(equity_x100),
                "fixed_income_x100": round6(fixed_income_x100),
                "cash_x100": round6(cash_x100),
                "other_x100": round6(other_x100),
                "x100_sum_in_95_105": 95 <= normalized_sum_x100 <= 105 if normalized_sum_x100 is not None else False,
                "raw_sum_in_0_95_1_05": 0.95 <= raw_sum <= 1.05 if raw_sum is not None else False,
                "parse_error": parse_error,
                "classification_asset_type": row.get("classification_asset_type", ""),
                "classification_asset_subtype": row.get("classification_asset_subtype", ""),
                "derived_asset_class": row.get("derived_asset_class", ""),
                "sem0_effective_equity_pct": row.get("effective_equity_pct", ""),
                "sem0_effective_fixed_income_pct": row.get("effective_fixed_income_pct", ""),
                "sem0_effective_cash_pct": row.get("effective_cash_pct", ""),
                "sem0_effective_other_pct": row.get("effective_other_pct", ""),
                "sem0_evidence": row.get("evidence", ""),
            }
        )

    confidence_counts = Counter(row["confidence"] for row in triage_rows)
    scale_bucket_counts = Counter(row["scale_bucket"] for row in triage_rows)

    high_confidence_rows = [row for row in triage_rows if row["confidence"] == CONF_HIGH]
    review_rows = [row for row in triage_rows if row["confidence"] == CONF_REVIEW]
    blocked_rows = [row for row in triage_rows if row["confidence"] == CONF_BLOCKED]
    invalid_fix_candidates = [
        row for row in high_confidence_rows if not row["x100_sum_in_95_105"]
    ]

    fields = [
        "audit_id",
        "generated_at_utc",
        "doc_id",
        "isin",
        "name",
        "source_flag",
        "confidence",
        "decision_reason",
        "scale_bucket",
        "raw_sum",
        "normalized_sum_x100",
        "computed_normalized_sum_x100",
        "equity_raw",
        "fixed_income_raw",
        "cash_raw",
        "other_raw",
        "equity_x100",
        "fixed_income_x100",
        "cash_x100",
        "other_x100",
        "x100_sum_in_95_105",
        "raw_sum_in_0_95_1_05",
        "parse_error",
        "classification_asset_type",
        "classification_asset_subtype",
        "derived_asset_class",
        "sem0_effective_equity_pct",
        "sem0_effective_fixed_income_pct",
        "sem0_effective_cash_pct",
        "sem0_effective_other_pct",
        "sem0_evidence",
    ]

    write_csv(DETAIL_PATH, triage_rows, fields)
    write_csv(FIX_CANDIDATES_PATH, high_confidence_rows, fields)
    write_csv(REVIEW_REQUIRED_PATH, review_rows, fields)
    write_csv(BLOCKED_PATH, blocked_rows, fields)

    top_20 = triage_rows[:20]
    summary = {
        "audit_id": AUDIT_ID,
        "generated_at_utc": generated_at,
        "operational_project_path": str(ROOT),
        "target_collection": "funds_v3",
        "input_artifacts": {
            "sem0_summary_json": str(SEM0_SUMMARY_PATH.relative_to(ROOT)),
            "sem0_detail_csv": str(SEM0_DETAIL_PATH.relative_to(ROOT)),
            "sem0_high_priority_csv": str(SEM0_HIGH_PATH.relative_to(ROOT)),
            "sem0_flags_by_type_json": str(SEM0_FLAGS_PATH.relative_to(ROOT)),
        },
        "read_only_confirmation": {
            "firestore_read_executed": False,
            "firestore_write_executed": False,
            "rollback_executed": False,
            "deploy_executed": False,
            "firebase_cli_deploy_executed": False,
            "core_used": False,
            "funds_core_v1_used": False,
            "parser_pdf_used": False,
            "batch_update_used": False,
            "documents_modified": 0,
        },
        "sem0_context": {
            "total_docs_audited": sem0_summary.get("total_docs_audited"),
            "sem0_high_flags": sem0_summary.get("severity_counts", {}).get("HIGH"),
            "sem0_unique_high_isins": sem0_summary.get("unique_isins_by_severity", {}).get("HIGH"),
            "sem0_scale_flag_count": sem0_summary.get("flag_counts_by_type", {}).get(TARGET_FLAG),
            "sem0_scale_flag_count_from_flags_file": sem0_flags.get(TARGET_FLAG, {}).get("count"),
            "sem0_exposure_source_counts": sem0_summary.get("exposure_source_counts", {}),
        },
        "validation": {
            "scale_flag_rows_from_detail": len(scale_rows),
            "total_analyzed_unique_isins": len(triage_rows),
            "duplicate_isins_in_scale_flag_rows": duplicate_isins,
            "total_analyzed_equals_unique_scale_isins": len(triage_rows) == len(rows_by_isin),
            "total_analyzed_equals_sem0_scale_flag_count": len(triage_rows)
            == sem0_summary.get("flag_counts_by_type", {}).get(TARGET_FLAG),
            "high_confidence_candidates_x100_sum_all_95_105": len(invalid_fix_candidates) == 0,
            "invalid_high_confidence_candidates": invalid_fix_candidates,
        },
        "decision_rule": {
            CONF_HIGH: "raw_sum between 0.95 and 1.05, every component numeric/non-negative, and x100 sum between 95 and 105",
            CONF_REVIEW: "raw_sum outside 0.95-1.05 but x100 sum between 95 and 105",
            CONF_BLOCKED: "missing/non-numeric/negative/out-of-range components or x100 sum not inferable",
        },
        "confidence_counts": {
            CONF_HIGH: confidence_counts.get(CONF_HIGH, 0),
            CONF_REVIEW: confidence_counts.get(CONF_REVIEW, 0),
            CONF_BLOCKED: confidence_counts.get(CONF_BLOCKED, 0),
        },
        "scale_mix_verification": {
            "asset_mix_docs_from_sem0": sem0_summary.get("exposure_source_counts", {}).get("asset_mix"),
            "asset_mix_scale_suspected_isins": len(triage_rows),
            "funds_already_0_100_within_scale_flag_set": scale_bucket_counts.get("already_0_100", 0),
            "funds_in_0_1_within_scale_flag_set": scale_bucket_counts.get("scale_0_1", 0),
            "funds_ambiguous_within_scale_flag_set": scale_bucket_counts.get("scale_ambiguous", 0)
            + scale_bucket_counts.get("ambiguous", 0),
            "interpretation": "SEM-0 reported 450 asset_mix docs and 450 ASSET_MIX_SCALE_0_1_SUSPECTED flags, so within SEM-0 artifacts every asset_mix-bearing document is in the suspected 0-1 cohort.",
        },
        "raw_sum_stats": numeric_stats([row["raw_sum"] for row in triage_rows]),
        "normalized_sum_x100_stats": numeric_stats(
            [row["normalized_sum_x100"] for row in triage_rows]
        ),
        "top_20_examples": top_20,
        "artifacts": {
            "summary_json": str(SUMMARY_PATH.relative_to(ROOT)),
            "detail_csv": str(DETAIL_PATH.relative_to(ROOT)),
            "high_confidence_fix_candidates_csv": str(FIX_CANDIDATES_PATH.relative_to(ROOT)),
            "review_required_csv": str(REVIEW_REQUIRED_PATH.relative_to(ROOT)),
            "blocked_csv": str(BLOCKED_PATH.relative_to(ROOT)),
            "markdown_doc": str(DOC_PATH.relative_to(ROOT)),
        },
        "recommendation": "Proceed to BDB-SEM-2 as a read-only correction plan: enumerate exact field transforms for HIGH_CONFIDENCE_SCALE_FIX candidates, verify downstream consumers expect 0-100, and require explicit approval before any Firestore mutation.",
    }

    SUMMARY_PATH.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    write_markdown(summary)

    print(
        json.dumps(
            {
                "total_analyzed": len(triage_rows),
                "high_confidence_fix_candidates": confidence_counts.get(CONF_HIGH, 0),
                "review_required": confidence_counts.get(CONF_REVIEW, 0),
                "blocked": confidence_counts.get(CONF_BLOCKED, 0),
                "artifacts": summary["artifacts"],
                "generated_at_utc": generated_at,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def numeric_stats(values: list[Any]) -> dict[str, float | int | None]:
    nums = sorted(value for value in (to_float(v) for v in values) if value is not None)
    if not nums:
        return {"count": 0, "min": None, "p50": None, "max": None}
    return {
        "count": len(nums),
        "min": round(nums[0], 6),
        "p50": round(nums[len(nums) // 2], 6),
        "max": round(nums[-1], 6),
    }


def write_markdown(summary: dict[str, Any]) -> None:
    confidence = summary["confidence_counts"]
    scale_mix = summary["scale_mix_verification"]
    top_lines = "\n".join(
        f"- `{row['confidence']}` `{row['isin']}` {row['name']}: raw_sum={row['raw_sum']}, x100_sum={row['normalized_sum_x100']}, equity_x100={row['equity_x100']}, fixed_income_x100={row['fixed_income_x100']}, cash_x100={row['cash_x100']}, other_x100={row['other_x100']}"
        for row in summary["top_20_examples"]
    )
    artifact_lines = "\n".join(f"- `{path}`" for path in summary["artifacts"].values())

    text = f"""# BDB-SEM-1 Asset Mix Scale Triage

Generated at UTC: `{summary['generated_at_utc']}`

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

SEM-0 found `ASSET_MIX_SCALE_0_1_SUSPECTED` on {summary['sem0_context']['sem0_scale_flag_count']} `asset_mix` entries. The raw component sums are near `1`, while multiplying components by 100 gives a valid allocation sum near `100`.

## Decision Rule

- `HIGH_CONFIDENCE_SCALE_FIX`: raw_sum is between `0.95` and `1.05`, all four components are numeric/non-negative, and x100 sum is between `95` and `105`.
- `REVIEW_REQUIRED`: raw_sum is outside `0.95`-`1.05`, but x100 sum is between `95` and `105`.
- `BLOCKED`: missing/non-numeric/negative/out-of-range components, or x100 sum cannot be inferred safely.

## Counts

- Total analyzed: {summary['validation']['total_analyzed_unique_isins']}
- HIGH_CONFIDENCE_SCALE_FIX: {confidence['HIGH_CONFIDENCE_SCALE_FIX']}
- REVIEW_REQUIRED: {confidence['REVIEW_REQUIRED']}
- BLOCKED: {confidence['BLOCKED']}

## Scale Mix Verification

- SEM-0 asset_mix docs: {scale_mix['asset_mix_docs_from_sem0']}
- Scale-suspected asset_mix ISINs: {scale_mix['asset_mix_scale_suspected_isins']}
- Already 0-100 within scale-flag set: {scale_mix['funds_already_0_100_within_scale_flag_set']}
- 0-1 within scale-flag set: {scale_mix['funds_in_0_1_within_scale_flag_set']}
- Ambiguous within scale-flag set: {scale_mix['funds_ambiguous_within_scale_flag_set']}

Interpretation: {scale_mix['interpretation']}

## Optimizer Risk

If a consumer expects 0-100 but reads these values as-is, equity/fixed income/cash/other limits can be understated by roughly 100x. If a consumer expects 0-1 and a correction multiplies values without updating that contract, the inverse risk appears. The correction decision must therefore be tied to the optimizer payload contract, not only to storage shape.

## Top 20 Examples

{top_lines}

## Artifacts

{artifact_lines}

## Recommendation

Next block should be `BDB-SEM-2`, still review-only: produce an exact correction plan for the {confidence['HIGH_CONFIDENCE_SCALE_FIX']} deterministic candidates, verify downstream optimizer/reporting consumers expect 0-100, and require explicit approval before any Firestore write.
"""
    DOC_PATH.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
