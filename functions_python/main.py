from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore, storage
from typing import Any
from datetime import datetime
import json
import os

# Inicialización básica
initialize_app()

# ==========================================
# CONFIGURACIÓN GLOBAL
# ==========================================
BENCHMARK_RF_ISIN = 'IE00B18GC888' 
BENCHMARK_RV_ISIN = 'IE00B03HCZ61'
EODHD_API_KEY = os.environ.get("EODHD_API_KEY")
if not EODHD_API_KEY:
    print("⚠️ WARNING: EODHD_API_KEY not found in environment variables.")

BUCKET_NAME = "bdb-fondos.firebasestorage.app" 
TRADING_DAYS = 252
RISK_FREE_RATE = 0.03

# CACHÉ EN MEMORIA
PRICE_CACHE = {}

# Configuración CORS Permisiva
cors_config = options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"])

# ==========================================
# 1. UTILIDADES
# ==========================================

def get_price_data(assets_list, db):
    # Importación diferida (Lazy Import)
    import pandas as pd
    import numpy as np
    
    def generate_synthetic_series(days=1200, vol=0.12, ret=0.07, seed=None):
        if seed is not None: np.random.seed(seed)
        end_date = datetime.now()
        dates = pd.date_range(end=end_date, periods=days, freq='B')
        dt = 1/252
        mu = ret * dt
        sigma = vol * np.sqrt(dt)
        returns = np.random.normal(loc=mu, scale=sigma, size=days)
        price_path = 100 * (1 + returns).cumprod()
        return {d.strftime('%Y-%m-%d'): float(round(p, 2)) for d, p in zip(dates, price_path)}

    price_data = {}
    missing_assets = []

    # 1. REVISAR CACHÉ RAM
    for isin in assets_list:
        if isin in PRICE_CACHE:
            price_data[isin] = PRICE_CACHE[isin]
        else:
            missing_assets.append(isin)
            
    if not missing_assets:
        print("⚡ [CACHE HIT] Todos los activos recuperados de memoria RAM.")
        return price_data, []

    # 2. CONSULTAR FIRESTORE
    print(f"📥 [DB READ] Buscando {len(missing_assets)} activos en Firestore...")
    
    synthetic_used = []

    for i, isin in enumerate(missing_assets):
        loaded = False
        try:
            doc = db.collection('historico_vl_v2').document(isin).get()
            if doc.exists:
                data = doc.to_dict()
                series = data.get('series', [])
                if len(series) > 50:
                    clean_series = {}
                    for p in series:
                        if p.get('date') and p.get('price'):
                            d_val = p['date']
                            if hasattr(d_val, 'strftime'): d_str = d_val.strftime('%Y-%m-%d')
                            else: d_str = str(d_val).split('T')[0]
                            clean_series[d_str] = float(p['price'])
                    
                    if len(clean_series) > 50:
                        price_data[isin] = clean_series
                        PRICE_CACHE[isin] = clean_series 
                        loaded = True
        except Exception as e:
            print(f"⚠️ Error leyendo {isin}: {e}")

        if not loaded:
            print(f"⚠️ {isin}: Usando datos SINTÉTICOS.")
            synthetic_used.append(isin)
            fake_vol = 0.05 + (0.15 * (i % 4) / 3) 
            fake_ret = 0.04 + (0.06 * (i % 3) / 2)
            price_data[isin] = generate_synthetic_series(vol=fake_vol, ret=fake_ret, seed=i)

    return price_data, synthetic_used

