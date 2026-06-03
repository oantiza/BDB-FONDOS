from typing import Any, Dict, Optional

from models.constraints_v1 import (
    BoundRange,
    BucketBoundsV1,
    ConstructionRulesV1,
    ConstraintFlagsV1,
    LockRulesV1,
    PortfolioConstraintsV1,
    RiskBudgetV1,
    TacticalViewsV1,
    VolBand,
)
import logging
from services.config import CUTOFF_DEFAULT, MAX_WEIGHT_DEFAULT, RISK_TARGETS

_logger = logging.getLogger(__name__)


_MODE_TO_OBJECTIVE = {
    "rebalance_to_profile": "efficient_risk",
    "efficient_risk": "efficient_risk",
    "max_sharpe": "max_sharpe",
    "min_vol": "min_vol",
    "target_return": "target_return",
    "pure_markowitz": "max_sharpe",
}


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        if isinstance(value, str):
            return float(value.strip().replace("%", "").replace(",", "."))
        return float(value)
    except Exception:
        return float(default)


def _as_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        return int(str(value))
    except Exception:
        return None


def _sanitize_01(value: Any) -> float:
    val = _to_float(value, 0.0)
    if val > 1.0:
        val = val / 100.0
    return max(0.0, min(1.0, val))


def _read_bound(raw: Any) -> BoundRange:
    if isinstance(raw, (list, tuple)) and len(raw) >= 2:
        return BoundRange(min=_sanitize_01(raw[0]), max=_sanitize_01(raw[1]))
    if isinstance(raw, dict):
        return BoundRange(
            min=_sanitize_01(raw.get("min")) if raw.get("min") is not None else None,
            max=_sanitize_01(raw.get("max")) if raw.get("max") is not None else None,
        )
    return BoundRange()


def _resolve_bucket_bounds(profile: Dict[str, Any], overrides: Dict[str, Any]) -> BucketBoundsV1:
    # Accept both canonical roots and legacy risk_profiles keys.
    canonical_raw = {}
    if isinstance(profile.get("bucket_bounds"), dict):
        canonical_raw = profile.get("bucket_bounds") or {}

    legacy_raw = profile
    override_raw = overrides.get("bucket_bounds") if isinstance(overrides.get("bucket_bounds"), dict) else {}

    return BucketBoundsV1(
        equity=_read_bound(
            override_raw.get("equity")
            or canonical_raw.get("equity")
            or legacy_raw.get("RV")
            or legacy_raw.get("equity")
        ),
        bond=_read_bound(
            override_raw.get("bond")
            or canonical_raw.get("bond")
            or legacy_raw.get("RF")
            or legacy_raw.get("bond")
        ),
        cash=_read_bound(
            override_raw.get("cash")
            or canonical_raw.get("cash")
            or legacy_raw.get("Monetario")
            or legacy_raw.get("cash")
        ),
        alternative=_read_bound(
            override_raw.get("alternative")
            or canonical_raw.get("alternative")
            or legacy_raw.get("Alternativos")
            or legacy_raw.get("alternative")
        ),
        real_asset=_read_bound(
            override_raw.get("real_asset")
            or canonical_raw.get("real_asset")
            # REM-2: eliminado el lookup de 'Inmobiliario' (clave inexistente en la
            # taxonomía canónica RV/RF/Mixto/Monetario/Alternativos/Otros). Los activos
            # reales se consolidan en 'Alternativos' (D3). Cambio NEUTRO: 'Inmobiliario'
            # siempre devolvía None, así que el resultado del 'or' no varía.
            or legacy_raw.get("real_asset")
        ),
        other=_read_bound(
            override_raw.get("other")
            or canonical_raw.get("other")
            or legacy_raw.get("Otros")
            or legacy_raw.get("other")
        ),
    )


def _resolve_locks(locked_positions: Any, overrides: Dict[str, Any]) -> LockRulesV1:
    mode = "keep_weight"
    positions = {}

    if isinstance(locked_positions, dict):
        mode = str(locked_positions.get("mode") or mode)
        raw_positions = locked_positions.get("positions", {})
        if isinstance(raw_positions, dict):
            positions = {str(k): _sanitize_01(v) for k, v in raw_positions.items()}

    # Legacy compatibility path.
    if not positions and isinstance(overrides.get("fixed_weights"), dict):
        positions = {str(k): _sanitize_01(v) for k, v in (overrides.get("fixed_weights") or {}).items()}
    if mode == "keep_weight" and overrides.get("lock_mode"):
        mode = str(overrides.get("lock_mode"))

    if mode not in {"keep_weight", "keep_money", "min_keep", "free"}:
        mode = "keep_weight"

    return LockRulesV1(mode=mode, positions=positions)


