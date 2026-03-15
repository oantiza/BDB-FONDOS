import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch

from services.portfolio.optimizer_core import run_optimization

@pytest.fixture
def dummy_db():
    """Mock the Firestore DB injected into the optimizer."""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False  # Force default risk buckets
    mock_db.collection().document().get.return_value = mock_doc
    return mock_db

@pytest.fixture
def dummy_price_data():
    """Return structured dummy price data for mock DataFetcher."""
    dates = pd.date_range("2020-01-01", periods=500, freq="B")
    
    # Simple growth series
    df_a = pd.Series(np.cumprod(1 + np.random.normal(0.0005, 0.015, 500)) * 100, index=dates)
    # Low vol series
    df_b = pd.Series(np.cumprod(1 + np.random.normal(0.0001, 0.003, 500)) * 100, index=dates)

    return {"FundA": df_a, "FundB": df_b}

@patch("services.portfolio.optimizer_core.DataFetcher")
def test_optimizer_valid_frontier(mock_data_fetcher_class, dummy_db, dummy_price_data):
    """Test that standard constraints yield a valid optimization solution."""
    
    # Setup mock fetcher
    mock_df_inst = MagicMock()
    mock_df_inst.get_price_data.return_value = (dummy_price_data, False)
    mock_df_inst.get_dynamic_risk_free_rate.return_value = 0.02
    mock_data_fetcher_class.return_value = mock_df_inst

    assets_list = ["FundA", "FundB"]
    
    # Setup standard metadata indicating Equity and Fixed Income
    metadata = {
        "FundA": {"asset_class": "RV", "portfolio_exposure_v2": {"equity": 100.0}},
        "FundB": {"asset_class": "RF", "portfolio_exposure_v2": {"bond": 100.0}}
    }

    # Run level 5 (Aggressive - mostly Equity)
    res_agg = run_optimization(
        assets_list=assets_list,
        risk_level=5,
        db=dummy_db,
        constraints={"apply_profile": True, "objective": "max_sharpe"},
        asset_metadata=metadata
    )

    print("RES_AGG:", res_agg)
    assert res_agg["status"] in ["optimal", "fallback"]
    # Weights should favor A (Equity) because it's level 5 but might split by max_weight
    assert "FundA" in res_agg["weights"]
    
    # Run level 1 (Conservative - mostly Bonds/Cash)
    res_cons = run_optimization(
        assets_list=assets_list,
        risk_level=1,
        db=dummy_db,
        constraints={"apply_profile": True, "objective": "max_sharpe"},
        asset_metadata=metadata
    )

    print("RES_CONS:", res_cons)
    assert res_cons["status"] in ["optimal", "fallback"]
    # In conservative, FundA (Equity) should be capped at max ~15% depending on defaults
    # Actually risk level 1 caps RV at 5% or 15%
    # We just ensure it solves and weights sum to 1
    assert abs(sum(res_cons["weights"].values()) - 1.0) < 1e-4

@patch("services.portfolio.optimizer_core.DataFetcher")
def test_optimizer_fallback_path(mock_data_fetcher_class, dummy_db, dummy_price_data):
    """Test the optimizer gracefully falls back when objective or constraints are impossible."""
    mock_df_inst = MagicMock()
    
    # We pass bad data
    bad_data = {
        "FundA": pd.Series([1.0]*500, index=pd.date_range("2020-01-01", periods=500, freq="B"))
    }
    mock_df_inst.get_price_data.return_value = (bad_data, False)
    mock_df_inst.get_dynamic_risk_free_rate.return_value = 0.02
    mock_data_fetcher_class.return_value = mock_df_inst

    metadata = {"FundA": {"asset_class": "RV"}}
    
    # Expected Return is 0, Vol is 0. Normal efficient_risk or target solves fail.
    res = run_optimization(["FundA"], risk_level=3, db=dummy_db, constraints={"apply_profile": False}, asset_metadata=metadata)

    # It should fallback (relaxed, min_vol, or equal weight)
    assert res["status"] in ["optimal", "fallback"]  # If fallback min_vol succeeds it sets ok
    assert "solver_path" in res
    assert "weights" in res
    assert res["weights"]["FundA"] > 0.99
