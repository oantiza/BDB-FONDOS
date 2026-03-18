import pandas as pd
import numpy as np
from pypfopt import (
    EfficientFrontier,
    risk_models,
    expected_returns,
    objective_functions,
    black_litterman,
)


from models.canonical_types import AssetClassV2, PortfolioExposureV2

class FinancialEngine:
    """
    Core Financial Calculation Engine.
    Pure Logic: No Database access, No external side effects.
    Input: DataFrames, Dicts, V2 Models
    Output: Weights, Metrics
    """


    @staticmethod
    def black_litterman_optimization(
        df_prices: pd.DataFrame,
        market_caps: dict,
        views: dict,
        confidences: dict = None,
        risk_aversion=None,
    ):
        """
        Implements Black-Litterman Model.

        :param df_prices: Historical prices
        :param market_caps: Dict {ticker: market_cap} for Market Equilibrium
        :param views: Dict {ticker: raw_tilt} (Relative tilts from frontend, e.g. +0.02 / -0.02)
        :param confidences: Dict {ticker: confidence_0_to_1}
        :return: new_mu, new_S (Adjusted by views)
        """
        from services.quant_core import get_covariance_matrix
        
        # 1. Market Priors
        # Canonical frequency is now derived intelligently within the core.
        S = get_covariance_matrix(df_prices)

        # Delta (Risk Aversion) - implied from S&P500 usually, or heuristic
        if risk_aversion is None:
            # df_prices is a multiactive fund dataframe, not a market proxy (like SPY).
            # We use the standard theoretical heuristic of 2.5 if no proxy is given.
            delta = 2.5
        else:
            delta = risk_aversion

        # Market Prior Returns (Pi)
        # We need market caps to estimate equilibrium weights
        mcaps = pd.Series(market_caps)
        pi = black_litterman.market_implied_prior_returns(mcaps, delta, S)

        # 2. Integrate Views
        # The frontend sends a relative magnitude of tilt (+0.02 or -0.02).
        # We add this tilt to the market prior so the new absolute view makes sense.
        absolute_views = {}
        filtered_confidences = {}

        for ticker, raw_tilt in views.items():
            if ticker in pi:
                absolute_views[ticker] = float(pi[ticker]) + float(raw_tilt)
                if confidences is not None and ticker in confidences:
                    filtered_confidences[ticker] = confidences[ticker]

        omega_method = "idzorek" if filtered_confidences else "default"

        bl = black_litterman.BlackLittermanModel(
            S,
            pi=pi,
            absolute_views=absolute_views,
            omega=omega_method,
            view_confidences=filtered_confidences if filtered_confidences else None,
        )

        ret_bl = bl.bl_returns()
        cov_bl = bl.bl_cov()

        return ret_bl, cov_bl

    @staticmethod
    def build_exposure_constraints(ef, tickers, exposures_v2: dict, limits: dict):
        """
        Dynamically applies constraints to the EfficientFrontier object
        based on PortfolioExposureV2 data (Sectors, Regions, etc).

        :param ef: EfficientFrontier instance
        :param tickers: List of tickers in the optimization
        :param exposures_v2: Dict {ticker: PortfolioExposureV2}
        :param limits: Dict {category_name: (min, max)} e.g. {"TECHNOLOGY": (0, 0.3)}
        """
        for category, (min_val, max_val) in limits.items():
            # Create a mapper for this specific category
            # We assume category is found in sectors, equity_regions, or alternatives
            weights = []
            for t in tickers:
                exp = exposures_v2.get(t)
                if not exp:
                    weights.append(0.0)
                    continue
                
                # Check sectors
                val = exp.sectors.get(category, 0.0) / 100.0
                if val == 0:
                    # Check regions
                    val = exp.equity_regions.get(category, 0.0) / 100.0
                if val == 0:
                    # Check alternatives
                    val = exp.alternatives.get(category, 0.0) / 100.0
                
                weights.append(val)
            
            if any(w > 0 for w in weights):
                w_vec = np.array(weights)
                ef.add_constraint(lambda w: w @ w_vec <= max_val)
                if min_val > 0:
                    ef.add_constraint(lambda w: w @ w_vec >= min_val)

    @staticmethod
    def optimize_efficient_frontier(mu, S, constraints: dict = None, exposures_v2: dict = None, gamma=0.0):
        """
        Solves Mean-Variance Optimization.
        Now supports Exposure-based constraints (V2).
        """
        max_weight = constraints.get("max_weight", 1.0) if constraints else 1.0
        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))

        if gamma > 0:
            ef.add_objective(objective_functions.L2_reg, gamma=gamma)

        # Apply Standard Constraints
        if constraints:
            # Locked Assets
            locked = constraints.get("locked_assets", [])
            for ticker in locked:
                if ticker in ef.tickers:
                    idx = ef.tickers.index(ticker)
                    ef.add_constraint(lambda w, i=idx: w[i] >= 0.03)

            # Exposure Limits (Sectors / Regions)
            exposure_limits = constraints.get("exposure_limits", {})
            if exposure_limits and exposures_v2:
                FinancialEngine.build_exposure_constraints(ef, ef.tickers, exposures_v2, exposure_limits)

        return ef

