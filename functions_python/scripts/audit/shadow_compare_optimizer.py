from __future__ import annotations

import argparse
import copy
import csv
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

TOLERANCE = 1e-4
VERDICT_PASS = "PASS"
VERDICT_FAIL = "FAIL"
VERDICT_EXPECTED = "EXPECTED"
VERDICT_INVESTIGATE = "INVESTIGATE"


class _Snap:
    def __init__(self, exists: bool, data: dict | None = None):
        self.exists = exists
        self._data = data or {}

    def to_dict(self):
        return self._data


class _DocRef:
    def __init__(self, docs: dict, doc_id: str):
        self._docs = docs
        self._doc_id = doc_id

    def get(self):
        return self._docs.get(self._doc_id, _Snap(False))

    def set(self, data):
        self._docs[self._doc_id] = _Snap(True, data)


class _Collection:
    def __init__(self, docs: dict):
        self._docs = docs

    def document(self, doc_id: str):
        return _DocRef(self._docs, doc_id)


class _DB:
    def __init__(self, docs: dict):
        self._docs = docs

    def collection(self, name: str):
        if name != "system_settings":
            raise ValueError(f"Unsupported fake collection: {name}")
        return _Collection(self._docs)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _risk_profiles_doc() -> dict:
    from services.config import RISK_BUCKETS_LABELS

    return {str(k): copy.deepcopy(v) for k, v in RISK_BUCKETS_LABELS.items()}


def _fake_db() -> _DB:
    profiles = _risk_profiles_doc()
    return _DB({
        "risk_profiles": _Snap(True, profiles),
        "risk_profiles_staging": _Snap(True, copy.deepcopy(profiles)),
        "feature_flags": _Snap(True, {"unified_constraints": False}),
    })


def _base_constraints(objective: str = "min_vol") -> dict:
    return {
        "apply_profile": True,
        "objective": objective,
        "max_weight": 1.0,
        "min_weight": 0.0,
        "cutoff": 0.0,
    }


def _case(
    case_id: str,
    risk_level: int,
    constraints: dict | None = None,
    constraints_v1: dict | None = None,
    notes: str = "",
    allow_equity_floor_status_diff: bool = False,
) -> dict:
    return {
        "id": case_id,
        "assets": [
            "EQ_GROWTH",
            "EQ_VALUE",
            "BOND_CORE",
            "CASH_MM",
            "ALT_HEDGE",
            "REAL_ASSET",
            "OTHER_ABS",
        ],
        "risk_level": risk_level,
        "constraints": constraints or _base_constraints(),
        "constraints_v1": constraints_v1 or {},
        "asset_metadata": {},
        "notes": notes,
        "allow_equity_floor_status_diff": allow_equity_floor_status_diff,
    }


def build_cases() -> list[dict]:
    cases = []
    for risk_level in range(1, 11):
        objective = "max_sharpe" if risk_level >= 8 else "min_vol"
        cases.append(
            _case(
                f"profile_{risk_level}_no_override",
                risk_level,
                constraints=_base_constraints(objective),
                notes="neutrality_baseline",
            )
        )

    cases.extend([
        _case(
            "profile_5_override_equity_narrow",
            5,
            constraints=_base_constraints(),
            constraints_v1={"bucket_bounds": {"equity": {"min": 0.50}}},
            notes="override narrows RV min",
        ),
        _case(
            "profile_5_override_equity_widen",
            5,
            constraints=_base_constraints(),
            constraints_v1={"bucket_bounds": {"equity": {"min": 0.10, "max": 0.90}}},
            notes="override attempts to widen RV bounds",
        ),
        _case(
            "profile_5_override_alt_real_caps",
            5,
            constraints=_base_constraints(),
            constraints_v1={
                "bucket_bounds": {
                    "alternative": {"max": 0.10},
                    "real_asset": {"max": 0.15},
                }
            },
            notes="alternative + real_asset merge into Alternativos",
        ),
        _case(
            "profile_5_no_override_low_vol_fallback",
            5,
            constraints=_base_constraints("efficient_risk"),
            constraints_v1={"risk_budget": {"target_vol": 0.0001}},
            notes="forces solver fallback without bucket overrides",
            allow_equity_floor_status_diff=True,
        ),
    ])
    return cases


def _case_has_bucket_overrides(case: dict) -> bool:
    bounds = ((case.get("constraints_v1") or {}).get("bucket_bounds") or {})
    return isinstance(bounds, dict) and bool(bounds)