# ==========================================
# 2. ENDPOINTS
# ==========================================

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getMarketIndex(request: https_fn.CallableRequest):
    import requests
    from datetime import datetime, timedelta
    
    try:
        symbol = request.data.get('symbol', 'GSPC.INDX')
        range_val = request.data.get('range', '1y') # 1y, 1m, 3m
        
        days_map = {'1m': 30, '3m': 90, '6m': 180, '1y': 365, 'ytd': 0}
        days = days_map.get(range_val, 365)
        
        if range_val == 'ytd':
             start_date = datetime(datetime.now().year, 1, 1).strftime('%Y-%m-%d')
        else:
             start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        url = f"https://eodhd.com/api/eod/{symbol}"
        params = {'api_token': EODHD_API_KEY, 'fmt': 'json', 'from': start_date, 'order': 'a'}
        
        r = requests.get(url, params=params, timeout=5)
        raw = r.json() if r.status_code == 200 else []
        
        series = []
        if isinstance(raw, list):
            for p in raw:
                if p.get('date') and p.get('close'):
                    series.append({'x': p['date'], 'y': float(p['close'])})
                    
        return {'series': series, 'symbol': symbol}
    except Exception as e:
        return {'error': str(e), 'series': []}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getYieldCurve(request: https_fn.CallableRequest):
    import requests
    try:
        region = request.data.get('region', 'US')
        
        # Desired Scale: 1, 5, 10, 15, 20, 25, 30
        # Strategy: Fetch key anchors (1Y, 5Y, 10Y, 20Y, 30Y) and interpolate 15, 25.
        
        if region == 'EU':
            # German Bunds as proxy
            tickers_map = {
                '1Y': 'DE1Y.GBOND', # Might fail, handled in loop
                '5Y': 'DE5Y.GBOND',
                '10Y': 'DE10Y.GBOND',
                '20Y': 'DE20Y.GBOND',
                '30Y': 'DE30Y.GBOND'
            }
        elif region == 'EURIBOR':
             tickers_map = {
                '1W': 'EURIBOR1W.MONEY',
                '1M': 'EURIBOR1M.MONEY',
                '3M': 'EURIBOR3M.MONEY',
                '6M': 'EURIBOR6M.MONEY',
                '12M': 'EURIBOR12M.MONEY'
            }
        else:
            # US Treasuries (Default)
            tickers_map = {
                '1Y': 'US1Y.GBOND',
                '5Y': 'US5Y.GBOND', 
                '10Y': 'US10Y.GBOND', 
                '20Y': 'US20Y.GBOND',
                '30Y': 'US30Y.GBOND'
            }
            
        # 1. Fetch Anchors
        yields = {}
        for label, ticker in tickers_map.items():
            try:
                url = f"https://eodhd.com/api/eod/{ticker}"
                params = {'api_token': EODHD_API_KEY, 'fmt': 'json', 'order': 'd', 'limit': 1}
                r = requests.get(url, params=params, timeout=3)
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list) and len(data) > 0:
                         # Handle None or 0
                         val = data[0]['close']
                         if val is not None:
                             yields[label] = float(val)
            except Exception as e:
                print(f"Error fetching {label}: {e}")

        # 2. Helper for Interpolation
        def get_val(lbl):
            return yields.get(lbl)

        def interpolate(y1, y2, x1, x2, target_x):
            if y1 is None or y2 is None: return None
            return y1 + (y2 - y1) * ((target_x - x1) / (x2 - x1))

        # 3. Fill Interpolations (15Y, 25Y)
        # 15Y needs 10Y and 20Y (or 30Y if 20 is missing)
        y10 = get_val('10Y')
        y20 = get_val('20Y')
        y30 = get_val('30Y')
        
        # If 20Y is missing but we have 10 and 30, interpolate 20
        if y20 is None and y10 is not None and y30 is not None:
             y20 = interpolate(y10, y30, 10, 30, 20)
             yields['20Y'] = y20

        # Now calc 15Y (between 10 and 20)
        if '15Y' not in yields:
             if y10 is not None and y20 is not None:
                 yields['15Y'] = interpolate(y10, y20, 10, 20, 15)

        # Now calc 25Y (between 20 and 30)
        if '25Y' not in yields:
             if y20 is not None and y30 is not None:
                 yields['25Y'] = interpolate(y20, y30, 20, 30, 25)

        # Final ordered list construction
        final_data = []
        if region == 'EURIBOR':
             desired_order = ['1W', '1M', '3M', '6M', '12M']
        else:
             desired_order = ['1Y', '5Y', '10Y', '15Y', '20Y', '25Y', '30Y']
        
        for maturity in desired_order:
            val = yields.get(maturity)
            if val is not None:
                final_data.append({'maturity': maturity, 'yield': round(val, 2)})
            
        # Backup if empty (e.g. API failure)
        if not final_data:
             final_data = [{'maturity': 'Error', 'yield': 0}]
            
        return {'curve': final_data, 'region': region}

    except Exception as e:
        print(f"Yield Error: {e}")
        return {'curve': [{'maturity': 'Error', 'yield': 0}], 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=120, cors=cors_config)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    req_data = request.data
    
    if req_data.get('warmup') is True:
        return {'status': 'warmed_up'}

    try:
        assets_list = req_data.get('assets', [])
        risk_level = req_data.get('risk_level', 5)
        
        if not assets_list: return {'status': 'error', 'warnings': ['Cartera vacía']}
        
        db = firestore.client()
        
        # Fetch Metadata for Constraints
        asset_metadata = {}
        for isin in assets_list:
             d = db.collection('funds_v2').document(isin).get()
             if d.exists:
                 asset_metadata[isin] = {'regions': d.to_dict().get('regions', {})}
        
        # Apply Macro-Europeist Strategy Constraints
        # Verify if we should apply them (check if we have enough Europe exposure potential?)
        # For now, apply blindly as it is the active strategy.
        constraints = {
            'europe': 0.40,
            'americas': 0.35
        }
        
        return _run_optimization(assets_list, risk_level, db, constraints=constraints, asset_metadata=asset_metadata)

    except Exception as e:
        print(f"❌ Error CRÍTICO Optimización Endpoint: {e}")
        return {'status': 'error', 'error': str(e)}

