import pandas as pd
import numpy as np
from pypfopt import expected_returns, risk_models
from pypfopt.efficient_frontier import EfficientFrontier

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "../functions_python"))
from services.financial_engine import FinancialEngine

# 1. Generate Synthetic Daily Prices
np.random.seed(42)
dates = pd.date_range("2020-01-01", periods=1000, freq="B")
returns = np.random.normal(0.0005, 0.01, (1000, 3))
returns[:, 0] += 0.0002  # Make A slightly better
returns[:, 1] += 0.0001  # B
# C is baseline
prices = pd.DataFrame(100 * np.exp(returns.cumsum(axis=0)), index=dates, columns=['A', 'B', 'C'])

# 2. Case 1: No Views (Standard Markowitz)
rf_returns = prices.pct_change().dropna()
mu_raw = rf_returns.mean() * 252
S_raw = rf_returns.cov() * 252

# Optimizer
ef_no_views = EfficientFrontier(mu_raw, S_raw, weight_bounds=(0, 1))
weights_no_views = ef_no_views.max_sharpe()
# Clean weights
weights_no_views = ef_no_views.clean_weights()

print("--- WITHOUT VIEWS ---")
print("Expected Returns:\n", mu_raw)
print("Weights:\n", weights_no_views)

# 3. Case 2: Strong Tactical Views
# Say we think B will have 50% return, overpowering A.
views = {'B': 0.50}
mcaps = {'A': 1_000_000, 'B': 1_500_000, 'C': 500_000}

mu_bl, S_bl = FinancialEngine.black_litterman_optimization(
    df_prices=prices,
    market_caps=mcaps,
    views=views
)

ef_views = EfficientFrontier(mu_bl, S_bl, weight_bounds=(0, 1))
weights_views = ef_views.max_sharpe()
weights_views = ef_views.clean_weights()

print("\n--- WITH VIEWS ---")
print("Expected Returns:\n", mu_bl)
print("Weights:\n", weights_views)

print("\n--- SUMMARY ---")
if weights_no_views['B'] < weights_views['B']:
    print("SUCCESS: Tactical views successfully increased weight for B.")
else:
    print("FAILURE: Tactical views did not increase weight for B.")

