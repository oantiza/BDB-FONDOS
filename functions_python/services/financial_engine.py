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
        [DELEGATED to quant_core] Implements Black-Litterman Model.
        
        This method is now a thin wrapper to preserve backward compatibility.
        """
        from services.quant_core import apply_black_litterman
        
        return apply_black_litterman(
            df_prices=df_prices,
            market_caps=market_caps,
            views=views,
            confidences=confidences,
            risk_aversion=risk_aversion
        )

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
                ef.add_constraint(lambda w, wv=w_vec, mx=max_val: w @ wv <= mx)
                if min_val > 0:
                    ef.add_constraint(lambda w, wv=w_vec, mn=min_val: w @ wv >= mn)

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

