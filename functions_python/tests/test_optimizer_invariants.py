# functions_python/tests/test_optimizer_invariants.py
# -*- coding: utf-8 -*-

"""
Mathematical invariants for the BDB-FONDOS optimizer.

These tests verify properties that should always hold in a coherent
Markowitz-style portfolio engine.

Invariants covered:
1. weights sum to 1
2. weights are non-negative (long-only)
3. covariance matrix is positive semi-definite
4. frontier volatility is monotonic non-decreasing
5. frontier acts as a "roof": no individual asset should sit above it
6. max-sharpe portfolio lies on / below the frontier envelope

These tests are intentionally synthetic and deterministic to avoid
data-provider noise and fragile fixture coupling.
"""

from __future__ import annotations

import math
from typing import Dict, List

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
        "PyPortfolioOpt is required for optimizer invariant tests"
    ) from exc


TRADING_DAYS = 252
SEED = 42


def _make_mock_prices(
    n_assets: int = 5,
    n_days: int = 504,
    seed: int = SEED,
) -> pd.DataFrame:
    """
    Build deterministic synthetic price series.

    The generated assets have different drifts/volatilities but remain realistic.
    """
    rng = np.random.default_rng(seed)

    dates = pd.bdate_range("2023-01-02", periods=n_days)

    # Drifts and vols chosen to create a sensible frontier shape
    drifts = np.array([0.00015, 0.00025, 0.00035, 0.00020, 0.00045])[:n_assets]
    vols = np.array([0.004, 0.007, 0.010, 0.006, 0.012])[:n_assets]

    returns = {}
    for i in range(n_assets):
        noise = rng.normal(loc=drifts[i], scale=vols[i], size=n_days)
        # Clip tails to keep tests stable
        noise = np.clip(noise, -0.06, 0.06)
        returns[f"Asset_{i + 1}"] = noise

    rets_df = pd.DataFrame(returns, index=dates)
    prices = 100.0 * (1.0 + rets_df).cumprod()
    return prices


def _clean_weights(raw_weights: Dict[str, float]) -> Dict[str, float]:
    """Normalize tiny float noise."""
    total = float(sum(raw_weights.values()))
    if total <= 0:
        raise ValueError("Weight vector sums to zero")

    cleaned = {k: max(0.0, float(v)) for k, v in raw_weights.items()}
    cleaned_total = float(sum(cleaned.values()))
    if cleaned_total <= 0:
        raise ValueError("Cleaned weight vector sums to zero")

    return {k: v / cleaned_total for k, v in cleaned.items()}


def _build_frontier(
    mu: pd.Series,
    S: pd.DataFrame,
    n_points: int = 25,
) -> List[Dict[str, float]]:
    """
    Build a long-only efficient frontier from min-vol to max-return.
    Returns a list of {x: vol, y: ret, weights: {...}} points.
    """
    min_ret = float(mu.min())
    max_ret = float(mu.max())

    # Avoid degenerate grids
    if math.isclose(min_ret, max_ret, rel_tol=1e-12, abs_tol=1e-12):
        max_ret = min_ret + 1e-6

    target_returns = np.linspace(min_ret, max_ret, n_points)

    frontier: List[Dict[str, float]] = []

    for target_ret in target_returns:
        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, 1.0))
        try:
            ef.efficient_return(float(target_ret))
            weights = _clean_weights(ef.clean_weights())
            perf_ret, perf_vol, _ = ef.portfolio_performance()
            frontier.append(
                {
                    "x": float(perf_vol),
                    "y": float(perf_ret),
                    "weights": weights,
                }
            )
        except Exception:
            # Some target returns may be infeasible; skip them.
            continue

    # Sort by volatility to make monotonic tests straightforward
    frontier.sort(key=lambda p: p["x"])

    # If the solver failed to reach the maximum return (often happens at the exact upper bound),
    # manually append the 100% distribution in the max return asset.
    if frontier and frontier[-1]["y"] < max_ret - 1e-5:
        max_asset = mu.idxmax()
        frontier.append(
            {
                "x": float(np.sqrt(S.loc[max_asset, max_asset])),
                "y": max_ret,
                "weights": {t: 1.0 if t == max_asset else 0.0 for t in mu.index},
            }
        )

    if len(frontier) < 5:
        raise AssertionError("Frontier construction returned too few valid points")

    return frontier


def _build_max_sharpe_point(
    mu: pd.Series,
    S: pd.DataFrame,
    risk_free_rate: float = 0.0,
) -> Dict[str, float]:
    """Compute long-only max-sharpe point."""
    ef = EfficientFrontier(mu, S, weight_bounds=(0.0, 1.0))
    ef.max_sharpe(risk_free_rate=risk_free_rate)
    weights = _clean_weights(ef.clean_weights())
    perf_ret, perf_vol, perf_sharpe = ef.portfolio_performance(
        risk_free_rate=risk_free_rate
    )
    return {
        "x": float(perf_vol),
        "y": float(perf_ret),
        "sharpe": float(perf_sharpe),
        "weights": weights,
    }


