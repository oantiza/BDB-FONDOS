from firebase_admin import firestore
from .data import get_price_data
from .config import RISK_FREE_RATE, RISK_TARGETS

def run_optimization(assets_list, risk_level, db, constraints=None, asset_metadata=None, locked_assets=None):
    """
    Optimización Híbrida Blindada:
    1. Define objetivos de volatilidad realistas (RISK_TARGETS).
    2. Usa fallback a Mínima Volatilidad si el objetivo es muy bajo.
    3. Protege las selecciones manuales (locked_assets).
    """
    import pandas as pd
    import numpy as np
    from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions

    # ==============================================================================
    # 1. MAPA DE RIESGO COHERENTE (Backend Source of Truth)
    # ==============================================================================
    # (RISK_TARGETS imported from config)

    try:
        # 2. CARGA DE DATOS
        price_data, synthetic_used = get_price_data(assets_list, db)
        
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().ffill().bfill()
        
        if len(df) < 50:
             raise Exception("Insuficientes datos históricos para optimizar.")

        # 3. MOTOR MATEMÁTICO
        mu = expected_returns.ema_historical_return(df, span=252)
        try:
            S = risk_models.CovarianceShrinkage(df).ledoit_wolf()
        except Exception:
            print(f"⚠️ Ledoit-Wolf falló. Usando covarianza estándar.")
            S = risk_models.sample_cov(df)
            S = risk_models.fix_nonpositive_semidefinite(S)

        # Seleccionamos el objetivo correcto. Default seguro: 5%.
        target_volatility = RISK_TARGETS.get(int(risk_level), 0.05)
        
        ef = EfficientFrontier(mu, S)
        
        # 4. CONFIGURACIÓN
        # Gamma dinámico para diversificación
        n_assets = len(assets_list)
        dynamic_gamma = 0.50 if n_assets < 10 else 1.0 
        ef.add_objective(objective_functions.L2_reg, gamma=dynamic_gamma) 
        
        # Techo máximo por fondo
        ef.add_constraint(lambda w: w <= 0.35) 

        # Respeto a Swaps Manuales
        if locked_assets:
            print(f"🔒 Protegiendo {len(locked_assets)} activos manuales...")
            for isin in locked_assets:
                if isin in ef.tickers:
                    idx = ef.tickers.index(isin)
                    # Forzamos que tenga al menos un 3%
                    ef.add_constraint(lambda w, i=idx: w[i] >= 0.03) 
        
        # Restricciones Geo (si existen)
        if constraints and asset_metadata:
            try:
                tickers = df.columns.tolist()
                eu_target = constraints.get('europe', 0.0)
                us_cap = constraints.get('americas', 1.0)
                
                if eu_target > 0 or us_cap < 1.0:
                    eu_vector = []
                    us_vector = []
                    for t in tickers:
                        meta = asset_metadata.get(t, {})
                        regions = meta.get('regions', {})
                        eu_vector.append(regions.get('europe', 0) / 100.0)
                        us_vector.append(regions.get('americas', 0) / 100.0)
                    
                    if eu_target > 0:
                        ef.add_constraint(lambda w: w @ np.array(eu_vector) >= eu_target)
                    if us_cap < 1.0:
                        ef.add_constraint(lambda w: w @ np.array(us_vector) <= us_cap)
            except Exception as e_geo:
                print(f"⚠️ Aviso Geo: {e_geo}")

        # 5. OPTIMIZACIÓN
        try:
            # Intentamos Efficient Risk: "Dame el máx retorno para esta volatilidad"
            raw_weights = ef.efficient_risk(target_volatility)
        except:
            # Si falla (ej. imposible bajar tanto la volatilidad),
            # intentamos Min Volatility (la cartera más segura matemáticamente posible)
            print("⚠️ Objetivo inalcanzable. Buscando Mínima Volatilidad.")
            try:
                raw_weights = ef.min_volatility()
            except:
                # Fallback final si todo falla
                raw_weights = ef.max_sharpe(risk_free_rate=RISK_FREE_RATE)

        # 6. PODA SUAVE
        cleaned_weights = ef.clean_weights(cutoff=0.015)
        
        final_weights = {}
        active_assets = []
        for ticker, weight in cleaned_weights.items():
            if weight > 0:
                final_weights[ticker] = weight
                active_assets.append(ticker)
        
        # Seguridad Swaps
        if locked_assets:
            for locked in locked_assets:
                if locked not in final_weights and locked in df.columns:
                    final_weights[locked] = 0.03
                    active_assets.append(locked)

        # Re-normalizar
        total_w = sum(final_weights.values())
        if total_w > 0:
            for t in final_weights:
                final_weights[t] = round(final_weights[t] / total_w, 4)
        else:
            n = len(active_assets) if active_assets else 1
            for t in active_assets: final_weights[t] = 1.0 / n

        # Métricas Finales
        perf = ef.portfolio_performance(verbose=False)
        
        warnings = []
        if synthetic_used:
            warnings.append(f"Datos Sintéticos usados para: {', '.join(synthetic_used)}")

        return { 
            'status': 'optimal', 
            'weights': final_weights, 
            'metrics': {'return': perf[0], 'volatility': perf[1], 'sharpe': perf[2]},
            'warnings': warnings
        }

    except Exception as e:
        print(f"❌ Error Crítico Optimización: {e}")
        n = len(assets_list) if assets_list else 1
        return {
            'status': 'fallback', 
            'weights': {isin: 1.0/n for isin in assets_list}, 
            'metrics': {'return': 0.05, 'volatility': 0.10, 'sharpe': 0.5},
            'warnings': [f"Error cálculo: {str(e)}"]
        }

