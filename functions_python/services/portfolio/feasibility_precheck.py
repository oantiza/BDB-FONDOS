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
        # FIX H9: la ruta legacy usa claves canonicas en los bounds del perfil.
        "RV": "Renta Variable",
        "RF": "Renta Fija",
        "Monetario": "Monetario",
        "Alternativos": "Alternativos",
        "Otros": "Otros",
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


def _maximum_achievable_exposure(
    universe: List[str],
    exposure_vector: np.ndarray,
    max_weight: float,
    min_weight: float,
    fixed_weights: Dict[str, float],
    lock_mode: str,
) -> Optional[dict]:
    """Return the exact single-bucket maximum under weight bounds and locks."""
    n_assets = len(universe or [])
    try:
        vector = np.asarray(exposure_vector, dtype=float)
    except Exception:
        return None
    if len(vector) != n_assets or not np.all(np.isfinite(vector)):
        return None

    # Negative exposures cannot improve a minimum. Preserve values above 1.0 so
    # the precheck never understates what the solver could achieve with the same data.
    vector = np.maximum(vector, 0.0)
    max_weight = max(0.0, float(max_weight))
    min_weight = max(0.0, min(float(min_weight or 0.0), max_weight))
    lower = np.full(n_assets, min_weight, dtype=float)
    upper = np.full(n_assets, max_weight, dtype=float)
    isin_to_idx = {isin: idx for idx, isin in enumerate(universe)}

    if lock_mode in ("keep_weight", "keep_money", "min_keep"):
        for isin, raw_weight in (fixed_weights or {}).items():
            idx = isin_to_idx.get(isin)
            if idx is None:
                continue
            locked_weight = max(0.0, min(1.0, float(raw_weight)))
            if lock_mode in ("keep_weight", "keep_money"):
                lower[idx] = locked_weight
                upper[idx] = locked_weight
            else:
                lower[idx] = max(lower[idx], locked_weight)
                upper[idx] = max(upper[idx], lower[idx])

    base_weight = float(np.sum(lower))
    base_exposure = float(lower @ vector)
    remaining_budget = max(0.0, 1.0 - base_weight)
    capacities = np.maximum(0.0, upper - lower)

    added_exposure = 0.0
    allocated_budget = 0.0
    for idx in np.argsort(-vector):
        allocation = min(float(capacities[idx]), remaining_budget)
        if allocation <= 1e-9:
            continue
        added_exposure += allocation * float(vector[idx])
        allocated_budget += allocation
        remaining_budget -= allocation
        if remaining_budget <= 1e-9:
            break

    return {
        "max_achievable_exposure": base_exposure + added_exposure,
        "base_weight": base_weight,
        "base_exposure": base_exposure,
        "allocated_budget": allocated_budget,
        "unallocated_budget": remaining_budget,
    }


