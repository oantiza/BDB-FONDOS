import pandas as pd
import numpy as np
from pypfopt import CLA, risk_models, expected_returns
from services.data_fetcher import DataFetcher

def generate_efficient_frontier(assets_list, db, portfolio_weights=None, period='3y'):
    """
    Calcula puntos de la Frontera Eficiente y métricas de activos individuales.
    Allows optional portfolio_weights {isin: weight} to calculate specific portfolio point.
    """
    try:
        print(f"🚀 [Senior EF] Starting generate_efficient_frontier for {len(assets_list)} assets. Period: {period}")
        
        # 1. Senior Data Alignment
        fetcher = DataFetcher(db)
        # Adding no_fill=True to identify true data start date (preventing hockey stick)
        price_data, synthetic_used = fetcher.get_price_data(assets_list, resample_freq='D', strict=False, no_fill=True)
        
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        
        # SANITIZACIÓN PROFESIONAL (Evitar distorsión de covarianza)
        df = df.sort_index()

        # --- ADAPTIVE TIME HORIZON ---
        if not df.empty:
            # 1. Identificar el activo más joven (Morningstar Standard)
            first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()
            if not first_valid_indices.empty:
                youngest_asset_start = first_valid_indices.max()
                
                # 2. Definir ventana según parámetro 'period'
                period_days_map = {'1y':365, '3y':1095, '5y':1825, 'ytd':252, 'max':10000}
                lookback_days = period_days_map.get(period, 1095)
                ideal_start = df.index[-1] - pd.Timedelta(days=lookback_days)
                
                # 3. El inicio real es el máximo entre el ideal y el activo más joven
                final_start_date = max(ideal_start, youngest_asset_start)
                
                print(f"📈 [Senior EF] Adaptive Window: {final_start_date.date()} to {df.index[-1].date()}")
                df = df[df.index >= final_start_date]
        
        # Limpieza residual controlada. Since we already sliced on first_valid_index, it's safe to fully bfill any remaining NaNs (e.g., from despiking)
        df = df.ffill().bfill()
        
        if len(df) < 10: 
            print(f"⚠️ [Senior EF] Insufficient history: {len(df)} points.")
            return {'error': 'Insufficient history', 'points': len(df), 'assets_found': list(df.columns)}

        print(f"📈 [Senior EF] Data Processed. Shape: {df.shape}, Assets: {list(df.columns)}")
        
        # 2. Senior Math Engine (mean/sample_cov)
        mu = expected_returns.mean_historical_return(df, frequency=252, compounding=False)
        
        # ⚡ SENIOR FIX: Large Portfolios (e.g. 25+ funds) cause singular matrices.
        # Use Ledoit-Wolf Shrinkage to enforce mathematical stability and invertibility.
        try:
            if len(df.columns) >= 15:
                print(f"🔧 [Senior EF] Large Portfolio ({len(df.columns)} assets) detected. Using Ledoit-Wolf Shrinkage.")
                # This mathematically guarantees a positive definite covariance matrix
                S = risk_models.CovarianceShrinkage(df, frequency=252).ledoit_wolf()
            else:
                S = risk_models.sample_cov(df, frequency=252)
                S = risk_models.fix_nonpositive_semidefinite(S)
        except Exception as cov_err:
            print(f"⚠️ [Senior EF] Shrinkage failed, falling back to basic sample covariance: {cov_err}")
            S = risk_models.sample_cov(df, frequency=252)
            S = risk_models.fix_nonpositive_semidefinite(S)
        
        print(f"✅ [Senior EF] Inputs ready. Mu Range: [{mu.min():.4f}, {mu.max():.4f}]")
        
        # 3. Double-Engine Generator (CLA + Convex Fallback for Collinear Portfolios)
        frontier_points = []
        if len(df.columns) >= 2:
            print("⚙️ [Senior EF] Running Optimization Engines...")
            try:
                # Engine A: CLA (Fast & Analytic, works best for clean matrices)
                cla = CLA(mu, S)
                # Generate curve points (explicit 50 points for smooth line)
                frontier_ret, frontier_vol, _ = cla.efficient_frontier(points=50)
                for v_raw, r_raw in zip(frontier_vol, frontier_ret):
                    try:
                        v = float(v_raw)
                        r = float(r_raw)
                        if np.isnan(v) or np.isnan(r) or v <= 0: continue
                        frontier_points.append({'x': round(v, 4), 'y': round(r, 4)})
                    except: continue
                # Sort horizontally to avoid zigzag lines
                frontier_points = sorted(frontier_points, key=lambda p: p['x'])
                
                if len(frontier_points) < 3: 
                    raise ValueError("CLA generated a trivial or degenerate frontier.")
                    
                print(f"✨ [Senior EF] Engine A (CLA) Success: {len(frontier_points)} points generated.")
                
            except Exception as exc:
                print(f"⚠️ [Senior EF] Engine A (CLA) Failed: {exc}. Attempting Engine B (Convex Optimization Fallback)...")
                try:
                    # Engine B: Quadratic Programming Solver (Extremely robust for large 25-asset portfolios with duplicates)
                    from pypfopt import EfficientFrontier as RobustEF
                    
                    min_r = float(mu.min()) * 0.99 
                    max_r = float(mu.max()) * 0.99
                    
                    if max_r > min_r:
                        target_returns = np.linspace(min_r, max_r, 40)
                        for tr in target_returns:
                            try:
                                # We reinstantiate EF each loop to solve fresh
                                ef = RobustEF(mu, S)
                                ef.efficient_return(target_return=tr)
                                ret, vol, _ = ef.portfolio_performance()
                                frontier_points.append({'x': round(float(vol), 4), 'y': round(float(ret), 4)})
                            except:
                                pass # Infeasible segment of the frontier
                    
                    if frontier_points:
                        frontier_points = sorted(frontier_points, key=lambda p: p['x'])
                        print(f"✨ [Senior EF] Engine B (Robust Solver) Success: {len(frontier_points)} points generated.")
                    else:
                        print("❌ [Senior EF] Engine B also failed. No frontier curve will be drawn.")
                        
                except Exception as eval_exc:
                     print(f"❌ [Senior EF] Complete Mathematical Failure on Curving: {eval_exc}")
        else:
            print("⚠️ [Senior EF] Not enough assets for a frontier curve (needs >= 2). Skipping curve.")

        # 4. Individual Asset Points (Scatter)
        asset_points = []
        for ticker in df.columns:
            try:
                # Vol = sqrt(diag(S))
                v = float(np.sqrt(S.loc[ticker, ticker]))
                r = float(mu[ticker])
                asset_points.append({'label': ticker, 'x': round(v, 4), 'y': round(r, 4)})
            except: continue
            
        # 5. CURRENT PORTFOLIO POINT (Manual Fix - Absolute Coherence)
        # Calculate (x,y) using EXACT same data pipeline and current weights
        portfolio_point = None
        if portfolio_weights:
            try:
                # Create weight vector aligned with df columns
                w_list = [float(portfolio_weights.get(col, 0)) for col in df.columns]
                w_total = sum(w_list)
                if w_total > 0:
                    w_arr = np.array([w / w_total for w in w_list]) # Normalize weights
                    
                    # Fix Coords Formula (Daily historical basis)
                    port_ret = float(w_arr.T @ mu.values)
                    port_vol = float(np.sqrt(w_arr.T @ S.values @ w_arr))
                    
                    portfolio_point = {'x': round(port_vol, 4), 'y': round(port_ret, 4)}
                    print(f"✅ [Senior EF] Coherent Point: {portfolio_point}")
            except Exception as e_p:
                print(f"⚠️ Portfolio point calc failed: {e_p}")

        result = {
            'frontier': frontier_points,
            'assets': asset_points,
            'portfolio': portfolio_point
        }
        print(f"🏁 [DEBUG] Returning success with {len(frontier_points)} fp, {len(asset_points)} ap.")
        return result

    except Exception as e:
        print(f"❌ [DEBUG] CRITICAL Frontier Error: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}