def generate_efficient_frontier(assets_list, db, portfolio_weights=None):
    """
    Calcula puntos de la Frontera Eficiente y métricas de activos individuales.
    Allows optional portfolio_weights {isin: weight} to calculate specific portfolio point.
    """
    import pandas as pd
    import numpy as np
    from pypfopt import CLA, risk_models, expected_returns

    try:
        print(f"🚀 [DEBUG] Starting generate_efficient_frontier for {len(assets_list)} assets.")
        
        # 1. Get Data
        price_data, synthetic_used = get_price_data(assets_list, db)
        if not price_data: 
            print("❌ [DEBUG] No price data found.")
            return {'error': 'No data'}
        
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().ffill().bfill()
        print(f"✅ [DEBUG] Data loaded. Shape: {df.shape}")
        
        if len(df) < 50: 
            print("❌ [DEBUG] Insufficient history (<50).")
            return {'error': 'Insufficient history'}

        # 2. Risk Model
        print("🔄 [DEBUG] Calculating Risk Model (Mu/Cov)...")
        mu = expected_returns.ema_historical_return(df, span=252)
        S = risk_models.CovarianceShrinkage(df).ledoit_wolf()
        print("✅ [DEBUG] Risk Model calculated.")

        # 3. CLA (Critical Line Algorithm) for Frontier
        print("🔄 [DEBUG] Initializing CLA...")
        cla = CLA(mu, S)
        cla.max_sharpe() # Optimize once to set up
        print("✅ [DEBUG] CLA max_sharpe solved.")
        
        # Get frontier points (volatility, returns, weights)
        frontier_points = []
        try:
            print("🔄 [DEBUG] Calculating frontier curve points...")
            frontier_ret, frontier_vol, _ = cla.efficient_frontier(points=50)
            
            for v_raw, r_raw in zip(frontier_vol, frontier_ret):
                try:
                    v = v_raw.item() if hasattr(v_raw, 'item') else float(v_raw)
                    r = r_raw.item() if hasattr(r_raw, 'item') else float(r_raw)
                    if np.isnan(v) or np.isnan(r): continue
                    frontier_points.append({'x': round(v, 4), 'y': round(r, 4)})
                except: continue
            print(f"✅ [DEBUG] Frontier points generated: {len(frontier_points)}")
        except Exception as e_cla:
            print(f"⚠️ [DEBUG] CLA efficient_frontier failed: {e_cla}")
            # Fallback if CLA fails
            frontier_ret, frontier_vol = [], []

        # 4. Individual Asset Points (Scatter)
        asset_points = []
        try:
            vol_series = df.pct_change().std() * np.sqrt(252)
            ret_series = (df.iloc[-1] / df.iloc[0]) ** (252 / len(df)) - 1
            
            for ticker in df.columns:
                try:
                    v_raw = vol_series.get(ticker, 0)
                    r_raw = ret_series.get(ticker, 0)
                    
                    v = v_raw.item() if hasattr(v_raw, 'item') else float(v_raw)
                    r = r_raw.item() if hasattr(r_raw, 'item') else float(r_raw)
                    
                    asset_points.append({
                        'label': ticker,
                        'x': round(v, 4),
                        'y': round(r, 4)
                    })
                except:
                    continue
        except:
            pass
        print(f"✅ [DEBUG] Asset points generated: {len(asset_points)}")
            
        # 5. Current Portfolio Point (Calculated with SAME matrix)
        portfolio_point = None
        if portfolio_weights:
            try:
                # Align weights with df columns
                w_vector = []
                for col in df.columns:
                    w_vector.append(portfolio_weights.get(col, 0))
                
                w_arr = np.array(w_vector)

                port_ret = w_arr @ mu
                port_vol = np.sqrt(w_arr.T @ S @ w_arr)
                
                p_v = port_vol.item() if hasattr(port_vol, 'item') else float(port_vol)
                p_r = port_ret.item() if hasattr(port_ret, 'item') else float(port_ret)
                
                portfolio_point = {'x': round(p_v, 4), 'y': round(p_r, 4)}
                print(f"✅ [DEBUG] Portfolio point calculated: {portfolio_point}")
            except Exception as e:
                print(f"⚠️ [DEBUG] Portfolio avg error: {e}")

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