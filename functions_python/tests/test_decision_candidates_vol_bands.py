"""DECISION 2026-06-09 — candidatos por tramo (H2 follow-up) y vol bands 8-10 (H8).

Criterios adoptados: coherente (elegibilidad del perfil como unico gate duro),
no bloqueante (afinidad de tramo solo ordena; enforcement de bandas soft) y
con margen (~700 fondos: relleno hasta pool minimo, umbrales relajados).
Incluye el prerequisito H17-b (claves no numericas en el doc de perfiles).
"""
from unittest.mock import MagicMock

import pytest

import services.feature_flags as feature_flags
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.autoexpand_candidates import select_candidate_pool
from services.portfolio.constraints_builder_v1 import (
    build_constraints_v1,
    merge_profile_vol_band,
)
from services.portfolio.optimizer_core import _build_optimization_context


def _row(isin, asset_type, eq=None, sharpe=1.0, subtype=None, history_ok=True):
    class_v2 = {"asset_type": asset_type}
    if subtype:
        class_v2["asset_subtype"] = subtype
    mix = {}
    if eq is not None:
        mix["equity"] = eq / 100.0
        mix["bond"] = max(0.0, 1.0 - eq / 100.0)
    elif asset_type == "FIXED_INCOME":
        mix["bond"] = 1.0
    elif asset_type == "MONEY_MARKET":
        mix["cash"] = 1.0
    return (isin, {
        "classification_v2": class_v2,
        "portfolio_exposure_v2": {"asset_mix": mix},
        "std_perf": {"sharpe": sharpe},
        "data_quality": {"history_ok": history_ok},
    })


# =========================================================================
# Selector de candidatos
# =========================================================================

def test_pool_p3_prefers_mixed_and_excludes_pure_equity_and_em():
    rows = [
        _row("EQ100", "EQUITY", eq=100, sharpe=3.0),                      # no apto en P3
        _row("EM1", "EQUITY", eq=100, sharpe=2.9, subtype="EMERGING_MARKETS_EQUITY"),
        _row("MIX44", "MIXED", eq=44, sharpe=1.5),                        # apto + afin
        _row("MIX40", "MIXED", eq=40, sharpe=1.2),                        # apto + afin
        _row("MIX50", "MIXED", eq=50, sharpe=2.5),                        # NO apto en P3 (eq>45)
        _row("BD1", "FIXED_INCOME", sharpe=1.0),                          # apto (relleno)
        _row("MM1", "MONEY_MARKET", sharpe=0.5),                          # apto (relleno)
    ]
    pool = select_candidate_pool(rows, risk_level=3)
    isins = list(pool.keys())
    assert "EQ100" not in isins and "EM1" not in isins
    # El cap de equity por fondo del perfil (45% en P3) sigue siendo gate duro:
    assert "MIX50" not in isins
    # afines primero, relleno despues (margen: no quedarse corto)
    assert isins[:2] == ["MIX44", "MIX40"]
    assert "BD1" in isins and "MM1" in isins


def test_pool_p9_prefers_high_equity_but_fills_with_eligible():
    rows = [
        _row("EQ95", "EQUITY", eq=95, sharpe=1.0),
        _row("EQ85", "EQUITY", eq=85, sharpe=2.0),
        _row("MIX50", "MIXED", eq=50, sharpe=3.0),   # apto en 9, menos afin
        _row("BD1", "FIXED_INCOME", sharpe=2.5),     # apto en 9 (relleno)
    ]
    pool = select_candidate_pool(rows, risk_level=9, min_pool=4)
    isins = list(pool.keys())
    assert isins[0] in {"EQ85", "EQ95"} and isins[1] in {"EQ85", "EQ95"}
    assert "MIX50" in isins and "BD1" in isins  # margen: relleno elegible


def test_pool_margin_fills_to_min_pool_with_any_eligible():
    rows = [_row("MIX50", "MIXED", eq=50, sharpe=1.0)] + [
        _row(f"BD{i}", "FIXED_INCOME", sharpe=0.5 - i * 0.01) for i in range(7)
    ]
    pool = select_candidate_pool(rows, risk_level=4, min_pool=6)
    assert len(pool) >= 6


def test_pool_skips_bad_history_and_respects_max():
    rows = [_row(f"MIX{i}", "MIXED", eq=50, sharpe=2.0 - i * 0.01) for i in range(20)]
    rows.append(_row("BADH", "MIXED", eq=50, sharpe=9.9, history_ok=False))
    pool = select_candidate_pool(rows, risk_level=4, max_candidates=12)
    assert "BADH" not in pool
    assert len(pool) == 12


def test_pool_legacy_without_risk_level_keeps_equity90_rule():
    rows = [
        _row("EQ95", "EQUITY", eq=95, sharpe=1.0),
        _row("EQ85", "EQUITY", eq=85, sharpe=2.0),
        _row("MIX50", "MIXED", eq=50, sharpe=3.0),
    ]
    pool = select_candidate_pool(rows, risk_level=None)
    assert list(pool.keys()) == ["EQ95"]


# =========================================================================
# Vol bands 8-10 via campo paralelo 'vol_bands'
# =========================================================================

_RAW_DOC = {
    "9": {"RV": [0.9, 1.0], "RF": [0, 0.07]},
    "vol_bands": {"9": {"min": 0.09, "max": 0.30, "target_vol": 0.16}},
}


def test_merge_profile_vol_band_injects_band_and_target():
    payload = merge_profile_vol_band({"RV": [0.9, 1.0], "profile_id": "9"}, _RAW_DOC, "9")
    assert payload["vol_band"] == {"min": 0.09, "max": 0.30}
    assert payload["target_vol"] == 0.16


def test_merge_profile_vol_band_noop_without_field():
    base = {"RV": [0.9, 1.0], "profile_id": "9"}
    assert merge_profile_vol_band(base, {"9": {}}, "9") == base


def test_builder_audits_explicit_band_for_p9_from_parallel_field():
    profile = merge_profile_vol_band({"profile_id": "9"}, _RAW_DOC, "9")
    c = build_constraints_v1(
        profile=profile,
        optimization_mode="rebalance_to_profile",
        locked_positions=None,
        tactical_views=None,
        overrides={},
    )
    # Banda explicita auditada (railes anchos), target informativo realista.
    assert c.risk_budget.vol_band.min == pytest.approx(0.09)
    assert c.risk_budget.vol_band.max == pytest.approx(0.30)
    assert c.risk_budget.target_vol == pytest.approx(0.16)
    assert c.objective == "max_sharpe"


# =========================================================================
# H17-b: el campo paralelo no rompe la carga de perfiles
# =========================================================================

def test_h17b_parallel_field_does_not_invalidate_profiles(monkeypatch):
    monkeypatch.delenv("UNIFIED_CONSTRAINTS", raising=False)
    feature_flags.reset_unified_constraints_cache()
    raw = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
    raw["vol_bands"] = {"9": {"min": 0.09, "max": 0.30}}

    db = MagicMock()
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = raw
    db.collection.return_value.document.return_value.get.return_value = doc

    (_ap, _m, _l, _fw, buckets, _fl, source) = _build_optimization_context(db, {})
    assert source == "firestore:risk_profiles"
    assert set(buckets.keys()) == set(range(1, 11))  # antes: TODO el doc caia a seeds
    feature_flags.reset_unified_constraints_cache()
