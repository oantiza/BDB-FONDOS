import logging
logger = logging.getLogger(__name__)
import numpy as np
import pandas as pd
from pypfopt import risk_models, expected_returns

TRADING_DAYS_PER_YEAR = 252

def get_covariance_matrix(df_prices: pd.DataFrame, frequency=TRADING_DAYS_PER_YEAR):
    """Canonical method for Covariance matrix using Ledoit-Wolf Shrinkage"""
    try:
        S = risk_models.CovarianceShrinkage(df_prices, frequency=frequency).ledoit_wolf()
    except Exception:
        S = risk_models.sample_cov(df_prices, frequency=frequency)
        
    S = risk_models.fix_nonpositive_semidefinite(S)
    
    # Cross-Module Consistency: Ensure perfect symmetry (fixes numerical floating precision issues)
    S = (S + S.T) / 2.0
    
    return S


def get_expected_returns(df_prices: pd.DataFrame, frequency=TRADING_DAYS_PER_YEAR, method="ema"):
    """Canonical expected returns"""
    if method == "ema":
        return expected_returns.ema_historical_return(df_prices, frequency=frequency, span=frequency)
    elif method == "mean":
        return expected_returns.mean_historical_return(df_prices, frequency=frequency)
    else:
        return expected_returns.capm_return(df_prices, frequency=frequency)


def calculate_portfolio_metrics(weights_dict: dict, mu_series: pd.Series, S_df: pd.DataFrame, rf_rate: float):
    """Calculates theoretical return, vol and sharpe of a point-in-time holding"""
    if not weights_dict or mu_series.empty or S_df.empty:
        return {"return": 0.0, "volatility": 0.0, "sharpe": 0.0}
        
    w_vec = np.array([weights_dict.get(t, 0.0) for t in mu_series.index])
    ret = float(w_vec.T @ mu_series.values)
    
    # Cross-Module Consistency: Ensure non-negative before sqrt (float precision issues)
    var = np.dot(w_vec.T, np.dot(S_df.values, w_vec))
    vol = float(np.sqrt(max(0.0, var)))
    
    sharpe = float((ret - rf_rate) / vol) if vol > 1e-6 else 0.0
    return {"return": ret, "volatility": vol, "sharpe": sharpe}


def calculate_historical_metrics(df_series: pd.Series, risk_free_annual=0.0, method="geometric"):
    """
    Standard metrics for a single price series.
    Method "arithmetic" matches legacy optimizer logic (simple mean * 252).
    Method "geometric" calculates true CAGR.
    """
    df = df_series.dropna()
    if len(df) < 5:
        return None
        
    days = (df.index[-1] - df.index[0]).days
    years = max(days / 365.25, 0.1)
    
    # 1. Volatility (Daily standard deviation of returns * sqrt(252))
    returns = df.pct_change().dropna()
    vol = returns.std() * np.sqrt(TRADING_DAYS_PER_YEAR)
    vol = max(float(vol), 0.0) # Cross-Module Consistency: Ensure non-negative volatility
    
    # 2. Return calculation
    if method == "geometric":
        total_ret = (df.iloc[-1] / df.iloc[0]) - 1
        ann_ret = (1 + total_ret) ** (1 / years) - 1
    else:
        # Arithmetic Mean
        ann_ret = returns.mean() * TRADING_DAYS_PER_YEAR
        
    # 3. Sharpe Calculation
    if method == "arithmetic":
        # Using daily excess return mean matching the calc_service legacy logic
        rf_daily = risk_free_annual / TRADING_DAYS_PER_YEAR
        excess_returns = returns - rf_daily
        if excess_returns.std() > 0:
            sharpe = (excess_returns.mean() / excess_returns.std()) * np.sqrt(TRADING_DAYS_PER_YEAR)
        else:
            sharpe = 0.0
    else:
        # Standard calculation
        sharpe = (ann_ret - risk_free_annual) / vol if vol > 1e-6 else 0.0
    
    # 4. Max Drawdown
    rolling_max = df.cummax()
    drawdown = (df / rolling_max) - 1.0
    max_dd = drawdown.min()
    
    # 5. Value at Risk (VaR) & CVaR (Historical Method, 95% Confidence)
    var_95 = np.percentile(returns, 5)
    cvar_returns = returns[returns <= var_95]
    cvar_95 = cvar_returns.mean() if len(cvar_returns) > 0 else var_95
    
    return {
        "return": float(ann_ret),
        "volatility": float(vol),
        "sharpe": float(sharpe),
        "max_drawdown": float(max_dd),
        "var_95_daily": float(var_95),
        "cvar_95_daily": float(cvar_95),
        "years": float(years),
        "points": len(df)
    }
