"""Non-blocking warnings derived from canonical fixed-income credit data."""

from __future__ import annotations

from math import isfinite
from typing import Any

from services.portfolio.fi_credit_schema import (
    FI_CREDIT_BOND_BUCKET_SCALE,
    validate_fi_credit,
)
from services.portfolio.utils import get_effective_asset_mix


FI_CREDIT_SCALE = FI_CREDIT_BOND_BUCKET_SCALE
FI_CREDIT_MIN_COVERAGE = 0.8


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if isfinite(parsed) else default


def _canonical_fi_credit(fund_data: dict[str, Any]) -> dict[str, Any] | None:
    exposure = (fund_data or {}).get("portfolio_exposure_v2", {}) or {}
    for field in ("fi_credit", "credit"):
        fi_credit = exposure.get(field)
        if isinstance(fi_credit, dict):
            return fi_credit
    return None


def _resolve_bond_weight(fund_data: dict[str, Any], bond_weight: float | None) -> float:
    if bond_weight is not None:
        return min(100.0, max(0.0, _to_float(bond_weight)))

    mix = get_effective_asset_mix(fund_data, as_percent=True)
    return min(100.0, max(0.0, _to_float(mix.get("bond"))))


def compute_fi_credit_warnings(
    fund_data: dict[str, Any],
    *,
    bond_weight: float | None = None,
) -> list[dict[str, Any]]:
    """Return advisory FI-credit warnings without changing suitability.

    The function is intentionally pure and never blocks, mutates
    ``compatible_profiles``, or persists data. Consumers decide if and where to
    display the returned warnings.
    """

    fi_credit = _canonical_fi_credit(fund_data)
    if not fi_credit or validate_fi_credit(fi_credit):
        return []
    if fi_credit.get("scale") != FI_CREDIT_SCALE:
        return []

    coverage = _to_float(fi_credit.get("coverage"))
    if coverage < FI_CREDIT_MIN_COVERAGE:
        return []

    low_quality = _to_float(fi_credit.get("low_quality"))
    if low_quality < 25.0:
        return []

    not_rated = _to_float(fi_credit.get("not_rated"))
    resolved_bond_weight = _resolve_bond_weight(fund_data, bond_weight)
    low_quality_total = round(low_quality * resolved_bond_weight / 100.0, 2)

    if low_quality < 35.0:
        severity = "INFO"
        code = "FI_CREDIT_LOW_QUALITY_OVER_25_BOND_BUCKET"
    elif low_quality < 70.0:
        severity = "WARNING"
        code = "FI_CREDIT_LOW_QUALITY_OVER_35_BOND_BUCKET"
    else:
        severity = "REVIEW"
        code = "FI_CREDIT_LOW_QUALITY_OVER_70_BOND_BUCKET"

    return [{
        "code": code,
        "severity": severity,
        "blocking": False,
        "low_quality": low_quality,
        "not_rated": not_rated,
        "scale": FI_CREDIT_SCALE,
        "bond_weight": resolved_bond_weight,
        "low_quality_total_portfolio_estimate": low_quality_total,
        "source": fi_credit["source"],
        "as_of": fi_credit.get("as_of"),
        "coverage": coverage,
        "message_advisor": (
            "Este fondo presenta una proporcion relevante de credito sub-investment grade "
            "dentro de su cartera de renta fija. No implica bloqueo automatico, pero "
            "requiere revision de idoneidad, duracion, volatilidad y objetivo del cliente."
        ),
        "message_client": (
            "El fondo incorpora exposicion significativa a credito de menor calidad "
            "crediticia. Puede aumentar la sensibilidad a ampliaciones de diferenciales "
            "y episodios de estres de mercado."
        ),
        "message_technical": (
            f"low_quality={low_quality:.1f}% = BB + B + below_B ({FI_CREDIT_SCALE}). "
            f"not_rated={not_rated:.1f}% tratado separadamente. "
            f"low_quality_total_portfolio_estimate={low_quality_total:.1f}% "
            f"(bond_weight={resolved_bond_weight:.1f}%)."
        ),
    }]
