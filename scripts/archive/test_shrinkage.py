import pandas as pd
import numpy as np
from pypfopt import risk_models

# Make fake returns
np.random.seed(42)
rets = np.random.normal(0, 0.01, (60, 25))
df = pd.DataFrame(rets, columns=[f"A{i}" for i in range(25)])

# Use constant_variance (default)
S_cv = risk_models.CovarianceShrinkage(df, returns_data=True).ledoit_wolf()

# Use constant_correlation
S_cc = risk_models.CovarianceShrinkage(df, returns_data=True).ledoit_wolf(shrinkage_target="constant_correlation")

print("Diagonal CV:", np.diag(S_cv)[:5])
print("Diagonal CC:", np.diag(S_cc)[:5])
print("Sample Diagonal:", np.diag(df.cov() * 252)[:5])

