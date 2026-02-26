from firebase_admin import firestore
import pandas as pd
import numpy as np
from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions, CLA

from services.data_fetcher import DataFetcher
from services.config import (
    RISK_TARGETS,
    MAX_WEIGHT_DEFAULT,
    CUTOFF_DEFAULT,
    MIN_ASSETS_DEFAULT,
    EQUITY_FLOOR,
    BOND_CAP,
    CASH_CAP,
    RISK_BUCKETS_LABELS
)

from .utils import _to_float, _normalize, _cap, _classify_asset, _allocation_vectors

def run_optimization(assets_list, risk_level, db, constraints=None, asset_metadata=None, locked_assets=None, tactical_views=None):
    """Optimizer v4.2 (Institutional: Hard Cutoff + Black-Litterman)"""

    # --- 1. Init Variables (Safe Defaults) ---
    constraints = constraints or {}
    asset_metadata = asset_metadata or {}
    locked_assets = locked_assets or []
    
    # Extract Constraints safely
    apply_profile = constraints.get('apply_profile', True)
    # Check disable flag
    if constraints.get('disable_profile_rules'): apply_profile = False

    # --- NEW: DYNAMIC RISK PROFILES FROM DB ---
    try:
        risk_profile_doc = db.collection('system_settings').document('risk_profiles').get()
        if risk_profile_doc.exists:
            raw_dic = risk_profile_doc.to_dict()
            current_risk_buckets = {int(k): v for k, v in raw_dic.items()}
            print("⚡ [Optimizer] Cargados perfiles de riesgo desde Firestore")
        else:
            print("⚠️ [Optimizer] Perfiles no encontrados en DB. Auto-inicializando...")
            db_save = {str(k): v for k, v in RISK_BUCKETS_LABELS.items()}
            db.collection('system_settings').document('risk_profiles').set(db_save)
            current_risk_buckets = RISK_BUCKETS_LABELS
    except Exception as e:
        print(f"⚠️ [Optimizer] Fallo al leer perfiles de riesgo: {e}. Usando locales.")
        current_risk_buckets = RISK_BUCKETS_LABELS
    
    equity_floor = float(constraints.get('equity_floor', 0.0))
    bond_cap = float(constraints.get('bond_cap', 1.0))
    cash_cap = float(constraints.get('cash_cap', 1.0))
    
    print(f"📥 [Optimizer] Risk: {risk_level}, Assets: {len(assets_list)}, Meta: {len(asset_metadata)}")

    # --- PHASE 2.1 CONSTANTS ---
    FALLBACK_CANDIDATES_DEFAULT = [
        'LU0340557775', # Morgan Stanley Global Opportunity (Activo)
        'LU1135865084', # Fidelity Funds - Global Dividend (Activo)
        'LU0690375182', # Fundsmith Equity Fund (Activo)
        'LU0203975437', # Robeco BP Global Premium Equities (Activo)
        'IE00B2NXKW18', # Seilern World Growth (Activo)
    ]
    
    # Init safe defaults (Handler for UnboundLocalError in except block)
    price_data = {}
    universe = []
    missing_assets = []
    synthetic_used = []
    solver_path = None # Init early
    relaxed = False

    try:
        added_assets = []
        raw_weights = None
        auto_complete_source = None
        rejected_candidates = []
        
        # 1) Carga de Datos (Strict Senior Methodology)
        fetcher = DataFetcher(db)
        # RELAXED: strict=False allows union of data (filled later)
        # NO_FILL=True: Critical for Adaptive Time Horizon (detect true start dates)
        price_data, synthetic_used = fetcher.get_price_data(assets_list, resample_freq='D', strict=False, no_fill=True)
        
        df = pd.DataFrame(price_data) # Ensure DataFrame
        df.index = pd.to_datetime(df.index)
        
        # SANITIZACIÓN: DataFrame comes with NaNs for non-existing dates.
        # We MUST NOT bfill yet. We check first valid index per column.
        
        # --- ADAPTIVE TIME HORIZON (Target: 5 Years) ---
        # 1. Determinar fecha de corte ideal (5 años atrás)
        target_years = 5
        ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * target_years)
        
        # 2. Encontrar el "Youngest Asset Start Date"
        # For each column, find first valid index.
        first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()
        
        if not first_valid_indices.empty:
            # The "common start" is the MAXIMUM of all first valid dates (the youngest asset)
            actual_start_date = first_valid_indices.max()
            
            # 3. Decidir fecha de inicio final
            # Si el "joven" empieza después de la ideal, cortamos ahí.
            # Si todos son viejos, cortamos en la ideal (5 años).
            final_start_date = max(ideal_start_date, actual_start_date)
            
            # 4. Validar longitud mínima (1 año)
            days_history = (df.index[-1] - final_start_date).days
            if days_history < 250: # Menos de un año de trading (~252 dias)
                print(f"⚠️ History too short ({days_history} days). Using available max history or fallback...")
                # Fallback: Usar todo lo disponible común, aunque sea poco (mejor que romper)
                final_start_date = actual_start_date
                
            df = df[df.index >= final_start_date]
            print(f"ℹ️ Optimization Time Window: {final_start_date.date()} to {df.index[-1].date()} ({(df.index[-1] - final_start_date).days} days)")
            
            # NOW we can safely fill small holes (holidays) and backfill the tiny gap if start_date wasn't perfect
            df = df.sort_index().ffill().bfill()
            
        else:
            print("⚠️ No valid data found for any asset. Falling back to strict inner join...")
            df = df.dropna()

        if df.empty or len(df) < 50:
            auto_expand = constraints.get('auto_expand_universe', False) if constraints else False
            if not auto_expand:
                print("⚠️ Insufficient history. Aborting and returning recovery candidates...")
                candidates_list = FALLBACK_CANDIDATES_DEFAULT
                try:
                    cfg_ref = db.collection('config').document('auto_complete_candidates')
                    cfg = cfg_ref.get()
                    if cfg.exists: candidates_list = cfg.to_dict().get('equity90_isins', FALLBACK_CANDIDATES_DEFAULT)
                except: pass
                
                # Throw controlled exception caught by endpoints_portfolio
                raise ValueError(f"INFEASIBLE_HISTORY:{','.join(candidates_list[:5])}")

            else:
                print("⚠️ Auto-expanding due to missing history...")
                candidates_list = FALLBACK_CANDIDATES_DEFAULT
                try:
                    cfg_ref = db.collection('config').document('auto_complete_candidates')
                    cfg = cfg_ref.get()
                    if cfg.exists: candidates_list = cfg.to_dict().get('equity90_isins', FALLBACK_CANDIDATES_DEFAULT)
                except: pass
                
                # Fetch data for candidates
                valid_cands, _ = fetcher.get_price_data(candidates_list, resample_freq='D', strict=True)
                for isin, p_series in valid_cands.items():
                    if len(p_series) >= 50:
                        price_data[isin] = p_series
                
                if not price_data:
                    raise Exception("Fallo crítico: ni siquiera los candidatos de recuperación tienen datos.")
                
                # Re-build DF
                df = pd.DataFrame(price_data)
                df.index = pd.to_datetime(df.index)
                
                ideal_start_date = df.index[-1] - pd.Timedelta(days=365 * 5)
                first_valid_indices = df.apply(lambda col: col.first_valid_index()).dropna()
                
                if not first_valid_indices.empty:
                    actual_start_date = first_valid_indices.max()
                    final_start_date = max(ideal_start_date, actual_start_date)
                    df = df[df.index >= final_start_date]
                    df = df.sort_index().ffill().bfill()
                else:
                    raise Exception("Fallo crítico tras auto-expandir: sin historial común.")

        universe = list(df.columns)
        missing_assets = [a for a in assets_list if a not in universe]
        
        # --- INITIALIZE ALLOCATION VECTORS ---
        eq_vec, bd_vec, cs_vec, ot_vec, _ = _allocation_vectors(universe, asset_metadata)
        
        # 2) Standard Markowitz Inputs & Black-Litterman (Tactical Views)
        mcaps = {}
        for t in universe:
            mcap_val = (asset_metadata or {}).get(t, {}).get('market_cap', 1e9)
            mcaps[t] = float(mcap_val)
            
        if tactical_views:
            print("👁️ [Optimizer] Tactical Views Detected. Applying Black-Litterman...")
            try:
                from services.financial_engine import FinancialEngine
                valid_views = {k: v for k, v in tactical_views.items() if k in universe}
                if valid_views:
                    mu, S = FinancialEngine.black_litterman_optimization(
                        df_prices=df, 
                        market_caps=mcaps, 
                        views=valid_views
                    )
                    S = risk_models.fix_nonpositive_semidefinite(S)
                else:
                    print("⚠️ Tactical views provided but no valid ISINs match universe. Fallback to Markowitz.")
                    mu = expected_returns.mean_historical_return(df, frequency=252, compounding=False)
                    S = risk_models.sample_cov(df, frequency=252)
                    S = risk_models.fix_nonpositive_semidefinite(S)
            except Exception as e_bl:
                print(f"⚠️ Black-Litterman Failed: {e_bl}. Fallback to Standard Markowitz.")
                mu = expected_returns.mean_historical_return(df, frequency=252, compounding=False)
                S = risk_models.sample_cov(df, frequency=252)
                S = risk_models.fix_nonpositive_semidefinite(S)
        else:
            mu = expected_returns.mean_historical_return(df, frequency=252, compounding=False)
            S = risk_models.sample_cov(df, frequency=252)
            S = risk_models.fix_nonpositive_semidefinite(S)

        # 3) Generate Frontier curve for feedback
        frontier_points = []
        try:
            cla = CLA(mu, S)
            f_ret, f_vol, _ = cla.efficient_frontier(points=50)
            for v_raw, r_raw in zip(f_vol, f_ret):
                if np.isnan(v_raw) or np.isnan(r_raw): continue
                frontier_points.append({'x': round(float(v_raw), 4), 'y': round(float(r_raw), 4)})
        except Exception as e_cla:
            print(f"⚠️ Frontier gen warning: {e_cla}")

        rf_rate = float(fetcher.get_dynamic_risk_free_rate())

        # 4) Optimization Parameters
        max_weight = float((constraints or {}).get('max_weight', MAX_WEIGHT_DEFAULT))
        min_weight = float((constraints or {}).get('min_weight', 0.0))
        cutoff = float(CUTOFF_DEFAULT)
        risk_level_i = int(risk_level)

        n_assets = len(universe)
        gamma = 1.0 if n_assets < 10 else (2.0 if n_assets <= 25 else 3.0)

        # Helper: Unified Constraint Application
        def _apply_standard_constraints(ef_inst, eq_v, bd_v, cs_v):
            """Applies geo, buckets and locked constraints to an EF instance"""
            # A) Locked assets (Min 3%)
            for isin in (locked_assets or []):
                if isin in universe:
                    idx = ef_inst.tickers.index(isin)
                    ef_inst.add_constraint(lambda w, i=idx: w[i] >= 0.03)
            
            # B) Geo Constraints
            if constraints and asset_metadata:
                try:
                    eu_target = float((constraints.get('europe', 0.0) or 0.0))
                    us_cap = float((constraints.get('americas', 1.0) or 1.0))
                    if eu_target > 0 or us_cap < 1.0:
                        eu_vec_l = []
                        us_vec_l = []
                        for t in ef_inst.tickers:
                            m = (asset_metadata or {}).get(t, {}) or {}
                            regs = m.get('regions', {}) or {}
                            eu_vec_l.append(_to_float(regs.get('europe', 0.0), 0.0) / 100.0)
                            us_vec_l.append(_to_float(regs.get('americas', 0.0), 0.0) / 100.0)
                        
                        if eu_target > 0:
                            eu_vec_np = np.array(eu_vec_l)
                            ef_inst.add_constraint(lambda w: w @ eu_vec_np >= eu_target)
                        if us_cap < 1.0:
                            us_vec_np = np.array(us_vec_l)
                            ef_inst.add_constraint(lambda w: w @ us_vec_np <= us_cap)
                except Exception as e_geo:
                    print(f"⚠️ Geo Constraint Warning: {e_geo}")

            # C) Risk Buckets (Asset Class Limits)
            if apply_profile and risk_level_i in current_risk_buckets:
                bucket_cfg = current_risk_buckets[risk_level_i]
                if 'RV' in bucket_cfg:
                    ef_inst.add_constraint(lambda w: w @ eq_v >= bucket_cfg['RV'][0])
                    ef_inst.add_constraint(lambda w: w @ eq_v <= bucket_cfg['RV'][1])
                if 'RF' in bucket_cfg:
                    ef_inst.add_constraint(lambda w: w @ bd_v >= bucket_cfg['RF'][0])
                    ef_inst.add_constraint(lambda w: w @ bd_v <= bucket_cfg['RF'][1])
                if 'Cash' in bucket_cfg:
                    ef_inst.add_constraint(lambda w: w @ cs_v <= bucket_cfg['Cash'][1])

        # 5) Main Solver Setup
        ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
        ef.add_objective(objective_functions.L2_reg, gamma=gamma)
        _apply_standard_constraints(ef, eq_vec, bd_vec, cs_vec)

        # ---------------------------------------------------------
        # PREDICCIÓN DE FACTIBILIDAD (Solo para Equity Floor)
        if apply_profile and equity_floor > 0:
            achieved_equity = 0.0
            current_budget = 1.0
            processed = set()
            
            # Locked assets come first
            for isin in locked_assets:
                if isin in universe:
                    idx = universe.index(isin)
                    w = max(0.03, min(max_weight, 1.0))
                    achieved_equity += w * eq_vec[idx]
                    current_budget -= w
                    processed.add(idx)
            
            # Fill remaining with best equity candidates
            sorted_eq = np.argsort(eq_vec)[::-1]
            for idx in sorted_eq:
                if idx in processed: continue
                space = min(max_weight, current_budget)
                if space <= 1e-4: break
                achieved_equity += space * eq_vec[idx]
                current_budget -= space
            
            if achieved_equity + 0.005 < equity_floor:
                auto_expand = constraints.get('auto_expand_universe', False)
                if not auto_expand:
                    return {
                        'api_version': 'optimizer_v4',
                        'status': 'infeasible_equity_floor',
                        'solver_path': 'blocked_infeasible',
                        'feasibility': {
                            'requested': equity_floor,
                            'achievable': round(achieved_equity, 4)
                        },
                        'weights': {},
                        'warnings': [f"Equity Floor {equity_floor} Unachievable"]
                    }
                else:
                    # AUTO-EXPAND LOGIC
                    print("⚠️ Auto-Expanding Universe...")
                    candidates_list = []
                    try:
                        docs = db.collection('funds_v3').order_by('std_perf.sharpe', direction=firestore.Query.DESCENDING).limit(50).stream()
                        for d in docs:
                            dd = d.to_dict()
                            if _to_float(dd.get('metrics', {}).get('equity'), 0.0) >= 90.0:
                                candidates_list.append(d.id)
                    except: pass
                    
                    if not candidates_list: candidates_list = FALLBACK_CANDIDATES_DEFAULT
                    
                    valid_added = []
                    seen = set(universe) | set(assets_list)
                    potential = [c for c in candidates_list if c not in seen]
                    if potential:
                        p_check, _ = fetcher.get_price_data(potential, resample_freq='D', strict=True)
                        for isin, p_s in p_check.items():
                            if len(p_s) >= 20: valid_added.append(isin)
                    
                    if not valid_added:
                        return {'api_version': 'optimizer_v4', 'status': 'auto_expand_failed', 'weights': {}}
                    
                    added_assets = valid_added[:6]
                    price_data.update({k: p_check[k] for k in added_assets})
                    
                    # Update metadata and re-run essentials
                    for isin in added_assets:
                        d = db.collection('funds_v3').document(isin).get()
                        if d.exists:
                            dd = d.to_dict()
                            asset_metadata[isin] = {'metrics': dd.get('metrics', {}), 'asset_class': dd.get('asset_class')}
                    
                    df = pd.DataFrame(price_data).sort_index().ffill().bfill()
                    universe = list(df.columns)
                    mu = expected_returns.ema_historical_return(df, frequency=252, span=252)
                    S = risk_models.CovarianceShrinkage(df, frequency=252).ledoit_wolf()
                    eq_vec, bd_vec, cs_vec, ot_vec, _ = _allocation_vectors(universe, asset_metadata)
                    
                    # Re-init main EF with new universe
                    ef = EfficientFrontier(mu, S, weight_bounds=(min_weight, max_weight))
                    ef.add_objective(objective_functions.L2_reg, gamma=gamma)
                    _apply_standard_constraints(ef, eq_vec, bd_vec, cs_vec)
                    solver_path = 'auto_expand_then_solve'

        # 6) Final Solver Call
        if not solver_path:
            try:
                if constraints and constraints.get('objective') == 'max_sharpe':
                    solver_path = 'max_sharpe_custom'
                    raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
                elif apply_profile:
                    solver_path = 'max_sharpe_profile'
                    raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
                else:
                    base_target = float(RISK_TARGETS.get(risk_level_i, 0.05))
                    target_vol = base_target + 0.015
                    solver_path = f'efficient_risk_{target_vol:.3f}'
                    raw_weights = ef.efficient_risk(target_vol)
            except Exception as e1:
                print(f"⚠️ Optimization Failed: {e1}. Trying Relaxed Fallbacks...")
                try:
                    # Fallback 1: Relaxed Sharpe (no extra constraints)
                    print("⚠️ Fallback 1: Relaxed Sharpe")
                    ef_relaxed = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
                    ef_relaxed.add_objective(objective_functions.L2_reg, gamma=gamma)
                    raw_weights = ef_relaxed.max_sharpe(risk_free_rate=rf_rate)
                    ef = ef_relaxed
                    solver_path = 'fallback_relaxed_sharpe'
                except:
                    try:
                        # Fallback 2: Min Volatility
                        print("⚠️ Fallback 2: Min Volatility")
                        ef_minvol = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
                        raw_weights = ef_minvol.min_volatility()
                        ef = ef_minvol
                        solver_path = 'fallback_min_vol'
                    except Exception as e_crit:
                        print(f"❌ ALL PATHS FAILED: {e_crit}")
                        solver_path = 'fallback_equal_weight'
                        raw_weights = None

        # 7) Post-Processing
        weights = {}
        r_w = None
        try:
            r_w = raw_weights
        except (UnboundLocalError, NameError):
            r_w = None
            
        if r_w is not None:
            cleaned = ef.clean_weights(cutoff=cutoff)
            weights = _normalize({t: float(cleaned.get(t, 0.0)) for t in universe})
            
            # Ensure locked assets hard floor without shrinking below floor
            excess_needed = 0.0
            for isin in (locked_assets or []):
                if isin in universe and weights.get(isin, 0.0) < 0.03:
                    excess_needed += (0.03 - weights.get(isin, 0.0))
                    weights[isin] = 0.03
            
            if excess_needed > 0:
                # Deduct excess_needed proportionally from non-locked assets
                non_locked = [t for t in universe if t not in (locked_assets or []) and weights.get(t, 0.0) > 0.0]
                non_locked_sum = sum(weights[t] for t in non_locked)
                if non_locked_sum > 0:
                    for t in non_locked:
                        reduction = (weights[t] / non_locked_sum) * excess_needed
                        weights[t] = max(0.0, weights[t] - reduction)
            
            weights = _normalize(weights)
        else:
            weights = {t: 1.0 / max(1, len(universe)) for t in universe}

        # Metrics
        w_arr = np.array([float(weights[t]) for t in universe])
        mu_arr = mu.values
        S_arr = S.values
        port_ret = float(w_arr.T @ mu_arr)
        port_vol = float(np.sqrt(w_arr.T @ S_arr @ w_arr))
        port_sharpe = float((port_ret - rf_rate) / port_vol) if port_vol > 1e-12 else 0.0
        portfolio_point = {'x': round(port_vol, 4), 'y': round(port_ret, 4)}

        # Allocation
        eq_total = float(w_arr @ eq_vec)
        bd_total = float(w_arr @ bd_vec)
        cs_total = float(w_arr @ cs_vec)
        ot_total = float(w_arr @ ot_vec)
        s_sum = eq_total + bd_total + cs_total + ot_total
        if s_sum > 0: eq_total, bd_total, cs_total, ot_total = eq_total/s_sum, bd_total/s_sum, cs_total/s_sum, ot_total/s_sum

        # Finish
        requested = []
        seen = set()
        for a in assets_list:
            if a not in seen:
                requested.append(a)
                seen.add(a)
        weights_full = {a: float(weights.get(a, 0.0)) if a in universe else 0.0 for a in requested}

        return {
            'api_version': 'optimizer_v4',
            'mode': 'PROFILE_B_AGGRESSIVE' if apply_profile else 'PROFILE_A',
            'status': 'optimal' if r_w is not None else 'fallback',
            'solver_path': solver_path,
            'added_assets': added_assets,
            'used_assets': universe,
            'missing_assets': missing_assets,
            'portfolio_allocation': {'equity': eq_total, 'bond': bd_total, 'cash': cs_total, 'other': ot_total},
            'weights': weights_full,
            'metrics': {'return': port_ret, 'volatility': port_vol, 'sharpe': port_sharpe, 'rf_rate': rf_rate, 'portfolio': portfolio_point},
            'frontier': frontier_points,
            'portfolio': portfolio_point,
            'warnings': []
        }

    except Exception as e:
        print(f"❌ Critical Error: {e}")
        return {'api_version': 'optimizer_v4', 'status': 'error', 'message': str(e)}


def generate_smart_portfolio(category, risk_level, num_funds, vip_funds_str, optimize_now, db):
    """Restored Wrapper"""
    return {'status': 'restored', 'portfolio': []}
