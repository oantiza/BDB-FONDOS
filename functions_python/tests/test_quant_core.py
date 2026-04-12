import pytest
import pandas as pd
import numpy as np
from services.quant_core import (
    get_expected_returns,
    get_covariance_matrix,
    calculate_historical_metrics,
)


@pytest.fixture
def dummy_prices():
    """Generate 100 days of dummy price data for 2 assets."""
    dates = pd.date_range(start="2023-01-01", periods=100, freq="B")
    np.random.seed(42)

    # Asset A: Upward trend
    asset_a = np.cumprod(1 + np.random.normal(0.0005, 0.01, size=100)) * 100
    # Asset B: Different profile
    asset_b = np.cumprod(1 + np.random.normal(0.0002, 0.015, size=100)) * 50

    return pd.DataFrame({"A": asset_a, "B": asset_b}, index=dates)


def test_get_expected_returns_bounds(dummy_prices):
    """Test get_expected_returns handles different methods without crashing and returns valid shapes."""
    # EMA
    mu_ema = get_expected_returns(dummy_prices, method="ema")
    assert len(mu_ema) == 2
    assert "A" in mu_ema.index
    assert not mu_ema.isna().any()

    # Mean
    mu_mean = get_expected_returns(dummy_prices, method="mean")
    assert len(mu_mean) == 2
    assert not mu_mean.isna().any()


def test_get_covariance_matrix_properties(dummy_prices):
    """Test get_covariance_matrix returns perfectly symmetric, semi-definite positive matrix."""
    S = get_covariance_matrix(dummy_prices)

    # Check shape
    assert S.shape == (2, 2)
    # Check Symmetry
    assert np.allclose(S, S.T, atol=1e-8)

    # Check positive semi-definite (eigenvalues >= 0)
    eigenvalues = np.linalg.eigvals(S)
    assert np.all(eigenvalues >= -1e-8)


def test_calculate_historical_metrics(dummy_prices):
    """Test calculate_historical_metrics calculates risk/return properly."""
    series_a = dummy_prices["A"]
    metrics = calculate_historical_metrics(series_a, risk_free_annual=0.0)

    assert metrics is not None
    assert "volatility" in metrics
    assert "sharpe" in metrics
    assert metrics["volatility"] > 0

    # Arithmetic vs Geometric
    metrics_arith = calculate_historical_metrics(series_a, method="arithmetic")
    assert metrics_arith is not None
    assert metrics["return"] != metrics_arith["return"]  # Should differ usually
