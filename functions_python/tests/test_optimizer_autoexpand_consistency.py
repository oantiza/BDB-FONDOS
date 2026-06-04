from __future__ import annotations

from unittest.mock import MagicMock

import numpy as np
import pandas as pd

import services.portfolio.optimizer_core as optimizer_core
from services.portfolio.optimizer_core import _check_feasibility_and_autoexpand, run_optimization


def _prices(isins: list[str], periods: int = 800) -> dict[str, pd.Series]:
    dates = pd.date_range("2021-01-01", periods=periods, freq="B")
    return {
        isin: pd.Series(
            100.0 * np.cumprod(np.full(periods, 1.0001 + idx * 0.0001)),
            index=dates,
        )
        for idx, isin in enumerate(isins)
    }


def _equity_meta() -> dict:
    return {
        "classification_v2": {"asset_type": "EQUITY"},
        "portfolio_exposure_v2": {"asset_mix": {"equity": 1.0}},
    }


def _bond_meta() -> dict:
    return {
        "classification_v2": {"asset_type": "FIXED_INCOME"},
        "portfolio_exposure_v2": {"asset_mix": {"bond": 1.0}},
    }


def test_autoexpand_reuses_canonical_expected_returns_builder(monkeypatch):
    price_data = _prices(["BD1", "BD2"])
    candidate_prices = _prices(["EQ_AUTO"])
    fetcher = MagicMock()
    fetcher.get_price_data.return_value = (candidate_prices, False)
    captured: dict = {}

    def fake_quant_builder(df, universe, asset_metadata, tactical_views):
        captured["columns"] = list(df.columns)
        captured["universe"] = list(universe)
        captured["tactical_views"] = tactical_views
        mu = pd.Series({isin: 0.05 for isin in universe})
        cov = pd.DataFrame(np.eye(len(universe)) * 0.01, index=universe, columns=universe)
        return mu, cov

    monkeypatch.setattr(optimizer_core, "_build_expected_returns_and_cov", fake_quant_builder)
    monkeypatch.setattr(optimizer_core, "_apply_standard_constraints", lambda *args, **kwargs: None)

    tactical_views = {"EQ_AUTO": 0.12}
    is_feasible, _result, added_assets, solver_path, _ef, mu, _cov, universe, *_vectors = (
        _check_feasibility_and_autoexpand(
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
            risk_level_i=5,
            fixed_weights={},
            current_risk_buckets={},
            candidate_funds={"EQ_AUTO": _equity_meta()},
            tactical_views=tactical_views,
        )
    )

    assert is_feasible is True
    assert added_assets == ["EQ_AUTO"]
    assert solver_path == "auto_expand_then_solve"
    assert universe == ["BD1", "BD2", "EQ_AUTO"]
    assert list(mu.index) == universe
    assert captured == {
        "columns": universe,
        "universe": universe,
        "tactical_views": tactical_views,
    }


class _CleanWeights:
    def clean_weights(self, cutoff=0.0):
        return {"REQ": 0.4, "BD": 0.3, "AUTO": 0.3}


def test_run_optimization_rebuilds_frontier_after_autoexpand(monkeypatch):
    monkeypatch.setenv("UNIFIED_CONSTRAINTS", "0")
    initial_universe = ["REQ", "BD"]
    final_universe = ["REQ", "BD", "AUTO"]
    initial_df = pd.DataFrame(_prices(initial_universe, periods=120))
    zero_initial = np.zeros(2)
    zero_final = np.zeros(3)

    fetcher = MagicMock()
    fetcher.get_dynamic_risk_free_rate.return_value = 0.02

    monkeypatch.setattr(optimizer_core, "_apply_suitability_filter", lambda assets, *_args: assets)
    monkeypatch.setattr(
        optimizer_core,
        "_build_candidate_universe",
        lambda *args, **kwargs: (
            fetcher,
            {},
            False,
            initial_df,
            initial_universe,
            [],
            np.array([1.0, 0.0]),
            np.array([0.0, 1.0]),
            zero_initial,
            zero_initial,
            zero_initial,
            zero_initial,
        ),
    )

    initial_mu = pd.Series({"REQ": 0.08, "BD": 0.03})
    initial_cov = pd.DataFrame(np.eye(2) * 0.01, index=initial_universe, columns=initial_universe)
    final_mu = pd.Series({"REQ": 0.08, "BD": 0.03, "AUTO": 0.06})
    final_cov = pd.DataFrame(np.eye(3) * 0.01, index=final_universe, columns=final_universe)
    monkeypatch.setattr(
        optimizer_core,
        "_build_expected_returns_and_cov",
        lambda *args, **kwargs: (initial_mu, initial_cov),
    )

    frontier_calls: list[list[str]] = []

    def fake_frontier(mu, _cov):
        frontier_calls.append(list(mu.index))
        return [{"x": float(len(mu)), "y": float(len(mu))}]

    monkeypatch.setattr(optimizer_core, "_build_frontier_curve", fake_frontier)
    monkeypatch.setattr(optimizer_core, "_apply_standard_constraints", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        optimizer_core,
        "_check_feasibility_and_autoexpand",
        lambda *args, **kwargs: (
            True,
            {},
            ["AUTO"],
            "auto_expand_then_solve",
            MagicMock(),
            final_mu,
            final_cov,
            final_universe,
            np.array([1.0, 0.0, 1.0]),
            np.array([0.0, 1.0, 0.0]),
            zero_final,
            zero_final,
            zero_final,
            zero_final,
        ),
    )
    monkeypatch.setattr(
        optimizer_core,
        "_run_solver",
        lambda *args, **kwargs: (
            _CleanWeights(),
            {"REQ": 0.4, "BD": 0.3, "AUTO": 0.3},
            "min_vol",
            {},
        ),
    )

    result = run_optimization(
        assets_list=initial_universe,
        risk_level=5,
        db=MagicMock(),
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 1.0, "cutoff": 0.0},
        asset_metadata={"REQ": _equity_meta(), "BD": _bond_meta(), "AUTO": _equity_meta()},
    )

    assert result["status"] == "optimal_compliant"
    assert result["used_assets"] == final_universe
    assert result["added_assets"] == ["AUTO"]
    assert frontier_calls == [initial_universe, final_universe]
    assert result["frontier"] == [{"x": 3.0, "y": 3.0}]
