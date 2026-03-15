import pandas as pd
import numpy as np
from pypfopt import expected_returns, risk_models, EfficientFrontier
import cvxpy as cp

# Mock data
np.random.seed(42)
returns = np.random.normal(0.001, 0.02, (100, 3))
df = pd.DataFrame(returns, columns=['A', 'B', 'C'])

mu = expected_returns.mean_historical_return(df)
S = risk_models.sample_cov(df)

ef = EfficientFrontier(mu, S)

target_weights = np.array([0.5, 0.3, 0.2])

def deviation_objective(w, w_target):
    return cp.sum_squares(w - w_target)

# Enforce a constraint to see if it moves
# e.g. A must be <= 0.2
ef.add_constraint(lambda w: w[0] <= 0.2)

# Minimize custom objective
try:
    ef.convex_objective(deviation_objective, w_target=target_weights)
    w = ef.clean_weights()
    print("Optimization success:", w)
except Exception as e:
    print("Error:", e)
