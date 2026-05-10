"""
Feasibility Pre-Check — Phase 1 (BLOCK validations).

Pure, deterministic, I/O-free module that detects mathematically impossible
constraint configurations BEFORE invoking PyPortfolioOpt / CVXPY.

Architecture role:
- Lives at the same level as suitability_engine.py (pre-solver filter).
- Receives only numpy arrays, dicts, and scalars — NO database, NO Firebase.
- Returns a structured result with blocking reasons, warnings, and info.
"""

import math
import logging
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


# =========================================================================
# OUTPUT CONTRACT
# =========================================================================

def _issue(code: str, severity: str, message_es: str, details: dict = None) -> dict:
    return {
        "code": code,
        "severity": severity,
        "message": message_es,
        "details": details or {},
    }


# =========================================================================
# INDIVIDUAL BLOCK CHECKS
# =========================================================================

def _check_empty_universe(universe: list) -> Optional[dict]:
    """BLOCK-5: Universe is empty after all filters."""
    if not universe or len(universe) == 0:
        return _issue(
            "BLOCK_EMPTY_UNIVERSE",
            "block",
            "No quedan fondos válidos tras aplicar los filtros de idoneidad e historial.",
            {"universe_size": 0},
        )
    return None


def _check_universe_too_small(universe: list, max_weight: float) -> Optional[dict]:
    """BLOCK-1: Not enough assets for sum-to-1 with max_weight cap."""
    n = len(universe)
    if n == 0:
        return None  # Already caught by BLOCK-5
    if max_weight <= 0:
        return None  # Degenerate; let solver handle
    min_needed = math.ceil(1.0 / max_weight)
    max_total = n * max_weight
    if max_total < 1.0 - 1e-6:
        return _issue(
            "BLOCK_UNIVERSE_TOO_SMALL",
            "block",
            f"El universo seleccionado ({n} fondos) no es suficiente para respetar "
            f"el peso máximo por activo ({max_weight*100:.0f}%). "
            f"Se necesitan al menos {min_needed} fondos.",
            {"n_assets": n, "max_weight": max_weight, "min_needed": min_needed,
             "max_achievable_total": round(max_total, 4)},
        )
    return None


def _check_bucket_mins_exceed_100(
    active_bounds: Dict[str, Any],
    _read_bound_fn,
) -> Optional[dict]:
    """BLOCK-2: Sum of bucket minimums exceeds 100%."""
    sum_mins = 0.0
    details = {}
    for bucket_key, raw in active_bounds.items():
        b_min, _ = _read_bound_fn(raw)
        if b_min is not None and b_min > 1e-6:
            sum_mins += b_min
            details[bucket_key] = {"min": round(b_min, 4)}
    if sum_mins > 1.0 + 1e-6:
        return _issue(
            "BLOCK_BUCKET_MINS_EXCEED_100",
            "block",
            f"Las restricciones mínimas por clase de activo suman "
            f"{sum_mins*100:.1f}%, superando el 100% del capital. "
            f"Revise los límites del perfil.",
            {"sum_mins": round(sum_mins, 4), "buckets": details},
        )
    return None


def _check_bucket_maxs_below_100(
    active_bounds: Dict[str, Any],
    _read_bound_fn,
) -> Optional[dict]:
    """BLOCK-3: Sum of bucket maximums is below 100%."""
    sum_maxs = 0.0
    all_have_max = True
    details = {}
    for bucket_key, raw in active_bounds.items():
        _, b_max = _read_bound_fn(raw)
        if b_max is not None:
            sum_maxs += b_max
            details[bucket_key] = {"max": round(b_max, 4)}
        else:
            all_have_max = False
    # Only block if ALL buckets have explicit maxes and they sum < 1.0
    if all_have_max and len(active_bounds) > 0 and sum_maxs < 1.0 - 1e-6:
        return _issue(
            "BLOCK_BUCKET_MAXS_BELOW_100",
            "block",
            f"Los máximos permitidos por clase de activo suman solo "
            f"{sum_maxs*100:.1f}%, impidiendo asignar todo el capital.",
            {"sum_maxs": round(sum_maxs, 4), "buckets": details},
        )
    return None


