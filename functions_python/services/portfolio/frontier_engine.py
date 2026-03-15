import logging
logger = logging.getLogger(__name__)
import pandas as pd
import numpy as np
from pypfopt import CLA
from services.data_fetcher import DataFetcher
from .utils import apply_market_proxy_backfill


def generate_efficient_frontier(assets_list, db, portfolio_weights=None, period="3y"):
    """
    Calcula puntos de la Frontera Eficiente y métricas de activos individuales.
    Allows optional portfolio_weights {isin: weight} to calculate specific portfolio point.
    """
    try:
        logger.info(
            f"🚀 [Senior EF] Starting generate_efficient_frontier for {len(assets_list)} assets. Period: {period}"
        )

        # 1. Senior Data Alignment
        fetcher = DataFetcher(db)
        # Adding no_fill=True to identify true data start date (preventing hockey stick)
        price_data, synthetic_used = fetcher.get_price_data(
            assets_list, resample_freq="D", strict=False, no_fill=True
        )

        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)

        # SANITIZACIÓN PROFESIONAL (Evitar distorsión de covarianza)
        df = df.sort_index()

        # --- FIXED TIME HORIZON (Pairwise Covariance Support) ---
        if not df.empty:
            # 1. Definir ventana ideal según parámetro 'period'
            period_days_map = {
                "1y": 365,
                "3y": 1095,
                "5y": 1825,
                "ytd": 252,
                "max": 10000,
            }
            lookback_days = period_days_map.get(period, 1095)
            ideal_start = df.index[-1] - pd.Timedelta(days=lookback_days)

            logger.info(
                f"📈 [Senior EF] Fixed Window (Pairwise): {ideal_start.date()} to {df.index[-1].date()}"
            )

            # Recortamos a la fecha ideal. NO restringimos por el activo más joven.
            df = df[df.index >= ideal_start]

        # Forward fill para huecos intermedios (festivos), NO bfill general porque vamos a truncar estrictamente al periodo común
        df = df.ffill()
        df = apply_market_proxy_backfill(df)

        # Calculamos retornos diarios y aplicamos Pairwise (Intersección Relajada)
        returns = df.pct_change().dropna(how="all")

        if len(returns) < 10:
            logger.info(f"⚠️ [Senior EF] Insufficient history: {len(returns)} points.")
            return {
                "error": "Insufficient history",
                "points": len(returns),
                "assets_found": list(df.columns),
            }

        logger.info(
            f"📈 [Senior EF] Data Processed. Shape: {df.shape}, Assets: {list(df.columns)}"
        )

        # 2. Canonical Math Engine (mean/sample_cov)
        from services.quant_core import get_expected_returns, get_covariance_matrix
        
        mu = get_expected_returns(df, method="mean")

        # ⚡ SENIOR FIX: Covariance logic (Shrinkage vs Sample) now handled in quant_core
        try:
            S = get_covariance_matrix(df)
        except Exception as cov_err:
            logger.warning(
                f"⚠️ [Senior EF] Canonical covariance failed, falling back: {cov_err}"
            )
            from pypfopt import risk_models
            S = risk_models.sample_cov(df, frequency=252)
            S = risk_models.fix_nonpositive_semidefinite(S)

        logger.info(
            f"✅ [Senior EF] Inputs ready. Mu Range: [{mu.min():.4f}, {mu.max():.4f}]"
        )

        # 3. Double-Engine Generator (CLA + Convex Fallback for Collinear Portfolios)
        frontier_points = []
        if len(df.columns) >= 2:
            logger.info("⚙️ [Senior EF] Running Optimization Engines...")
            try:
                # Engine A: CLA (Fast & Analytic, works best for clean matrices)
                cla = CLA(mu, S)
                # Generate curve points (explicit 50 points for smooth line)
                frontier_ret, frontier_vol, frontier_weights = cla.efficient_frontier(
                    points=50
                )
                for v_raw, r_raw, w_raw in zip(
                    frontier_vol, frontier_ret, frontier_weights
                ):
                    try:
                        v = float(v_raw)
                        # [FIX] Use exact Engine Target (Arithmetic Mean) for Y Coordinate
                        r = float(r_raw)
                        if np.isnan(v) or np.isnan(r) or v <= 0:
                            continue
                        frontier_points.append(
                            {"x": round(v, 4), "y": round(r, 4)}
                        )
                    except:
                        continue
                # Sort horizontally to avoid zigzag lines (now sorting by Return 'y' for Monotonic Frontier)
                frontier_points = sorted(frontier_points, key=lambda p: p["y"])

                if len(frontier_points) < 3:
                    raise ValueError("CLA generated a trivial or degenerate frontier.")

                logger.info(
                    f"✨ [Senior EF] Engine A (CLA) Success: {len(frontier_points)} points generated."
                )

            except Exception as exc:
                logger.info(
                    f"⚠️ [Senior EF] Engine A (CLA) Failed: {exc}. Attempting Engine B (Convex Optimization Fallback)..."
                )
                try:
                    # Engine B: Quadratic Programming Solver (Extremely robust for large 25-asset portfolios with duplicates)
                    from pypfopt import EfficientFrontier as RobustEF

                    min_r = float(mu.min()) * 0.99
                    max_r = float(mu.max()) * 0.99

                    if max_r > min_r:
                        import gc

                        target_returns = np.linspace(min_r, max_r, 15)
                        for tr in target_returns:
                            try:
                                # We reinstantiate EF each loop to solve fresh
                                ef = RobustEF(mu, S)
                                ef.efficient_return(target_return=tr)
                                ret, vol, _ = ef.portfolio_performance()
                                frontier_points.append(
                                    {"x": round(float(vol), 4), "y": round(float(ret), 4)}
                                )
                            except:
                                pass  # Infeasible segment of the frontier
                            finally:
                                gc.collect()

                    if frontier_points:
                        logger.info(
                            f"✨ [Senior EF] Engine B (Robust Solver) Partial Success: {len(frontier_points)} points generated."
                        )
                    else:
                        logger.info(
                            "❌ [Senior EF] Engine B also failed. No frontier curve will be drawn."
                        )

                except Exception as eval_exc:
                    logger.info(
                        f"❌ [Senior EF] Complete Mathematical Failure on Curving: {eval_exc}"
                    )

        # GEOMETRIC FILTER: Eliminate inefficient half of the parabola (Back-bending curve)
        if frontier_points:
            # Sort vertically by Return
            frontier_points = sorted(frontier_points, key=lambda p: p["y"])
            # Find Global Minimum Volatility (GMV) point
            min_vol_idx = min(
                range(len(frontier_points)), key=lambda i: frontier_points[i]["x"]
            )

            efficient_only = []
            current_max_x = -1.0
            for p in frontier_points[min_vol_idx:]:
                # Strict monotonic increasing check for X, allowing a tiny epsilon for float comparisons
                if p["x"] >= current_max_x - 1e-5:
                    efficient_only.append(p)
                    current_max_x = max(current_max_x, p["x"])

            frontier_points = efficient_only
            logger.info(
                f"📐 [Senior EF] Geometric Filter Applied. Final efficient points: {len(frontier_points)}"
            )

        else:
            logger.info(
                "⚠️ [Senior EF] Not enough assets for a frontier curve (needs >= 2). Skipping curve."
            )

        # 4. Individual Asset Points (Scatter)
        asset_points = []
        for ticker in df.columns:
            try:
                # Vol = sqrt(diag(S))
                v = float(np.sqrt(S.loc[ticker, ticker]))
                r = float(mu[ticker])
                asset_points.append(
                    {"label": ticker, "x": round(v, 4), "y": round(r, 4)}
                )
            except:
                continue

        # 5. CURRENT PORTFOLIO POINT (Manual Fix - Absolute Coherence)
        # Calculate (x,y) using EXACT same data pipeline and current weights
        portfolio_point = None
        if portfolio_weights:
            try:
                # Create weight vector aligned with df columns
                w_list = [float(portfolio_weights.get(col, 0)) for col in df.columns]
                w_total = sum(w_list)
                if w_total > 0:
                    w_arr = np.array([w / w_total for w in w_list])  # Normalize weights

                    # Fix Coords Formula (Daily historical basis)
                    port_ret = float(np.sum(w_arr * mu))
                    port_vol = float(np.sqrt(w_arr.T @ S.values @ w_arr))

                    portfolio_point = {"x": round(port_vol, 4), "y": round(port_ret, 4)}
                    logger.info(f"✅ [Senior EF] Coherent Point: {portfolio_point}")
            except Exception as e_p:
                logger.info(f"⚠️ Portfolio point calc failed: {e_p}")

        result = {
            "frontier": frontier_points,
            "assets": asset_points,
            "portfolio": portfolio_point,
            "math_data": {
                "ordered_isins": list(df.columns),
                "expected_returns": {
                    k: float(v) for k, v in mu.to_dict().items()
                },
                "covariance_matrix": S.values.tolist(),
            },
        }
        logger.info(
            f"🏁 [DEBUG] Returning success with {len(frontier_points)} fp, {len(asset_points)} ap."
        )
        return result

    except Exception as e:
        logger.info(f"❌ [DEBUG] CRITICAL Frontier Error: {e}")
        import traceback

        traceback.print_exc()
        return {"error": str(e)}
