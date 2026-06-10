"""FIX lote 4 (auditoria logica 2026-06-09) — hallazgos BAJA H13/H14/H16.

- H13: el punto de cartera de la frontera se normaliza SOLO sobre los activos
  con datos (antes quedaba infraestimado si se excluian activos por historial).
- H14: 'ytd' significa desde el 1 de enero (frontier_engine lo aproximaba con
  252 dias; backtester ni lo mapeaba y caia al default de 3 anios en silencio).
- H16: la estimacion de presupuesto del auto-expand usa el peso REAL de cada
  lock (antes asumia max(0.03, max_weight) y podia declarar inalcanzable un
  equity floor alcanzable con locks pequenos).
"""
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

import services.backtester as backtester
import services.portfolio.frontier_engine as frontier_engine
from services.backtester import _compute_metrics
from services.portfolio.frontier_engine import generate_efficient_frontier
from services.portfolio.optimizer_core import _check_feasibility_and_autoexpand


def _prices(isins, periods=400, end="2026-06-05"):
    rng = np.random.default_rng(3)
    dates = pd.bdate_range(end=end, periods=periods)
    return {
        isin: pd.Series(
            100.0 * np.exp(np.cumsum(rng.normal(0.0003, 0.007, periods))),
            index=dates,
        )
        for isin in isins
    }


# =========================================================================
# H16 — presupuesto real de locks en la estimacion del equity floor
# =========================================================================

def test_h16_small_lock_does_not_overconsume_budget():
    """Lock de 5% en un bono con floor 55%: alcanzable (5% lock + 95% en RV).
    Con la estimacion anterior el lock consumia max_weight (50%) y el floor se
    declaraba inalcanzable -> infeasible_equity_floor espurio."""
    universe = ["BD0", "EQ1", "EQ2"]
    eq_vec = np.array([0.0, 1.0, 1.0])
    zeros = np.zeros(3)
    (is_feasible, ret_obj, *_rest) = _check_feasibility_and_autoexpand(
        db=MagicMock(),
        fetcher=MagicMock(),
        price_data={},
        universe=universe,
        assets_list=universe,
        apply_profile=True,
        equity_floor=0.55,
        max_weight=0.50,
        eq_vec=eq_vec,
        locked_assets=["BD0"],
        constraints={},
        asset_metadata={},
        min_weight=0.0,
        gamma=1.0,
        bd_vec=np.array([1.0, 0.0, 0.0]),
        cs_vec=zeros,
        al_vec=zeros,
        ra_vec=zeros,
        ot_vec=zeros,
        lock_mode="keep_weight",
        risk_level_i=5,
        fixed_weights={"BD0": 0.05},
        current_risk_buckets={},
    )
    assert is_feasible is True
    assert ret_obj == {}


def test_h16_unachievable_floor_still_blocked():
    """Lock 40% en bono + un solo fondo RV con cap 20%: max RV = 20% < 50%."""
    universe = ["BD0", "EQ1"]
    eq_vec = np.array([0.0, 1.0])
    zeros = np.zeros(2)
    (is_feasible, ret_obj, *_rest) = _check_feasibility_and_autoexpand(
        db=MagicMock(),
        fetcher=MagicMock(),
        price_data={},
        universe=universe,
        assets_list=universe,
        apply_profile=True,
        equity_floor=0.50,
        max_weight=0.20,
        eq_vec=eq_vec,
        locked_assets=["BD0"],
        constraints={},
        asset_metadata={},
        min_weight=0.0,
        gamma=1.0,
        bd_vec=np.array([1.0, 0.0]),
        cs_vec=zeros,
        al_vec=zeros,
        ra_vec=zeros,
        ot_vec=zeros,
        lock_mode="keep_weight",
        risk_level_i=5,
        fixed_weights={"BD0": 0.40},
        current_risk_buckets={},
    )
    assert is_feasible is False
    assert ret_obj["status"] == "infeasible_equity_floor"


# =========================================================================
# H13 — punto de cartera sobre activos presentes
# =========================================================================

class _FrontierFetcher:
    def __init__(self, db):
        self.db = db
        self._prices = _prices(["AA1", "BB1"])

    def get_price_data(self, assets, **kwargs):
        return ({i: self._prices[i] for i in assets if i in self._prices}, [])


def test_h13_portfolio_point_ignores_missing_assets(monkeypatch):
    """Cartera 50% AA1 + 50% GONE (sin datos): el punto debe coincidir con el
    del activo AA1 al 100%, no con la mitad de su retorno/volatilidad."""
    monkeypatch.setattr(frontier_engine, "DataFetcher", _FrontierFetcher)
    result = generate_efficient_frontier(
        ["AA1", "BB1", "GONE"], MagicMock(),
        portfolio_weights={"AA1": 1.0, "GONE": 1.0},
        period="3y",
    )
    assert result["status"] == "success"
    point = result["portfolio"]
    asset_a = next(a for a in result["assets"] if a["label"] == "AA1")
    assert point["x"] == pytest.approx(asset_a["x"], abs=1e-4)
    assert point["y"] == pytest.approx(asset_a["y"], abs=1e-4)


# =========================================================================
# H14 — ytd real
# =========================================================================

def test_h14_frontier_ytd_starts_on_january_first(monkeypatch):
    monkeypatch.setattr(frontier_engine, "DataFetcher", _FrontierFetcher)
    result = generate_efficient_frontier(
        ["AA1", "BB1"], MagicMock(), portfolio_weights=None, period="ytd"
    )
    assert result["status"] == "success"
    start = pd.Timestamp(result["effective_start_date"])
    assert start.year == 2026
    assert start.month == 1
    assert start.day <= 5  # primer dia habil del anio


def test_h14_backtester_ytd_slices_from_january_first(monkeypatch):
    # Sin red: cualquier benchmark externo cae al fallback interno.
    monkeypatch.setattr(
        backtester.yf, "download",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("sin red")),
    )
    df_master = pd.DataFrame(_prices(["AA1"], periods=400))
    fetcher = MagicMock()
    fetcher.get_dynamic_risk_free_rate.return_value = 0.02
    result = _compute_metrics(df_master, "ytd", {"AA1": 1.0}, [], fetcher)
    assert "error" not in result
    start = pd.Timestamp(result["effective_start_date"])
    assert start.year == 2026 and start.month == 1
