"""REM-2 — Tests de la fusión narrowing-only (ligero, sin stack pesado)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from services.portfolio.bounds_resolver import (  # noqa: E402
    resolve_effective_bounds,
    ConstraintError,
)

PROFILE = {"RV": {"min": 0.40, "max": 0.60}, "RF": {"min": 0.20, "max": 0.40}}


def test_no_override_keeps_profile():
    eff, ignored = resolve_effective_bounds(PROFILE, {})
    assert eff["RV"] == {"min": 0.40, "max": 0.60}
    assert ignored == []


def test_narrowing_min_wins():
    eff, ignored = resolve_effective_bounds(PROFILE, {"RV": {"min": 0.50}})
    assert eff["RV"]["min"] == 0.50 and eff["RV"]["max"] == 0.60
    assert ignored == []


def test_narrowing_max_wins():
    eff, ignored = resolve_effective_bounds(PROFILE, {"RV": {"max": 0.55}})
    assert eff["RV"]["max"] == 0.55
    assert ignored == []


def test_widening_min_is_ignored_and_reported():
    eff, ignored = resolve_effective_bounds(PROFILE, {"RV": {"min": 0.20}})
    assert eff["RV"]["min"] == 0.40  # no se rebaja el suelo
    assert any(i["bucket"] == "RV" and i["field"] == "min" for i in ignored)


def test_widening_max_is_ignored_and_reported():
    eff, ignored = resolve_effective_bounds(PROFILE, {"RV": {"max": 0.90}})
    assert eff["RV"]["max"] == 0.60  # no se sube el techo
    assert any(i["bucket"] == "RV" and i["field"] == "max" for i in ignored)


def test_contradiction_raises():
    # Estrechar el suelo por encima del techo del perfil -> contradicción.
    with pytest.raises(ConstraintError):
        resolve_effective_bounds(PROFILE, {"RV": {"min": 0.70}})


def test_percent_inputs_are_sanitized():
    eff, _ = resolve_effective_bounds({"RV": [40, 60]}, {"RV": {"min": 50}})
    assert eff["RV"]["min"] == 0.50 and eff["RV"]["max"] == 0.60


def test_override_on_unbounded_bucket_applies():
    # El perfil no acota 'Alternativos' (implícito 0..1); el override lo estrecha.
    eff, ignored = resolve_effective_bounds(PROFILE, {"Alternativos": {"max": 0.10}})
    assert eff["Alternativos"]["max"] == 0.10
    assert ignored == []
