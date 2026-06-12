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
            return ({}, [])
        # Filter existing
        filtered = {k: v for k, v in self.price_data.items() if k in assets}
        return (filtered, [])

    def get_dynamic_risk_free_rate(self):
        return self.rf_rate


@pytest.fixture
def short_history_fetcher():
    """Simulates a portfolio where ONE asset has short history (55 days) and ONE has sufficient (100 days).
    
    Contract (post-hardening commit 9198e63):
    - Analyzer: excludes 'B' (< 60 obs), continues with 'A' → status=success
    - Frontier: uses common window = ~55 obs (>= 30 threshold) → status=success
    """
    dates_A = pd.date_range("2023-01-01", periods=100, freq="B")
    dates_B = pd.date_range("2023-03-01", periods=55, freq="B")
    data = {
        "A": pd.Series(np.random.normal(0, 0.01, 100), index=dates_A),
        "B": pd.Series(np.random.normal(0, 0.01, 55), index=dates_B)
    }
    return MockDataFetcher(data)


@pytest.fixture
def all_short_history_fetcher():
    """Simulates a portfolio where ALL assets have short history (< 60 obs).
    
    Contract: analyzer should return status=error because no asset survives the
    minimum-observations guard. This tests the critical error path that remains
    after the hardening in commit 9198e63.
    """
    dates_A = pd.date_range("2023-03-01", periods=45, freq="B")
    dates_B = pd.date_range("2023-03-01", periods=50, freq="B")
    data = {
        "A": pd.Series(np.random.normal(0, 0.01, 45), index=dates_A),
        "B": pd.Series(np.random.normal(0, 0.01, 50), index=dates_B)
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
    """analyzer: ONE asset with short history (< 60 obs) + ONE with sufficient history.
    
    CONTRACT (post-hardening, commit 9198e63 'Harden historical series alignment'):
    - The analyzer EXCLUDES the asset with insufficient history (< 60 obs).
    - Continues with the remaining valid asset.
    - Returns status=success with real metrics for the surviving asset.
    - A WARNING log is emitted for the excluded asset.
    
    The OLD contract (status=error for any short asset) was written BEFORE the
    deliberate hardening. The hardening was intentional: partial analysis is
    better than a blanket error when at least one asset is viable.
    """
    mock_fetcher_class.return_value = short_history_fetcher

    res = analyze_portfolio({"A": 0.5, "B": 0.5}, db=mock_db)

    # Post-hardening contract: partial exclusion → success
    assert res.get("status") == "success", (
        f"Expected success after excluding short-history asset B. Got: {res.get('status')} — {res.get('message')}"
    )
    # Real metrics must be present (computed on surviving asset A)
    assert "portfolio_metrics" in res
    metrics = res["portfolio_metrics"]
    assert metrics.get("observations", 0) > 0
    assert "effective_start_date" in metrics


@patch("services.portfolio.analyzer.DataFetcher")
def test_analyzer_all_assets_insufficient_history(mock_fetcher_class, all_short_history_fetcher, mock_db):
    """analyzer: ALL assets have short history (< 60 obs) → status=error.
    
    This is the CRITICAL error path that still exists after hardening:
    when NO asset survives the minimum-observations guard, the analyzer
    correctly returns an error (no viable partial result is possible).
    """
    mock_fetcher_class.return_value = all_short_history_fetcher

    res = analyze_portfolio({"A": 0.5, "B": 0.5}, db=mock_db)

    assert res.get("status") == "error"
    assert "error" in res


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
    
    # FIX H3 (auditoria 2026-06-09): el historico insuficiente ya no sale como
    # status 'error' con el prefijo tecnico INFEASIBLE_HISTORY, sino como
    # resultado estructurado 'infeasible' con recovery_candidates y mensaje de
    # usuario (contrato en test_optimizer_infeasible_history_contract.py).
    assert res.get("status") == "infeasible"
    assert res.get("solver_path") == "blocked_insufficient_history"
    assert "faltan datos hist" in res.get("message", "").lower()

# ---------------------------------------------------------
# Tests for Frontier Engine
# ---------------------------------------------------------

@patch("services.portfolio.frontier_engine.DataFetcher")
def test_frontier_short_history(mock_fetcher_class, short_history_fetcher, mock_db):
    """frontier: ONE asset with short history + ONE with sufficient. Common window ~55 obs.
    
    CONTRACT (post-hardening):
    - The frontier does NOT perform per-asset exclusion; it uses pairwise alignment
      (ffill + dropna), yielding ~55 obs common window.
    - 55 obs >= 30 (frontier minimum threshold) → status=success.
    - The frontier returns real mathematical data (assets, math_data).
    - Frontier points may or may not be present depending on CLA convergence.
    
    The OLD contract (status=error) was written before the 30-obs frontier threshold
    was tuned. The current threshold deliberately allows shorter windows for the
    frontier since it is less sensitive to sample size than the optimizer.
    """
    mock_fetcher_class.return_value = short_history_fetcher

    res = generate_efficient_frontier(["A", "B"], db=mock_db)

    # Post-hardening contract: 55 obs > 30 threshold → success
    assert res.get("status") == "success", (
        f"Expected success for 55-obs common window (threshold=30). Got: {res.get('status')} — {res.get('message')}"
    )
    assert "math_data" in res
    assert "assets" in res
    assert "frontier" in res
    assert res["observations"] > 0
    assert res["effective_start_date"] != "N/A"

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