def _as_float_map(raw: Any) -> dict[str, float]:
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key, value in raw.items():
        try:
            out[str(key)] = float(value)
        except Exception:
            continue
    return out


def max_abs_diff(left: dict | None, right: dict | None) -> float:
    left_map = _as_float_map(left)
    right_map = _as_float_map(right)
    keys = set(left_map) | set(right_map)
    if not keys:
        return 0.0
    return max(abs(left_map.get(key, 0.0) - right_map.get(key, 0.0)) for key in keys)


def metrics_diff(left: dict | None, right: dict | None) -> dict[str, float]:
    left_map = _as_float_map(left)
    right_map = _as_float_map(right)
    return {
        key: abs(left_map.get(key, 0.0) - right_map.get(key, 0.0))
        for key in ("return", "volatility", "sharpe")
    }


def _status(result: dict | None) -> str:
    return str((result or {}).get("status") or "")


def _solver_path(result: dict | None) -> str:
    return str((result or {}).get("solver_path") or "")


def _is_error_result(result: dict | None) -> bool:
    status = _status(result)
    return status == "error" or bool((result or {}).get("error"))


def _status_diff_due_to_equity_floor(case: dict, legacy: dict, unified: dict) -> bool:
    if not (_status(legacy) != _status(unified) or _solver_path(legacy) != _solver_path(unified)):
        return False
    if case.get("allow_equity_floor_status_diff"):
        return True
    statuses = {_status(legacy), _status(unified)}
    return "infeasible_equity_floor" in statuses


def compare_case_results(case: dict, legacy: dict, unified: dict, tolerance: float = TOLERANCE) -> dict:
    has_overrides = _case_has_bucket_overrides(case)
    weights_delta = max_abs_diff(legacy.get("weights"), unified.get("weights"))
    allocation_delta = max_abs_diff(legacy.get("portfolio_allocation"), unified.get("portfolio_allocation"))
    metric_delta = metrics_diff(legacy.get("metrics"), unified.get("metrics"))
    status_changed = _status(legacy) != _status(unified)
    solver_changed = _solver_path(legacy) != _solver_path(unified)
    ignored_unified = ((unified.get("explainability") or {}).get("ignored_overrides") or [])
    effective_bounds_unified = ((unified.get("explainability") or {}).get("effective_bounds") or {})
    notes = []

    if _is_error_result(legacy) or _is_error_result(unified):
        verdict = VERDICT_INVESTIGATE
        notes.append("error_status_or_exception")
    elif _status_diff_due_to_equity_floor(case, legacy, unified):
        verdict = VERDICT_EXPECTED
        notes.append("status_or_solver_path_diff_due_to_equity_floor")
    elif (not has_overrides) and (weights_delta > tolerance or allocation_delta > tolerance):
        verdict = VERDICT_FAIL
        notes.append("neutral_case_weight_or_allocation_diff")
    elif (not has_overrides) and (status_changed or solver_changed):
        verdict = VERDICT_INVESTIGATE
        notes.append("neutral_case_status_or_solver_path_diff")
    elif has_overrides and (
        weights_delta > tolerance
        or allocation_delta > tolerance
        or status_changed
        or solver_changed
        or bool(ignored_unified)
        or bool(effective_bounds_unified)
    ):
        verdict = VERDICT_EXPECTED
        notes.append("override_case_expected_delta")
    else:
        verdict = VERDICT_PASS
        notes.append("within_tolerance")

    return {
        "id": case.get("id"),
        "verdict": verdict,
        "has_bucket_overrides": has_overrides,
        "weights_max_abs_diff": round(float(weights_delta), 10),
        "allocation_max_abs_diff": round(float(allocation_delta), 10),
        "metrics_diff": {key: round(float(value), 10) for key, value in metric_delta.items()},
        "status": {"legacy": _status(legacy), "unified": _status(unified)},
        "solver_path": {"legacy": _solver_path(legacy), "unified": _solver_path(unified)},
        "applicable": {
            "legacy": bool((legacy or {}).get("applicable", False)),
            "unified": bool((unified or {}).get("applicable", False)),
        },
        "usable": {
            "legacy": bool((legacy or {}).get("usable", False)),
            "unified": bool((unified or {}).get("usable", False)),
        },
        "violations_count": {
            "legacy": len((legacy or {}).get("violations") or (legacy or {}).get("constraint_violations") or []),
            "unified": len((unified or {}).get("violations") or (unified or {}).get("constraint_violations") or []),
        },
        "bucket_constraints_source": {
            "legacy": ((legacy.get("explainability") or {}).get("bucket_constraints_source")),
            "unified": ((unified.get("explainability") or {}).get("bucket_constraints_source")),
        },
        "ignored_overrides_unified": ignored_unified,
        "effective_bounds_unified": effective_bounds_unified,
        "notes": "; ".join(notes + ([case.get("notes")] if case.get("notes") else [])),
    }


