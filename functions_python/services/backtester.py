import pandas as pd
import numpy as np
from datetime import timedelta
from .data_fetcher import DataFetcher
from .config import BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN, RISK_FREE_RATE
import yfinance as yf

def run_backtest(portfolio, period, db):
    try:
        assets = [p['isin'] for p in portfolio]
        weights_map = {p['isin']: float(p['weight'])/100.0 for p in portfolio}
        
        # Base Indices for synthetic profiles
        all_assets = assets + [BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN]
        
        # --- MIGRATION: USE DataFetcher ---
        fetcher = DataFetcher(db)
        # Professional standard: Daily Frequency
        price_data_df, synthetic_used = fetcher.get_price_data(all_assets, resample_freq='D', strict=False)
        print(f"🔍 [DEBUG] Price data fetched. Shape: {price_data_df.shape if hasattr(price_data_df, 'shape') else 'N/A'}")
        
        if price_data_df.empty:
            print("❌ [DEBUG] Price data is empty after fetch.")
            raise Exception("No data available for the selected assets.")
            
        df = price_data_df 
        
        # --- FIX: Handle Empty or Disjoint Data ---
        if df.empty:
             raise Exception("No common history found for selected assets.")

        df.index = pd.to_datetime(df.index)
        
        # Identify assets with too many NaNs explicitly before filling
        missing_assets = []
        keep_assets = []
        for col in df.columns:
            # If asset has < 10% valid points, consider it missing/broken
            if df[col].count() < (len(df) * 0.1):
                missing_assets.append(col)
            else:
                keep_assets.append(col)
        
        if not keep_assets:
            return {
                'status': 'no_common_history',
                'missing_assets': assets,
                'error': 'No assets with sufficient history.'
            }

        # Filter valid assets only
        df = df[keep_assets]
        df = df.sort_index().ffill().bfill()
        print(f"🔍 [DEBUG] Data aligned and filled. Shape: {df.shape}")
        
        # Standard: 3-Year (36 Months) analysis window
        # We force 3y (1095 days) to align with Morningstar rating standards
        lookback_days = 1095 
        
        # Calculate start date based on available history
        if len(df) > 0:
            start_date = df.index[-1] - timedelta(days=lookback_days) 
            df = df[df.index >= start_date]
            print(f"🔍 [DEBUG] Data sliced to 3Y window. New Shape: {df.shape}")
        
        # Re-check validity after slicing time range
        if df.empty:
            return {
                'status': 'no_common_history',
                'missing_assets': list(set(assets) - set(keep_assets)),
                'error': 'Period selected is outside available history range.'
            }

        valid_assets = [c for c in df.columns if c in assets]
        # Return specific status if we had to drop everything
        if not valid_assets: 
             return {
                'status': 'no_common_history',
                'missing_assets': assets,
                'error': 'No intersection of valid history found.'
             }
        
        df_port = df[valid_assets]
        returns = df_port.pct_change().dropna()
        w_vector = np.array([weights_map.get(c, 0) for c in df_port.columns])
        if w_vector.sum() > 0: w_vector = w_vector / w_vector.sum()
        
        port_ret = returns.dot(w_vector)
        cumulative = (1 + port_ret).cumprod() * 100
        print(f"🔍 [DEBUG] Cumulative returns calculated. Days: {len(cumulative)}")
        
        # Helper to fetch YF fallback
        def get_yf_series(ticker, start_date, default_index):
             try:
                # Fetch slightly more history to fill gaps
                yf_data = yf.download(ticker, start=start_date - timedelta(days=10), progress=False)['Close']
                # Flatten multi-index if present
                if isinstance(yf_data, pd.DataFrame): yf_data = yf_data.iloc[:, 0]
                
                # Reindex to match portfolio df
                yf_data.index = pd.to_datetime(yf_data.index).normalize()
                # tz_localize(None) if needed, but usually safe to join
                if yf_data.index.tz is not None: yf_data.index = yf_data.index.tz_localize(None)
                
                aligned = yf_data.reindex(default_index).ffill().bfill()
                return aligned
             except Exception as e:
                print(f"Fallback YF failed for {ticker}: {e}")
                return pd.Series(index=default_index, dtype=float).fillna(100.0)

        # 1. RF CURVE (Bonds)
        if BENCHMARK_RF_ISIN in df and BENCHMARK_RF_ISIN not in synthetic_used:
             rf_curve = df[BENCHMARK_RF_ISIN]
        else:
             # Fallback to IEF (7-10 Year Treasury) or AGG
             rf_curve = get_yf_series('IEF', start_date, df.index)

        # 2. RV CURVE (Equity)
        if BENCHMARK_RV_ISIN in df and BENCHMARK_RV_ISIN not in synthetic_used:
             rv_curve = df[BENCHMARK_RV_ISIN]
        else:
             # Fallback to SPY (S&P 500)
             rv_curve = get_yf_series('SPY', start_date, df.index) 
        
        def norm(s): return (s / s.iloc[0] * 100) if len(s) > 0 else s
        
        rf_norm = norm(rf_curve)
        rv_norm = norm(rv_curve)
        
        profiles = {
            'conservative': rf_norm,                    
            'moderate': rf_norm * 0.75 + rv_norm * 0.25,
            'balanced': rf_norm * 0.50 + rv_norm * 0.50,
            'dynamic': rf_norm * 0.25 + rv_norm * 0.75, 
            'aggressive': rv_norm                       
        }

        synthetics_metrics = []
        for name, series in profiles.items():
            if len(series) < 2: continue
            
            prof_ret = series.pct_change().dropna()
            p_days = len(series)
            p_years = p_days / 252
            p_total = series.iloc[-1] / series.iloc[0] - 1
            p_cagr = (1 + p_total) ** (1/p_years) - 1 if p_years > 0 else 0
            
            # Aligned to daily frequency and log-returns for professionalism
            p_log_ret = np.log(series / series.shift(1)).dropna()
            p_vol = p_log_ret.std() * np.sqrt(252)
            
            label_map = {
                'conservative': 'Conservador',
                'moderate': 'Moderado',
                'balanced': 'Equilibrado',
                'dynamic': 'Dinámico',
                'aggressive': 'Agresivo'
            }
            
            synthetics_metrics.append({
                'name': label_map.get(name, name),
                'vol': float(p_vol),
                'ret': float(p_cagr),
                'type': 'benchmark'
            })

        days_count = len(cumulative)
        # 3-Year Window Strategy (Strict 1095 days)
        if days_count > 0:
            start_date_bound = cumulative.index[-1] - pd.Timedelta(days=1095)
            # Re-slice if needed to be absolutely sure we use 3Y
            cumulative = cumulative[cumulative.index >= start_date_bound]
            port_ret = port_ret[port_ret.index >= start_date_bound]
            days_count = len(cumulative)

        if days_count > 1:
            years = (cumulative.index[-1] - cumulative.index[0]).days / 365.25
        else:
            years = 0
        
        # SENIOR MATH ENGINE ALIGNMENT: 
        # For EF Coherence, we use Arithmetic Mean and Arithmetic Volatility
        
        # 1. Arithmetic Annualized Return (Mean of Daily * 252)
        # This matches weights.T @ mu
        cagr = float(port_ret.mean() * 252) if days_count > 1 else 0
        
        # 2. Arithmetic Annualized Volatility (Std of Daily * sqrt(252))
        # This matches sqrt(weights.T @ S @ weights)
        vol = float(port_ret.std() * np.sqrt(252)) if days_count > 1 else 0
        
        # 3. Sharpe (Arithmetic Excess)
        rf_rate_annual = fetcher.get_dynamic_risk_free_rate()
        rf_daily = rf_rate_annual / 252
        
        excess_ret = port_ret - rf_daily
        if days_count > 1 and excess_ret.std() > 0:
            sharpe = (float(excess_ret.mean()) / float(excess_ret.std())) * np.sqrt(252)
        else:
            sharpe = 0
            
        max_dd = ((cumulative - cumulative.cummax()) / cumulative.cummax()).min() if days_count > 0 else 0
        
        print(f"🔍 [Senior Metrics] Ret: {cagr:.4f}, Vol: {vol:.4f}, Sharpe: {sharpe:.4f}, MaxDD: {max_dd:.4f}")
        
        def to_chart(ser): return [{'x': d.strftime('%Y-%m-%d'), 'y': round(v, 2)} for d, v in ser.items()]

        # --- LOOK-THROUGH HOLDINGS & REGIONS ---
        aggregated_holdings = {}
        
        # Morningstar Regions Mapping
        region_stats = {
            'united_states': 0,
            'canada': 0,
            'latin_america': 0,
            'united_kingdom': 0,
            'eurozone': 0,
            'europe_ex_euro': 0,
            'europe_emerging': 0,
            'africa': 0,
            'middle_east': 0,
            'japan': 0,
            'australasia': 0,
            'asia_developed': 0,
            'asia_emerging': 0
        }

        region_labels = {
            'united_states': 'EE.UU.',
            'canada': 'Canadá',
            'latin_america': 'Latinoamérica',
            'united_kingdom': 'Reino Unido',
            'eurozone': 'Eurozona',
            'europe_ex_euro': 'Europa (No Euro)',
            'europe_emerging': 'Europa Emergente',
            'africa': 'África',
            'middle_east': 'Oriente Medio',
            'japan': 'Japón',
            'australasia': 'Australasia',
            'asia_developed': 'Asia Desarrollada',
            'asia_emerging': 'Asia Emergente'
        }
        total_region_weight = 0
        
        def distribute_holdings_fallback(isin, total_weight):
            if 'OTHERS' in aggregated_holdings:
                aggregated_holdings['OTHERS']['weight'] += total_weight
            else:
                aggregated_holdings['OTHERS'] = {'name': 'Otras/No Disponible', 'weight': total_weight}

        for item in portfolio:
             isin = item['isin']
             w = float(item['weight'])/100.0
             
             real_holdings_found = False
             
             try:
                 fdoc = db.collection('funds_v3').document(isin).get()
                 if fdoc.exists:
                     fd = fdoc.to_dict()
                     
                     # 1. HOLDINGS AGGREGATION
                     holdings_list = fd.get('holdings', [])
                     if not holdings_list:
                         holdings_list = fd.get('holdings_top10', [])
                     if not holdings_list: 
                         holdings_list = fd.get('top_holdings', [])
                          
                     if holdings_list and isinstance(holdings_list, list) and len(holdings_list) > 0:
                         real_holdings_found = True
                         for h in holdings_list:
                             h_name = h.get('name', 'Unknown')
                             h_w = float(h.get('weight', 0)) / 100.0
                             h_isin = h.get('isin', h_name) 
                             
                             contrib = w * h_w
                             
                             if h_isin in aggregated_holdings:
                                 aggregated_holdings[h_isin]['weight'] += contrib
                             else:
                                 aggregated_holdings[h_isin] = {'name': h_name, 'weight': contrib}
                                 
                         total_known = sum(float(h.get('weight', 0)) for h in holdings_list)
                         if total_known < 100:
                             others_w = (100 - total_known) / 100.0
                             contrib_others = w * others_w
                             if 'OTHERS' in aggregated_holdings:
                                 aggregated_holdings['OTHERS']['weight'] += contrib_others
                             else:
                                 aggregated_holdings['OTHERS'] = {'name': 'Otras/No Disponible', 'weight': contrib_others}

                     # 2. REGION AGGREGATION (Robust Mapping)
                     # We check multiple possible keys for region data
                     regions = fd.get('regions') or fd.get('ms', {}).get('regions') or fd.get('derived', {}).get('regions')
                     
                     if regions and isinstance(regions, dict):
                         for r_key, r_val in regions.items():
                             if r_key in region_stats:
                                 try:
                                     # Handle both 0-1 and 0-100 formats if necessary, 
                                     # but usually they are 0-100 in MS
                                     val = float(r_val)
                                     # If value is already > 1, assume 0-100 scale
                                     if val > 1.0: val = val / 100.0
                                     
                                     contribution = w * val
                                     region_stats[r_key] += contribution
                                     total_region_weight += contribution
                                 except (ValueError, TypeError):
                                     continue

             except Exception as fetch_err:
                 print(f"⚠️ Error fetching details for {isin}: {fetch_err}")
             
             if not real_holdings_found:
                 distribute_holdings_fallback(isin, w)

        top_lookthrough = sorted(aggregated_holdings.items(), key=lambda x: x[1]['weight'], reverse=True)[:15] 
        
        final_top_holdings = []
        for h in top_lookthrough:
             final_top_holdings.append({'isin': h[0], 'name': h[1]['name'], 'weight': h[1]['weight'] * 100})
             
        final_top_holdings = final_top_holdings[:10]

        # Prepare Region Allocation (Sorted and normalized to 100% of regions found)
        region_list = []
        
        for k, v in region_stats.items():
            if v > 0.0001:  # Lower threshold to capture small allocations
                label = region_labels.get(k, k.replace('_', ' ').capitalize())
                # Normalize values if total_region_weight > 0
                norm_val = (v / total_region_weight * 100.0) if total_region_weight > 0 else 0
                region_list.append({'name': label, 'value': round(norm_val, 2)})
        
        region_list = sorted(region_list, key=lambda x: x['value'], reverse=True)

        return {
            'portfolioSeries': to_chart(cumulative),
            'benchmarkSeries': { k: to_chart(v) for k, v in profiles.items() },
            'metrics': {'cagr': cagr, 'volatility': vol, 'sharpe': sharpe, 'maxDrawdown': max_dd, 'rf_rate': rf_rate_annual},
            'correlationMatrix': returns.corr().round(2).fillna(0).values.tolist(),
            'effectiveISINs': valid_assets, 
            'synthetics': synthetics_metrics, 
            'topHoldings': final_top_holdings,
            'regionAllocation': region_list
        }

    except Exception as e:
        print(f"❌ Error Backtest: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}
