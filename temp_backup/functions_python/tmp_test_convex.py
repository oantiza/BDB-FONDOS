from pypfopt.efficient_frontier import EfficientFrontier
import numpy as np
import cvxpy as cp
import pandas as pd

mu = pd.Series([0.05, 0.08, 0.12])
S = pd.DataFrame([
    [0.1, 0.0, 0.0],
    [0.0, 0.15, 0.0],
    [0.0, 0.0, 0.2]
])

ef = EfficientFrontier(mu, S)
target_arr = np.array([0.5, 0.3, 0.2])

def tracking_error_objective(w, w_target):
    return cp.sum_squares(w - w_target)

# Add constraint first
ef.add_constraint(lambda w: w[0] <= 0.3)

try:
    ws = ef.convex_objective(tracking_error_objective, w_target=target_arr)
    print("convex_objective returned:", ws)
    print("ef.weights:", ef.weights)
except Exception as e:
    print("Error:", e)
