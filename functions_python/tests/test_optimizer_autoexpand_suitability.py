"""FIX H2 (auditoria logica 2026-06-09) — suitability en auto-expand.

Antes del fix, los candidatos de auto-expand (FASE 3 historico y FASE 7 equity
floor) entraban al universo DESPUES del filtro de idoneidad de FASE 2, pudiendo
colar fondos vetados para el perfil (p.ej. RV emergente en perfiles <=4).

Contrato vigente:
- Los candidatos pasan is_fund_eligible_for_profile ANTES de inyectarse.
- Candidatos sin classification_v2 utilizable se excluyen (prudente).
- Las exclusiones se divulgan en explainability.auto_expand_suitability_excluded.
- Sin candidatos aptos: FASE 7 devuelve auto_expand_failed con mensaje claro;
  FASE 3 degrada a la ruta estructurada de historico insuficiente.
- Los recovery_candidates del retorno 'infeasible' tambien van filtrados.
- Con apply_profile=False no se filtra (coherente con FASE 2).
"""
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

import services.portfolio.optimizer_core as optimizer_core
from services.config import RISK_BUCKETS_LABELS
from services.portfolio.optimizer_core import (
    _check_feasibility_and_autoexpand,
    _filter_autoexpand_candidates_by_suitability,
    run_optimization,
)


def _readonly_dummy_db() -> MagicMock:
    db = MagicMock()
    doc = MagicMock()
    doc.exists = True
    doc.to_dict.return_value = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
    document = MagicMock()
    document.get.return_value = doc
    collection = MagicMock()
    collection.document.return_value = document
    db.collection.return_value = collection
    return db


def _prices(isins, periods=800):
    dates = pd.date_range("2021-01-01", periods=periods, freq="B")
    return {
        isin: pd.Series(
            100.0 * np.cumprod(np.full(periods, 1.0001 + idx * 0.0001)),
            index=dates,
        )
        for idx, isin in enumerate(isins)
    }


def _em_equity_meta():
    return {
        "classification_v2": {
            "asset_type": "EQUITY",
            "asset_subtype": "EMERGING_MARKETS_EQUITY",
        },
        "portfolio_exposure_v2": {"asset_mix": {"equity": 1.0}},
    }


def _mixed_meta():
    return {
        "classification_v2": {"asset_type": "MIXED"},
        "portfolio_exposure_v2": {"asset_mix": {"equity": 0.4, "bond": 0.6}},
    }


def _bond_meta():
    return {
        "classification_v2": {"asset_type": "FIXED_INCOME"},
        "portfolio_exposure_v2": {"asset_mix": {"bond": 1.0}},
    }


# =========================================================================
# 1. Unidad: filtro de candidatos
# =========================================================================

def test_filter_excludes_em_equity_for_conservative_profile():
    eligible, excluded = _filter_autoexpand_candidates_by_suitability(
        ["EM", "MIX"],
        {"EM": _em_equity_meta(), "MIX": _mixed_meta()},
        {},
        risk_level=3,
        apply_profile=True,
    )
    assert eligible == ["MIX"]
    assert [e["isin"] for e in excluded] == ["EM"]
    assert excluded[0]["reason"]


def test_filter_keeps_em_equity_for_dynamic_profile():
    eligible, excluded = _filter_autoexpand_candidates_by_suitability(
        ["EM"], {"EM": _em_equity_meta()}, {}, risk_level=7, apply_profile=True
    )
    assert eligible == ["EM"]
    assert excluded == []


def test_filter_excludes_candidates_without_usable_metadata():
    eligible, excluded = _filter_autoexpand_candidates_by_suitability(
        ["NO_META"], None, {}, risk_level=5, apply_profile=True
    )
    assert eligible == []
    assert [e["isin"] for e in excluded] == ["NO_META"]


def test_filter_is_bypassed_without_profile_rules():
    eligible, excluded = _filter_autoexpand_candidates_by_suitability(
        ["NO_META"], None, {}, risk_level=5, apply_profile=False
    )
    assert eligible == ["NO_META"]
    assert excluded == []


def test_filter_is_bypassed_without_risk_level():
    eligible, excluded = _filter_autoexpand_candidates_by_suitability(
        ["NO_META"], None, {}, risk_level=None, apply_profile=True
    )
    assert eligible == ["NO_META"]
    assert excluded == []


# =========================================================================
# 2. FASE 7 (equity floor): candidatos filtrados antes de inyectarse
# =========================================================================