def _check_fixed_weights_exceed_100(
    fixed_weights: Dict[str, float],
    lock_mode: str,
) -> Optional[dict]:
    """BLOCK-4: Locked/fixed positions consume more than 100% of budget."""
    if lock_mode not in ("keep_weight", "keep_money", "min_keep"):
        return None
    if not fixed_weights:
        return None
    total_fixed = sum(max(0.0, float(v)) for v in fixed_weights.values())
    if total_fixed > 1.0 + 1e-6:
        return _issue(
            "BLOCK_FIXED_WEIGHTS_EXCEED_100",
            "block",
            f"Las posiciones bloqueadas consumen el {total_fixed*100:.1f}% "
            f"del capital. No queda presupuesto para optimizar.",
            {"total_fixed": round(total_fixed, 4),
             "positions": {k: round(float(v), 4) for k, v in fixed_weights.items()}},
        )
    return None


def _check_bucket_not_representable(
    active_bounds: Dict[str, Any],
    exposure_vectors: Dict[str, np.ndarray],
    _read_bound_fn,
) -> Optional[dict]:
    """BLOCK-6: A bucket has a minimum requirement but no asset provides exposure."""
    bucket_labels = {
        "equity": "Renta Variable",
        "bond": "Renta Fija",
        "cash": "Monetario",
        "alternative": "Alternativos",
        "real_asset": "Activos Reales",
        "other": "Otros",
    }
    for bucket_key, raw in active_bounds.items():
        b_min, _ = _read_bound_fn(raw)
        if b_min is not None and b_min > 1e-6:
            vec = exposure_vectors.get(bucket_key)
            if vec is not None and np.max(vec) < 1e-6:
                label = bucket_labels.get(bucket_key, bucket_key)
                return _issue(
                    "BLOCK_BUCKET_NOT_REPRESENTABLE",
                    "block",
                    f"Existe un mínimo exigido ({b_min*100:.0f}%) para {label}, "
                    f"pero ningún fondo seleccionado aporta exposición a {label}.",
                    {"bucket": bucket_key, "label": label,
                     "required_min": round(b_min, 4),
                     "max_exposure_in_universe": 0.0},
                )
    return None


# =========================================================================
# LOCK COMPATIBILITY CHECKS (Phase 1.5 — approved P2/P3/P5)
# =========================================================================

def _check_locks_incompatible_bucket(
    universe: List[str],
    active_bounds: Dict[str, Any],
    exposure_vectors: Dict[str, np.ndarray],
    fixed_weights: Dict[str, float],
    lock_mode: str,
    _read_bound_fn,
) -> Optional[dict]:
    """BLOCK-7: Locked weights in a bucket exceed the bucket's maximum.

    Covers GAP-H1 from precheck audit. Approved in P2 (keep_weight),
    P3 (min_keep), P5 (effective bounds + Mixto).
    lock_mode='free' is excluded (P4).
    Tolerance: 1e-4 (business-level, per approved decision).
    """
    if lock_mode not in ("keep_weight", "keep_money", "min_keep"):
        return None
    if not fixed_weights or not active_bounds:
        return None

    bucket_labels = {
        "equity": "Renta Variable",
        "bond": "Renta Fija",
        "cash": "Monetario",
        "alternative": "Alternativos",
        "real_asset": "Activos Reales",
        "mixto": "Mixto",
        "other": "Otros",
    }

    isin_to_idx = {isin: i for i, isin in enumerate(universe)}

    for bucket_key, raw in active_bounds.items():
        _, b_max = _read_bound_fn(raw)
        if b_max is None:
            continue

        vec = exposure_vectors.get(bucket_key)
        if vec is None:
            continue

        locked_in_bucket = 0.0
        for isin, fw in fixed_weights.items():
            idx = isin_to_idx.get(isin)
            if idx is not None and idx < len(vec) and vec[idx] > 0.5:
                locked_in_bucket += max(0.0, float(fw))

        if locked_in_bucket > b_max + 1e-4:
            label = bucket_labels.get(bucket_key, bucket_key)
            return _issue(
                "BLOCK_LOCKS_INCOMPATIBLE_BUCKET",
                "block",
                f"Las posiciones bloqueadas ({locked_in_bucket*100:.1f}% en {label}) "
                f"superan el máximo permitido ({b_max*100:.1f}%) para ese tipo de activo. "
                f"Desbloquee o reduzca las posiciones en {label} para poder optimizar.",
                {
                    "bucket": bucket_key,
                    "label": label,
                    "locked_sum": round(locked_in_bucket, 4),
                    "bucket_max": round(b_max, 4),
                },
            )

    return None


