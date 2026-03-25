import logging
logger = logging.getLogger(__name__)
import pandas as pd
import numpy as np
from pypfopt import CLA
from services.data_fetcher import DataFetcher


def generate_efficient_frontier(assets_list, db, portfolio_weights=None, period="3y"):
    """
    [MATHEMATICAL CONVENTIONS & INTEGRATION]
    Generates Efficient Frontier points and asset metrics for UI plotting.
    
    1. Base Data: Daily prices (resample_freq="D"), strictly truncated to common 
       history (Pairwise alignment) according to `period` window.
    2. Expected Returns: Uses canonical `method="mean"` (Arithmetic) via `quant_core`.
    3. Covariance: Uses canonical `get_covariance_matrix` via `quant_core` (Ledoit-Wolf 
       shrinkage with exact symmetry enforcement).
    4. Black-Litterman is NOT applied here (Frontier is objective, BL is subjective).
    5. Portfolio Point: Calculated via `quant_core` for exact coherence with optimizer.
    """
    try:
        logger.info(
            f"🚀 [Senior EF] Starting generate_efficient_frontier for {len(assets_list)} assets. Period: {period}"
        )

        # 1. Senior Data Alignment
        fetcher = DataFetcher(db)
        # We rely on strict truncating to identify true data start date (preventing hockey stick)
        price_data, synthetic_used = fetcher.get_price_data(
            assets_list, resample_freq="D", strict=False
        )

        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)

        # SANITIZACIÓN PROFESIONAL (Evitar distorsión de covarianza)
        df = df.sort_index()

        # --- TIME HORIZON: STRICT COMMON PERIOD ---
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

            first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()
            if not first_valid_indices.empty:
                actual_start = first_valid_indices.max()
                final_start = max(ideal_start, actual_start)
            else:
                final_start = ideal_start

            logger.info(
                f"📈 [Senior EF] Strict Window: {final_start.date()} to {df.index[-1].date()}"
            )

            df = df[df.index >= final_start]

        # Forward fill para huecos intermedios (festivos), y obligar a tramo común eliminando NaNs iniciales
        df = df.ffill(limit=5).dropna()

        if df.empty or len(df) < 60:
            actual_start_str = df.index[0].strftime('%Y-%m-%d') if not df.empty else "N/A"
            logger.info(f"⚠️ [Senior EF] Insufficient history: {len(df)} points.")
            err_msg = f"El tramo común estricto encontrado es demasiado corto ({len(df)} días). Se requieren al menos 60 días laborables para calcular la frontera."
            return {
                "status": "error",
                "message": err_msg,
                "error": err_msg,
                "effective_start_date": actual_start_str,
                "observations": len(df),
                "points": len(df),
                "assets_found": list(df.columns),
                "assets": [],
                "frontier": [],
                "math_data": {}
            }

        effective_start_date = df.index[0].strftime('%Y-%m-%d')
        observations = len(df)

        # Calculamos retornos diarios
        returns = df.pct_change().dropna(how="all")

        logger.info(
            f"📈 [Senior EF] Data Processed. Shape: {df.shape}, Assets: {list(df.columns)}"
        )

        # 2. Canonical Math Engine
        from services.quant_core import get_expected_returns, get_covariance_matrix
        
        # [CONVENTION] Method 'mean' (Arithmetic) matches current optimizer logic
        mu = get_expected_returns(df, method="mean")

        # [CONVENTION] quant_core already handles Shrinkage fallback and guarantees Symmetry
        S = get_covariance_matrix(df)

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

        # 5. CURRENT PORTFOLIO POINT (Canonical Math Engine)
        portfolio_point = None
        if portfolio_weights:
            try:
                from services.quant_core import calculate_portfolio_metrics
                
                # Normalize weights to sum exactly 1.0 before calculation
                raw_total = sum(float(w) for w in portfolio_weights.values())
                if raw_total > 0:
                    norm_weights = {k: float(v)/raw_total for k, v in portfolio_weights.items()}
                    
                    # rf_rate relies on 0.0 for pure plot coordinates without excess return translation
                    metrics = calculate_portfolio_metrics(norm_weights, mu, S, rf_rate=0.0)
                    portfolio_point = {"x": round(metrics["volatility"], 4), "y": round(metrics["return"], 4)}
                    logger.info(f"✅ [Senior EF] Coherent Point via quant_core: {portfolio_point}")
            except Exception as e_p:
                logger.warning(f"⚠️ Portfolio point calc failed: {e_p}")

        result = {
            "status": "success",
            "frontier": frontier_points,
            "assets": asset_points,
            "portfolio": portfolio_point,
            "effective_start_date": effective_start_date,
            "observations": observations,
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
        return {"status": "error", "message": str(e), "error": str(e)}
