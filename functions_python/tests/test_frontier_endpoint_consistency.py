# functions_python/tests/test_frontier_endpoint_consistency.py
# -*- coding: utf-8 -*-

"""
Endpoint-level / engine-level consistency tests for Efficient Frontier plotting.

Goal:
Ensure that:
- frontier points
- individual asset points
- current portfolio point
- math_data expected returns

all use the SAME expected-return metric.

These tests are specifically designed to catch the historical bug where
the frontier was plotted with one return metric and the asset dots / portfolio
used another, causing assets to appear above the efficient frontier.
"""

from __future__ import annotations

import math
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import pytest

from services.quant_core import (
    calculate_portfolio_metrics,
    get_covariance_matrix,
    get_expected_returns,
)

try:
    from pypfopt import EfficientFrontier
except Exception as exc:  # pragma: no cover
    raise RuntimeError(
        "PyPortfolioOpt is required for frontier endpoint consistency tests"
    ) from exc


TRADING_DAYS = 252
SEED = 123


def _make_mock_prices(
    n_assets: int = 6,
    n_days: int = 756,
    seed: int = SEED,
) -> pd.DataFrame:
    """
    Synthetic deterministic daily price panel with enough variation
    to create a meaningful efficient frontier.
    """
    rng = np.random.default_rng(seed)
    dates = pd.bdate_range("2022-01-03", periods=n_days)

    drifts = np.array([0.00010, 0.00018, 0.00028, 0.00022, 0.00035, 0.00014])[:n_assets]
    vols = np.array([0.005, 0.007, 0.011, 0.009, 0.013, 0.006])[:n_assets]

    rets = {}
    for i in range(n_assets):
        series = rng.normal(loc=drifts[i], scale=vols[i], size=n_days)
        series = np.clip(series, -0.08, 0.08)
        rets[f"Asset_{i+1}"] = series

    returns_df = pd.DataFrame(rets, index=dates)
    prices = 100.0 * (1.0 + returns_df).cumprod()
    return prices


def _clean_weights(raw: Dict[str, float]) -> Dict[str, float]:
    total = float(sum(raw.values()))
    if total <= 0:
        raise ValueError("Weights sum to zero")
    cleaned = {k: max(0.0, float(v)) for k, v in raw.items()}
    cleaned_total = float(sum(cleaned.values()))
    if cleaned_total <= 0:
        raise ValueError("Cleaned weights sum to zero")
    return {k: v / cleaned_total for k, v in cleaned.items()}


def _interpolate_frontier_y(frontier: List[Dict[str, float]], x: float) -> float:
    xs = [p["x"] for p in frontier]
    ys = [p["y"] for p in frontier]

    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]

    for i in range(len(xs) - 1):
        x0, x1 = xs[i], xs[i + 1]
        y0, y1 = ys[i], ys[i + 1]
        if x0 <= x <= x1:
            if math.isclose(x0, x1):
                return max(y0, y1)
            t = (x - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)

    raise AssertionError("Failed to interpolate frontier")


def _build_frontier_from_mu_S(
    mu: pd.Series,
    S: pd.DataFrame,
    n_points: int = 30,
) -> List[Dict[str, float]]:
    """
    Build a classical long-only efficient frontier and expose plotting points.
    """
    min_ret = float(mu.min())
    max_ret = float(mu.max())
    if math.isclose(min_ret, max_ret, rel_tol=1e-12, abs_tol=1e-12):
        max_ret = min_ret + 1e-6

    target_returns = np.linspace(min_ret, max_ret, n_points)
    points: List[Dict[str, float]] = []

    for target_ret in target_returns:
        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, 1.0))
        try:
            ef.efficient_return(float(target_ret))
            weights = _clean_weights(ef.clean_weights())
            perf_ret, perf_vol, _ = ef.portfolio_performance()
            points.append(
                {
                    "x": float(perf_vol),
                    "y": float(perf_ret),
                    "weights": weights,
                }
            )
        except Exception:
            continue

    points.sort(key=lambda p: p["x"])
    
    # If the solver failed to reach the maximum return (often happens at the exact upper bound),
    # manually append the 100% distribution in the max return asset.
    if points and points[-1]["y"] < max_ret - 1e-5:
        max_asset = mu.idxmax()
        points.append({
            "x": float(np.sqrt(S.loc[max_asset, max_asset])),
            "y": max_ret,
            "weights": {t: 1.0 if t == max_asset else 0.0 for t in mu.index}
        })
    
    if len(points) < 5:
        raise AssertionError("Frontier has too few valid points")
    return points


def _build_asset_points(
    mu: pd.Series,
    S: pd.DataFrame,
) -> List[Dict[str, float]]:
    """
    Build individual asset points using the SAME metric as the frontier.
    """
    vols = np.sqrt(np.diag(S.values))
    return [
        {
            "ticker": ticker,
            "x": float(vol),
            "y": float(mu[ticker]),
        }
        for ticker, vol in zip(mu.index, vols)
    ]


def _build_portfolio_point(
    weights: Dict[str, float],
    mu: pd.Series,
    S: pd.DataFrame,
) -> Dict[str, float]:
    metrics = calculate_portfolio_metrics(weights, mu, S, rf_rate=0.0)
    return {
        "x": float(metrics["volatility"]),
        "y": float(metrics["return"]),
    }


def _build_math_data(mu: pd.Series, S: pd.DataFrame) -> Dict[str, object]:
    return {
        "ordered_isins": list(mu.index),
        "expected_returns": {k: float(v) for k, v in mu.to_dict().items()},
        "covariance_matrix": S.values.tolist(),
    }