def summarize(case_results: list[dict]) -> dict[str, int]:
    summary = {"total": len(case_results), "pass": 0, "expected_diff": 0, "fail": 0, "investigate": 0}
    for result in case_results:
        verdict = result.get("verdict")
        if verdict == VERDICT_PASS:
            summary["pass"] += 1
        elif verdict == VERDICT_EXPECTED:
            summary["expected_diff"] += 1
        elif verdict == VERDICT_FAIL:
            summary["fail"] += 1
        elif verdict == VERDICT_INVESTIGATE:
            summary["investigate"] += 1
    return summary


def _price_frame(universe: list[str]):
    import numpy as np
    import pandas as pd

    dates = pd.date_range("2021-01-01", periods=260, freq="B")
    drifts = {
        "EQ_GROWTH": 1.00035,
        "EQ_VALUE": 1.00025,
        "BOND_CORE": 1.00008,
        "CASH_MM": 1.00003,
        "ALT_HEDGE": 1.00015,
        "REAL_ASSET": 1.00018,
        "OTHER_ABS": 1.00011,
    }
    return pd.DataFrame({
        isin: pd.Series(100.0 * np.cumprod(np.full(len(dates), drifts[isin])), index=dates)
        for isin in universe
    })


def _expected_returns_and_cov(universe: list[str]):
    import pandas as pd

    mu_values = {
        "EQ_GROWTH": 0.090,
        "EQ_VALUE": 0.075,
        "BOND_CORE": 0.030,
        "CASH_MM": 0.015,
        "ALT_HEDGE": 0.045,
        "REAL_ASSET": 0.050,
        "OTHER_ABS": 0.035,
    }
    variances = {
        "EQ_GROWTH": 0.045,
        "EQ_VALUE": 0.035,
        "BOND_CORE": 0.006,
        "CASH_MM": 0.001,
        "ALT_HEDGE": 0.020,
        "REAL_ASSET": 0.025,
        "OTHER_ABS": 0.015,
    }
    mu = pd.Series({isin: mu_values[isin] for isin in universe})
    cov = pd.DataFrame(0.0, index=universe, columns=universe)
    for isin in universe:
        cov.loc[isin, isin] = variances[isin]
    return mu, cov


def _exposure_vectors(universe: list[str]):
    import numpy as np

    exposure = {
        "EQ_GROWTH": (1, 0, 0, 0, 0, 0),
        "EQ_VALUE": (1, 0, 0, 0, 0, 0),
        "BOND_CORE": (0, 1, 0, 0, 0, 0),
        "CASH_MM": (0, 0, 1, 0, 0, 0),
        "ALT_HEDGE": (0, 0, 0, 1, 0, 0),
        "REAL_ASSET": (0, 0, 0, 0, 1, 0),
        "OTHER_ABS": (0, 0, 0, 0, 0, 1),
    }
    columns = list(zip(*(exposure[isin] for isin in universe)))
    return tuple(np.array(col, dtype=float) for col in columns)


@contextmanager
def _deterministic_optimizer_inputs(case: dict):
    import services.portfolio.optimizer_core as optimizer_core

    originals = {
        "_apply_suitability_filter": optimizer_core._apply_suitability_filter,
        "_build_candidate_universe": optimizer_core._build_candidate_universe,
        "_build_expected_returns_and_cov": optimizer_core._build_expected_returns_and_cov,
        "_build_frontier_curve": optimizer_core._build_frontier_curve,
    }
    universe = list(case["assets"])
    df = _price_frame(universe)
    eq_vec, bd_vec, cs_vec, al_vec, ra_vec, ot_vec = _exposure_vectors(universe)

    def fake_candidate_universe(*args, **kwargs):
        fetcher = MagicMock()
        fetcher.get_dynamic_risk_free_rate.return_value = 0.0
        return (
            fetcher,
            {col: df[col] for col in df.columns},
            False,
            df,
            universe,
            [],
            eq_vec,
            bd_vec,
            cs_vec,
            al_vec,
            ra_vec,
            ot_vec,
        )

    def fake_expected_returns_and_cov(*args, **kwargs):
        return _expected_returns_and_cov(universe)

    try:
        optimizer_core._apply_suitability_filter = lambda assets, *_args: assets
        optimizer_core._build_candidate_universe = fake_candidate_universe
        optimizer_core._build_expected_returns_and_cov = fake_expected_returns_and_cov
        optimizer_core._build_frontier_curve = lambda mu, s: []
        yield
    finally:
        for name, value in originals.items():
            setattr(optimizer_core, name, value)


