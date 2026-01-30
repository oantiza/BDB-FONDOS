import pandas as pd
import numpy as np
from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions, black_litterman

class FinancialEngine:
    """
    Core Financial Calculation Engine.
    Pure Logic: No Database access, No external side effects.
    Input: DataFrames, Dicts
    Output: Weights, Metrics
    """

    @staticmethod
    def calculate_risk_model(df_prices: pd.DataFrame):
        """Calculates Mu (Expected Returns) and S (Covariance Matrix)"""
        # 1. Expected Returns (Exponential Moving Average)
        # frequency=52 because DataFetcher provides Weekly Data
        mu = expected_returns.ema_historical_return(df_prices, frequency=52, span=52)
        
        # 2. Covariance Matrix (Ledoit-Wolf Shrinkage for stability)
        try:
            S = risk_models.CovarianceShrinkage(df_prices, frequency=52).ledoit_wolf()
        except:
            # Fallback to standard sample covariance if shrinkage fails
            S = risk_models.sample_cov(df_prices)
            S = risk_models.fix_nonpositive_semidefinite(S)
            
        return mu, S

    @staticmethod
    def black_litterman_optimization(df_prices: pd.DataFrame, market_caps: dict, views: dict, confidences: dict = None, risk_aversion=None):
        """
        Implements Black-Litterman Model.
        
        :param df_prices: Historical prices
        :param market_caps: Dict {ticker: market_cap} for Market Equilibrium
        :param views: Dict {ticker: expected_return} (Absolute views)
        :param confidences: Dict {ticker: confidence_0_to_1}
        :return: new_mu, new_S (Adjusted by views)
        """
        # 1. Market Priors
        S = risk_models.CovarianceShrinkage(df_prices).ledoit_wolf()
        
        # Delta (Risk Aversion) - implied from S&P500 usually, or heuristic
        if risk_aversion is None:
            delta = black_litterman.market_implied_risk_aversion(df_prices)
        else:
            delta = risk_aversion

        # Market Prior Returns (Pi)
        # We need market caps to estimate equilibrium weights
        mcaps = pd.Series(market_caps)
        pi = black_litterman.market_implied_prior_returns(mcaps, delta, S)

        # 2. Integrate Views
        # Currently handling only Absolute Views (Asset X will return Y%)
        # TODO: Support Relative Views (Asset X > Asset Y)
        
        bl = black_litterman.BlackLittermanModel(
            S, 
            pi=pi, 
            absolute_views=views, 
            omega="idf", # Idzorek's method using confidences if provided
            view_confidences=confidences
        )
        
        ret_bl = bl.bl_returns()
        cov_bl = bl.bl_cov()
        
        return ret_bl, cov_bl

    @staticmethod
    def optimize_efficient_frontier(mu, S, constraints: dict = None, gamma=0.0):
        """
        Solves Mean-Variance Optimization.
        Supports: Max Weight, Min Weight, Sector/Region Constraints.
        """
        max_weight = constraints.get('max_weight', 1.0) if constraints else 1.0
        
        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
        
        # L2 Regularization (Gamma) restricts extreme weights ("corner solutions")
        if gamma > 0:
            ef.add_objective(objective_functions.L2_reg, gamma=gamma)
            
        # Apply Constraints
        if constraints:
            # Locked Assets (Min Weight)
            locked = constraints.get('locked_assets', [])
            for ticker in locked:
                if ticker in ef.tickers:
                    idx = ef.tickers.index(ticker)
                    ef.add_constraint(lambda w, i=idx: w[i] >= 0.03) # Hardcoded min 3% for locked
            
            # TODO: Add Sector/Region Constraints inputs
            
        return ef
    
    @staticmethod
    def calculate_portfolio_metrics(weights: dict, mu: pd.Series, S: pd.DataFrame, rf_rate: float):
        """Calculates expected return, volatility and Sharpe"""
        w_vec = np.array([weights.get(t, 0.0) for t in mu.index])
        
        ret = np.sum(w_vec * mu.values)
        vol = np.sqrt(np.dot(w_vec.T, np.dot(S.values, w_vec)))
        sharpe = (ret - rf_rate) / vol if vol > 0 else 0.0
        
        return {
            'return': float(ret),
            'volatility': float(vol),
            'sharpe': float(sharpe)
        }
