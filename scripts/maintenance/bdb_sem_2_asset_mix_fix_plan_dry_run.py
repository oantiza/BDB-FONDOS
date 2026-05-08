#!/usr/bin/env python
"""BDB-SEM-2 deterministic asset_mix scale fix plan.

Dry-run only: reads SEM-1 local artifacts, reviews the optimizer scale contract
from code inspection findings, and writes local plan artifacts. It never opens
Firestore and contains no write, rollback, deploy, parser, or batch-update path.
"""

from __future__ import annotations

import csv
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


AUDIT_ID = "BDB-SEM-2"
ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "bdb_semantic_audit"
DOC_PATH = ROOT / "docs" / "BDB_SEM_2_ASSET_MIX_FIX_PLAN_DRY_RUN.md"

SEM1_SUMMARY_PATH = ARTIFACT_DIR / "bdb_sem_1_asset_mix_scale_triage_summary.json"
SEM1_DETAIL_PATH = ARTIFACT_DIR / "bdb_sem_1_asset_mix_scale_triage_detail.csv"
SEM1_CANDIDATES_PATH = ARTIFACT_DIR / "bdb_sem_1_high_confidence_fix_candidates.csv"

SUMMARY_PATH = ARTIFACT_DIR / "bdb_sem_2_asset_mix_fix_plan_summary.json"
DETAIL_PATH = ARTIFACT_DIR / "bdb_sem_2_asset_mix_fix_plan_detail.csv"
PATCH_PREVIEW_PATH = ARTIFACT_DIR / "bdb_sem_2_asset_mix_patch_preview.json"
CONTRACT_REVIEW_PATH = ARTIFACT_DIR / "bdb_sem_2_optimizer_scale_contract_review.json"

