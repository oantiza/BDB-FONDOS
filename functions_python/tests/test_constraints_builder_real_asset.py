"""REM-2 — _resolve_bucket_bounds: real_asset neutro tras quitar 'Inmobiliario' (ligero)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.portfolio.constraints_builder_v1 import build_constraints_v1  # noqa: E402
from services.config import RISK_BUCKETS_LABELS  # noqa: E402


def test_real_asset_neutral_without_inmobiliario():
    profile = dict(RISK_BUCKETS_LABELS[5])  # RV/RF/Mixto/Monetario/Alternativos/Otros
    c = build_constraints_v1(profile, "rebalance_to_profile", None, None)
    bb = c.bucket_bounds
    # real_asset no se puebla desde legacy (sin 'Inmobiliario' ni 'real_asset') -> sigue vacío.
    assert bb.real_asset.min is None and bb.real_asset.max is None
    # alternative SÍ se puebla desde 'Alternativos' del perfil 5 canónico.
    assert bb.alternative.max == RISK_BUCKETS_LABELS[5]["Alternativos"][1]
    # equity desde 'RV' (0.40-0.60).
    assert bb.equity.min == 0.40 and bb.equity.max == 0.60


def test_real_asset_from_explicit_key_still_works():
    c = build_constraints_v1({"real_asset": [0.0, 0.05]}, "rebalance_to_profile", None, None)
    assert c.bucket_bounds.real_asset.max == 0.05
