"""FIX H4 (auditoria logica 2026-06-09) — correlacion sobre retornos en analyzer.

Antes, analyze_portfolio calculaba df.corr() sobre NIVELES de precio: dos fondos
independientes con tendencia alcista superaban el umbral 0.8 y disparaban la
"Alerta de concentracion" y sugerencias de sustitucion espurias.

Contrato vigente: la matriz de correlacion y los pares de alta correlacion se
calculan sobre retornos diarios (pct_change), misma convencion que backtester.
"""
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

import services.portfolio.analyzer as analyzer
from services.portfolio.analyzer import analyze_portfolio


def _make_prices(periods: int = 800):
    rng = np.random.default_rng(42)
    dates = pd.date_range("2022-01-03", periods=periods, freq="B")
    ret_a = rng.normal(0.0004, 0.01, periods)
    ret_b = rng.normal(0.0004, 0.01, periods)  # independiente de A
    px_a = 100.0 * np.exp(np.cumsum(ret_a))
    px_b = 100.0 * np.exp(np.cumsum(ret_b))
    px_c = px_a * 2.0  # retornos identicos a A -> correlacion real 1.0
    return {
        "AA1": pd.Series(px_a, index=dates),
        "BB1": pd.Series(px_b, index=dates),
        "CC1": pd.Series(px_c, index=dates),
    }


class _FakeFetcher:
    def __init__(self, db):
        self.db = db

    def get_price_data(self, assets, **kwargs):
        prices = _make_prices()
        return ({isin: prices[isin] for isin in assets if isin in prices}, [])

    def get_dynamic_risk_free_rate(self):
        return 0.02


def _run(monkeypatch):
    monkeypatch.setattr(analyzer, "DataFetcher", _FakeFetcher)
    return analyze_portfolio({"AA1": 0.4, "BB1": 0.3, "CC1": 0.3}, MagicMock())


def test_independent_funds_do_not_trigger_concentration_alert(monkeypatch):
    """Dos random walks independientes: correlacion de PRECIOS ~0.8+ pero de
    RETORNOS ~0. No deben marcarse como par de alta correlacion."""
    result = _run(monkeypatch)

    assert result["status"] == "success"
    pairs = {
        frozenset((p["asset1"], p["asset2"]))
        for p in result["high_correlation_pairs"]
    }
    assert frozenset(("AA1", "BB1")) not in pairs
    assert abs(result["correlation_matrix"]["AA1"]["BB1"]) < 0.3


def test_truly_correlated_funds_are_still_detected(monkeypatch):
    """CC1 replica los retornos de AA1: el par debe seguir detectandose."""
    result = _run(monkeypatch)

    pairs = {
        frozenset((p["asset1"], p["asset2"]))
        for p in result["high_correlation_pairs"]
    }
    assert frozenset(("AA1", "CC1")) in pairs
    assert result["correlation_matrix"]["AA1"]["CC1"] > 0.99


def test_correlation_is_computed_on_returns_not_prices_static():
    import inspect

    source = inspect.getsource(analyzer)
    assert "pct_change" in source
    assert "corr_matrix = df.corr()" not in source