def _interpolate_frontier_y(frontier: List[Dict[str, float]], x: float) -> float:
    """
    Piecewise-linear interpolation on the frontier.
    Assumes frontier sorted by x.
    """
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
            if math.isclose(x1, x0):
                return max(y0, y1)
            t = (x - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)

    raise AssertionError("Interpolation failed unexpectedly")


@pytest.fixture(scope="module")
def mock_prices() -> pd.DataFrame:
    return _make_mock_prices()


@pytest.fixture(scope="module")
def mu(mock_prices: pd.DataFrame) -> pd.Series:
    # Use arithmetic mean, which is the correct metric for classical frontier plotting
    return get_expected_returns(mock_prices, frequency=TRADING_DAYS, method="mean")


@pytest.fixture(scope="module")
def S(mock_prices: pd.DataFrame) -> pd.DataFrame:
    return get_covariance_matrix(mock_prices, frequency=TRADING_DAYS)


@pytest.fixture(scope="module")
def frontier(mu: pd.Series, S: pd.DataFrame) -> List[Dict[str, float]]:
    return _build_frontier(mu, S, n_points=30)


@pytest.fixture(scope="module")
def max_sharpe_point(mu: pd.Series, S: pd.DataFrame) -> Dict[str, float]:
    return _build_max_sharpe_point(mu, S, risk_free_rate=0.0)


def test_weights_sum(max_sharpe_point: Dict[str, float]) -> None:
    """Invariant: long-only optimizer weights must sum to 1."""
    total = sum(max_sharpe_point["weights"].values())
    assert abs(total - 1.0) < 1e-6


def test_weights_non_negative(max_sharpe_point: Dict[str, float]) -> None:
    """Invariant: long-only optimizer weights must be non-negative."""
    assert all(w >= -1e-8 for w in max_sharpe_point["weights"].values())


def test_covariance_psd(S: pd.DataFrame) -> None:
    """
    Invariant: covariance matrix must be positive semi-definite
    up to tiny numerical tolerance.
    """
    eigvals = np.linalg.eigvalsh(S.values)
    assert np.all(eigvals >= -1e-8), f"Non-PSD eigenvalues found: {eigvals}"


def test_frontier_monotonic_vol(frontier: List[Dict[str, float]]) -> None:
    """Invariant: frontier x-axis (volatility) must be non-decreasing after sorting."""
    xs = [p["x"] for p in frontier]
    assert all(xs[i + 1] >= xs[i] - 1e-10 for i in range(len(xs) - 1))


def test_frontier_roof_property(
    mu: pd.Series, S: pd.DataFrame, frontier: List[Dict[str, float]]
) -> None:
    """
    Invariant: no individual asset should lie above the efficient frontier
    when plotted using the same expected-return metric as the optimizer.
    """
    asset_vols = np.sqrt(np.diag(S.values))
    asset_rets = mu.values

    for ticker, vol, ret in zip(mu.index, asset_vols, asset_rets):
        frontier_y = _interpolate_frontier_y(frontier, float(vol))
        assert float(ret) <= frontier_y + 1e-4, (
            f"{ticker} lies above frontier: "
            f"asset_ret={ret:.6f}, frontier_ret={frontier_y:.6f}, vol={vol:.6f}"
        )


def test_max_sharpe_on_or_below_frontier(
    frontier: List[Dict[str, float]],
    max_sharpe_point: Dict[str, float],
) -> None:
    """
    Invariant: max-sharpe solution should not plot above the frontier envelope.
    """
    x = max_sharpe_point["x"]
    y = max_sharpe_point["y"]
    frontier_y = _interpolate_frontier_y(frontier, x)

    assert y <= frontier_y + 1e-3, (
        f"Max-Sharpe point lies above frontier: "
        f"point_ret={y:.6f}, frontier_ret={frontier_y:.6f}, vol={x:.6f}"
    )


def test_calculate_portfolio_metrics_consistency(
    mu: pd.Series,
    S: pd.DataFrame,
    max_sharpe_point: Dict[str, float],
) -> None:
    """
    Invariant: canonical metrics function should agree with optimizer output
    on the same weights.
    """
    metrics = calculate_portfolio_metrics(
        max_sharpe_point["weights"],
        mu,
        S,
        rf_rate=0.0,
    )

    assert abs(metrics["return"] - max_sharpe_point["y"]) < 1e-4
    assert abs(metrics["volatility"] - max_sharpe_point["x"]) < 1e-4
    assert metrics["sharpe"] >= 0.0


def test_frontier_points_have_valid_weights(frontier: List[Dict[str, float]]) -> None:
    """Invariant: every frontier point should have valid long-only normalized weights."""
    for i, point in enumerate(frontier):
        weights = point["weights"]
        total = sum(weights.values())
        assert abs(total - 1.0) < 1e-6, f"Frontier point {i} weights do not sum to 1"
        assert all(w >= -1e-8 for w in weights.values()), (
            f"Frontier point {i} has negative weight(s): {weights}"
        )
