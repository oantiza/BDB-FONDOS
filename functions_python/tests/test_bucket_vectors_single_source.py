"""REM-2 — El mapeo bucket->vector tiene una única definición (ligero)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np  # noqa: E402
from services.config import RISK_BUCKETS_LABELS  # noqa: E402
from services.portfolio.bounds_resolver import build_bucket_vectors  # noqa: E402


def test_keys_are_canonical_without_mixto():
    z = np.zeros(3)
    vecs = build_bucket_vectors(z, z, z, z, z, z)
    assert set(vecs.keys()) == {"RV", "RF", "Monetario", "Alternativos", "Otros"}
    assert "Mixto" not in vecs  # D1a: Mixto via look-through, no es cota


def test_seed_profile_bounds_exclude_mixto():
    for profile in RISK_BUCKETS_LABELS.values():
        assert set(profile.keys()) == {"RV", "RF", "Monetario", "Alternativos", "Otros"}
        assert "Mixto" not in profile


def test_alternativos_combines_alternative_and_real_asset():
    eq = np.array([1.0, 0.0, 0.0]); bd = np.array([0.0, 1.0, 0.0])
    cs = np.zeros(3); al = np.array([0.0, 0.0, 0.5]); ra = np.array([0.0, 0.0, 0.5]); ot = np.zeros(3)
    vecs = build_bucket_vectors(eq, bd, cs, al, ra, ot)
    assert np.allclose(vecs["Alternativos"], al + ra)
    assert np.allclose(vecs["RV"], eq)
