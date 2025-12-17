import pandas as pd
import numpy as np
from datetime import timedelta
from .data import get_price_data
from .config import BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN, RISK_FREE_RATE

def run_backtest(portfolio, period, db):
    try:
        assets = [p['isin'] for p in portfolio]
        weights_map = {p['isin']: float(p['weight'])/100.0 for p in portfolio}
        
        # Base Indices for synthetic profiles
        all_assets = assets + [BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN]
        
        price_data, _ = get_price_data(all_assets, db)
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().fillna(method='ffill').fillna(method='bfill')
        
        days_map = {'1y': 252, '3y': 756, '5y': 1260}
        lookback_days = days_map.get(period, 756)
        
        start_date = df.index[-1] - timedelta(days=lookback_days/252*365 + 30) 
        df = df[df.index >= start_date]

        valid_assets = [c for c in df.columns if c in assets]
        if not valid_assets: raise Exception("Sin datos válidos para backtest")
        
        df_port = df[valid_assets]
        returns = df_port.pct_change().dropna()
        w_vector = np.array([weights_map.get(c, 0) for c in df_port.columns])
        if w_vector.sum() > 0: w_vector = w_vector / w_vector.sum()
        
        port_ret = returns.dot(w_vector)
        cumulative = (1 + port_ret).cumprod() * 100
        
        # --- SYNTHETIC PROFILES CALCULATION ---
        def make_trend(cagr_annual, index_dates):
             days = np.arange(len(index_dates))
             years = days / 252.0
             trajectory = (1 + cagr_annual) ** years
             return pd.Series(trajectory * 100, index=index_dates)

        if BENCHMARK_RF_ISIN in df and not df[BENCHMARK_RF_ISIN].empty:
             rf_curve = df[BENCHMARK_RF_ISIN]
        else:
             rf_curve = make_trend(0.035, df.index) 

        if BENCHMARK_RV_ISIN in df and not df[BENCHMARK_RV_ISIN].empty:
             rv_curve = df[BENCHMARK_RV_ISIN]
        else:
             rv_curve = make_trend(0.085, df.index) 
        
        def norm(s): return (s / s.iloc[0] * 100) if len(s) > 0 else s
        
        rf_norm = norm(rf_curve)
        rv_norm = norm(rv_curve)
        
        profiles = {
            'conservative': rf_norm,                    
            'moderate': rf_norm * 0.75 + rv_norm * 0.25,
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

        days = len(cumulative)
        years = days / 252
        total_ret = cumulative.iloc[-1] / 100 - 1 if days > 0 else 0
        cagr = (1 + total_ret) ** (1/years) - 1 if years > 0 else 0
        vol = port_ret.std() * np.sqrt(252) if days > 0 else 0
        sharpe = (cagr - RISK_FREE_RATE) / vol if vol > 0 else 0
        max_dd = ((cumulative - cumulative.cummax()) / cumulative.cummax()).min() if days > 0 else 0
        
        def to_chart(ser): return [{'x': d.strftime('%Y-%m-%d'), 'y': round(v, 2)} for d, v in ser.items()]

        # --- LOOK-THROUGH HOLDINGS ---
        aggregated_holdings = {}
        
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

        for item in portfolio:
             isin = item['isin']
             w = float(item['weight'])/100.0
             
             ftype = 'RV' 
             real_holdings_found = False
             
             try:
                 fdoc = db.collection('funds_v2').document(isin).get()
                 if fdoc.exists:
                     fd = fdoc.to_dict()
                     metrics = fd.get('metrics', {})
                     if metrics.get('bond', 0) > 50: ftype = 'RF'
                     
                     holdings_list = fd.get('holdings', [])
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
                                 aggregated_holdings['OTHERS'] = {'name': 'Other Holdings', 'weight': contrib_others}

             except Exception as fetch_err:
                 print(f"⚠️ Error fetching details for {isin}: {fetch_err}")
             
             if not real_holdings_found:
                 distribute_holdings_mock(isin, w, ftype)

        top_lookthrough = sorted(aggregated_holdings.items(), key=lambda x: x[1]['weight'], reverse=True)[:15] 
        
        final_top_holdings = []
        for h in top_lookthrough:
             final_top_holdings.append({'isin': h[0], 'name': h[1]['name'], 'weight': h[1]['weight'] * 100})
             
        final_top_holdings = final_top_holdings[:10]

        return {
            'portfolioSeries': to_chart(cumulative),
            'benchmarkSeries': { k: to_chart(v) for k, v in profiles.items() },
            'metrics': {'cagr': cagr, 'volatility': vol, 'sharpe': sharpe, 'maxDrawdown': max_dd},
            'correlationMatrix': returns.corr().round(2).fillna(0).values.tolist(),
            'effectiveISINs': valid_assets, 
            'synthetics': synthetics_metrics, 
            'topHoldings': final_top_holdings 
        }

    except Exception as e:
        print(f"❌ Error Backtest: {e}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}