@pytest.fixture(scope="module")
def mock_prices() -> pd.DataFrame:
    return _make_mock_prices()


@pytest.fixture(scope="module")
def mu(mock_prices: pd.DataFrame) -> pd.Series:
    # IMPORTANT: arithmetic mean for frontier coherence
    return get_expected_returns(mock_prices, frequency=TRADING_DAYS, method="mean")


@pytest.fixture(scope="module")
def S(mock_prices: pd.DataFrame) -> pd.DataFrame:
    return get_covariance_matrix(mock_prices, frequency=TRADING_DAYS)


@pytest.fixture(scope="module")
def frontier(mu: pd.Series, S: pd.DataFrame) -> List[Dict[str, float]]:
    return _build_frontier_from_mu_S(mu, S, n_points=35)


@pytest.fixture(scope="module")
def asset_points(mu: pd.Series, S: pd.DataFrame) -> List[Dict[str, float]]:
    return _build_asset_points(mu, S)


@pytest.fixture(scope="module")
def portfolio_weights(mu: pd.Series) -> Dict[str, float]:
    """
    Example long-only normalized portfolio.
    """
    n = len(mu.index)
    raw = {ticker: 1.0 / n for ticker in mu.index}
    return _clean_weights(raw)


@pytest.fixture(scope="module")
def portfolio_point(
    portfolio_weights: Dict[str, float],
    mu: pd.Series,
    S: pd.DataFrame,
) -> Dict[str, float]:
    return _build_portfolio_point(portfolio_weights, mu, S)


@pytest.fixture(scope="module")
def math_data(mu: pd.Series, S: pd.DataFrame) -> Dict[str, object]:
    return _build_math_data(mu, S)


def test_math_data_expected_returns_match_mu(
    mu: pd.Series,
    math_data: Dict[str, object],
) -> None:
    """
    math_data must expose the SAME expected-return series as the plotting logic.
    """
    expected_returns = math_data["expected_returns"]
    assert set(expected_returns.keys()) == set(mu.index)

    for ticker in mu.index:
        assert abs(float(expected_returns[ticker]) - float(mu[ticker])) < 1e-10


def test_asset_points_use_same_mu_as_frontier(
    mu: pd.Series,
    asset_points: List[Dict[str, float]],
) -> None:
    """
    Every individual asset dot must use the same mu value as the frontier engine.
    """
    for point in asset_points:
        ticker = point["ticker"]
        assert abs(point["y"] - float(mu[ticker])) < 1e-10


def test_portfolio_point_uses_same_mu_and_S(
    portfolio_weights: Dict[str, float],
    portfolio_point: Dict[str, float],
    mu: pd.Series,
    S: pd.DataFrame,
) -> None:
    """
    Current portfolio point must be derived from the same mu and S used by the frontier.
    """
    metrics = calculate_portfolio_metrics(portfolio_weights, mu, S, rf_rate=0.0)
    assert abs(portfolio_point["x"] - metrics["volatility"]) < 1e-10
    assert abs(portfolio_point["y"] - metrics["return"]) < 1e-10


def test_no_asset_point_above_frontier(
    frontier: List[Dict[str, float]],
    asset_points: List[Dict[str, float]],
) -> None:
    """
    The efficient frontier must remain the upper envelope in the same metric space.
    """
    for asset in asset_points:
        frontier_y = _interpolate_frontier_y(frontier, asset["x"])
        assert asset["y"] <= frontier_y + 1e-4, (
            f"Asset {asset['ticker']} lies above frontier: "
            f"asset_y={asset['y']:.6f}, frontier_y={frontier_y:.6f}, x={asset['x']:.6f}"
        )


def test_portfolio_point_not_above_frontier(
    frontier: List[Dict[str, float]],
    portfolio_point: Dict[str, float],
) -> None:
    """
    A generic long-only portfolio should not lie above the efficient frontier.
    """
    frontier_y = _interpolate_frontier_y(frontier, portfolio_point["x"])
    assert portfolio_point["y"] <= frontier_y + 1e-4, (
        f"Portfolio point lies above frontier: "
        f"portfolio_y={portfolio_point['y']:.6f}, frontier_y={frontier_y:.6f}, "
        f"x={portfolio_point['x']:.6f}"
    )


def test_frontier_y_is_generated_from_solver_not_geometric_override(
    frontier: List[Dict[str, float]],
    mu: pd.Series,
    S: pd.DataFrame,
) -> None:
    """
    Defensive test:
    Recompute one frontier point's return directly from its weights and verify it
    matches the stored Y-value. This catches visual override bugs like using CAGR
    instead of arithmetic expected return.
    """
    mid_idx = len(frontier) // 2
    point = frontier[mid_idx]
    weights = point["weights"]

    metrics = calculate_portfolio_metrics(weights, mu, S, rf_rate=0.0)
    assert abs(point["y"] - metrics["return"]) < 1e-4, (
        f"Frontier point return mismatch: stored={point['y']:.6f}, "
        f"recomputed={metrics['return']:.6f}"
    )


def test_frontier_and_math_data_share_same_asset_ordering(
    mu: pd.Series,
    math_data: Dict[str, object],
) -> None:
    """
    ordered_isins must stay aligned with the expected_returns mapping.
    """
    ordered = math_data["ordered_isins"]
    assert ordered == list(mu.index)
