import pandas as pd
import numpy as np

# Simulate data
dates = pd.date_range('2024-01-01', periods=10)
df = pd.DataFrame(index=dates)

# Asset A is alive the whole time
df['A'] = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]

# Asset B is born on day 5
df['B'] = [np.nan, np.nan, np.nan, np.nan, 50, 51, 52, 53, 54, 55]

weights_map = {'A': 0.6, 'B': 0.4}

valid_assets = ['A', 'B']
df_port = df[valid_assets]

# Note: fill_method=None to prevent filling across NaNs inappropriately
returns = df_port.pct_change(fill_method=None)
returns = returns.dropna(how="all")

print("Returns:\n", returns)

# Create weight matrix matching returns index
w_df = pd.DataFrame(index=returns.index, columns=returns.columns)
for c in w_df.columns:
    w_df[c] = weights_map.get(c, 0)

# Set weights to 0 where asset has no return data (pre-inception or gaps)
w_df = w_df.mask(returns.isna(), 0.0)
print("\nW Matrix before norm:\n", w_df)

# Re-normalize point-in-time
w_sum = w_df.sum(axis=1)
w_df = w_df.div(w_sum.replace(0, np.nan), axis=0).fillna(0.0)

print("\nW Matrix after norm:\n", w_df)

# Calculate portfolio daily returns
aggr_returns = (returns.fillna(0.0) * w_df).sum(axis=1)

print("\nAggr Returns:\n", aggr_returns)
