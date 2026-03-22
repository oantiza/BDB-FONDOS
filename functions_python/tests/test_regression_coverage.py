import pytest
import pandas as pd
import numpy as np
from unittest.mock import MagicMock, patch

from services.portfolio.analyzer import analyze_portfolio
from services.portfolio.frontier_engine import generate_efficient_frontier
from services.portfolio.optimizer_core import run_optimization
from services.portfolio.utils import _classify_asset

# ---------------------------------------------------------
# Mocks & Fixtures
# ---------------------------------------------------------

@pytest.fixture
def mock_db():
    mock = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = False
    mock.collection().document().get.return_value = mock_doc
    return mock


class MockDataFetcher:
    def __init__(self, price_data, rf_rate=0.02, missing=False):
        self.price_data = price_data
        self.rf_rate = rf_rate
        self.missing = missing

    def get_price_data(self, assets, **kwargs):
        if self.missing:
            return ({}, True)
        # Filter existing
        filtered = {k: v for k, v in self.price_data.items() if k in assets}
        return (filtered, False)

    def get_dynamic_risk_free_rate(self):
        return self.rf_rate


@pytest.fixture
def short_history_fetcher():
    """Simulates a short common history (e.g. 55 days)"""
    dates_A = pd.date_range("2023-01-01", periods=100, freq="B")
    dates_B = pd.date_range("2023-03-01", periods=55, freq="B")
    data = {
        "A": pd.Series(np.random.normal(0, 0.01, 100), index=dates_A),
        "B": pd.Series(np.random.normal(0, 0.01, 55), index=dates_B)
    }
    return MockDataFetcher(data)


@pytest.fixture
def empty_history_fetcher():
    """Simulates no price data available"""
    return MockDataFetcher({}, missing=True)

# ---------------------------------------------------------
# Tests for Analyzer
# ---------------------------------------------------------

def test_analyzer_empty_portfolio(mock_db):
    """analyzer: portfolio vacío -> status=error + message + error"""
    res = analyze_portfolio({}, db=mock_db)
    assert res.get("status") == "error"
    assert "Portfolio is empty" in res.get("message", "")
    assert "error" in res


@patch("services.portfolio.analyzer.DataFetcher")
def test_analyzer_insufficient_history(mock_fetcher_class, short_history_fetcher, mock_db):
    """analyzer: historial común corto (< 60 observaciones) -> status=error + metadata"""
    mock_fetcher_class.return_value = short_history_fetcher

    res = analyze_portfolio({"A": 0.5, "B": 0.5}, db=mock_db)
    
    assert res.get("status") == "error"
    assert "muy corto" in res.get("message", "").lower() or "too short" in res.get("message", "").lower() or "demasiado corto" in res.get("message", "").lower()
    assert "error" in res
    assert "effective_start_date" in res
    assert "observations" in res
    assert res["observations"] == 58


@patch("services.portfolio.analyzer.DataFetcher")
def test_analyzer_missing_data(mock_fetcher_class, empty_history_fetcher, mock_db):
    """analyzer: no hay datos para los activos dados -> status=error"""
    mock_fetcher_class.return_value = empty_history_fetcher
    
    res = analyze_portfolio({"NOT_EXISTS": 1.0}, db=mock_db)
    assert res.get("status") == "error"
    assert "Insufficient historical data" in res.get("message", "") or "None of the provided assets" in res.get("message", "")
    assert "error" in res

# ---------------------------------------------------------
# Tests for Optimizer
# ---------------------------------------------------------

@patch("services.portfolio.optimizer_core.DataFetcher")
def test_optimizer_short_history(mock_fetcher_class, short_history_fetcher, mock_db):
    """optimizer: no puede optimizar si la muestra es corta (< 60 observaciones) -> fallback dict"""
    mock_fetcher_class.return_value = short_history_fetcher
    # For constraints and defaults
    metadata = {
        "A": {"classification_v2": {"asset_type": "EQUITY", "risk_bucket": "HIGH"}},
        "B": {"classification_v2": {"asset_type": "FIXED_INCOME", "risk_bucket": "LOW"}}
    }

    res = run_optimization(
        assets_list=["A", "B"], 
        risk_level=3, 
        db=mock_db, 
        asset_metadata=metadata
    )
    
    # Optimizer fallback early return mechanism
    assert res.get("status") == "error"
    assert "infeasible_history" in res.get("message", "").lower() or "too short" in res.get("message", "").lower()

# ---------------------------------------------------------
# Tests for Frontier Engine
# ---------------------------------------------------------

@patch("services.portfolio.frontier_engine.DataFetcher")
def test_frontier_short_history(mock_fetcher_class, short_history_fetcher, mock_db):
    """frontier: retorna error pero preservando la metadata legacy vacía cuando hay historia corta"""
    mock_fetcher_class.return_value = short_history_fetcher
    
    metadata = {
        "A": {"classification_v2": {"asset_type": "EQUITY"}},
        "B": {"classification_v2": {"asset_type": "FIXED_INCOME"}}
    }

    res = generate_efficient_frontier(["A", "B"], db=mock_db)
    
    assert res.get("status") == "error"
    assert "error" in res
    assert "demasiado corto" in res.get("message", "").lower()
    assert "effective_start_date" in res
    assert "observations" in res
    assert res["observations"] == 58
    
    # Check legacy math structures are preserved empty
    assert "frontier" in res
    assert "math_data" in res
    assert res["frontier"] == []

# ---------------------------------------------------------
# Tests for Taxonomy Utils
# ---------------------------------------------------------

def test_classify_asset_fallback():
    """
    Verify _classify_asset behavior without touching label, using asset_class fallback perfectly.
    """
    # 1. classification_v2 takes precedence
    meta1 = {
        "A": {
            "classification_v2": {"asset_type": "FIXED_INCOME"},
            "asset_class": "RV" # SHOULD BE IGNORED
        }
    }
    assert _classify_asset("A", meta1) == "RF"

    # 2. If classification_v2 is missing, falls back to legacy `asset_class` -> RV
    meta2 = {
        "A": {
            "asset_class": "RV"
        }
    }
    assert _classify_asset("A", meta2) == "RV"

    # 3. If everything is missing
    meta3 = {}
    assert _classify_asset("A", meta3) == "Otros"
