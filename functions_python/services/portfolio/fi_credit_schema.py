"""Validation helpers for canonical fixed-income credit exposure data."""

from __future__ import annotations

from math import isfinite
from typing import Any


FI_CREDIT_BOND_BUCKET_SCALE = "percent_of_bond_bucket"
FI_CREDIT_TOTAL_PORTFOLIO_SCALE = "percent_of_total_portfolio"
FI_CREDIT_ALLOWED_SCALES = frozenset({
    FI_CREDIT_BOND_BUCKET_SCALE,
    FI_CREDIT_TOTAL_PORTFOLIO_SCALE,
})

_BREAKDOWN_BANDS = ("AAA", "AA", "A", "BBB", "BB", "B", "below_B", "not_rated")
_LOW_QUALITY_BANDS = ("BB", "B", "below_B")
_BREAKDOWN_TOTAL_TOLERANCE = 0.5
_LOW_QUALITY_TOLERANCE = 0.2


def _finite_number(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    parsed = float(value)
    return parsed if isfinite(parsed) else None


def validate_fi_credit(fi_credit: Any) -> list[str]:
    """Return stable error codes for a canonical ``fi_credit`` document.

    ``as_of=None`` is valid because the current Morningstar source does not
    always expose the underlying data date. Consumers may surface staleness
    separately, but absence of the field remains a schema error.
    """

    if not isinstance(fi_credit, dict):
        return ["fi_credit_not_object"]

    errors: list[str] = []

    source = fi_credit.get("source")
    if not isinstance(source, str) or not source.strip():
        errors.append("missing_source")

    if "as_of" not in fi_credit:
        errors.append("missing_as_of")

    if "scale" not in fi_credit:
        errors.append("missing_scale")
    elif fi_credit.get("scale") not in FI_CREDIT_ALLOWED_SCALES:
        errors.append("invalid_scale")

    coverage = _finite_number(fi_credit.get("coverage"))
    if coverage is None or not 0.0 < coverage <= 1.0:
        errors.append("invalid_coverage")

    breakdown = fi_credit.get("breakdown")
    if not isinstance(breakdown, dict):
        errors.append("breakdown_not_object")
        return errors

    missing_bands = [band for band in _BREAKDOWN_BANDS if band not in breakdown]
    if missing_bands:
        errors.append("missing_breakdown_band")

    parsed_breakdown: dict[str, float] = {}
    for band in _BREAKDOWN_BANDS:
        if band not in breakdown:
            continue
        value = _finite_number(breakdown[band])
        if value is None or not 0.0 <= value <= 100.0:
            errors.append("breakdown_value_invalid")
            break
        parsed_breakdown[band] = value

    if len(parsed_breakdown) == len(_BREAKDOWN_BANDS):
        total = sum(parsed_breakdown.values())
        if total > 100.0 + _BREAKDOWN_TOTAL_TOLERANCE:
            errors.append("breakdown_total_exceeds_100")

    low_quality = _finite_number(fi_credit.get("low_quality"))
    if low_quality is None or not 0.0 <= low_quality <= 100.0:
        errors.append("invalid_low_quality")
    elif all(band in parsed_breakdown for band in _LOW_QUALITY_BANDS):
        derived_low_quality = sum(parsed_breakdown[band] for band in _LOW_QUALITY_BANDS)
        if abs(low_quality - derived_low_quality) > _LOW_QUALITY_TOLERANCE:
            errors.append("low_quality_mismatch")

    return errors
