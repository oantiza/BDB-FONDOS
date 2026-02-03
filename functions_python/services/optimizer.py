from firebase_admin import firestore
from firebase_admin import firestore
from .data_fetcher import DataFetcher
# from .data import get_price_data, get_dynamic_risk_free_rate (DEPRECATED)
from .config import (
    RISK_TARGETS,
    MAX_WEIGHT_DEFAULT,
    CUTOFF_DEFAULT,
    MIN_ASSETS_DEFAULT,
    EQUITY_FLOOR,
    BOND_CAP,
    CASH_CAP,
    RISK_BUCKETS_LABELS # NEW [V3 Unified Buckets]
)

def run_optimization(assets_list, risk_level, db, constraints=None, asset_metadata=None, locked_assets=None):
    """Optimizer v4 (Unified Buckets + Markowitz)

    Principios:
    - Trabajar siempre sobre el universo real con histórico (df.columns).
    - Devolver used_assets / missing_assets / dropped_assets y pesos completos (incluye ceros).
    - Recalcular métricas sobre los pesos finales.
    - NEW: Unified Buckets (Labels) constraints matching Frontend.
    """
    import pandas as pd
    import numpy as np
    from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions, CLA

    def _to_float(x, default=0.0):
        try:
            if x is None: return float(default)
            if isinstance(x, str):
                s = x.strip().replace('%', '').replace(',', '.')
                return float(s)
            return float(x)
        except Exception:
            return float(default)

    def _normalize(weights: dict) -> dict:
        s = sum(max(0.0, float(v)) for v in weights.values())
        if s <= 0: return weights
        return {k: float(v) / s for k, v in weights.items()}

    def _cap(weights: dict, max_w: float) -> dict:
        return {k: min(float(v), max_w) for k, v in weights.items()}

    # --- NEW: UNIFIED LABEL CLASSIFIER ---
    def _classify_asset(ticker: str) -> str:
        """Determines bucket label (RV, RF, Mixto, Monetario, Other)"""
        meta = (asset_metadata or {}).get(ticker, {}) or {}
        # Try raw asset_class (std_type)
        raw = (meta.get('asset_class') or '').strip().upper()
        
        if "MONETARIO" in raw or "CASH" in raw or "LIQUIDEZ" in raw or "MONEY" in raw: return "Monetario"
        if "FIJA" in raw or "FIXED" in raw or "BOND" in raw or "CREDIT" in raw: return "RF"
        if "VARIABLE" in raw or "EQUITY" in raw or "STOCK" in raw or "ACCION" in raw or "RV" in raw: return "RV"
        if "MIXTO" in raw or "MIXED" in raw or "MULTI" in raw or "BALANCED" in raw or "ALLOCATION" in raw: return "Mixto"
        return "Other" # Default/Fallback

    def _allocation_vectors(tickers: list):
        """Standard allocation vectors (Equity/Bond/Cash/Other) for reporting metrics.
        Kept for backward compatibility and metrics calculation, separate from Bucket Logic.
        """
        eq_vec, bd_vec, cs_vec, ot_vec = [], [], [], []
        
        for t in tickers:
            meta = (asset_metadata or {}).get(t, {}) or {}
            metrics = meta.get('metrics', {}) or {}
            asset_class = (meta.get('asset_class') or '').strip().lower()

            eq = metrics.get('equity', None)
            bd = metrics.get('bond', None)
            cs = metrics.get('cash', None)
            ot = metrics.get('other', None)

            has_metrics = any(v is not None for v in [eq, bd, cs, ot])
            if has_metrics:
                eqp = max(0.0, min(100.0, _to_float(eq, 0.0))) / 100.0
                bdp = max(0.0, min(100.0, _to_float(bd, 0.0))) / 100.0
                csp = max(0.0, min(100.0, _to_float(cs, 0.0))) / 100.0
                otp = max(0.0, min(100.0, _to_float(ot, 0.0))) / 100.0
                s = eqp + bdp + csp + otp
                if 0.95 <= s <= 1.05 and s > 0:
                    eqp, bdp, csp, otp = eqp / s, bdp / s, csp / s, otp / s
            else:
                # Fallback based on text
                if 'rv' in asset_class or 'equity' in asset_class:
                    eqp, bdp, csp, otp = 1.0, 0.0, 0.0, 0.0
                elif 'rf' in asset_class or 'bond' in asset_class or 'fixed' in asset_class:
                    eqp, bdp, csp, otp = 0.0, 1.0, 0.0, 0.0
                elif 'monet' in asset_class or 'cash' in asset_class:
                    eqp, bdp, csp, otp = 0.0, 0.0, 1.0, 0.0
                elif 'mixto' in asset_class or 'mixed' in asset_class:
                    eqp, bdp, csp, otp = 0.5, 0.5, 0.0, 0.0
                else:
                    eqp, bdp, csp, otp = 0.0, 0.0, 0.0, 1.0

            eq_vec.append(eqp)
            bd_vec.append(bdp)
            cs_vec.append(csp)
            ot_vec.append(otp)

        return np.array(eq_vec), np.array(bd_vec), np.array(cs_vec), np.array(ot_vec), {}

    # --- PHASE 2.1 CONSTANTS ---
    FALLBACK_CANDIDATES_DEFAULT = [
        'IE00B03HCZ61', # Vanguard Global Stock
        'LU0996182563', # Amundi Index Solutions - Amundi Prime Global
        'IE00B4L5Y983', # iShares Core MSCI World
        'LU0340557775', # Morgan Stanley Global Opportunity
        'LU1670724373', # Amundi Index MSCI World
        'IE0031442068', # iShares S&P 500
        'IE00B5BXRH53', # iShares Core S&P 500
        'LU1135865084', # Fidelity Funds - Global Dividend
    ]
    
    # Init safe defaults (Handler for UnboundLocalError in except block)
    price_data = {}
    universe = []
    missing_assets = []
    synthetic_used = []

    try:
        solver_path = None
        added_assets = []
        raw_weights = None
        auto_complete_source = None
        rejected_candidates = []
        
        # 1) Carga de Datos (Strict Senior Methodology)
        fetcher = DataFetcher(db)
        # RELAXED: strict=False allows union of data (filled later)
        price_data, synthetic_used = fetcher.get_price_data(assets_list, resample_freq='D', strict=False)
        
        df = pd.DataFrame(price_data) # Ensure DataFrame
        df.index = pd.to_datetime(df.index)
        
        # SANITIZACIÓN INMEDIATA (Morningstar Standard)
        # Apply .ffill() IMMEDIATELY after loading
        df = df.sort_index().ffill().bfill()
        
        # FILTRO TEMPORAL ESTRICTO: 3 Años (1095 días)
        if not df.empty:
            start_date = df.index[-1] - pd.Timedelta(days=1095)
            df = df[df.index >= start_date]

        if df.empty or len(df) < 50:
            # --- EMERGENCY AUTO-EXPAND ---
            auto_expand = constraints.get('auto_expand_universe', False) if constraints else False
            if auto_expand:
                print("⚠️ Emergency Auto-Expand triggered due to insufficient history...")
                 # A) Fallback Candidates
                candidates_list = FALLBACK_CANDIDATES_DEFAULT
                try:
                    cfg_ref = db.collection('config').document('auto_complete_candidates')
                    cfg = cfg_ref.get()
                    if cfg.exists: candidates_list = cfg.to_dict().get('equity90_isins', FALLBACK_CANDIDATES_DEFAULT)
                except: pass
                
                prices_check, _ = fetcher.get_price_data(candidates_list, resample_freq='D', strict=True)
                valid_candidates = [k for k, v in prices_check.items() if len(v) >= 50]
                
                if not valid_candidates:
                    raise Exception("Insuficientes datos (incluso tras auto-expand).")
                
                top_candidates = valid_candidates[:5]
                added_assets = top_candidates
                price_data = {} 
                for c in top_candidates:
                    price_data[c] = prices_check[c]
                
                df = pd.DataFrame(price_data)
                df.index = pd.to_datetime(df.index)
                
                # Senior Pipeline: Fill then Slice
                df = df.sort_index().ffill().bfill()
                start_date = df.index[-1] - pd.Timedelta(days=1095)
                df = df[df.index >= start_date]

                universe = list(df.columns)
                solver_path = 'emergency_auto_expand'
                print(f"✅ Emergency Expansion Applied. New Universe: {universe}")
                
                try:
                    refs = [db.collection('funds_v3').document(isin) for isin in universe]
                    new_docs = db.get_all(refs)
                    for d in new_docs:
                        if d.exists:
                            dd = d.to_dict() or {}
                            asset_metadata[d.id] = {
                                'metrics': dd.get('metrics', {}),
                                'asset_class': dd.get('asset_class') or dd.get('std_type')
                            }
                except: pass

            else:
                raise Exception("Insuficientes datos históricos para optimizar.")

        universe = list(df.columns)
        missing_assets = [a for a in assets_list if a not in universe]

        
        # 2) Standard Markowitz Inputs (Visual Coherence Refactor)
        # Mu = Mean Historical Return (No BL)
        # S = Sample Covariance
        mu = expected_returns.mean_historical_return(df, frequency=252, compounding=False)
        S = risk_models.sample_cov(df, frequency=252)
        S = risk_models.fix_nonpositive_semidefinite(S)

        # 3) Generate Efficient Frontier Curve (50 points) - Internal coherence check
        print("⚙️ [Optimizer] Generating Internal Coherence Frontier...")
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

        # 3) Parámetros
        max_weight = float(MAX_WEIGHT_DEFAULT)
        cutoff = float(CUTOFF_DEFAULT)
        risk_level_i = int(risk_level)

        # Gamma dinámico (diversificación)
        n_assets = len(universe)
        gamma = 1.0 if n_assets < 10 else (2.0 if n_assets <= 25 else 3.0)

        # 4) Construir EF
        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
        ef.add_objective(objective_functions.L2_reg, gamma=gamma)

        # 4.1 Locked assets
        locked_assets = locked_assets or []
        for isin in locked_assets:
            if isin in universe:
                idx = ef.tickers.index(isin)
                ef.add_constraint(lambda w, i=idx: w[i] >= 0.03)

        # 4.2 Restricciones geo (opcional - preserved)
        if constraints and asset_metadata:
            try:
                tickers = universe
                eu_target = float((constraints.get('europe', 0.0) or 0.0))
                us_cap = float((constraints.get('americas', 1.0) or 1.0))
                if eu_target > 0 or us_cap < 1.0:
                    eu_vec = []
                    us_vec = []
                    for t in tickers:
                        meta = (asset_metadata or {}).get(t, {}) or {}
                        regions = meta.get('regions', {}) or {}
                        eu_vec.append(_to_float(regions.get('europe', 0.0), 0.0) / 100.0)
                        us_vec.append(_to_float(regions.get('americas', 0.0), 0.0) / 100.0)
                    eu_vec = np.array(eu_vec)
                    us_vec = np.array(us_vec)
                    if eu_target > 0:
                        ef.add_constraint(lambda w: w @ eu_vec >= eu_target)
                    if us_cap < 1.0:
                        ef.add_constraint(lambda w: w @ us_vec <= us_cap)
            except Exception as e_geo:
                print(f"⚠️ Aviso Geo: {e_geo}")

        # 4.3 UNIFIED BUCKET CONSTRAINTS (V3)
        # Apply strict bucket limits from config if available for this risk level
        bucket_cfg = RISK_BUCKETS_LABELS.get(risk_level_i)
        
        # Check explicit disable flag (for pure rebalancing)
        apply_buckets = True 
        if constraints and constraints.get('disable_profile_rules'): apply_buckets = False
        
        if bucket_cfg and apply_buckets:
            print(f"🔒 Applying Unified Buckets for Risk {risk_level_i}: {bucket_cfg}")
            
            # Create Binary Vectors for each Label
            vecs = {
                "RV": [], "RF": [], "Mixto": [], "Monetario": [], "Other": []
            } # order matters if we iterate, but here we access by key
            
            for t in universe:
                lbl = _classify_asset(t)
                # Populate all vectors
                for k in vecs:
                    vecs[k].append(1.0 if lbl == k else 0.0)
            
            # Convert to numpy arrays
            np_vecs = {k: np.array(v) for k, v in vecs.items()}
            
            # Apply Constraints
            for label, (min_p, max_p) in bucket_cfg.items():
                if label not in np_vecs: continue
                # Relax slightly (tol=0.01) to avoid solver choke on hard boundaries
                v_min = max(0.0, min_p - 0.01)
                v_max = min(1.0, max_p + 0.01)
                
                if v_min > 0:
                    ef.add_constraint(lambda w, vec=np_vecs[label], val=v_min: w @ vec >= val)
                if v_max < 1.0:
                    ef.add_constraint(lambda w, vec=np_vecs[label], val=v_max: w @ vec <= val)

        # 5) Resolver

        # ---------------------------------------------------------
        
        # 5.0) Pre-Check: Equity Floor Feasibility
        if apply_profile_b and equity_floor > 0:
            # Calcular equity maximo alcanzable con max_weight
            eq_vec, _, _, _, _ = _allocation_vectors(universe)
            
            # Ordenar equity scores de mayor a menor
            sorted_indices = np.argsort(eq_vec)[::-1] # indices descending
            
            # Calcular locked budget
            current_weight_budget = 1.0
            achieved_equity = 0.0
            
            # Locked assets consumen budget primero
            processed_indices = set()
            
            # Primero procesar locked (con min 3% o constraints)
            locked_sum = 0.0
            for isin in locked_assets:
                if isin in universe:
                    idx = universe.index(isin)
                    processed_indices.add(idx)
                    w = max(0.03, min(max_weight, 1.0)) # asumiendo min 3%
                    locked_sum += w
                    achieved_equity += w * eq_vec[idx]
            
            current_weight_budget -= locked_sum
            
            # Rellenar con los mejores equity funds restantes
            for idx in sorted_indices:
                if idx in processed_indices: continue
                
                space = min(max_weight, current_weight_budget)
                if space <= 1e-4: break
                
                achieved_equity += space * eq_vec[idx]
                current_weight_budget -= space
            
            # Tolerancia pequeña por redondeos
            equity_max_achievable = achieved_equity + 0.005 

            print(f"🔍 DEBUG LOGIC: apply_profile_b={apply_profile_b}, equity_floor={equity_floor}, MaxAchieved={equity_max_achievable}")

            if equity_max_achievable < equity_floor:
                # 5.1) Check Auto-Expand
                auto_expand = constraints.get('auto_expand_universe', False) if constraints else False
                
                if not auto_expand:
                    # BLOCKING RETURN (unchanged)
                    return {
                        'api_version': 'optimizer_v4',
                        'mode': 'PROFILE_B_AGGRESSIVE',
                        'status': 'infeasible_equity_floor',
                        'solver_path': 'blocked_infeasible',
                        'feasibility': {
                            'equity_floor_requested': equity_floor,
                            'equity_max_achievable': round(equity_max_achievable, 4),
                            'min_100pct_equity_funds_needed': int(np.ceil(equity_floor / max_weight)),
                            'note': "Universe does not contain enough equity exposure."
                        },
                        'used_assets': universe,
                        'missing_assets': missing_assets,
                        'dropped_assets': [],
                        'weights': {},
                        'warnings': [f"Equity Floor {equity_floor} Unachievable (Max: {equity_max_achievable:.2f})"]
                    }
                else:
                    # 5.2) AUTO-EXPAND EXECUTION (STRICT PHASE 2.1)
                    print("⚠️ Auto-Expanding Universe (Strict Production Mode)...")
                    
                    # A) Helper: Get candidates from DB or Config
                    candidates_list = []
                    source = 'db_query'
                    
                    # 1. Try DB Query (High Equity, High Sharpe)
                    try:
                        docs = db.collection('funds_v3')\
                            .order_by('std_perf.sharpe', direction=firestore.Query.DESCENDING)\
                            .limit(50)\
                            .stream()
                        
                        for d in docs:
                            dd = d.to_dict()
                            eq = _to_float(dd.get('metrics', {}).get('equity'), 0.0)
                            if eq >= 90.0:
                                candidates_list.append(d.id)
                    except Exception as e_q:
                        print(f"⚠️ DB Query failed: {e_q}")
                    
                    # 2. If DB empty/failed, Try Config Fallback
                    if not candidates_list:
                        source = 'config_fallback'
                        print("⚠️ No DB candidates found. Checking Config Fallback...")
                        try:
                            cfg_ref = db.collection('config').document('auto_complete_candidates')
                            cfg = cfg_ref.get()
                            if cfg.exists:
                                candidates_list = cfg.to_dict().get('equity90_isins', [])
                            else:
                                # SELF-HEALING: Write default to DB
                                print("⚠️ Config missing. Writing Default Safety Net to DB.")
                                candidates_list = FALLBACK_CANDIDATES_DEFAULT
                                cfg_ref.set({
                                    'equity90_isins': candidates_list,
                                    'updated_at': firestore.SERVER_TIMESTAMP,
                                    'created_by': 'optimizer_v4_auto_heal'
                                })
                        except Exception as e_cfg:
                            print(f"⚠️ Config read failed: {e_cfg}")
                            # Last resort: memory literal (should rarely happen if FB works)
                            candidates_list = FALLBACK_CANDIDATES_DEFAULT

                    # B) Filter: Must have REAL Price History
                    # We only care about assets we can actually trade/optimize
                    valid_candidates = []
                    
                    # Remove duplicates and existing assets
                    candidates_unique = []
                    seen = set(universe) | set(assets_list)
                    for c in candidates_list:
                        if c not in seen:
                            candidates_unique.append(c)
                            seen.add(c)
                    
                    # Batch check history (get_price_data handles batching internally roughly)
                    if candidates_unique:
                        prices_check, _ = fetcher.get_price_data(candidates_unique, resample_freq='D', strict=True)
                        # Only keep those with >= 50 data points (simple check)
                        for isin, p_series in prices_check.items():
                            if len(p_series) >= 20: # Relaxed slightly for robustness, but implies real data
                                valid_candidates.append(isin)
                            else:
                                rejected_candidates.append({'isin': isin, 'reason': 'insufficient_history'})
                    else:
                         rejected_candidates.append({'reason': 'no_unique_candidates'})

                    # C) Add minimal set
                    if not valid_candidates:
                        # CASE B2: FAILURE
                        print("❌ No valid candidates found after filtering.")
                        return {
                            'api_version': 'optimizer_v4',
                            'status': 'auto_expand_no_candidates',
                            'solver_path': 'blocked_no_candidates',
                            'auto_complete_source': source,
                            'rejected_candidates': rejected_candidates[:10], # trim for safety
                            'warnings': ["Found candidates but none had sufficient history.", "Please verify funds_v3 and historico_vl_v2 sync."],
                            'weights': {}
                        }
                    
                    # Add top N needed. For max_weight=0.20, we broadly need 5 total equity funds.
                    # We assume these are 100% equity roughly.
                    # Safety: Just add top 5 valid ones to be sure we cover the gap.
                    added_assets = valid_candidates[:6] 
                    auto_complete_source = source
                    
                    print(f"✅ Auto-Expand Successful. Source: {source}. Added: {added_assets}")
                    
                    # D) Update Optimization Context
                    # Fetch price data again (already fetched in check, but logic flow cleaner to update)
                    # Use prices_check directly
                    new_prices = {k: prices_check[k] for k in added_assets}
                    price_data.update(new_prices)
                    
                    # Update metadata for vectors (fetch new docs)
                    # Needed for _allocation_vectors to recognize them as equity!
                    # If we used DB Query, we might assume metrics are there.
                    # If Config Fallback, we MUST fetch metrics or logic falls back to asset_class.
                    try:
                        refs = [db.collection('funds_v3').document(isin) for isin in added_assets]
                        new_docs = db.get_all(refs)
                        for d in new_docs:
                            if d.exists:
                                dd = d.to_dict() or {}
                                asset_metadata[d.id] = {
                                    'metrics': dd.get('metrics', {}),
                                    'asset_class': dd.get('asset_class') or dd.get('std_type')
                                }
                    except Exception as e_meta:
                        print(f"⚠️ Metadata fetch warning: {e_meta}")

                    # Re-init DF and Universe
                    df = pd.DataFrame(price_data)
                    df.index = pd.to_datetime(df.index)
                    df = df.sort_index().ffill().bfill()
                    
                    universe = list(df.columns)
                    mu = expected_returns.ema_historical_return(df, frequency=252, span=252)
                    try:
                        S = risk_models.CovarianceShrinkage(df, frequency=252).ledoit_wolf()
                    except:
                        S = risk_models.sample_cov(df) * 252
                        S = risk_models.fix_nonpositive_semidefinite(S)
                    
                    # Re-calc allocated vectors for constraints
                    eq_vec, bd_vec, cs_vec, ot_vec, alloc_lookup = _allocation_vectors(universe)
                    
                    # Set flag for return
                    solver_path = 'auto_expand_then_solve'
                    
                    # Resume standard flow...
                    # (Code continues to solver block below)


        solver_path = solver_path or None
        if not solver_path:
            try:
                # --- NEW: Explicit Objective Override (e.g. Max Sharpe for Rebalance) ---
                if constraints and constraints.get('objective') == 'max_sharpe':
                    solver_path = 'max_sharpe_unconstrained'
                    raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
                elif apply_profile_b:
                    solver_path = 'max_sharpe_with_equity_floor'
                    raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
                else:
                    base_target = float(RISK_TARGETS.get(risk_level_i, 0.05))
                    target_vol = base_target + 0.015
                    solver_path = f'efficient_risk_{target_vol:.3f}'
                    raw_weights = ef.efficient_risk(target_vol)
            except Exception as e1:
                # Si equity floor es infeasible, relajar una vez
                if apply_profile_b and equity_floor > 0 and not relaxed:
                    try:
                        relaxed = True
                        equity_floor2 = max(0.0, equity_floor - 0.10)
                        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
                        ef.add_objective(objective_functions.L2_reg, gamma=gamma)
                        for isin in locked_assets:
                            if isin in universe:
                                idx = ef.tickers.index(isin)
                                ef.add_constraint(lambda w, i=idx: w[i] >= 0.03)
                        ef.add_constraint(lambda w: w @ eq_vec >= equity_floor2)
                        if bond_cap is not None:
                            ef.add_constraint(lambda w: w @ bd_vec <= bond_cap)
                        if cash_cap is not None:
                            ef.add_constraint(lambda w: w @ cs_vec <= cash_cap)
                        solver_path = f'max_sharpe_relaxed_equity_{equity_floor2:.2f}'
                        raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
                        equity_floor = equity_floor2
                    except Exception:
                        solver_path = 'fallback_max_sharpe_no_equity'
                        ef = EfficientFrontier(mu, S, weight_bounds=(0.0, max_weight))
                        ef.add_objective(objective_functions.L2_reg, gamma=gamma)
                        raw_weights = ef.max_sharpe(risk_free_rate=rf_rate)
                        equity_floor = 0.0
                else:
                    # Fallback general
                    try:
                        solver_path = 'fallback_min_volatility'
                        raw_weights = ef.min_volatility()
                    except Exception:
                        solver_path = 'fallback_equal_weight'
                        raw_weights = None

        # 6) Post-proceso de pesos
        weights = {}
        
        # Guard against UnboundLocalError if logic skipped
        r_w = None
        try:
            r_w = raw_weights
        except UnboundLocalError:
            r_w = None

        if r_w is not None:
            cleaned = ef.clean_weights(cutoff=cutoff)
            # cleaned solo devuelve no-ceros; completamos universe
            weights = {t: float(cleaned.get(t, 0.0)) for t in universe}
        else:
            # equal-weight sobre universe
            weights = {t: 1.0 / max(1, len(universe)) for t in universe}

        # asegurar locked min y cap, renormalizar iterativamente
        for _ in range(5):
            for isin in locked_assets:
                if isin in universe:
                    weights[isin] = max(float(weights.get(isin, 0.0)), 0.03)
            weights = _cap(weights, max_weight)
            weights = _normalize(weights)

        # dropped_assets: en universe con peso ~0
        dropped_assets = [t for t in universe if float(weights.get(t, 0.0)) <= 0.0]

        # 7) Métricas coherentes (Senior Formulas: w.T @ mu y sqrt(w.T @ S @ w))
        # This matches the Efficient Frontier visualization 100%
        w_arr = np.array([float(weights[t]) for t in universe], dtype=float)
        mu_arr = mu.values
        S_arr = S.values
        
        # Formula Retorno ($y$): weights.T @ mu
        port_ret = float(w_arr.T @ mu_arr)
        
        # Formula Volatilidad ($x$): sqrt(weights.T @ S @ weights)
        port_vol = float(np.sqrt(w_arr.T @ S_arr @ w_arr))
        
        # Sharpe Aritmético: (Ret - Rf) / Vol
        port_sharpe = float((port_ret - rf_rate) / port_vol) if port_vol > 1e-12 else 0.0

        # Create explicit portfolio point object for frontend (if needed in metrics)
        portfolio_point = {'x': round(port_vol, 4), 'y': round(port_ret, 4)}

        # 8) Allocation resultante (equity/bond/cash/other)
        eq_total = float(w_vec @ eq_vec)
        bd_total = float(w_vec @ bd_vec)
        cs_total = float(w_vec @ cs_vec)
        ot_total = float(w_vec @ ot_vec)
        # renormalizar por si hay pequeños desajustes
        s_alloc = eq_total + bd_total + cs_total + ot_total
        if s_alloc > 0:
            eq_total, bd_total, cs_total, ot_total = eq_total/s_alloc, bd_total/s_alloc, cs_total/s_alloc, ot_total/s_alloc

        warnings = []
        if synthetic_used:
            warnings.append(f"Datos Sintéticos usados para: {', '.join(synthetic_used)}")
        if missing_assets:
            warnings.append(f"{len(missing_assets)} activos sin histórico y excluidos de la optimización")
        if apply_profile_b and equity_floor > 0:
            warnings.append(f"Equity floor aplicado: {equity_floor:.2f}")

        # 9) weights completos para assets_list (incluye missing=0)
        # Mantener orden estable y sin duplicados
        seen = set()
        requested = []
        for a in assets_list:
            if a not in seen:
                requested.append(a)
                seen.add(a)
        weights_full = {a: float(weights.get(a, 0.0)) if a in universe else 0.0 for a in requested}

        # Sanity: suma ~ 1 sobre universe, y también sobre requested (si requested incluye missing, suma <1). Aceptable.
        if added_assets:
            solver_path = 'auto_expand_then_solve'

        return {
            'api_version': 'optimizer_v4',
            'mode': 'PROFILE_B_AGGRESSIVE' if apply_profile_b else 'PROFILE_A',
            'status': 'optimal',
            'solver_path': solver_path,
            'added_assets': locals().get('added_assets', []),
            'used_assets': universe,
            'missing_assets': missing_assets,
            'dropped_assets': dropped_assets,
            'constraints_applied': {
                'max_weight': max_weight,
                'cutoff': cutoff,
                'equity_floor': equity_floor if apply_profile_b else None,
                'bond_cap': bond_cap if apply_profile_b else None,
                'cash_cap': cash_cap if apply_profile_b else None,
                'locked_min': 0.03 if locked_assets else 0.0,
            },
            'portfolio_allocation': {
                'equity': eq_total,
                'bond': bd_total,
                'cash': cs_total,
                'other': ot_total,
            },
            'weights': weights_full,
            'metrics': {
                'return': port_ret,
                'volatility': port_vol,
                'sharpe': port_sharpe,
                'rf_rate': rf_rate,
                'portfolio': portfolio_point # Consistent with spec
            },
            'frontier': frontier_points, # <--- NEW: Internal Coherence Curve (50 pts)
            'portfolio': portfolio_point, # Root level exposure per spec
            'warnings': warnings,
        }

    except Exception as e:
        print(f"❌ Error Crítico Optimización: {e}")
        # fallback seguro: equal-weight sobre lo que tengamos en price_data
        try:
            tickers = list(pd.DataFrame(price_data).columns)
        except Exception:
            tickers = []
        universe = tickers
        missing_assets = [a for a in assets_list if a not in universe]
        n = len(universe) if universe else 1
        weights_full = {a: (1.0 / n if a in universe else 0.0) for a in assets_list}
        
        # Enhanced Fallback: Detect History Issues
        err_str = str(e).lower()
        if "insuficientes datos" in err_str or "no common history" in err_str or "empty" in err_str:
            return {
             'api_version': 'optimizer_v4',
             'mode': 'PROFILE_B_AGGRESSIVE' if int(risk_level) >= 9 else 'PROFILE_A',
             'status': 'fallback_no_history',
             'solver_path': 'blocked_insufficient_history',
             'added_assets': [],
             'used_assets': universe,
             'missing_assets': missing_assets,
             'dropped_assets': [],
             'weights': weights_full,
             'metrics': {'return': 0.0, 'volatility': 0.0, 'sharpe': 0.0},
             'warnings': [f"Error de Datos: {str(e)}"],
             'suggestion': "Prueba a activar 'Auto-Expandir Universo' o selecciona fondos con mayor historial (Indexados Globales, ETFs líquidos).",
             'required_points': 504
            }

        return {
            'api_version': 'optimizer_v4',
            'mode': 'PROFILE_B_AGGRESSIVE' if int(risk_level) >= 9 else 'PROFILE_A',
            'status': 'fallback',
            'solver_path': 'exception_equal_weight',
            'added_assets': locals().get('added_assets', []),
            'used_assets': universe,
            'missing_assets': missing_assets,
            'dropped_assets': [],
            'weights': weights_full,
            'metrics': {'return': 0.0, 'volatility': 0.0, 'sharpe': 0.0},
            'warnings': [f"Error cálculo: {str(e)}"],
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
        print(f"🚀 [Senior EF] Starting generate_efficient_frontier for {len(assets_list)} assets.")
        
        # 1. Senior Data Alignment
        fetcher = DataFetcher(db)
        price_data, synthetic_used = fetcher.get_price_data(assets_list, resample_freq='D', strict=False)
        
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        
        # SANITIZACIÓN INMEDIATA (Morningstar Standard)
        df = df.sort_index().ffill().bfill()
        
        # FILTRO TEMPORAL ESTRICTO: 3 Años (1095 días)
        if not df.empty:
            start_date = df.index[-1] - pd.Timedelta(days=1095)
            df = df[df.index >= start_date]
        
        if len(df) < 10: 
            print(f"⚠️ [Senior EF] Insufficient history: {len(df)} points.")
            return {'error': 'Insufficient history', 'points': len(df), 'assets_found': list(df.columns)}

        print(f"📈 [Senior EF] Data Processed. Shape: {df.shape}, Assets: {list(df.columns)}")

        # 2. Senior Math Engine (mean/sample_cov)
        # Sincronizado con run_optimization (compounding=False)
        mu = expected_returns.mean_historical_return(df, frequency=252, compounding=False)
        S = risk_models.sample_cov(df, frequency=252)
        S = risk_models.fix_nonpositive_semidefinite(S)
        
        print(f"✅ [Senior EF] Inputs ready. Mu Range: [{mu.min():.4f}, {mu.max():.4f}]")

        # 3. CLA Engine (Reliable Frontier Generation - 50 Points Resolution)
        print("⚙️ [Senior EF] Running CLA...")
        cla = CLA(mu, S)
        frontier_points = []
        try:
            # Generate curve points (explicit 50 points for smooth line)
            frontier_ret, frontier_vol, _ = cla.efficient_frontier(points=50)
            for v_raw, r_raw in zip(frontier_vol, frontier_ret):
                try:
                    v = float(v_raw)
                    r = float(r_raw)
                    if np.isnan(v) or np.isnan(r): continue
                    frontier_points.append({'x': round(v, 4), 'y': round(r, 4)})
                except: continue
            print(f"✨ [Senior EF] CLA Success: {len(frontier_points)} points generated.")
        except Exception as e_cla:
            print(f"❌ [Senior EF] CLA Error: {e_cla}")
            return {'error': f'Optimization engine failed: {str(e_cla)}', 'frontier': []}

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

        return {
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