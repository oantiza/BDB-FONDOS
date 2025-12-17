# Advanced Risk Metrics Utilities
import pandas as pd
import numpy as np

def calculate_max_drawdown(price_series):
    """Calculate maximum drawdown from price series"""
    if len(price_series) < 2:
        return 0
    
    cumulative = (1 + price_series.pct_change()).cumprod()
    running_max = cumulative.expanding().max()
    drawdown = (cumulative - running_max) / running_max
    return abs(drawdown.min())

def calculate_sortino_ratio(returns, risk_free_rate=0.03):
    """Calculate Sortino Ratio (return / downside deviation)"""
    if len(returns) < 2:
        return 0
    
    excess_returns = returns - (risk_free_rate / 252)  # Daily risk-free
    downside_returns = excess_returns[excess_returns < 0]
    
    if len(downside_returns) == 0:
        return 0
    
    downside_std = downside_returns.std()
    if downside_std == 0:
        return 0
    
    return (returns.mean() * 252) / (downside_std * np.sqrt(252))

def calculate_calmar_ratio(returns, max_drawdown):
    """Calculate Calmar Ratio (CAGR / Max Drawdown)"""
    if max_drawdown == 0:
        return 0
    
    cagr = (1 + returns.mean()) ** 252 - 1
    return cagr / max_drawdown

def smart_prefilter_candidates(candidates, target_vol, min_sharpe=0):
    """
    Pre-filter candidates before optimization
    Remove funds with obvious issues
    """
    filtered = []
    
    for c in candidates:
        # Get metrics with defaults
        sharpe = c.get('sharpe', 0)
        volatility = c.get('volatility', 0.15)
        alpha = c.get('alpha', 0)
        data_years = c.get('data_years', 0)
        
        # Filter rules
        skip = False
        
        # 1. Negative Sharpe (losing money after risk adjustment)
        if sharpe < min_sharpe:
            skip = True
        
        # 2. Volatility > 2x target (too risky)
        if volatility > target_vol * 2:
            skip = True
        
        # 3. Severely negative alpha
        if alpha < -0.10:  # -10% alpha
            skip = True
        
        # 4. Insufficient data
        if data_years < 1:
            skip = True
        
        if not skip:
            filtered.append(c)
    
    return filtered
