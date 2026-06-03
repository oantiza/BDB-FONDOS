from __future__ import annotations

import argparse
import copy
import csv
import json
import os
import sys
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

FUNCTIONS_ROOT = Path(__file__).resolve().parents[2]
if str(FUNCTIONS_ROOT) not in sys.path:
    sys.path.insert(0, str(FUNCTIONS_ROOT))

LIVE_DEFAULT_ASSETS = [
    "LU0293313671",
    "LU0117858752",
    "ES0182105033",
    "ES0161992005",
    "ES0142167032",
    "ES0138936036",
    "LU0835722488",
    "LU1066281574",
]


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


def _production_weight_constraints(objective: str = "efficient_risk") -> dict:
    constraints = _base_constraints(objective)
    constraints["max_weight"] = 0.20
    return constraints


def _case(
    case_id: str,
    risk_level: int,
    assets: list[str] | None = None,
    constraints: dict | None = None,
    constraints_v1: dict | None = None,
    notes: str = "",
    allow_equity_floor_status_diff: bool = False,
) -> dict:
    return {
        "id": case_id,
        "assets": list(assets or [
            "EQ_GROWTH",
            "EQ_VALUE",
            "EQ_QUALITY",
            "EQ_SMALL",
            "EQ_GLOBAL",
            "MIX_60_40",
            "BOND_CORE",
            "BOND_SHORT",
            "CASH_MM",
            "CASH_TBILL",
            "ALT_HEDGE",
            "REAL_ASSET",
            "OTHER_ABS",
        ]),
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
        cases.append(
            _case(
                f"profile_{risk_level}_efficient_risk_no_override",
                risk_level,
                constraints=_production_weight_constraints("efficient_risk"),
                notes="neutrality_baseline_efficient_risk_max_weight_0.20",
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


def build_live_cases(
    assets: list[str],
    risk_levels: list[int],
    include_overrides: bool = True,
    include_fallback: bool = True,
) -> list[dict]:
    cases = [
        _case(
            f"live_profile_{risk_level}_efficient_risk_no_override",
            risk_level,
            assets=assets,
            constraints=_production_weight_constraints("efficient_risk"),
            notes="live_neutrality_baseline_efficient_risk_max_weight_0.20",
        )
        for risk_level in risk_levels
    ]

    if include_overrides:
        cases.extend([
            _case(
                "live_profile_5_override_equity_narrow",
                5,
                assets=assets,
                constraints=_production_weight_constraints("efficient_risk"),
                constraints_v1={"bucket_bounds": {"equity": {"min": 0.50}}},
                notes="live override narrows RV min",
            ),
            _case(
                "live_profile_5_override_equity_widen",
                5,
                assets=assets,
                constraints=_production_weight_constraints("efficient_risk"),
                constraints_v1={"bucket_bounds": {"equity": {"min": 0.10, "max": 0.90}}},
                notes="live override attempts to widen RV bounds",
            ),
            _case(
                "live_profile_5_override_alt_real_caps",
                5,
                assets=assets,
                constraints=_production_weight_constraints("efficient_risk"),
                constraints_v1={
                    "bucket_bounds": {
                        "alternative": {"max": 0.10},
                        "real_asset": {"max": 0.15},
                    }
                },
                notes="live alternative + real_asset merge into Alternativos",
            ),
        ])

    if include_fallback:
        cases.append(
            _case(
                "live_profile_5_no_override_low_vol_fallback",
                5,
                assets=assets,
                constraints=_production_weight_constraints("efficient_risk"),
                constraints_v1={"risk_budget": {"target_vol": 0.0001}},
                notes="live fallback/status characterization without bucket overrides",
                allow_equity_floor_status_diff=True,
            )
        )

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


def _has_material_weights(result: dict | None, tolerance: float = TOLERANCE) -> bool:
    return any(abs(value) > tolerance for value in _as_float_map((result or {}).get("weights")).values())


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
    equity_floor_status_diff = _status_diff_due_to_equity_floor(case, legacy, unified)
    neutral_weight_or_allocation_diff = (
        not has_overrides
        and (weights_delta > tolerance or allocation_delta > tolerance)
    )
    both_runs_have_material_weights = (
        _has_material_weights(legacy, tolerance)
        and _has_material_weights(unified, tolerance)
    )
    ignored_unified = ((unified.get("explainability") or {}).get("ignored_overrides") or [])
    effective_bounds_unified = ((unified.get("explainability") or {}).get("effective_bounds") or {})
    notes = []

    if _is_error_result(legacy) or _is_error_result(unified):
        verdict = VERDICT_INVESTIGATE
        notes.append("error_status_or_exception")
    elif neutral_weight_or_allocation_diff and (not equity_floor_status_diff or both_runs_have_material_weights):
        verdict = VERDICT_FAIL
        notes.append("neutral_case_weight_or_allocation_diff")
    elif equity_floor_status_diff:
        verdict = VERDICT_EXPECTED
        notes.append("status_or_solver_path_diff_due_to_equity_floor")
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
        "EQ_QUALITY": 1.00030,
        "EQ_SMALL": 1.00028,
        "EQ_GLOBAL": 1.00024,
        "MIX_60_40": 1.00018,
        "BOND_CORE": 1.00008,
        "BOND_SHORT": 1.00006,
        "CASH_MM": 1.00003,
        "CASH_TBILL": 1.00002,
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
        "EQ_QUALITY": 0.082,
        "EQ_SMALL": 0.087,
        "EQ_GLOBAL": 0.078,
        "MIX_60_40": 0.055,
        "BOND_CORE": 0.030,
        "BOND_SHORT": 0.024,
        "CASH_MM": 0.015,
        "CASH_TBILL": 0.012,
        "ALT_HEDGE": 0.045,
        "REAL_ASSET": 0.050,
        "OTHER_ABS": 0.035,
    }
    variances = {
        "EQ_GROWTH": 0.045,
        "EQ_VALUE": 0.035,
        "EQ_QUALITY": 0.032,
        "EQ_SMALL": 0.050,
        "EQ_GLOBAL": 0.038,
        "MIX_60_40": 0.018,
        "BOND_CORE": 0.006,
        "BOND_SHORT": 0.003,
        "CASH_MM": 0.001,
        "CASH_TBILL": 0.0005,
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
        "EQ_QUALITY": (1, 0, 0, 0, 0, 0),
        "EQ_SMALL": (1, 0, 0, 0, 0, 0),
        "EQ_GLOBAL": (1, 0, 0, 0, 0, 0),
        "MIX_60_40": (0.6, 0.4, 0, 0, 0, 0),
        "BOND_CORE": (0, 1, 0, 0, 0, 0),
        "BOND_SHORT": (0, 1, 0, 0, 0, 0),
        "CASH_MM": (0, 0, 1, 0, 0, 0),
        "CASH_TBILL": (0, 0, 1, 0, 0, 0),
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


@contextmanager
def _fixed_live_risk_free_rate(rate: float):
    from services.data_fetcher import DataFetcher

    original = DataFetcher.get_dynamic_risk_free_rate
    DataFetcher.get_dynamic_risk_free_rate = lambda self: float(rate)
    try:
        yield
    finally:
        DataFetcher.get_dynamic_risk_free_rate = original


def _run_once(case: dict, flag_value: str, db=None) -> dict:
    import services.portfolio.optimizer_core as optimizer_core

    with _unified_flag(flag_value):
        return optimizer_core.run_optimization(
            assets_list=list(case["assets"]),
            risk_level=case["risk_level"],
            db=db or _fake_db(),
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


def _split_csv(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.replace("\n", ",").split(",") if item.strip()]


def _load_assets(assets: str | None = None, assets_file: str | None = None) -> list[str]:
    if assets_file:
        path = Path(assets_file)
        raw = path.read_text(encoding="utf-8-sig")
        if path.suffix.lower() == ".json":
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                parsed = parsed.get("assets") or parsed.get("isins") or []
            return [str(item).strip() for item in parsed if str(item).strip()]
        return _split_csv(raw)
    parsed_assets = _split_csv(assets)
    return parsed_assets or list(LIVE_DEFAULT_ASSETS)


def _parse_risk_levels(raw: str | None) -> list[int]:
    levels = [int(item) for item in _split_csv(raw or "1,2,3,4,5,6,7,8,9,10")]
    invalid = [level for level in levels if level < 1 or level > 10]
    if invalid:
        raise ValueError(f"Risk levels must be between 1 and 10: {invalid}")
    return levels


def _stable_json(data: Any) -> str:
    return json.dumps(data or {}, sort_keys=True, ensure_ascii=False, default=str)


def _read_settings_doc(db, doc_id: str) -> tuple[bool, dict]:
    snap = db.collection("system_settings").document(doc_id).get()
    return bool(getattr(snap, "exists", False)), (snap.to_dict() or {})


def check_live_preflight(db, allow_profile_drift: bool = False) -> dict:
    canonical_exists, canonical = _read_settings_doc(db, "risk_profiles")
    staging_exists, staging = _read_settings_doc(db, "risk_profiles_staging")
    flags_exists, flags = _read_settings_doc(db, "feature_flags")
    profiles_equal = canonical_exists and staging_exists and _stable_json(canonical) == _stable_json(staging)
    failures = []

    if not canonical_exists:
        failures.append("missing_system_settings/risk_profiles")
    if not staging_exists:
        failures.append("missing_system_settings/risk_profiles_staging")
    if canonical_exists and staging_exists and not profiles_equal and not allow_profile_drift:
        failures.append("risk_profiles_and_staging_differ")

    status = "pass"
    if failures:
        status = "fail"
    elif canonical_exists and staging_exists and not profiles_equal:
        status = "allowed_profile_drift"

    return {
        "status": status,
        "canonical_exists": canonical_exists,
        "staging_exists": staging_exists,
        "profiles_equal": profiles_equal,
        "feature_flags_exists": flags_exists,
        "remote_unified_constraints": bool(flags.get("unified_constraints", False)) if flags_exists else None,
        "allow_profile_drift": bool(allow_profile_drift),
        "failures": failures,
    }


def init_firestore_client():
    import firebase_admin
    from firebase_admin import credentials, firestore

    if not firebase_admin._apps:
        key_candidates = [
            _repo_root() / "serviceAccountKey.json",
            _repo_root() / "functions_python" / "serviceAccountKey.json",
            _repo_root() / "functions_python" / "scripts" / "serviceAccountKey.json",
        ]
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get("FIRESTORE_EMULATOR_HOST"):
            firebase_admin.initialize_app()
        else:
            key_path = next((path for path in key_candidates if path.exists()), None)
            if key_path:
                firebase_admin.initialize_app(credentials.Certificate(str(key_path)))
            else:
                firebase_admin.initialize_app()
    return firestore.client()


def _build_live_asset_metadata(db, assets: list[str]) -> dict:
    try:
        from api.endpoints_portfolio import _build_asset_metadata

        return _build_asset_metadata(db, assets, {})
    except Exception:
        from services.data_fetcher import DataFetcher

        return DataFetcher(db).get_asset_metadata(assets)


def run_live_case(case: dict, db, risk_free_rate: float = 0.03) -> dict:
    with _fixed_live_risk_free_rate(risk_free_rate):
        legacy = _run_once(case, "0", db=db)
        unified = _run_once(case, "1", db=db)
    return compare_case_results(case, legacy, unified)


def _manifest_path(mode: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_dir = _repo_root() / "artifacts" / "shadow"
    out_dir.mkdir(parents=True, exist_ok=True)
    return out_dir / f"shadow_{mode}_{timestamp}.json"


def write_manifest(case_results: list[dict], mode: str = "deterministic", metadata: dict | None = None) -> Path:
    summary = summarize(case_results)
    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "summary": summary,
        "cases": case_results,
    }
    if metadata:
        manifest.update(metadata)
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


def run_live(
    assets: list[str],
    risk_levels: list[int],
    db=None,
    include_overrides: bool = True,
    include_fallback: bool = True,
    allow_profile_drift: bool = False,
    risk_free_rate: float = 0.03,
) -> tuple[list[dict], Path, dict]:
    if not assets:
        raise ValueError("Live shadow requires at least one asset.")

    db = db or init_firestore_client()
    preflight = check_live_preflight(db, allow_profile_drift=allow_profile_drift)
    manifest_metadata = {
        "preflight": preflight,
        "assets": assets,
        "assets_count": len(assets),
        "risk_levels": risk_levels,
        "include_overrides": include_overrides,
        "include_fallback": include_fallback,
        "risk_free_rate": risk_free_rate,
        "read_only_guards": {
            "unified_constraints": "env_override_per_run",
            "risk_free_rate": "fixed_in_harness",
        },
    }

    if preflight["status"] == "fail":
        manifest_path = write_manifest([], mode="live", metadata=manifest_metadata)
        return [], manifest_path, preflight

    asset_metadata = _build_live_asset_metadata(db, assets)
    cases = build_live_cases(
        assets,
        risk_levels,
        include_overrides=include_overrides,
        include_fallback=include_fallback,
    )
    results = []
    for case in cases:
        case["asset_metadata"] = copy.deepcopy(asset_metadata)
        results.append(run_live_case(case, db, risk_free_rate=risk_free_rate))

    manifest_metadata.update({
        "metadata_count": len(asset_metadata),
        "metadata_missing": [asset for asset in assets if asset not in asset_metadata],
    })
    manifest_path = write_manifest(results, mode="live", metadata=manifest_metadata)
    return results, manifest_path, preflight


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="REM-5B shadow comparator for optimizer unified constraints.")
    parser.add_argument("--live", action="store_true", help="Run the read-only Firestore/emulator live comparison.")
    parser.add_argument("--assets", help="Comma-separated ISIN list for live mode.")
    parser.add_argument("--assets-file", help="File with ISINs as JSON array/object or comma/newline text.")
    parser.add_argument("--risk-levels", default="1,2,3,4,5,6,7,8,9,10", help="Comma-separated risk levels for live mode.")
    parser.add_argument("--no-overrides", action="store_true", help="Live mode: skip override characterization cases.")
    parser.add_argument("--no-fallback", action="store_true", help="Live mode: skip low-vol fallback characterization case.")
    parser.add_argument("--allow-profile-drift", action="store_true", help="Live mode: run even if staging differs from canonical profiles.")
    parser.add_argument("--risk-free-rate", type=float, default=0.03, help="Fixed risk-free rate used by live shadow runs.")
    args = parser.parse_args(argv)

    if args.live:
        assets = _load_assets(args.assets, args.assets_file)
        risk_levels = _parse_risk_levels(args.risk_levels)
        try:
            case_results, manifest_path, preflight = run_live(
                assets=assets,
                risk_levels=risk_levels,
                include_overrides=not args.no_overrides,
                include_fallback=not args.no_fallback,
                allow_profile_drift=args.allow_profile_drift,
                risk_free_rate=args.risk_free_rate,
            )
        except Exception as exc:
            print(
                "live shadow could not start or complete. Check GOOGLE_APPLICATION_CREDENTIALS, "
                f"FIRESTORE_EMULATOR_HOST, and Firestore data. Details: {exc}"
            )
            return 2
        print(f"preflight: {preflight['status']} {preflight.get('failures') or ''}")
        print_summary(case_results, manifest_path)
        summary = summarize(case_results)
        if preflight["status"] == "fail":
            return 2
        return 1 if summary["fail"] > 0 or summary["investigate"] > 0 else 0

    case_results, manifest_path = run_deterministic()
    print_summary(case_results, manifest_path)
    return 1 if summarize(case_results)["fail"] > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
