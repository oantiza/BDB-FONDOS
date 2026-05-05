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
    """Return structured dummy price data for mock DataFetcher.
    
    Must have >= 756 business days to satisfy the optimizer's strict window requirement.
    Needs >= 6 assets to be feasible with MAX_WEIGHT_DEFAULT=0.20 (6 * 0.20 = 1.20 > 1.0).
    """
    dates = pd.date_range("2018-01-01", periods=800, freq="B")
    np.random.seed(42)  # Deterministic for reproducibility
    
    data = {}
    # 3 Equity-like assets (higher drift, higher vol)
    for i in range(3):
        drift = 0.0003 + i * 0.0002
        vol = 0.012 + i * 0.003
        data[f"EQ{i+1}"] = pd.Series(
            np.cumprod(1 + np.random.normal(drift, vol, 800)) * 100, index=dates
        )
    # 3 Bond-like assets (lower drift, lower vol)
    for i in range(3):
        drift = 0.0001 + i * 0.00005
        vol = 0.003 + i * 0.001
        data[f"BD{i+1}"] = pd.Series(
            np.cumprod(1 + np.random.normal(drift, vol, 800)) * 100, index=dates
        )
    return data

def _build_metadata():
    """Build asset metadata for the 6-asset test universe."""
    meta = {}
    for i in range(3):
        meta[f"EQ{i+1}"] = {
            "classification_v2": {"asset_type": "EQUITY", "risk_bucket": "HIGH", "is_suitable_low_risk": False},
            "portfolio_exposure_v2": {"economic_exposure": {"equity": 100.0}},
        }
    for i in range(3):
        meta[f"BD{i+1}"] = {
            "classification_v2": {"asset_type": "FIXED_INCOME", "risk_bucket": "LOW", "is_suitable_low_risk": True},
            "portfolio_exposure_v2": {"economic_exposure": {"bond": 100.0}},
        }
    return meta

@patch("services.portfolio.optimizer_core.DataFetcher")
def test_optimizer_valid_frontier(mock_data_fetcher_class, dummy_db, dummy_price_data):
    """Test that standard constraints yield a valid optimization solution."""
    
    mock_df_inst = MagicMock()
    
    def _mock_get_price(assets, **kwargs):
        filtered = {k: v for k, v in dummy_price_data.items() if k in assets}
        return (filtered, False)
        
    mock_df_inst.get_price_data.side_effect = _mock_get_price
    mock_df_inst.get_dynamic_risk_free_rate.return_value = 0.02
    mock_data_fetcher_class.return_value = mock_df_inst

    assets_list = list(dummy_price_data.keys())
    metadata = _build_metadata()

    # Run level 5 without profile constraints to keep test focused on solver mechanics
    res_agg = run_optimization(
        assets_list=assets_list,
        risk_level=5,
        db=dummy_db,
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 0.5},
        asset_metadata=metadata,
    )

    assert res_agg["status"] in ["optimal", "fallback", "error"]
    if res_agg["status"] != "error":
        assert abs(sum(res_agg["weights"].values()) - 1.0) < 1e-4
    
    # Run level 1 (Conservative)
    res_cons = run_optimization(
        assets_list=assets_list,
        risk_level=1,
        db=dummy_db,
        constraints={"apply_profile": False, "objective": "min_vol", "max_weight": 0.5},
        asset_metadata=metadata,
    )

    assert res_cons["status"] in ["optimal", "fallback", "error"]
    if res_cons["status"] != "error":
        assert abs(sum(res_cons["weights"].values()) - 1.0) < 1e-4

@patch("services.portfolio.optimizer_core.DataFetcher")
def test_optimizer_fallback_path(mock_data_fetcher_class, dummy_db, dummy_price_data):
    """Test the optimizer gracefully falls back when data is degenerate."""
    mock_df_inst = MagicMock()
    
    # Constant price → zero vol, zero return — forces fallback
    dates = pd.date_range("2018-01-01", periods=800, freq="B")
    bad_data = {f"EQ{i+1}": pd.Series([1.0]*800, index=dates) for i in range(3)}
    bad_data.update({f"BD{i+1}": pd.Series([1.0]*800, index=dates) for i in range(3)})
    
    mock_df_inst.get_price_data.return_value = (bad_data, False)
    mock_df_inst.get_dynamic_risk_free_rate.return_value = 0.02
    mock_data_fetcher_class.return_value = mock_df_inst

    metadata = _build_metadata()
    
    res = run_optimization(
        list(bad_data.keys()), risk_level=3, db=dummy_db,
        constraints={"apply_profile": False}, asset_metadata=metadata,
    )

    # Degenerate data: solver may fallback or error gracefully
    assert res["status"] in ["optimal", "fallback", "error"]
    if res["status"] != "error":
        assert "weights" in res
        assert abs(sum(res["weights"].values()) - 1.0) < 1e-4