def _resolve_risk_budget(
    profile: Dict[str, Any],
    overrides: Dict[str, Any],
    profile_id: str,
    objective: str,
) -> RiskBudgetV1:
    profile_target_vol = profile.get("target_vol")
    override_target_vol = overrides.get("target_vol")
    profile_id_i = _as_int(profile_id)
    seed_target_vol = RISK_TARGETS.get(profile_id_i, RISK_TARGETS.get(5, 0.105))

    target_vol = _to_float(
        override_target_vol if override_target_vol is not None else (
            profile_target_vol if profile_target_vol is not None else seed_target_vol
        ),
        seed_target_vol,
    )
    target_vol = max(0.0, min(1.0, target_vol))

    raw_vol_band = (
        overrides.get("vol_band")
        or profile.get("vol_band")
        or {
            "min": max(0.0, target_vol - 0.02),
            "max": min(1.0, target_vol + 0.02),
        }
    )
    vol_band_bound = _read_bound(raw_vol_band)
    vol_band = VolBand(min=vol_band_bound.min, max=vol_band_bound.max)

    target_return = None
    if objective == "target_return":
        raw_tr = overrides.get("target_return", profile.get("target_return"))
        if raw_tr is not None:
            target_return = _to_float(raw_tr, 0.0)

    return RiskBudgetV1(target_vol=target_vol, vol_band=vol_band, target_return=target_return)


def build_constraints_v1(
    profile: Optional[Dict[str, Any]],
    optimization_mode: Optional[str],
    locked_positions: Optional[Dict[str, Any]],
    tactical_views: Optional[Dict[str, Any]],
    overrides: Optional[Dict[str, Any]] = None,
) -> PortfolioConstraintsV1:
    profile = profile or {}
    overrides = overrides or {}

    profile_id = str(
        overrides.get("profile_id")
        or profile.get("profile_id")
        or profile.get("id")
        or profile.get("risk_level")
        or "5"
    )
    optimization_mode = str(
        optimization_mode
        or overrides.get("optimization_mode")
        or "rebalance_to_profile"
    )
    objective = str(overrides.get("objective") or _MODE_TO_OBJECTIVE.get(optimization_mode, "efficient_risk"))
    if objective not in {"efficient_risk", "max_sharpe", "min_vol", "target_return"}:
        objective = "efficient_risk"

    # Perfiles agresivos (8-10): target_vol es inalcanzable con max_weight=20%
    # y diversificación forzada. Usar max_sharpe maximiza retorno respetando
    # las bandas de asset allocation del perfil sin exigir vol exacta.
    profile_id_i = _as_int(profile_id)
    if profile_id_i is not None and profile_id_i >= 8 and objective == "efficient_risk":
        _logger.info(
            f"⚠️ Perfil agresivo ({profile_id}): usando max_sharpe en vez de "
            f"efficient_risk para evitar target_vol inalcanzable."
        )
        objective = "max_sharpe"

    risk_budget = _resolve_risk_budget(profile, overrides, profile_id, objective)
    bucket_bounds = _resolve_bucket_bounds(profile, overrides)
    locks = _resolve_locks(locked_positions, overrides)

    construction = ConstructionRulesV1(
        min_weight=_sanitize_01(overrides.get("min_weight", profile.get("min_weight", 0.0))),
        max_weight=_sanitize_01(overrides.get("max_weight", profile.get("max_weight", MAX_WEIGHT_DEFAULT))),
        cutoff=_sanitize_01(overrides.get("cutoff", profile.get("cutoff", CUTOFF_DEFAULT))),
    )

    views = TacticalViewsV1(
        by_isin={
            str(k): float(v)
            for k, v in (tactical_views or {}).items()
            if isinstance(k, str) and k and isinstance(v, (int, float))
        }
    )

    flags = ConstraintFlagsV1(
        apply_profile=bool(overrides.get("apply_profile", True)),
        strict_feasibility=bool(overrides.get("strict_feasibility", True)),
    )

    return PortfolioConstraintsV1(
        version="1.0",
        profile_id=profile_id,
        optimization_mode=optimization_mode,
        objective=objective,
        risk_budget=risk_budget,
        bucket_bounds=bucket_bounds,
        construction=construction,
        locks=locks,
        views=views,
        flags=flags,
    )