def _fase7_kwargs(candidate_funds, diagnostics, risk_level_i=3):
    price_data = _prices(["BD1", "BD2"])
    all_prices = dict(price_data)
    all_prices.update(_prices(list(candidate_funds.keys())))
    fetcher = MagicMock()
    fetcher.get_price_data.side_effect = lambda assets, **kw: (
        {isin: all_prices[isin] for isin in assets if isin in all_prices},
        False,
    )
    return dict(
        db=MagicMock(),
        fetcher=fetcher,
        price_data=price_data,
        universe=["BD1", "BD2"],
        assets_list=["BD1", "BD2"],
        apply_profile=True,
        equity_floor=0.40,
        max_weight=0.50,
        eq_vec=np.zeros(2),
        locked_assets=[],
        constraints={"auto_expand_universe": True, "objective": "min_vol"},
        asset_metadata={"BD1": _bond_meta(), "BD2": _bond_meta()},
        min_weight=0.0,
        gamma=1.0,
        bd_vec=np.ones(2),
        cs_vec=np.zeros(2),
        al_vec=np.zeros(2),
        ra_vec=np.zeros(2),
        ot_vec=np.zeros(2),
        lock_mode="free",
        risk_level_i=risk_level_i,
        fixed_weights={},
        current_risk_buckets={},
        candidate_funds=candidate_funds,
        tactical_views=None,
        autoexpand_diagnostics=diagnostics,
    )


def _fake_quant(df, universe, asset_metadata, tactical_views):
    mu = pd.Series({isin: 0.05 for isin in universe})
    cov = pd.DataFrame(np.eye(len(universe)) * 0.01, index=universe, columns=universe)
    return mu, cov


def test_fase7_excludes_unsuitable_candidates(monkeypatch):
    monkeypatch.setattr(optimizer_core, "_build_expected_returns_and_cov", _fake_quant)
    monkeypatch.setattr(optimizer_core, "_apply_standard_constraints", lambda *a, **k: None)

    diagnostics = {}
    kwargs = _fase7_kwargs(
        {"EM_AUTO": _em_equity_meta(), "MIX_OK": _mixed_meta()}, diagnostics
    )
    (is_feasible, _ret, added_assets, solver_path, *_rest) = (
        _check_feasibility_and_autoexpand(**kwargs)
    )

    assert is_feasible is True
    assert added_assets == ["MIX_OK"]
    assert solver_path == "auto_expand_then_solve"
    assert [e["isin"] for e in diagnostics["suitability_excluded"]] == ["EM_AUTO"]


def test_fase7_fails_fast_when_no_suitable_candidates(monkeypatch):
    monkeypatch.setattr(optimizer_core, "_build_expected_returns_and_cov", _fake_quant)
    monkeypatch.setattr(optimizer_core, "_apply_standard_constraints", lambda *a, **k: None)

    diagnostics = {}
    kwargs = _fase7_kwargs({"EM_AUTO": _em_equity_meta()}, diagnostics)
    (is_feasible, ret_obj, *_rest) = _check_feasibility_and_autoexpand(**kwargs)

    assert is_feasible is False
    assert ret_obj["status"] == "auto_expand_failed"
    assert ret_obj["applicable"] is False
    assert ret_obj["usable"] is False
    assert "aptos" in ret_obj["message"]
    excluded = ret_obj["explainability"]["auto_expand_suitability_excluded"]
    assert [e["isin"] for e in excluded] == ["EM_AUTO"]


# =========================================================================
# 3. FASE 3 (historico): recovery_candidates filtrados y divulgados
# =========================================================================

class _ShortHistoryFetcher:
    def __init__(self, db):
        self.db = db

    def get_price_data(self, assets, **kwargs):
        return (_prices(assets, periods=30), [])

    def get_dynamic_risk_free_rate(self):
        return 0.02


def test_fase3_recovery_candidates_are_suitability_filtered(monkeypatch):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _ShortHistoryFetcher)
    result = run_optimization(
        assets_list=["A", "B"],
        risk_level=3,
        db=_readonly_dummy_db(),
        constraints={},
        asset_metadata={"A": _mixed_meta(), "B": _mixed_meta()},
        candidate_funds={"EM1": _em_equity_meta(), "MIX1": _mixed_meta()},
    )

    assert result["status"] == "infeasible"
    assert result["solver_path"] == "blocked_insufficient_history"
    assert result["recovery_candidates"] == ["MIX1"]
    excluded = result["explainability"]["auto_expand_suitability_excluded"]
    assert [e["isin"] for e in excluded] == ["EM1"]


def test_fase3_all_candidates_unsuitable_yields_empty_recovery(monkeypatch):
    monkeypatch.setattr(optimizer_core, "DataFetcher", _ShortHistoryFetcher)
    result = run_optimization(
        assets_list=["A", "B"],
        risk_level=3,
        db=_readonly_dummy_db(),
        constraints={},
        asset_metadata={"A": _mixed_meta(), "B": _mixed_meta()},
        candidate_funds={"EM1": _em_equity_meta()},
    )

    assert result["status"] == "infeasible"
    assert result["recovery_candidates"] == []
    excluded = result["explainability"]["auto_expand_suitability_excluded"]
    assert [e["isin"] for e in excluded] == ["EM1"]
