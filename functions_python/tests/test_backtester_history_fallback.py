import sys
import types

import numpy as np
import pandas as pd
import pytest

from services.backtester import _compute_metrics
from services.config import BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN


class _DummyFetcher:
    def get_dynamic_risk_free_rate(self):
        return 0.02


def _build_prices(periods: int = 320) -> pd.DataFrame:
    dates = pd.bdate_range("2024-01-02", periods=periods)
    rng = np.random.default_rng(42)

    returns = pd.DataFrame(
        {
            "ASSET_A": rng.normal(0.0004, 0.008, size=periods),
            "ASSET_B": rng.normal(0.0002, 0.010, size=periods),
            BENCHMARK_RF_ISIN: rng.normal(0.0001, 0.002, size=periods),
            BENCHMARK_RV_ISIN: rng.normal(0.0005, 0.009, size=periods),
        },
        index=dates,
    )
    return 100.0 * (1.0 + returns).cumprod()


@pytest.fixture(autouse=True)
def _stub_quant_core(monkeypatch):
    module = types.ModuleType("services.quant_core")

    def calculate_historical_metrics(series, risk_free_annual=0.0, method="geometric"):
        returns = pd.Series(series).pct_change().dropna()
        if returns.empty:
            return None

        volatility = float(returns.std() * np.sqrt(252))
        total_return = float(series.iloc[-1] / series.iloc[0] - 1.0)
        sharpe = 0.0 if volatility <= 0 else float((total_return - risk_free_annual) / volatility)
        rolling_max = pd.Series(series).cummax()
        max_drawdown = float((pd.Series(series) / rolling_max - 1.0).min())

        return {
            "return": total_return,
            "volatility": volatility,
            "sharpe": sharpe,
            "max_drawdown": max_drawdown,
        }

    module.calculate_historical_metrics = calculate_historical_metrics
    monkeypatch.setitem(sys.modules, "services.quant_core", module)


def test_compute_metrics_keeps_calculating_with_reduced_history():
    df = _build_prices(periods=320)

    result = _compute_metrics(
        df_master=df,
        period="3y",
        weights_map={"ASSET_A": 0.6, "ASSET_B": 0.4},
        synthetic_used=[],
        fetcher=_DummyFetcher(),
    )

    assert "error" not in result
    assert result["metrics"]["volatility"] > 0
    assert result["metrics"]["cagr"] != 0
    assert any("Reduced History Warning" in warning for warning in result["warnings"])
    assert result["observations"] >= 60
    assert result["effective_start_date"] == df.index[0].strftime("%Y-%m-%d")


def test_compute_metrics_warns_with_short_but_usable_history():
    df = _build_prices(periods=40)

    result = _compute_metrics(
        df_master=df,
        period="1y",
        weights_map={"ASSET_A": 0.6, "ASSET_B": 0.4},
        synthetic_used=[],
        fetcher=_DummyFetcher(),
    )

    assert "error" not in result
    assert result["observations"] == 40
    assert any("Short History Warning" in warning for warning in result["warnings"])


def test_compute_metrics_still_fails_below_absolute_minimum_observations():
    df = _build_prices(periods=4)

    result = _compute_metrics(
        df_master=df,
        period="1y",
        weights_map={"ASSET_A": 0.6, "ASSET_B": 0.4},
        synthetic_used=[],
        fetcher=_DummyFetcher(),
    )

    assert "error" in result
    assert "Needed at least 5 observations" in result["error"]