def _check_locks_high_concentration(
    fixed_weights: Dict[str, float],
    lock_mode: str,
) -> Optional[dict]:
    """WARNING: More than 60% of capital is locked.

    Approved in P3 (min_keep) and semantic decision doc.
    Threshold: 60% (approved by user).
    lock_mode='free' is excluded (P4).
    """
    if lock_mode not in ("keep_weight", "keep_money", "min_keep"):
        return None
    if not fixed_weights:
        return None

    total_locked = sum(max(0.0, float(v)) for v in fixed_weights.values())
    if total_locked > 0.60 + 1e-4:
        free_pct = (1.0 - total_locked) * 100
        return _issue(
            "WARNING_LOCKS_HIGH_CONCENTRATION",
            "warning",
            f"Tiene el {total_locked*100:.1f}% del capital bloqueado. "
            f"El optimizador solo puede actuar sobre el {free_pct:.1f}% restante, "
            f"lo que puede limitar la diversificación.",
            {
                "total_locked": round(total_locked, 4),
                "free_budget": round(1.0 - total_locked, 4),
            },
        )

    return None


# =========================================================================
# MAIN PUBLIC API
# =========================================================================

def run_feasibility_precheck(
    universe: List[str],
    max_weight: float,
    active_bounds: Dict[str, Any],
    exposure_vectors: Dict[str, np.ndarray],
    fixed_weights: Dict[str, float],
    lock_mode: str,
    _read_bound_fn,
) -> dict:
    """
    Run Phase 1 feasibility pre-checks before invoking the solver.

    Args:
        universe: List of ISINs surviving data & suitability filters.
        max_weight: Maximum weight per asset (0..1).
        active_bounds: The effective bucket bounds dict (v1 or legacy).
            Keys are bucket names ("equity", "bond", etc.) with values
            being dicts {"min": float, "max": float} or tuples.
        exposure_vectors: Dict mapping bucket key to np.ndarray of
            per-asset exposures (same order as universe).
        fixed_weights: Dict of locked asset ISINs to their fixed weights.
        lock_mode: Lock mode string ("keep_weight", "free", etc.).
        _read_bound_fn: Callable that parses a raw bound value into
            (min_val, max_val) tuple. Injected to avoid duplicating
            parsing logic.

    Returns:
        dict with keys:
            is_feasible: bool — True if no BLOCK issues found.
            blocks: list[dict] — Fatal issues.
            warnings: list[dict] — High risk (Phase 2).
            info: list[dict] — Transparency (Phase 2).
    """
    blocks = []
    warnings = []
    info = []

    # BLOCK-5: Empty universe
    issue = _check_empty_universe(universe)
    if issue:
        blocks.append(issue)
        # No point checking further
        return {"is_feasible": False, "blocks": blocks, "warnings": warnings, "info": info}

    # BLOCK-1: Universe too small for max_weight
    issue = _check_universe_too_small(universe, max_weight)
    if issue:
        blocks.append(issue)

    # BLOCK-4: Fixed weights exceed 100%
    issue = _check_fixed_weights_exceed_100(fixed_weights, lock_mode)
    if issue:
        blocks.append(issue)

    # BLOCK-2: Bucket mins exceed 100%
    if active_bounds:
        issue = _check_bucket_mins_exceed_100(active_bounds, _read_bound_fn)
        if issue:
            blocks.append(issue)

        # BLOCK-3: Bucket maxs below 100%
        issue = _check_bucket_maxs_below_100(active_bounds, _read_bound_fn)
        if issue:
            blocks.append(issue)

        # BLOCK-6: Bucket not representable
        issue = _check_bucket_not_representable(active_bounds, exposure_vectors, _read_bound_fn)
        if issue:
            blocks.append(issue)

        # BLOCK-7: Locks incompatible with bucket bounds (GAP-H1)
        issue = _check_locks_incompatible_bucket(
            universe, active_bounds, exposure_vectors,
            fixed_weights, lock_mode, _read_bound_fn,
        )
        if issue:
            blocks.append(issue)

    # --- WARNINGS (non-blocking) ---
    issue = _check_locks_high_concentration(fixed_weights, lock_mode)
    if issue:
        warnings.append(issue)

    is_feasible = len(blocks) == 0

    if blocks:
        logger.info(
            f"🛑 [FeasibilityPrecheck] {len(blocks)} blocking issue(s) detected: "
            f"{[b['code'] for b in blocks]}"
        )
    else:
        logger.info("✅ [FeasibilityPrecheck] All Phase 1 checks passed.")
    if warnings:
        logger.info(
            f"⚠️ [FeasibilityPrecheck] {len(warnings)} warning(s): "
            f"{[w['code'] for w in warnings]}"
        )

    return {
        "is_feasible": is_feasible,
        "blocks": blocks,
        "warnings": warnings,
        "info": info,
    }
