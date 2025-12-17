from firebase_admin import firestore
from .data import get_price_data
from .config import RISK_FREE_RATE

def run_optimization(assets_list, risk_level, db, constraints=None, asset_metadata=None):
    """
    Core Logic for Mean-Variance Optimization using PyPortfolioOpt
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
        from .strategies import RISK_VOL_MAP
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
            
            tickers = df.columns.tolist()
            
            eu_vector = []
            us_vector = []
            
            for t in tickers:
                meta = asset_metadata.get(t, {})
                regions = meta.get('regions', {})
                eu_vector.append(regions.get('europe', 0) / 100.0)
                us_vector.append(regions.get('americas', 0) / 100.0)
            
            eu_vec = np.array(eu_vector)
            us_vec = np.array(us_vector)
            
            if eu_target > 0:
                ef.add_constraint(lambda w: w @ eu_vec >= eu_target)
            
            if us_cap < 1.0:
                 ef.add_constraint(lambda w: w @ us_vec <= us_cap)

        # TIER 1
        try:
            weights = ef.efficient_risk(target_volatility)
        except Exception as e_opt:
            
            # TIER 1.5
            try:
                if constraints and asset_metadata:
                    eu_relaxed = max(0.30, constraints.get('europe', 0) - 0.10)
                    us_relaxed = min(0.45, constraints.get('americas', 1.0) + 0.10)
                    
                    ef_relaxed = EfficientFrontier(mu, S)
                    ef_relaxed.add_objective(objective_functions.L2_reg, gamma=0.5)
                    ef_relaxed.add_constraint(lambda w: w <= max_weight)
                    ef_relaxed.add_constraint(lambda w: w >= 0.01)
                    
                    if eu_relaxed > 0:
                        ef_relaxed.add_constraint(lambda w: w @ eu_vec >= eu_relaxed)
                    if us_relaxed < 1.0:
                        ef_relaxed.add_constraint(lambda w: w @ us_vec <= us_relaxed)
                    
                    weights = ef_relaxed.efficient_risk(target_volatility)
                    warnings.append(f"ℹ️ Restricciones geográficas relajadas: Europa {eu_relaxed*100:.0f}%, Américas {us_relaxed*100:.0f}%")
                else:
                    raise Exception("No constraints to relax")
                    
            except Exception as e_relax:
                # TIER 2
                try:
                    weights = ef.max_sharpe(risk_free_rate=RISK_FREE_RATE)
                except Exception as e_ms:
                    # TIER 2b
                    try:
                        ef_clean = EfficientFrontier(mu, S)
                        ef_clean.add_objective(objective_functions.L2_reg, gamma=0.5)
                        ef_clean.add_constraint(lambda w: w <= max_weight)
                        ef_clean.add_constraint(lambda w: w >= 0.01)
                        weights = ef_clean.max_sharpe(risk_free_rate=RISK_FREE_RATE)
                        warnings.append("⚠️ Restricciones geográficas eliminadas para permitir optimización.")
                    except Exception as e_final:
                        # TIER 3
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
        
        n = len(assets_list) if assets_list else 1
        return {
            'status': 'fallback', 
            'weights': {isin: 1.0/n for isin in assets_list}, 
            'metrics': {'return': 0.05, 'volatility': 0.10, 'sharpe': 0.5},
            'warnings': [f"Fallback activado: {str(e)}"]
        }


def generate_smart_portfolio(category, risk_level, num_funds, vip_funds_str, optimize_now, db):
    try:
        # Calculate target volatility based on risk level
        from .strategies import RISK_VOL_MAP
        target_vol = RISK_VOL_MAP.get(int(risk_level), 0.12)
        print(f"🎯 Risk Level {risk_level} → Target Volatility: {target_vol*100:.1f}%")
        
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
            
            # --- DYNAMIC SCORING WEIGHTS BASED ON RISK ---
            # Default (Balanced - Risk 4-7)
            w_sharpe = 35
            w_alpha = 25
            w_safety = 20
            w_momentum = 10
            w_quality = 10
            
            if int(risk_level) <= 3: # CONSERVATIVE
                w_sharpe = 30
                w_alpha = 10
                w_safety = 50 # Huge emphasis on safety
                w_momentum = 0
                w_quality = 10
            elif int(risk_level) >= 8: # AGGRESSIVE
                w_sharpe = 20
                w_alpha = 40 # Chase Alpha
                w_safety = 0  # Ignore safety (volatility)
                w_momentum = 30 # Chase trends
                w_quality = 10

            # 1. Sharpe
            if sharpe is not None:
                sharpe_norm = max(-1, min(3, float(sharpe)))
                score += (sharpe_norm / 3) * w_sharpe
            
            # 2. Alpha
            if alpha is not None:
                alpha_norm = max(-5, min(5, float(alpha)))
                score += ((alpha_norm + 5) / 10) * w_alpha
                
            # 3. Safety (Volatility Check)
            # For low risk, we punish high volatility severely
            if w_safety > 0:
                try:
                    if int(risk_level) <= 3:
                         # Strict penalty for conservative
                         dist = max(0, target_vol - volatility)
                         safety_score = (dist / target_vol) * 100
                         if volatility > target_vol * 1.5: safety_score = -50
                    else:
                         # Standard safety ratio
                         safety_score = max(0, (target_vol - volatility) / target_vol) * 100
                         
                    score += safety_score * (w_safety / 100.0)
                except: pass
            
            # 4. Momentum
            if cagr3y != 0 and cagr6m != 0:
                momentum_ratio = cagr6m / cagr3y
                score += max(0, min(1, momentum_ratio)) * w_momentum
            
            # 5. Quality
            quality_score = min(history_years / 10, 1) * w_quality
            score += quality_score
            
            # 6. MAX DRAWDOWN PENALTY (Higher penalty for low risk)
            max_dd = perf_data.get('max_drawdown', 0)
            if max_dd > 0:
                penalty_factor = 1000 if int(risk_level) <= 3 else 500
                dd_penalty = min(abs(max_dd) * penalty_factor, 100 if int(risk_level) <= 3 else 50)
                score -= dd_penalty
            
            # 7. SORTINO BONUS
            sortino = perf_data.get('sortino_ratio')
            if sortino is not None and sortino > 0:
                sortino_norm = max(0, min(4, float(sortino)))
                sortino_bonus = (sortino_norm / 4) * 5
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
                q = funds_ref.where(filter=firestore.FieldFilter('isin', '==', vip_isin)).limit(1)
                docs = q.stream()
                found = False
                for doc in docs:
                    f_processed = process_fund(doc, target_vol=target_vol)
                    if f_processed:
                        f_processed['is_vip'] = True
                        selected_primary.append(f_processed)
                        used_categories.add(f_processed['category'])
                        found = True
                
                if not found:
                    print(f"Warning: VIP Fund {vip_isin} not found.")

        # Query Primary Candidates
        query = funds_ref
        if category and category != 'All':
            query = query.where(filter=firestore.FieldFilter('category_morningstar', '==', category))

        docs = query.stream()
        for doc in docs:
            c = process_fund(doc, target_vol=target_vol)
            if c: candidates.append(c)
            
        # --- DIVERSIFIED SELECTION ---
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        remaining_slots = num_funds - len(selected_primary)
        
        if remaining_slots > 0:
            if len(candidates) <= remaining_slots:
                for c in candidates:
                    if not any(s['isin'] == c['isin'] for s in selected_primary):
                        selected_primary.append(c)
            else:
                if not selected_primary and candidates:
                    selected_primary.append(candidates[0])
                    used_categories.add(candidates[0]['category'])
                
                def get_diversity_penalty(candidate, selected):
                    penalty = 0
                    if candidate['category'] in used_categories:
                        penalty += 0.3
                    
                    if selected:
                        avg_eu_selected = sum(s['regions'].get('europe', 0) for s in selected) / len(selected)
                        avg_us_selected = sum(s['regions'].get('americas', 0) for s in selected) / len(selected)
                        
                        candidate_eu = candidate['regions'].get('europe', 0)
                        candidate_us = candidate['regions'].get('americas', 0)
                        
                        eu_diff = abs(avg_eu_selected - candidate_eu)
                        us_diff = abs(avg_us_selected - candidate_us)
                        
                        if eu_diff < 10 and us_diff < 10:
                            penalty += 0.2
                    return penalty
                
                while len(selected_primary) < num_funds:
                    best_idx = None
                    best_adjusted_score = -999
                    
                    for idx, candidate in enumerate(candidates):
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
                        break
        
        if not selected_primary:
             return {'error': 'No funds found for criteria', 'criteria': category}

        # --- 2. HYDRAULIC BALANCER INJECTION ---
        avg_eu = sum([c['regions'].get('europe', 0) for c in selected_primary]) / len(selected_primary)
        
        selected_all = list(selected_primary)
        
        TARGET_EU = 40.0
        if avg_eu < TARGET_EU:
            existing_isins = set(c['isin'] for c in selected_primary)
            potential_cats = ['RV Europa', 'RV Europa Cap. Grande Blend', 'RV Europa Cap. Grande Value', 'RV Europa Cap. Grande Growth', 'RV Zona Euro', 'Europe Equity']
            balancers = []
            
            for cat in potential_cats:
                if len(balancers) >= 5: break 
                try:
                    q = funds_ref.where(filter=firestore.FieldFilter('category_morningstar', '==', cat)).limit(5)
                    for d in q.stream():
                        b = process_fund(d, is_balancer=True)
                        if b and b['isin'] not in existing_isins: 
                            if not any(bx['isin'] == b['isin'] for bx in balancers):
                                balancers.append(b)
                except: continue
                
            if not balancers:
                try:
                    q = funds_ref.where(filter=firestore.FieldFilter('category_morningstar', '==', 'RV Global Cap. Grande Blend')).limit(3)
                    for d in q.stream():
                        b = process_fund(d, is_balancer=True)
                        if b and b['isin'] not in existing_isins:
                             if not any(bx['isin'] == b['isin'] for bx in balancers):
                                 balancers.append(b)
                except: pass
            
            balancers.sort(key=lambda x: x['score'], reverse=True)
            top_balancers = balancers[:2]
            selected_all.extend(top_balancers)
            
        unique_selection_map = {}
        seen_names = set()
        
        for fund in selected_all:
             f_name = fund.get('name', '').strip()
             if fund['isin'] not in unique_selection_map:
                 if f_name and f_name in seen_names: continue
                 unique_selection_map[fund['isin']] = fund
                 seen_names.add(f_name)
        
        selected_all_unique = list(unique_selection_map.values())
        selected_isins = list(unique_selection_map.keys())

        asset_metadata = {f['isin']: {'regions': f['regions']} for f in selected_all_unique}
        
        if not optimize_now:
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
        from .strategies import STRATEGY_CONSTRAINTS
        constraints = STRATEGY_CONSTRAINTS
        
        opt_result = run_optimization(selected_isins, risk_level, db, constraints, asset_metadata)
        
        final_portfolio = []
        weights = opt_result.get('weights', {})
        
        for isin, fund in unique_selection_map.items():
            w = weights.get(isin, 0)
            if w > 0.001: 
                final_portfolio.append({
                    'isin': fund['isin'],
                    'name': fund['name'],
                    'weight': round(w * 100, 2),
                    'score': round(fund['score'], 1),
                    'role': 'Balancer' if fund.get('is_balancer') else 'Core'
                })
        
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