@contextmanager
def _unified_flag(value: str):
    previous = os.environ.get("UNIFIED_CONSTRAINTS")
    os.environ["UNIFIED_CONSTRAINTS"] = value
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("UNIFIED_CONSTRAINTS", None)
        else:
            os.environ["UNIFIED_CONSTRAINTS"] = previous


def _run_once(case: dict, flag_value: str) -> dict:
    import services.portfolio.optimizer_core as optimizer_core

    with _unified_flag(flag_value):
        return optimizer_core.run_optimization(
            assets_list=list(case["assets"]),
            risk_level=case["risk_level"],
            db=_fake_db(),
            constraints=copy.deepcopy(case.get("constraints") or {}),
            asset_metadata=copy.deepcopy(case.get("asset_metadata") or {}),
            locked_assets=copy.deepcopy(case.get("locked_assets") or []),
            tactical_views=copy.deepcopy(case.get("tactical_views") or None),
            candidate_funds=copy.deepcopy(case.get("candidate_funds") or None),
            constraints_v1=copy.deepcopy(case.get("constraints_v1") or {}),
        )


def run_case(case: dict) -> dict:
    with _deterministic_optimizer_inputs(case):
        legacy = _run_once(case, "0")
        unified = _run_once(case, "1")
    return compare_case_results(case, legacy, unified)


def _manifest_path(mode: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = _repo_root() / "artifacts" / "shadow"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"shadow_{mode}_{timestamp}.json"


def write_manifest(case_results: list[dict], mode: str = "deterministic") -> Path:
    summary = summarize(case_results)
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "summary": summary,
        "cases": case_results,
    }
    path = _manifest_path(mode)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    csv_path = path.with_suffix(".csv")
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "id",
                "verdict",
                "weights_max_abs_diff",
                "allocation_max_abs_diff",
                "legacy_status",
                "unified_status",
                "legacy_solver_path",
                "unified_solver_path",
                "notes",
            ],
        )
        writer.writeheader()
        for item in case_results:
            writer.writerow({
                "id": item["id"],
                "verdict": item["verdict"],
                "weights_max_abs_diff": item["weights_max_abs_diff"],
                "allocation_max_abs_diff": item["allocation_max_abs_diff"],
                "legacy_status": item["status"]["legacy"],
                "unified_status": item["status"]["unified"],
                "legacy_solver_path": item["solver_path"]["legacy"],
                "unified_solver_path": item["solver_path"]["unified"],
                "notes": item["notes"],
            })
    return path


def print_summary(case_results: list[dict], manifest_path: Path) -> None:
    summary = summarize(case_results)
    print("id | verdict | weights_max_abs_diff | status legacy->unified")
    print("--- | --- | ---: | ---")
    for item in case_results:
        print(
            f"{item['id']} | {item['verdict']} | {item['weights_max_abs_diff']:.6f} | "
            f"{item['status']['legacy']}->{item['status']['unified']}"
        )
    print("")
    print(
        "summary: "
        f"total={summary['total']} pass={summary['pass']} expected={summary['expected_diff']} "
        f"fail={summary['fail']} investigate={summary['investigate']}"
    )
    print(f"manifest: {manifest_path}")


def run_deterministic() -> tuple[list[dict], Path]:
    results = [run_case(case) for case in build_cases()]
    manifest_path = write_manifest(results, mode="deterministic")
    return results, manifest_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="REM-5B shadow comparator for optimizer unified constraints.")
    parser.add_argument("--live", action="store_true", help="Reserved for emulator/staging live comparison.")
    args = parser.parse_args(argv)

    if args.live:
        print("--live is reserved for emulator/staging wiring. Deterministic mode is the REM-5B gate.")
        return 2

    case_results, manifest_path = run_deterministic()
    print_summary(case_results, manifest_path)
    return 1 if summarize(case_results)["fail"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