def _run_optimization(assets_list, risk_level, db, constraints=None, asset_metadata=None):
    """
    Core Logic for Mean-Variance Optimization using PyPortfolioOpt
    constraints: dict of generic constraints (e.g. {'europe': 0.40})
    asset_metadata: dict of {isin: {regions: {...}}}
    """
    import pandas as pd
    import numpy as np
    from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions

    try:
        price_data, synthetic_used = get_price_data(assets_list, db)
        
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().fillna(method='ffill').fillna(method='bfill')
        
        # Ensure enough data points
        if len(df) < 50:
             raise Exception("Insuficientes datos históricos para optimizar.")

        mu = expected_returns.ema_historical_return(df, span=252)
        
        try:
            S = risk_models.CovarianceShrinkage(df).ledoit_wolf()
        except Exception as math_err:
            print(f"⚠️ Ledoit-Wolf falló. Usando covarianza estándar.")
            S = risk_models.sample_cov(df)
            S = risk_models.fix_nonpositive_semidefinite(S)
        
        n_assets = len(assets_list)
        RISK_VOL_MAP = {
            1: 0.03, 2: 0.05, 3: 0.07, 4: 0.09, 5: 0.12,
            6: 0.15, 7: 0.18, 8: 0.22, 9: 0.28, 10: 0.99
        }
        target_volatility = RISK_VOL_MAP.get(int(risk_level), 0.10)
        
        warnings = []
        
        # Constraints
        max_weight = max(0.40, (1.0 / n_assets) + 0.15) 
        
        ef = EfficientFrontier(mu, S)
        ef.add_objective(objective_functions.L2_reg, gamma=0.5) 
        ef.add_constraint(lambda w: w <= max_weight) 
        ef.add_constraint(lambda w: w >= 0.01) 
        
        # --- GEOGRAPHIC CONSTRAINTS (MACRO-EUROPEIST) ---
        if constraints and asset_metadata:
            eu_target = constraints.get('europe', 0.0)
            us_cap = constraints.get('americas', 1.0)
            
            # Create vectors for exposure
            # asset_metadata keys must match ef.tickers (which are df.columns)
            # Ensure order matches df.columns
            tickers = df.columns.tolist()
            
            eu_vector = []
            us_vector = []
            
            for t in tickers:
                meta = asset_metadata.get(t, {})
                regions = meta.get('regions', {})
                # regions: { 'europe': 40.5, 'americas': 20, ... } (0-100 scale)
                eu_vector.append(regions.get('europe', 0) / 100.0)
                us_vector.append(regions.get('americas', 0) / 100.0)
            
            eu_vec = np.array(eu_vector)
            us_vec = np.array(us_vector)
            
            # Constraint: Sum(w * eu_vec) >= eu_target
            if eu_target > 0:
                print(f"Adding Europe Constraint >= {eu_target}")
                ef.add_constraint(lambda w: w @ eu_vec >= eu_target)
            
            # Constraint: Sum(w * us_vec) <= us_cap
            if us_cap < 1.0:
                 print(f"Adding Americas Constraint <= {us_cap}")
                 # Relaxation: only apply if feasible? For now hard constraint.
                 ef.add_constraint(lambda w: w @ us_vec <= us_cap)

        # TIER 1: Constrained Efficient Risk (Target Volatility)
        try:
            weights = ef.efficient_risk(target_volatility)
        except Exception as e_opt:
            print(f"⚠️ [Tier 1 Failed] efficient_risk ({e_opt}). Trying Tier 1.5 (Relaxed Constraints)...")
            
            # TIER 1.5: Relax Geographic Constraints by 10%
            try:
                if constraints and asset_metadata:
                    eu_relaxed = max(0.30, constraints.get('europe', 0) - 0.10)
                    us_relaxed = min(0.45, constraints.get('americas', 1.0) + 0.10)
                    
                    # Rebuild EfficientFrontier with relaxed constraints
                    ef_relaxed = EfficientFrontier(mu, S)
                    ef_relaxed.add_objective(objective_functions.L2_reg, gamma=0.5)
                    ef_relaxed.add_constraint(lambda w: w <= max_weight)
                    ef_relaxed.add_constraint(lambda w: w >= 0.01)
                    
                    # Re-apply relaxed geo constraints
                    if eu_relaxed > 0:
                        ef_relaxed.add_constraint(lambda w: w @ eu_vec >= eu_relaxed)
                    if us_relaxed < 1.0:
                        ef_relaxed.add_constraint(lambda w: w @ us_vec <= us_relaxed)
                    
                    weights = ef_relaxed.efficient_risk(target_volatility)
                    warnings.append(f"ℹ️ Restricciones geográficas relajadas: Europa {eu_relaxed*100:.0f}%, Américas {us_relaxed*100:.0f}%")
                else:
                    # No constraints to relax, go to next tier
                    raise Exception("No constraints to relax")
                    
            except Exception as e_relax:
                print(f"⚠️ [Tier 1.5 Failed] Relaxed efficient_risk ({e_relax}). Trying Tier 2 (Max Sharpe)...")
                
                # TIER 2: Unconstrained Max Sharpe
                try:
                    weights = ef.max_sharpe(risk_free_rate=RISK_FREE_RATE)
                except Exception as e_ms:
                    print(f"⚠️ [Tier 2 Failed] Constrained Max Sharpe ({e_ms}). Trying Tier 2b (Unconstrained)...")
                    
                    # TIER 2b: CLEAN SLATE (Remove all geo constraints)
                    try:
                        ef_clean = EfficientFrontier(mu, S)
                        ef_clean.add_objective(objective_functions.L2_reg, gamma=0.5)
                        ef_clean.add_constraint(lambda w: w <= max_weight)
                        ef_clean.add_constraint(lambda w: w >= 0.01)
                        weights = ef_clean.max_sharpe(risk_free_rate=RISK_FREE_RATE)
                        warnings.append("⚠️ Restricciones geográficas eliminadas para permitir optimización.")
                    except Exception as e_final:
                        # TIER 3: Equal Weight (Total Failure)
                        print(f"⚠️ [Tier 2b Failed] Unconstrained Max Sharpe ({e_final}). Fallback to Equal Weight.")
                        return {
                            'status': 'fallback_error',
                            'weights': {t: 1.0/len(tickers) for t in tickers},
                            'metrics': {'return': 0, 'volatility': 0, 'sharpe': 0},
                            'warnings': ["No se pudo optimizar matemáticamente. Se usa distribución equitativa."]
                        }

        clean_weights = ef.clean_weights()
        perf = ef.portfolio_performance(risk_free_rate=RISK_FREE_RATE)
        
        if synthetic_used:
            warnings.append(f"Datos Sintéticos usados para: {', '.join(synthetic_used)}")

        return { 
            'status': 'optimal' if not warnings else 'fallback', 
            'weights': clean_weights, 
            'metrics': {'return': perf[0], 'volatility': perf[1], 'sharpe': perf[2]},
            'warnings': warnings
        }

    except Exception as e:
        print(f"❌ Error Interno Optimización: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback Equal Weight
        n = len(assets_list) if assets_list else 1
        return {
            'status': 'fallback', 
            'weights': {isin: 1.0/n for isin in assets_list}, 
            'metrics': {'return': 0.05, 'volatility': 0.10, 'sharpe': 0.5},
            'warnings': [f"Fallback activado: {str(e)}"]
        }

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def generateSmartPortfolio(request: https_fn.CallableRequest):
    """
    Intelligently selects funds and creates a portfolio base on:
    1. Category (optional)
    2. Quantitative Scoring (Cost-Agnostic: Sharpe 50%, Alpha 40%, R2 10%)
    3. Optimization with Macro-Europeist Constraints (Europe >= 40%)
    """
    try:
        data = request.data
        category = data.get('category')  # e.g. "RV Sector Tecnologia"
        risk_level = data.get('risk_level', 5)
        num_funds = data.get('num_funds', 5)
        vip_funds_str = data.get('vip_funds', '')
        
        db = firestore.client()
        funds_ref = db.collection('funds_v2')
        
        # --- 1. SELECTION & SCORING ---
        candidates = []
        selected_primary = []
        used_categories = set()
        
        # Helper to process docs
        def process_fund(doc, is_balancer=False, target_vol=0.12):
            f = doc.to_dict()
            isin = f.get('isin')
            if not isin: return None
            
            # --- UNIFIED SCORING ENGINE (Frontend + Backend Consistent) ---
            score = 0
            
            perf_data = f.get('perf', {})
            sharpe = perf_data.get('sharpe')
            alpha = perf_data.get('alpha')
            volatility = perf_data.get('volatility', 0.15)
            
            # Data for Quality & Momentum
            history_years = f.get('inception_years', 0)
            cagr3y = perf_data.get('cagr3y', 0)
            cagr6m = perf_data.get('cagr6m', cagr3y)  # Fallback to 3y
            
            # 1. Sharpe (35% - Risk-adjusted return)
            if sharpe is not None:
                sharpe_norm = max(-1, min(3, float(sharpe)))
                score += (sharpe_norm / 3) * 35
            
            # 2. Alpha (25% - Value generation)
            if alpha is not None:
                alpha_norm = max(-5, min(5, float(alpha)))
                score += ((alpha_norm + 5) / 10) * 25
                
            # 3. Safety (20% - Stability relative to target)
            try:
                safety_ratio = max(0, (target_vol - volatility) / target_vol)
                score += safety_ratio * 100 * 0.20
            except: pass
            
            # 4. Momentum (10% - Trend)
            if cagr3y != 0 and cagr6m != 0:
                momentum_ratio = cagr6m / cagr3y
                score += max(0, min(1, momentum_ratio)) * 10
            
            # 5. Quality (10% - Data quality)
            quality_score = min(history_years / 10, 1) * 10
            score += quality_score
            
            # 6. MAX DRAWDOWN PENALTY (NEW - P2 Integration)
            max_dd = perf_data.get('max_drawdown', 0)  # Esperado como valor absoluto (ej: 0.25 = -25%)
            if max_dd > 0:
                # Penalty: -5 points per 1% drawdown (max -50 for 10% dd)
                dd_penalty = min(abs(max_dd) * 500, 50)
                score -= dd_penalty
            
            # 7. SORTINO BONUS (NEW - P2 Integration)  
            sortino = perf_data.get('sortino_ratio')
            if sortino is not None and sortino > 0:
                # Bonus for funds with good downside risk management
                # Sortino often higher than Sharpe, so normalize differently
                sortino_norm = max(0, min(4, float(sortino)))
                sortino_bonus = (sortino_norm / 4) * 5  # Max 5 points bonus
                score += sortino_bonus
            
            return {

                'isin': isin,
                'name': f.get('name'),
                'score': score,
                'category': f.get('category_morningstar', 'Unknown'),
                'regions': f.get('regions', {'europe': 0, 'americas': 0}),
                'volatility': volatility,
                'is_balancer': is_balancer
            }

        # --- PROCESS VIP FUNDS (ANCHORS) ---
        if vip_funds_str:
            vip_isins = [x.strip() for x in vip_funds_str.split(',') if x.strip()]
            for vip_isin in vip_isins:
                # Query by ISIN
                # Try simple query first if ISIN is document ID (often isin is doc id in some setups, but here it's a field)
                # Assuming 'isin' field. Index might be needed.
                q = funds_ref.where(filter=firestore.FieldFilter('isin', '==', vip_isin)).limit(1)
                docs = q.stream()
                found = False
                for doc in docs:
                    f_processed = process_fund(doc, target_vol=0.12) # Use default vol or specific? Using default for scoring, but inclusion is forced.
                    if f_processed:
                        f_processed['is_vip'] = True
                        selected_primary.append(f_processed)
                        used_categories.add(f_processed['category'])
                        found = True
                
                if not found:
                    print(f"Warning: VIP Fund {vip_isin} not found.")

        # Query Primary Candidates

        # Query Primary Candidates
        query = funds_ref
        if category and category != 'All':
            query = query.where(filter=firestore.FieldFilter('category_morningstar', '==', category))


        docs = query.stream()
        for doc in docs:
            c = process_fund(doc)
            if c: candidates.append(c)
            
        # --- DIVERSIFIED SELECTION (Avoid concentration) ---
        # Sort all candidates by score
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        # If we have VIP funds, they are already in selected_primary
        # We need to fill remaining spots until we reach num_funds
        
        remaining_slots = num_funds - len(selected_primary)
        
        if remaining_slots > 0:
            if len(candidates) <= remaining_slots:
                # Add all valid candidates that aren't already included
                for c in candidates:
                    # Check for duplicates by ISIN (VIP funds might be in candidates too)
                    if not any(s['isin'] == c['isin'] for s in selected_primary):
                        selected_primary.append(c)
            else:
                # Greedy diversification filling
                # If no VIP funds were added, pick the best one to start (if selected_primary is empty)
                if not selected_primary and candidates:
                    selected_primary.append(candidates[0])
                    used_categories.add(candidates[0]['category'])
                
                # Helper for diversity penalty (defined above or here)
                def get_diversity_penalty(candidate, selected):
                    penalty = 0
                    # Category overlap: heavy penalty
                    if candidate['category'] in used_categories:
                        penalty += 0.3
                    
                    # Regional overlap: moderate penalty
                    if selected:
                        avg_eu_selected = sum(s['regions'].get('europe', 0) for s in selected) / len(selected)
                        avg_us_selected = sum(s['regions'].get('americas', 0) for s in selected) / len(selected)
                        
                        candidate_eu = candidate['regions'].get('europe', 0)
                        candidate_us = candidate['regions'].get('americas', 0)
                        
                        # Penalize if very similar to average
                        eu_diff = abs(avg_eu_selected - candidate_eu)
                        us_diff = abs(avg_us_selected - candidate_us)
                        
                        if eu_diff < 10 and us_diff < 10:  # Very similar
                            penalty += 0.2
                    
                    return penalty
                
                # Fill remaining slots
                while len(selected_primary) < num_funds:
                    best_idx = None
                    best_adjusted_score = -999
                    
                    for idx, candidate in enumerate(candidates):
                         # Skip if already selected (by ISIN check)
                        if any(s['isin'] == candidate['isin'] for s in selected_primary):
                            continue
                        
                        penalty = get_diversity_penalty(candidate, selected_primary)
                        adjusted_score = candidate['score'] * (1 - penalty)
                        
                        if adjusted_score > best_adjusted_score:
                            best_adjusted_score = adjusted_score
                            best_idx = idx
                    
                    if best_idx is not None:
                        selected_fund = candidates[best_idx]
                        selected_primary.append(selected_fund)
                        used_categories.add(selected_fund['category'])
                    else:
                        # No more candidates found? Break to avoid infinite loop
                        break
                    
                    penalty = get_diversity_penalty(candidate, selected_primary)
                    adjusted_score = candidate['score'] * (1 - penalty)
                    
                    if adjusted_score > best_adjusted_score:
                        best_adjusted_score = adjusted_score
                        best_idx = idx
                
                if best_idx is not None:
                    selected_fund = candidates[best_idx]
                    selected_primary.append(selected_fund)
                    used_categories.add(selected_fund['category'])
        
        if not selected_primary:
             return {'error': 'No funds found for criteria', 'criteria': category}


        # --- 2. HYDRAULIC BALANCER INJECTION ---
        # Calculate current Geographic Exposure of Primary Selection (Equal Weight Est)
        avg_eu = sum([c['regions'].get('europe', 0) for c in selected_primary]) / len(selected_primary)
        
        selected_all = list(selected_primary)
        
        # If Europe exposure < 40%, Inject Balancers
        TARGET_EU = 40.0
        if avg_eu < TARGET_EU:
            print(f"⚠️ Europe avg ({avg_eu}%) below target ({TARGET_EU}%). Injecting Balancers...")
            
            # Helper set for fast lookup of what we already have
            existing_isins = set(c['isin'] for c in selected_primary)

            # Fetch Balancers: High quality funds from 'RV Europa'
            potential_cats = ['RV Europa', 'RV Europa Cap. Grande Blend', 'RV Europa Cap. Grande Value', 'RV Europa Cap. Grande Growth', 'RV Zona Euro', 'Europe Equity']
            balancers = []
            
            for cat in potential_cats:
                if len(balancers) >= 5: break 
                try:
                    q = funds_ref.where(filter=firestore.FieldFilter('category_morningstar', '==', cat)).limit(5)
                    for d in q.stream():
                        b = process_fund(d, is_balancer=True)
                        if b and b['isin'] not in existing_isins: # Avoid dupes
                            # Also check if already in balancers list
                            if not any(bx['isin'] == b['isin'] for bx in balancers):
                                balancers.append(b)
                except: continue
                
            # If still empty, try Global
            if not balancers:
                 # Fallback to Global
                try:
                    q = funds_ref.where(filter=firestore.FieldFilter('category_morningstar', '==', 'RV Global Cap. Grande Blend')).limit(3)
                    for d in q.stream():
                        b = process_fund(d, is_balancer=True)
                        if b and b['isin'] not in existing_isins:
                             if not any(bx['isin'] == b['isin'] for bx in balancers):
                                 balancers.append(b)
                except: pass
            
            # Sort balancers by score and pick top 2
            balancers.sort(key=lambda x: x['score'], reverse=True)
            top_balancers = balancers[:2]
            
            # Add to selection
            # Logic: Add enough to allow optimization to shift weight.
            # We don't remove primary funds, we ADD candidates for the optimizer to use.
            selected_all.extend(top_balancers)
            
        # Deduplicate selected_all before optimization
        # Logic: If ISIN exists, keep the one with higher score or merging properties?
        # Simple Logic: First one wins (usually primary selection).
        # STRICTER: Also check for Name duplicates (same fund, diff ISIN)
        unique_selection_map = {}
        seen_names = set()
        
        for fund in selected_all:
             # Clean name for comparison (remove class info if desperate? for now exact match)
             f_name = fund.get('name', '').strip()
             
             if fund['isin'] not in unique_selection_map:
                 if f_name and f_name in seen_names:
                     print(f"Skipping Duplicate Name: {f_name} ({fund['isin']})")
                     continue
                     
                 unique_selection_map[fund['isin']] = fund
                 seen_names.add(f_name)
        
        # Override lists with unique version
        selected_all_unique = list(unique_selection_map.values())
        selected_isins = list(unique_selection_map.keys())

        # Metadata map for Optimizer
        asset_metadata = {f['isin']: {'regions': f['regions']} for f in selected_all_unique}
        
        # CHECK: Skip Optimization?
        optimize_now = request.data.get('optimize', True) # Default True for backward compat
        
        if not optimize_now:
             # Return Equal Weight Portfolio directly
             n = len(selected_all_unique)
             final_portfolio = []
             for fund in selected_all_unique:
                 final_portfolio.append({
                    'isin': fund['isin'],
                    'name': fund['name'],
                    'weight': round(100.0 / n, 2),
                    'score': round(fund['score'], 1),
                    'role': 'Balancer' if fund.get('is_balancer') else 'Core'
                 })
                 
             return {
                'portfolio': final_portfolio,
                'metrics': None, 
                'warnings': ["Generación sin optimización (Peso Equitativo)."],
                'debug': {
                    'primary_candidates': [c['name'] for c in selected_primary],
                    'balancers_injected': [b['name'] for b in selected_all if b.get('is_balancer')]
                }
             }

        # --- 3. CONSTRAINED OPTIMIZATION ---
        constraints = {
            'europe': 0.40,  # 40% Floor
            'americas': 0.35 # 35% Cap (Soft-ish)
        }
        
        opt_result = _run_optimization(selected_isins, risk_level, db, constraints, asset_metadata)
        
        # Merge info
        final_portfolio = []
        weights = opt_result.get('weights', {})
        
        for isin, fund in unique_selection_map.items():
            w = weights.get(isin, 0)
            if w > 0.001: # Filter dust
                final_portfolio.append({
                    'isin': fund['isin'],
                    'name': fund['name'],
                    'weight': round(w * 100, 2),
                    'score': round(fund['score'], 1),
                    'role': 'Balancer' if fund.get('is_balancer') else 'Core'
                })
        
        # Sort by weight desc
        final_portfolio.sort(key=lambda x: x['weight'], reverse=True)

        return {
            'portfolio': final_portfolio,
            'metrics': opt_result.get('metrics'),
            'warnings': opt_result.get('warnings'),
            'debug': {
                'primary_candidates': [c['name'] for c in selected_primary],
                'balancers_injected': [b['name'] for b in selected_all if b.get('is_balancer')],
                'pre_opt_eu_avg': avg_eu
            }
        }

    except Exception as e:
        print(f"Global Smart Portfolio Error: {e}")
        return {'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=120, cors=cors_config)
def backtest_portfolio(request: https_fn.CallableRequest):
    try:
        import pandas as pd
        import numpy as np

        data = request.data
        portfolio = data.get('portfolio', [])
        period = data.get('period', '3y') # 1y, 3y, 5y
        
        if not portfolio: return {'error': 'Cartera vacía'}
        
        db = firestore.client()
        assets = [p['isin'] for p in portfolio]
        weights_map = {p['isin']: float(p['weight'])/100.0 for p in portfolio}
        
        # Base Indices for synthetic profiles
        all_assets = assets + [BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN]
        
        price_data, _ = get_price_data(all_assets, db)
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().fillna(method='ffill').fillna(method='bfill')
        
        # Determine start date based on period
        from datetime import  timedelta
        days_map = {'1y': 252, '3y': 756, '5y': 1260}
        lookback_days = days_map.get(period, 756)
        
        start_date = df.index[-1] - timedelta(days=lookback_days/252*365 + 30) # Aproximate buffer
        df = df[df.index >= start_date]

        # Calculate Portfolio Return
        valid_assets = [c for c in df.columns if c in assets]
        if not valid_assets: raise Exception("Sin datos válidos para backtest")
        
        df_port = df[valid_assets]
        returns = df_port.pct_change().dropna()
        w_vector = np.array([weights_map.get(c, 0) for c in df_port.columns])
        if w_vector.sum() > 0: w_vector = w_vector / w_vector.sum()
        
        port_ret = returns.dot(w_vector)
        cumulative = (1 + port_ret).cumprod() * 100
        
        # --- SYNTHETIC PROFILES CALCULATION ---
        # Helper for Fallback Trend (Geometric Growth)
        def make_trend(cagr_annual, index_dates):
             days = np.arange(len(index_dates))
             years = days / 252.0
             trajectory = (1 + cagr_annual) ** years
             return pd.Series(trajectory * 100, index=index_dates)

        # Fallback or DB
        if BENCHMARK_RF_ISIN in df and not df[BENCHMARK_RF_ISIN].empty:
             rf_curve = df[BENCHMARK_RF_ISIN]
        else:
             rf_curve = make_trend(0.035, df.index) # 3.5% Annual for RF fallback

        if BENCHMARK_RV_ISIN in df and not df[BENCHMARK_RV_ISIN].empty:
             rv_curve = df[BENCHMARK_RV_ISIN]
        else:
             rv_curve = make_trend(0.085, df.index) # 8.5% Annual for RV fallback
        
        # Normalize bases to 100 at start
        def norm(s): return (s / s.iloc[0] * 100) if len(s) > 0 else s
        
        rf_norm = norm(rf_curve)
        rv_norm = norm(rv_curve)
        
        # 4 Profiles
        profiles = {
            'conservative': rf_norm,                    # 100% RF
            'moderate': rf_norm * 0.75 + rv_norm * 0.25, # 75% RF / 25% RV
            'dynamic': rf_norm * 0.25 + rv_norm * 0.75,  # 25% RF / 75% RV
            'aggressive': rv_norm                       # 100% RV
        }

        # Calculate metrics for Risk Map (Scatter)
        synthetics_metrics = []
        for name, series in profiles.items():
            if len(series) < 2: continue
            
            # Recalc returns for this series to get vol/cagr relative to the period
            prof_ret = series.pct_change().dropna()
            
            p_days = len(series)
            p_years = p_days / 252
            p_total = series.iloc[-1] / series.iloc[0] - 1
            p_cagr = (1 + p_total) ** (1/p_years) - 1 if p_years > 0 else 0
            p_vol = prof_ret.std() * np.sqrt(252)
            
            label_map = {
                'conservative': 'Conservador',
                'moderate': 'Moderado',
                'dynamic': 'Dinámico',
                'aggressive': 'Agresivo'
            }
            
            synthetics_metrics.append({
                'name': label_map.get(name, name),
                'vol': float(p_vol),
                'ret': float(p_cagr),
                'type': 'benchmark'
            })


        # Portfolio Metrics
        days = len(cumulative)
        years = days / 252
        total_ret = cumulative.iloc[-1] / 100 - 1 if days > 0 else 0
        cagr = (1 + total_ret) ** (1/years) - 1 if years > 0 else 0
        vol = port_ret.std() * np.sqrt(252) if days > 0 else 0
        sharpe = (cagr - RISK_FREE_RATE) / vol if vol > 0 else 0
        max_dd = ((cumulative - cumulative.cummax()) / cumulative.cummax()).min() if days > 0 else 0
        
        
        def to_chart(ser): return [{'x': d.strftime('%Y-%m-%d'), 'y': round(v, 2)} for d, v in ser.items()]

        # --- LOOK-THROUGH HOLDINGS (REAL + MOCK FALLBACK) ---
        aggregated_holdings = {}
        
        # Helper to distribute fund weight into mock underlying assets
        def distribute_holdings_mock(isin, total_weight, std_type):
            mock_dist = []
            if std_type == 'RV':
                 mock_dist = [
                     ('US0378331005', 'Apple Inc', 0.05),
                     ('US5949181045', 'Microsoft Corp', 0.04),
                     ('US0231351067', 'Amazon.com', 0.03),
                     ('US67066G1040', 'NVIDIA Corp', 0.03),
                     ('US02079K3059', 'Alphabet Inc', 0.02),
                     ('Other Equity', 'Diversified Equity', 0.83)
                 ]
            elif std_type == 'RF':
                 mock_dist = [
                     ('US912810TS08', 'US Treasury 2Y', 0.10),
                     ('US912810TT80', 'US Treasury 10Y', 0.08),
                     ('DE0001102309', 'Bund German', 0.07),
                     ('Corp Bond InvG', 'Investment Grade Corp', 0.75)
                 ]
            else:
                 mock_dist = [
                     ('Cash', 'Liquidity', 0.40),
                     ('US0378331005', 'Apple Inc', 0.10),
                     ('US912810TS08', 'US Treasury 2Y', 0.50)
                 ]
            
            for sub_isin, sub_name, weight_in_fund in mock_dist:
                contrib = total_weight * weight_in_fund
                if sub_isin in aggregated_holdings:
                    aggregated_holdings[sub_isin]['weight'] += contrib
                else:
                    aggregated_holdings[sub_isin] = {'name': sub_name, 'weight': contrib}

        # Distribute for each asset in portfolio
        for item in portfolio:
             isin = item['isin']
             w = float(item['weight'])/100.0
             
             # Fetch Metadata & Holdings from Firestore
             ftype = 'RV' # Default
             real_holdings_found = False
             
             try:
                 fdoc = db.collection('funds_v2').document(isin).get()
                 if fdoc.exists:
                     fd = fdoc.to_dict()
                     # 1. Type Inference
                     metrics = fd.get('metrics', {})
                     if metrics.get('bond', 0) > 50: ftype = 'RF'
                     
                     # 2. Real Holdings Check
                     holdings_list = fd.get('holdings', [])
                     if not holdings_list: 
                         holdings_list = fd.get('top_holdings', [])
                         
                     if holdings_list and isinstance(holdings_list, list) and len(holdings_list) > 0:
                         real_holdings_found = True
                         # Sum of weights in the list (usually top 10 sum < 100%)
                         # We normalize contribution based on the fund's weight in portfolio
                         for h in holdings_list:
                             h_name = h.get('name', 'Unknown')
                             h_w = float(h.get('weight', 0)) / 100.0 # assume stored as percentage e.g. 5.5
                             h_isin = h.get('isin', h_name) # Use name as ID if ISIN missing
                             
                             contrib = w * h_w
                             
                             if h_isin in aggregated_holdings:
                                 aggregated_holdings[h_isin]['weight'] += contrib
                             else:
                                 aggregated_holdings[h_isin] = {'name': h_name, 'weight': contrib}
                                 
                         # Handle "Others" (Rest of the fund not in top holdings)
                         total_known = sum(float(h.get('weight', 0)) for h in holdings_list)
                         if total_known < 100:
                             others_w = (100 - total_known) / 100.0
                             contrib_others = w * others_w
                             if 'OTHERS' in aggregated_holdings:
                                 aggregated_holdings['OTHERS']['weight'] += contrib_others
                             else:
                                 aggregated_holdings['OTHERS'] = {'name': 'Other Holdings', 'weight': contrib_others}

             except Exception as fetch_err:
                 print(f"⚠️ Error fetching details for {isin}: {fetch_err}")
             
             if not real_holdings_found:
                 # Fallback to Mock
                 distribute_holdings_mock(isin, w, ftype)

        # Sort and Format Top 10
        # Filter out OTHERS from top list if we want specific names, or keep it.
        # Usually valid to show "Others" if it's huge.
        top_lookthrough = sorted(aggregated_holdings.items(), key=lambda x: x[1]['weight'], reverse=True)[:15] # Take top 15 to filter
        
        final_top_holdings = []
        for h in top_lookthrough:
             final_top_holdings.append({'isin': h[0], 'name': h[1]['name'], 'weight': h[1]['weight'] * 100})
             
        final_top_holdings = final_top_holdings[:10]

        return {
            'portfolioSeries': to_chart(cumulative),
            'benchmarkSeries': { k: to_chart(v) for k, v in profiles.items() },
            'metrics': {'cagr': cagr, 'volatility': vol, 'sharpe': sharpe, 'maxDrawdown': max_dd},
            'correlationMatrix': returns.corr().round(2).fillna(0).values.tolist(),
            'effectiveISINs': valid_assets, # List of ISINs used in the matrix
            'synthetics': synthetics_metrics, # For Risk Map
            'topHoldings': final_top_holdings # New Look-through Data
        }

    except Exception as e:
        print(f"❌ Error Backtest: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getFinancialNews(request: https_fn.CallableRequest):
    import requests 
    try:
        data = request.data
        raw_query = data.get('query', 'general')
        mode = data.get('mode', 'general')
        
        TAG_MAP = {
            'general': 'balance',
            'inflation': 'inflation',
            'interest rates': 'interest rates',
            'gdp': 'gdp',
            'employment': 'employment',
            'earnings': 'earnings'
        }
        
        final_query = raw_query
        if mode == 'general' and raw_query in TAG_MAP:
            final_query = TAG_MAP[raw_query]

        url = "https://eodhd.com/api/news"
        params = {'api_token': EODHD_API_KEY, 'limit': 20, 'offset': 0}
        
        if mode == 'ticker':
            params['s'] = final_query 
        else:
            params['t'] = final_query 

        r = requests.get(url, params=params, timeout=10)
        news_list = r.json() if r.status_code == 200 else []
        
        if not isinstance(news_list, list): 
             news_list = [] 

        articles = []
        for item in news_list:
            if not item.get('title'): continue
            articles.append({
                'title': item.get('title'),
                'summary': item.get('content', '')[:250] + "...",
                'link': item.get('link'),
                'date': item.get('date'),
                'source': 'EOD Wire'
            })
            
        return {'articles': articles}

    except Exception as e:
        print(f"News Error: {e}")
        return {'articles': [], 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=300, cors=cors_config)
def clean_duplicates(request: https_fn.CallableRequest):
    """
    Scans 'funds_v2' for duplicates (Same ISIN or Same Name).
    Keeps the document with the most fields (highest quality).
    """
    try:
        db = firestore.client()
        docs = db.collection('funds_v2').stream()
        
        all_funds = []
        for d in docs:
            data = d.to_dict()
            data['doc_id'] = d.id
            all_funds.append(data)
            
        print(f"Cleaner: Scanning {len(all_funds)} funds...")

        # 1. Group by ISIN (Primary Key)
        by_isin = {}
        for f in all_funds:
            isin = f.get('isin', '').strip().upper()
            if not isin: continue
            if isin not in by_isin: by_isin[isin] = []
            by_isin[isin].append(f)
            
        deleted_count = 0
        preserved_count = 0
        
        batch = db.batch()
        batch_limit = 400
        batch_ops = 0
        
        def commit_if_full():
            nonlocal batch, batch_ops, deleted_count
            if batch_ops >= batch_limit:
                batch.commit()
                batch = db.batch()
                batch_ops = 0
                print("Batch committed.")

        # Helper to calculate deep completeness
        def calculate_score(fund_data):
            score = 0
            # 1. Base fields
            for k, v in fund_data.items():
                if v and str(v).strip() and k != 'std_extra':
                    score += 1
            
            # 2. Extra fields (High value)
            extra = fund_data.get('std_extra', {})
            if isinstance(extra, dict):
                for k, v in extra.items():
                    if v and str(v).strip():
                        score += 1
            return score

        # Process Duplicate ISIN groups
        for isin, group in by_isin.items():
            if len(group) > 1:
                # Sort by Completeness Score (Desc)
                # Tie-breaker: creation date (if available) or doc_id
                group.sort(key=lambda x: calculate_score(x), reverse=True)
                
                winner = group[0]
                losers = group[1:]
                
                preserved_count += 1
                
                for loser in losers:
                    ref = db.collection('funds_v2').document(loser['doc_id'])
                    batch.delete(ref)
                    batch_ops += 1
                    deleted_count += 1
                    commit_if_full()
        
        # 2. Group by Name (Secondary Key check)
        # Note: We run this AFTER ISIN dedupe, but we must re-scan or apply logic carefully.
        # Ideally, we only run one pass or refresh state. 
        # For safety/simplicity in this pass, we stick to ISIN deduplication which is the critical DB constraint.
        # Name defaults might vary slightly, ISIN is the anchor.

        if batch_ops > 0:
            batch.commit()
            
        return {
            'success': True,
            'scanned': len(all_funds),
            'deleted': deleted_count,
            'preserved': preserved_count,
            'message': f"Limpieza completada: {deleted_count} duplicados eliminados."
        }

    except Exception as e:
        print(f"❌ Clean Error: {e}")
        return {'success': False, 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540, cors=cors_config)
def restore_historico(request: https_fn.CallableRequest):
    """
    Recupera el historial de precios para todos los fondos en funds_v2
    desde EODHD y rellena historico_vl_v2.
    """
    import requests
    from datetime import datetime, timedelta
    
    try:
        db = firestore.client()
        
        # 1. Obtener todos los fondos
        funds_ref = db.collection('funds_v2')
        docs = funds_ref.stream()
        
        updated_count = 0
        errors = []
        
        # Batch settings
        batch = db.batch()
        batch_counter = 0
        BATCH_LIMIT = 400
        
        for doc in docs:
            fund_data = doc.to_dict()
            isin = fund_data.get('isin')
            
            if not isin:
                continue
                
            # 2. Fetch data from EODHD
            # Try using 'eod_ticker' if available, else ISIN
            ticker = fund_data.get('eod_ticker', isin)
            
            # Start date: 5 years ago
            start_date = (datetime.now() - timedelta(days=365*5)).strftime('%Y-%m-%d')
            
            # EODHD API Format: needs 'fmt=json'
            url = f"https://eodhd.com/api/eod/{ticker}"
            params = {
                'api_token': EODHD_API_KEY, 
                'fmt': 'json', 
                'from': start_date, 
                'order': 'a'
            }
            
            try:
                r = requests.get(url, params=params, timeout=10)
                if r.status_code == 200:
                    data = r.json()
                    
                    if isinstance(data, list) and len(data) > 0:
                        # Format series
                        series = []
                        for p in data:
                            if p.get('date') and p.get('close'):
                                series.append({
                                    'date': p['date'], 
                                    'price': float(p['close'])
                                })
                        
                        # Add to batch
                        ref = db.collection('historico_vl_v2').document(isin)
                        batch.set(ref, {'series': series, 'last_updated': datetime.now()})
                        batch_counter += 1
                        updated_count += 1
                        
                        if batch_counter >= BATCH_LIMIT:
                            batch.commit()
                            batch = db.batch()
                            batch_counter = 0
                            print(f"Committed batch. Total so far: {updated_count}")
                            
                else:
                    errors.append(f"{isin}: EODHD status {r.status_code}")
                    
            except Exception as e:
                errors.append(f"{isin}: {str(e)}")

        # Final commit
        if batch_counter > 0:
            batch.commit()
            
        return {
            'success': True,
            'updated': updated_count,
            'errors': errors[:20] 
        }

    except Exception as ie:
        return {'error': str(ie)}

# ==========================================
# REPAIR TOOLS
# ==========================================

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540, cors=cors_config)
def analyze_isin_health(request: https_fn.CallableRequest):
    """
    Analyzes 'funds_v2' for corrupted ISINs (id or field).
    Checks for:
    1. ID Length != 12
    2. ID Starts with 'IN', 'ISIN' (common corruption patterns)
    3. Missing 'eod_ticker' which is crucial for recovery
    
    Returns: Summary stats and a list of corrupted entries.
    Also saves 'isin_health_report.json' to Storage.
    """
    from firebase_admin import storage
    import re

    print("🔍 Starting ISIN Health Check...")
    db = firestore.client()
    bucket = storage.bucket(BUCKET_NAME)

    funds_ref = db.collection('funds_v2')
    docs = funds_ref.stream()

    total = 0
    corrupted_ids = []
    corrupted_data = []

    # Regex for strict ISIN (2 letters + 9 alphanumeric + 1 digit/char)
    # But usually just length 12 is a good enough filter for "grossly wrong" stuff like 'ISIN...'
    isin_pattern = re.compile(r'^[A-Z]{2}[A-Z0-9]{9}\d$')

    for doc in docs:
        total += 1
        d = doc.to_dict()
        fid = doc.id
        
# ==========================================