def _check_bucket_min_attainable(
    universe: List[str],
    active_bounds: Dict[str, Any],
    exposure_vectors: Dict[str, np.ndarray],
    fixed_weights: Dict[str, float],
    lock_mode: str,
    max_weight: float,
    min_weight: float,
    _read_bound_fn,
) -> Optional[dict]:
    """BLOCK-9: A bucket minimum exceeds its best-case attainable exposure."""
    bucket_labels = {
        "equity": "Renta Variable",
        "bond": "Renta Fija",
        "cash": "Monetario",
        "alternative": "Alternativos",
        "real_asset": "Activos Reales",
        "other": "Otros",
        "RV": "Renta Variable",
        "RF": "Renta Fija",
        "Monetario": "Monetario",
        "Alternativos": "Alternativos",
        "Otros": "Otros",
    }
    for bucket_key, raw in active_bounds.items():
        b_min, _ = _read_bound_fn(raw)
        if b_min is None or b_min <= 1e-6:
            continue
        vec = exposure_vectors.get(bucket_key)
        if vec is None:
            continue
        try:
            if len(vec) != len(universe) or np.max(vec) < 1e-6:
                continue
        except Exception:
            continue

        attainable = _maximum_achievable_exposure(
            universe,
            vec,
            max_weight,
            min_weight,
            fixed_weights,
            lock_mode,
        )
        if not attainable:
            continue
        max_exposure = float(attainable["max_achievable_exposure"])
        if max_exposure < b_min - 1e-4:
            label = bucket_labels.get(bucket_key, bucket_key)
            return _issue(
                "BLOCK_BUCKET_MIN_UNATTAINABLE",
                "block",
                f"El universo solo puede alcanzar un {max_exposure*100:.1f}% de {label}, "
                f"pero el perfil exige al menos un {b_min*100:.1f}%. "
                f"Añada fondos con exposición a {label} o revise los límites.",
                {
                    "bucket": bucket_key,
                    "label": label,
                    "required_min": round(b_min, 4),
                    "max_achievable_exposure": round(max_exposure, 4),
                    "max_weight": round(float(max_weight), 4),
                    "min_weight": round(float(min_weight or 0.0), 4),
                    "lock_mode": lock_mode,
                    "base_weight": round(float(attainable["base_weight"]), 4),
                    "base_exposure": round(float(attainable["base_exposure"]), 4),
                    "unallocated_budget": round(float(attainable["unallocated_budget"]), 4),
                },
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
        "other": "Otros",
        # FIX H9: la ruta legacy usa claves canonicas en los bounds del perfil.
        "RV": "Renta Variable",
        "RF": "Renta Fija",
        "Monetario": "Monetario",
        "Alternativos": "Alternativos",
        "Otros": "Otros",
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
        locked_contributions = {}
        for isin, fw in fixed_weights.items():
            idx = isin_to_idx.get(isin)
            if idx is None or idx >= len(vec):
                continue

            locked_weight = max(0.0, float(fw))
            bucket_exposure = float(vec[idx])
            if not math.isfinite(bucket_exposure) or bucket_exposure <= 0.0:
                continue

            contribution = locked_weight * bucket_exposure
            locked_in_bucket += contribution
            locked_contributions[isin] = {
                "locked_weight": round(locked_weight, 4),
                "bucket_exposure": round(bucket_exposure, 4),
                "contribution": round(contribution, 4),
            }

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
                    "locked_contributions": locked_contributions,
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


def _check_locks_incompatible_equity_floor(
    universe: List[str],
    exposure_vectors: Dict[str, np.ndarray],
    fixed_weights: Dict[str, float],
    lock_mode: str,
    equity_floor: Optional[float],
    max_weight: float,
) -> Optional[dict]:
    """BLOCK-8: Locked non-equity positions make equity_floor unreachable.

    Covers GAP-H2 from precheck audit. Approved in P1 (equity_floor HARD).
    Calculates the maximum achievable equity considering:
    - Equity already guaranteed by locked positions
    - Best-case equity from free budget (greedy allocation)
    lock_mode='free' is excluded (P4).
    Tolerance: 1e-4 (business-level, per approved decision).
    """
    if equity_floor is None or equity_floor <= 0:
        return None
    if lock_mode not in ("keep_weight", "keep_money", "min_keep"):
        return None
    if not fixed_weights:
        return None

    eq_vec = exposure_vectors.get("RV")
    if eq_vec is None:
        eq_vec = exposure_vectors.get("equity")
    if eq_vec is None:
        return None

    # Budget consumed by locks
    total_locked = sum(max(0.0, float(v)) for v in fixed_weights.values())

    # Equity already guaranteed by locked positions
    isin_to_idx = {isin: i for i, isin in enumerate(universe)}
    locked_equity = 0.0
    for isin, fw in fixed_weights.items():
        idx = isin_to_idx.get(isin)
        if idx is not None and idx < len(eq_vec):
            locked_equity += max(0.0, float(fw)) * eq_vec[idx]

    # Maximum additional equity from free budget
    free_budget = max(0.0, 1.0 - total_locked)

    # Best-case: allocate free budget to highest-equity assets first
    locked_isins = set(fixed_weights.keys())
    free_eq_exposures = []
    for i, isin in enumerate(universe):
        if isin not in locked_isins and i < len(eq_vec):
            free_eq_exposures.append(eq_vec[i])
    free_eq_exposures.sort(reverse=True)

    remaining = free_budget
    additional_equity = 0.0
    for eq_exp in free_eq_exposures:
        alloc = min(max_weight, remaining)
        if alloc <= 1e-6:
            break
        additional_equity += alloc * eq_exp
        remaining -= alloc

    max_achievable_equity = locked_equity + additional_equity

    if max_achievable_equity < equity_floor - 1e-4:
        return _issue(
            "BLOCK_LOCKS_INCOMPATIBLE_EQUITY_FLOOR",
            "block",
            f"Las posiciones bloqueadas limitan la renta variable alcanzable "
            f"al {max_achievable_equity*100:.1f}%, pero el perfil requiere "
            f"al menos {equity_floor*100:.1f}%.",
            {
                "max_achievable_equity": round(max_achievable_equity, 4),
                "equity_floor": round(equity_floor, 4),
                "locked_equity": round(locked_equity, 4),
                "free_budget": round(free_budget, 4),
                "total_locked": round(total_locked, 4),
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
    equity_floor: Optional[float] = None,
    min_weight: float = 0.0,
) -> dict:
    """
    Run Phase 1 feasibility pre-checks before invoking the solver.

    Args:
        universe: List of ISINs surviving data & suitability filters.
        max_weight: Maximum weight per asset (0..1).
        min_weight: Minimum weight per asset (0..1).
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

        # BLOCK-9: Bucket minimum exists but cannot be reached under weight bounds/locks
        issue = _check_bucket_min_attainable(
            universe,
            active_bounds,
            exposure_vectors,
            fixed_weights,
            lock_mode,
            max_weight,
            min_weight,
            _read_bound_fn,
        )
        if issue:
            blocks.append(issue)

        # BLOCK-7: Locks incompatible with bucket bounds (GAP-H1)
        issue = _check_locks_incompatible_bucket(
            universe, active_bounds, exposure_vectors,
            fixed_weights, lock_mode, _read_bound_fn,
        )
        if issue:
            blocks.append(issue)

    # BLOCK-8: Locks incompatible with equity_floor (GAP-H2)
    issue = _check_locks_incompatible_equity_floor(
        universe, exposure_vectors, fixed_weights,
        lock_mode, equity_floor, max_weight,
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
