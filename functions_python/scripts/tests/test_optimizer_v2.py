import os
import sys
import pandas as pd
import numpy as np

# Add functions_python to path for imports
sys.path.append(os.path.join(os.getcwd(), "functions_python"))

from services.financial_engine import FinancialEngine
from services.quant_core import get_covariance_matrix, get_expected_returns
from models.canonical_types import PortfolioExposureV2


def test_optimization_v2():
    print("=== Testing Optimizer V2 Integration ===")

    # 1. Mock Data: 3 Real Funds (represented by mock prices for simplicity of the test logic)
    tickers = ["FUND_A", "FUND_B", "FUND_C"]
    dates = pd.date_range(start="2023-01-01", periods=100, freq="D")

    # Random but stable prices
    np.random.seed(42)
    df_prices = pd.DataFrame(
        {
            "FUND_A": np.cumprod(1 + np.random.normal(0.0001, 0.01, 100)),
            "FUND_B": np.cumprod(1 + np.random.normal(0.0002, 0.015, 100)),
            "FUND_C": np.cumprod(1 + np.random.normal(0.00015, 0.012, 100)),
        },
        index=dates,
    )

    # 2. Mock V2 Exposures
    exposures_v2 = {
        "FUND_A": PortfolioExposureV2(
            sectors={"TECHNOLOGY": 80.0, "HEALTHCARE": 20.0},
            equity_regions={"US": 100.0},
        ),
        "FUND_B": PortfolioExposureV2(
            sectors={"HEALTHCARE": 70.0, "FINANCIALS": 30.0},
            equity_regions={"EUROZONE": 100.0},
        ),
        "FUND_C": PortfolioExposureV2(
            sectors={"TECHNOLOGY": 20.0, "FINANCIALS": 80.0},
            equity_regions={"EMERGING": 100.0},
        ),
    }

    # 3. Calculate Mu and S
    mu = get_expected_returns(df_prices)
    S = get_covariance_matrix(df_prices)

    print("\n--- Basic Optimization (Max Sharpe) ---")
    ef = FinancialEngine.optimize_efficient_frontier(mu, S)
    weights = ef.max_sharpe()
    print(f"Weights: {ef.clean_weights()}")

    print("\n--- Constrained Optimization (Max 5% Tech) ---")
    constraints = {"exposure_limits": {"TECHNOLOGY": (0.0, 0.05)}}
    ef_constrained = FinancialEngine.optimize_efficient_frontier(
        mu, S, constraints=constraints, exposures_v2=exposures_v2
    )
    weights_constrained = ef_constrained.max_sharpe()
    cleaned_weights = ef_constrained.clean_weights()
    print(f"Constrained Weights: {cleaned_weights}")

    # Calculate tech exposure in resulting portfolio
    tech_exposure = sum(
        cleaned_weights[t] * (exposures_v2[t].sectors.get("TECHNOLOGY", 0.0) / 100.0)
        for t in tickers
    )
    print(f"Resulting Portfolio Tech Exposure: {tech_exposure:.2%}")

    if tech_exposure <= 0.05001:
        print("[OK] Constraint verified!")
    else:
        print("[FAIL] Constraint failed!")


if __name__ == "__main__":
    test_optimization_v2()
