import pandas as pd
import numpy as np
from pypfopt import CLA, risk_models, expected_returns

def test_frontier():
    # Simulate 3 years of daily returns for 3 assets
    np.random.seed(42)
    dates = pd.date_range('2023-01-01', periods=756, freq='B')
    
    data = {
        'FUND_A': 100 * (1 + np.random.normal(0.0005, 0.015, 756)).cumprod(),
        'FUND_B': [100.0] * 756
    }
    df = pd.DataFrame(data, index=dates)
    
    print("DataFrame shape:", df.shape)
    
    # 2. Senior Math Engine (mean/sample_cov)
    mu = expected_returns.mean_historical_return(df, frequency=252)
    S = risk_models.sample_cov(df, frequency=252)
    S = risk_models.fix_nonpositive_semidefinite(S)
    
    print("\nExpected Returns (mu):\n", mu)
    print("\nCovariance Matrix (S):\n", S)

    # 3. CLA Engine
    print("\nInitializing CLA...")
    try:
        # POTENTIAL BUG: fix_nonpositive_semidefinite returns numpy array
        S = risk_models.fix_nonpositive_semidefinite(S)
        print("S type after fix:", type(S))
        
        # This should fail if S is numpy
        try:
            print("Accessing S.values...")
            val = S.values
        except AttributeError as e:
            print(f"CRASH on S.values: {e}")

        try:
            print("Accessing S.loc...")
            ticker = df.columns[0]
            val = S.loc[ticker, ticker]
        except AttributeError as e:
            print(f"CRASH on S.loc: {e}")

        cla = CLA(mu, S)
        frontier_ret, frontier_vol, _ = cla.efficient_frontier(points=30)
        
        frontier_points = []
        for v_raw, r_raw in zip(frontier_vol, frontier_ret):
            v = float(v_raw)
            r = float(r_raw)
            if np.isnan(v) or np.isnan(r): continue
            frontier_points.append({'x': round(v, 4), 'y': round(r, 4)})
        
        print(f"Frontier Points Generated: {len(frontier_points)}")
        if len(frontier_points) > 0:
            print("Sample Point:", frontier_points[0])
            
    except Exception as e:
        print(f"FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_frontier()