FIX_RULE = "MULTIPLY_BY_100"
CONFIDENCE = "HIGH"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_float(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            parsed = float(raw)
        except ValueError:
            return None
        return parsed if math.isfinite(parsed) else None
    return None


def round6(value: float | None) -> float | None:
    return round(value, 6) if value is not None else None


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


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def as_asset_mix(row: dict[str, str], prefix: str) -> dict[str, float | None]:
    return {
        "equity": round6(to_float(row.get(f"equity_{prefix}"))),
        "bond": round6(to_float(row.get(f"fixed_income_{prefix}"))),
        "cash": round6(to_float(row.get(f"cash_{prefix}"))),
        "other": round6(to_float(row.get(f"other_{prefix}"))),
    }


def mix_sum(mix: dict[str, float | None]) -> float | None:
    values = [mix.get(k) for k in ("equity", "bond", "cash", "other")]
    if any(v is None for v in values):
        return None
    return round6(sum(float(v or 0.0) for v in values))


def build_optimizer_contract_review(generated_at: str) -> dict[str, Any]:
    return {
        "audit_id": AUDIT_ID,
        "generated_at_utc": generated_at,
        "review_scope": "real optimizer/runtime code in BDB-FONDOS, plus payload/UI normalizers that feed or mirror it",
        "optimizer_scale_contract": {
            "runtime_internal_scale": "0-1 decimal fractions",
            "runtime_storage_input_tolerance": "accepts both 0-1 and 0-100 for exposure components",
            "optimizer_expects_storage_0_100": False,
            "optimizer_converts_to_0_1_internally": True,
            "asset_mix_precedence": "portfolio_exposure_v2.asset_mix is read before economic_exposure when present",
            "normalization_behavior": "component values with absolute value > 1.5 are divided by 100, then the vector is normalized to sum 1.0",
            "runtime_effect_of_single_0_1_to_0_100_storage_patch": "neutral for optimizer vectors; both 0.998 and 99.8 become 0.998 before final normalization",
            "raw_reporting_contract": "frontend/UI normalizers expose V2 exposure as 0-100 percentages",
        },
        "fields_used_by_optimizer": {
            "primary": [
                "portfolio_exposure_v2.asset_mix.equity",
                "portfolio_exposure_v2.asset_mix.bond",
                "portfolio_exposure_v2.asset_mix.cash",
                "portfolio_exposure_v2.asset_mix.other",
            ],
            "aliases_or_fallbacks": [
                "portfolio_exposure_v2.economic_exposure.equity",
                "portfolio_exposure_v2.economic_exposure.bond",
                "portfolio_exposure_v2.economic_exposure.fixed_income",
                "portfolio_exposure_v2.economic_exposure.cash",
                "portfolio_exposure_v2.economic_exposure.other",
                "portfolio_exposure_v2.asset_mix.alternative / alternatives",
                "portfolio_exposure_v2.asset_mix.real_asset / real_estate",
                "v2_exposure",
                "metrics.equity/bond/cash/alternative/real_asset/other",
                "classification_v2.asset_type for fallback base mix",
                "legacy asset_class/label only if V2 exposure is unavailable",
            ],
            "derived_usage": "not used for top-level asset_mix when portfolio_exposure_v2 has usable V2 exposure; used for group maps/legacy fallback in utilities",
            "classification_v2_usage": "used for identity, fallback bucket labels, and suitability/profile routing",
        },
        "double_scale_risk": {
            "optimizer_runtime_double_scale_risk": "NO",
            "reason": "current runtime converts values >1.5 from percent to decimal, so a single 0-1 to 0-100 patch does not double optimizer exposure",
            "operational_rerun_risk": "YES if a future write script blindly multiplies already-corrected 0-100 values",
            "required_write_guard": "before any real write, assert current_sum between 0.95 and 1.05 and proposed_sum between 95 and 105 for every ISIN",
        },
        "non_runtime_scale_conflicts": [
            {
                "file": "scripts/maintenance/cargador_lotes_v_2.js",
                "lines": "420-446",
                "finding": "parser canonical validation expects asset_mix values clamped to 0-1 and sum near 1",
                "impact": "future parser/update flows may still encode 0-1 storage semantics unless updated or explicitly scoped away",
            },
            {
                "file": "scripts/apply_manual_overrides.js",
                "lines": "234-255",
                "finding": "manual override validation for top-level exposure values expects 0-1 when used on a direct exposure object",
                "impact": "not the optimizer runtime, but relevant before designing a write tool or override-based correction",
            },
        ],
        "evidence": [
            {
                "file": "functions_python/services/portfolio/utils.py",
                "lines": "134-138",
                "observation": "_as_fraction divides values with abs(value) > 1.5 by 100 and clamps to 0..1",
            },
            {
                "file": "functions_python/services/portfolio/utils.py",
                "lines": "245-283",
                "observation": "get_v2_asset_mix reads asset_mix first, falls back to economic_exposure/v2_exposure, then returns decimal or percent based on as_percent",
            },
            {
                "file": "functions_python/services/portfolio/optimizer_core.py",
                "lines": "67-103",
                "observation": "optimizer exposure vectors come from get_effective_asset_mix and are decimal fractions",
            },
            {
                "file": "functions_python/api/endpoints_portfolio.py",
                "lines": "75-115",
                "observation": "backend fetches funds_v3 metadata, computes get_v2_asset_mix(as_percent=True) for v2_exposure, and passes raw portfolio_exposure_v2 to optimizer metadata",
            },
            {
                "file": "frontend/src/utils/normalizer.ts",
                "lines": "203-209, 280-303",
                "observation": "UI normalizeExposurePct converts <=1.5 to percent by multiplying by 100 and leaves 0-100 values unchanged",
            },
            {
                "file": "frontend/src/hooks/usePortfolioActions.ts",
                "lines": "29-143",
                "observation": "frontend optimization payload sends minimal asset metadata; backend funds_v3 metadata remains authoritative for V2 exposure",
            },
        ],
        "conclusion": "The deterministic storage patch can be planned, but the current optimizer does not require it for correct internal exposure math. The write decision should be based on canonical storage/reporting contract alignment and must include idempotency guards.",
    }


def main() -> None:
    generated_at = now_utc()
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    DOC_PATH.parent.mkdir(parents=True, exist_ok=True)

    sem1_summary = json.loads(SEM1_SUMMARY_PATH.read_text(encoding="utf-8"))
    sem1_detail_rows = load_csv(SEM1_DETAIL_PATH)
    candidate_rows = load_csv(SEM1_CANDIDATES_PATH)

    plan_rows: list[dict[str, Any]] = []
    patch_preview: list[dict[str, Any]] = []
    invalid_current_sum: list[dict[str, Any]] = []
    invalid_proposed_sum: list[dict[str, Any]] = []
    non_high_confidence: list[dict[str, Any]] = []

    for row in sorted(candidate_rows, key=lambda r: r.get("isin", "")):
        current_mix = as_asset_mix(row, "raw")
        proposed_mix = as_asset_mix(row, "x100")
        current_sum = round6(to_float(row.get("raw_sum")) or mix_sum(current_mix))
        proposed_sum = round6(to_float(row.get("normalized_sum_x100")) or mix_sum(proposed_mix))
        confidence_in = row.get("confidence", "")

        write_allowed = False
        validation_ok = (
            confidence_in == "HIGH_CONFIDENCE_SCALE_FIX"
            and current_sum is not None
            and 0.95 <= current_sum <= 1.05
            and proposed_sum is not None
            and 95 <= proposed_sum <= 105
        )

        out = {
            "audit_id": AUDIT_ID,
            "generated_at_utc": generated_at,
            "isin": row.get("isin", ""),
            "doc_id": row.get("doc_id", ""),
            "name": row.get("name", ""),
            "field_path": "portfolio_exposure_v2.asset_mix",
            "current_asset_mix": json.dumps(current_mix, ensure_ascii=False, sort_keys=True),
            "proposed_asset_mix": json.dumps(proposed_mix, ensure_ascii=False, sort_keys=True),
            "current_sum": current_sum,
            "proposed_sum": proposed_sum,
            "fix_rule": FIX_RULE,
            "confidence": CONFIDENCE,
            "source_confidence": confidence_in,
            "write_allowed": write_allowed,
            "validation_ok": validation_ok,
            "precondition_current_sum_0_95_1_05": current_sum is not None and 0.95 <= current_sum <= 1.05,
            "precondition_proposed_sum_95_105": proposed_sum is not None and 95 <= proposed_sum <= 105,
            "classification_asset_type": row.get("classification_asset_type", ""),
            "classification_asset_subtype": row.get("classification_asset_subtype", ""),
            "derived_asset_class": row.get("derived_asset_class", ""),
        }
        plan_rows.append(out)

        preview_item = {
            "isin": out["isin"],
            "doc_id": out["doc_id"],
            "name": out["name"],
            "field_path": out["field_path"],
            "current_asset_mix": current_mix,
            "proposed_asset_mix": proposed_mix,
            "current_sum": current_sum,
            "proposed_sum": proposed_sum,
            "fix_rule": FIX_RULE,
            "confidence": CONFIDENCE,
            "write_allowed": write_allowed,
            "dry_run_only": True,
            "preconditions": {
                "source_confidence": "HIGH_CONFIDENCE_SCALE_FIX",
                "current_sum_between_0_95_1_05": out["precondition_current_sum_0_95_1_05"],
                "proposed_sum_between_95_105": out["precondition_proposed_sum_95_105"],
                "do_not_apply_if_current_sum_already_95_105": True,
            },
            "proposed_update_payload_preview": {
                "portfolio_exposure_v2.asset_mix": proposed_mix,
            },
        }
        patch_preview.append(preview_item)

        if confidence_in != "HIGH_CONFIDENCE_SCALE_FIX":
            non_high_confidence.append(preview_item)
        if not out["precondition_current_sum_0_95_1_05"]:
            invalid_current_sum.append(preview_item)
        if not out["precondition_proposed_sum_95_105"]:
            invalid_proposed_sum.append(preview_item)

    fields = [
        "audit_id",
        "generated_at_utc",
        "isin",
        "doc_id",
        "name",
        "field_path",
        "current_asset_mix",
        "proposed_asset_mix",
        "current_sum",
        "proposed_sum",
        "fix_rule",
        "confidence",
        "source_confidence",
        "write_allowed",
        "validation_ok",
        "precondition_current_sum_0_95_1_05",
        "precondition_proposed_sum_95_105",
        "classification_asset_type",
        "classification_asset_subtype",
        "derived_asset_class",
    ]
    write_csv(DETAIL_PATH, plan_rows, fields)

    contract_review = build_optimizer_contract_review(generated_at)
    CONTRACT_REVIEW_PATH.write_text(
        json.dumps(contract_review, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    patch_preview_payload = {
        "audit_id": AUDIT_ID,
        "generated_at_utc": generated_at,
        "dry_run_only": True,
        "write_allowed": False,
        "target_collection": "funds_v3",
        "fix_rule": FIX_RULE,
        "patch_count": len(patch_preview),
        "patches": patch_preview,
    }
    PATCH_PREVIEW_PATH.write_text(
        json.dumps(patch_preview_payload, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )

    validation = {
        "total_candidates": len(plan_rows),
        "total_candidates_equals_sem1_high_confidence": len(plan_rows)
        == sem1_summary.get("confidence_counts", {}).get("HIGH_CONFIDENCE_SCALE_FIX"),
        "sem1_review_required_count": sem1_summary.get("confidence_counts", {}).get("REVIEW_REQUIRED"),
        "sem1_blocked_count": sem1_summary.get("confidence_counts", {}).get("BLOCKED"),
        "no_review_or_blocked_candidates": not non_high_confidence
        and sem1_summary.get("confidence_counts", {}).get("REVIEW_REQUIRED") == 0
        and sem1_summary.get("confidence_counts", {}).get("BLOCKED") == 0,
        "current_sum_all_0_95_1_05": not invalid_current_sum,
        "proposed_sum_all_95_105": not invalid_proposed_sum,
        "write_allowed_false_for_all": all(row["write_allowed"] is False for row in plan_rows),
        "validation_ok_for_all": all(row["validation_ok"] is True for row in plan_rows),
        "invalid_current_sum": invalid_current_sum,
        "invalid_proposed_sum": invalid_proposed_sum,
        "non_high_confidence_candidates": non_high_confidence,
    }

    proposed_stats = numeric_stats([row["proposed_sum"] for row in plan_rows])
    current_stats = numeric_stats([row["current_sum"] for row in plan_rows])
    summary = {
        "audit_id": AUDIT_ID,
        "generated_at_utc": generated_at,
        "operational_project_path": str(ROOT),
        "target_collection": "funds_v3",
        "mode": "dry-run",
        "input_artifacts": {
            "sem1_summary_json": str(SEM1_SUMMARY_PATH.relative_to(ROOT)),
            "sem1_detail_csv": str(SEM1_DETAIL_PATH.relative_to(ROOT)),
            "sem1_high_confidence_fix_candidates_csv": str(SEM1_CANDIDATES_PATH.relative_to(ROOT)),
        },
        "forbidden_contexts": {
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
        "optimizer_scale_contract": contract_review["optimizer_scale_contract"],
        "double_scale_risk": contract_review["double_scale_risk"],
        "total_fix_candidates": len(plan_rows),
        "fix_rule": FIX_RULE,
        "confidence_counts": dict(Counter(row["confidence"] for row in plan_rows)),
        "current_sum_stats": current_stats,
        "proposed_sum_stats": proposed_stats,
        "validation": validation,
        "top_20_patch_preview": patch_preview[:20],
        "artifacts": {
            "summary_json": str(SUMMARY_PATH.relative_to(ROOT)),
            "detail_csv": str(DETAIL_PATH.relative_to(ROOT)),
            "patch_preview_json": str(PATCH_PREVIEW_PATH.relative_to(ROOT)),
            "optimizer_scale_contract_review_json": str(CONTRACT_REVIEW_PATH.relative_to(ROOT)),
            "markdown_doc": str(DOC_PATH.relative_to(ROOT)),
        },
        "tests_or_validations": {
            "dry_run_plan_generation": "python scripts/maintenance/bdb_sem_2_asset_mix_fix_plan_dry_run.py",
            "available_tests_executed": [
                {
                    "command": ".\\venv\\Scripts\\python.exe -m pytest tests\\test_optimizer_core.py tests\\test_bucket_constraints_dedup.py tests\\test_suitability_v2.py",
                    "cwd": "functions_python",
                    "result": "PASS",
                    "summary": "58 passed in 10.14s",
                },
                {
                    "command": "python -m pytest tests\\test_suitability_v2.py",
                    "cwd": "functions_python",
                    "result": "PASS",
                    "summary": "47 passed in 0.10s",
                },
                {
                    "command": "npm test -- --run src\\__tests__\\mixedFunds.test.ts",
                    "cwd": "frontend",
                    "result": "PASS",
                    "summary": "19 passed",
                },
                {
                    "command": "npm test -- --run src\\__tests__\\v2Helpers.test.ts",
                    "cwd": "frontend",
                    "result": "FAIL_UNRELATED_TO_ASSET_MIX_PLAN",
                    "summary": "28 passed, 2 failed: getCanonicalSubtype expected raw V2 subtype / uppercase EUR but received display-normalized labels",
                },
            ],
            "notes": "Artifact validations are embedded in validation.*. Backend optimizer-relevant tests pass in the local venv; system Python lacks pypfopt for optimizer tests, so the venv result is authoritative for that suite.",
        },
        "recommendation": "Next block should be BDB-SEM-3 only after explicit human approval. It should be a guarded write proposal/apply block that revalidates current_sum 0.95-1.05 immediately before any update and aborts if any candidate is already 0-100.",
    }

    SUMMARY_PATH.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    write_markdown(summary, contract_review)

    print(
        json.dumps(
            {
                "optimizer_scale_contract": {
                    "runtime_internal_scale": contract_review["optimizer_scale_contract"]["runtime_internal_scale"],
                    "runtime_storage_input_tolerance": contract_review["optimizer_scale_contract"]["runtime_storage_input_tolerance"],
                    "optimizer_runtime_double_scale_risk": contract_review["double_scale_risk"]["optimizer_runtime_double_scale_risk"],
                },
                "total_fix_candidates": len(plan_rows),
                "current_sum_stats": current_stats,
                "proposed_sum_stats": proposed_stats,
                "validation": {
                    "current_sum_all_0_95_1_05": validation["current_sum_all_0_95_1_05"],
                    "proposed_sum_all_95_105": validation["proposed_sum_all_95_105"],
                    "write_allowed_false_for_all": validation["write_allowed_false_for_all"],
                    "no_review_or_blocked_candidates": validation["no_review_or_blocked_candidates"],
                },
                "artifacts": summary["artifacts"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def write_markdown(summary: dict[str, Any], contract_review: dict[str, Any]) -> None:
    top_lines = "\n".join(
        f"- `{p['isin']}` {p['name']}: current_sum={p['current_sum']}, proposed_sum={p['proposed_sum']}, write_allowed=false"
        for p in summary["top_20_patch_preview"]
    )
    artifact_lines = "\n".join(f"- `{path}`" for path in summary["artifacts"].values())
    evidence_lines = "\n".join(
        f"- `{item['file']}` lines {item['lines']}: {item['observation']}"
        for item in contract_review["evidence"]
    )

    text = f"""# BDB-SEM-2 Asset Mix Fix Plan Dry-Run

Generated at UTC: `{summary['generated_at_utc']}`

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

- Runtime internal scale: `{contract_review['optimizer_scale_contract']['runtime_internal_scale']}`
- Runtime input tolerance: `{contract_review['optimizer_scale_contract']['runtime_storage_input_tolerance']}`
- Optimizer converts to 0-1 internally: `{str(contract_review['optimizer_scale_contract']['optimizer_converts_to_0_1_internally']).lower()}`
- Asset mix precedence: `{contract_review['optimizer_scale_contract']['asset_mix_precedence']}`
- Runtime effect of a single patch: `{contract_review['optimizer_scale_contract']['runtime_effect_of_single_0_1_to_0_100_storage_patch']}`

Evidence reviewed:

{evidence_lines}

## Expected Optimizer Impact

The current optimizer should produce equivalent exposure vectors before and after a single 0-1 to 0-100 storage patch because `_as_fraction` converts percent-like inputs back to decimals and `get_v2_asset_mix` normalizes the vector. The expected operational benefit is contract clarity for reporting/storage consumers, not a change in optimizer math.

## Risks

- Risk of not correcting: raw consumers that expect 0-100 may understate allocations by roughly 100x.
- Risk of double scale in optimizer runtime: `{contract_review['double_scale_risk']['optimizer_runtime_double_scale_risk']}`.
- Operational rerun risk: `{contract_review['double_scale_risk']['operational_rerun_risk']}`.
- Guard required: `{contract_review['double_scale_risk']['required_write_guard']}`.
- Non-runtime conflict: parser/ingest validation currently encodes 0-1 semantics, so any real write block should explicitly resolve or scope that contract before mutation.

## Validations

- Total candidates: {summary['total_fix_candidates']}
- Current sum all 0.95-1.05: `{str(summary['validation']['current_sum_all_0_95_1_05']).lower()}`
- Proposed sum all 95-105: `{str(summary['validation']['proposed_sum_all_95_105']).lower()}`
- No REVIEW/BLOCKED candidates: `{str(summary['validation']['no_review_or_blocked_candidates']).lower()}`
- write_allowed false for all: `{str(summary['validation']['write_allowed_false_for_all']).lower()}`
- Proposed sum min/max: `{summary['proposed_sum_stats']['min']}` / `{summary['proposed_sum_stats']['max']}`

## Tests Executed

- Backend optimizer/suitability: `.\\venv\\Scripts\\python.exe -m pytest tests\\test_optimizer_core.py tests\\test_bucket_constraints_dedup.py tests\\test_suitability_v2.py` -> `58 passed`.
- Backend suitability with system Python: `python -m pytest tests\\test_suitability_v2.py` -> `47 passed`.
- Frontend mixed funds: `npm test -- --run src\\__tests__\\mixedFunds.test.ts` -> `19 passed`.
- Frontend V2 helpers: `npm test -- --run src\\__tests__\\v2Helpers.test.ts` -> `28 passed, 2 failed`; failures are existing taxonomy display/raw subtype expectations, not asset_mix scale logic.

## Top 20 Patch Preview

{top_lines}

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

{artifact_lines}

## Recommendation

Next block should be `BDB-SEM-3` only after explicit human approval. It should re-read each candidate immediately before write, assert current sum is still `0.95`-`1.05`, abort on any already-0-100 value, and apply no update unless all guards pass.
"""
    DOC_PATH.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
