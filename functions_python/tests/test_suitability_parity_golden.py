"""REM-1 — Paridad de lógica de suitability contra un golden fijo (sin Firestore).

Pinea el motor canónico: si alguien cambia una regla de elegibilidad, este test
falla y obliga a regenerar el golden conscientemente. El MISMO golden lo consume
el test del frontend (vitest) para garantizar paridad FE/BE donde se espera.
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from services.portfolio.suitability_engine import compute_compatible_profiles  # noqa: E402

_GOLDEN = os.path.join(os.path.dirname(__file__), "fixtures", "suitability_golden.json")
with open(_GOLDEN, encoding="utf-8") as _fh:
    _CASES = json.load(_fh)["cases"]


@pytest.mark.parametrize("case", _CASES, ids=[c["id"] for c in _CASES])
def test_engine_matches_golden(case):
    got = compute_compatible_profiles(case["fund"])
    assert got == case["expected_compatible_profiles"], (
        f"{case['id']}: motor={got} != golden={case['expected_compatible_profiles']}. "
        "Si el cambio de regla es intencional, regenera el golden."
    )
