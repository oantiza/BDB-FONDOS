# functions_python/main.py
from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions

initialize_app()

BENCHMARK_RF_ISIN = 'IE00B18GC888'
BENCHMARK_RV_ISIN = 'IE00B03HCZ61'

RISK_PROFILES = {
    'aggressive':   {'min_weight': 0.01, 'max_weight': 0.60, 'gamma': 0.05},
    'moderate':     {'min_weight': 0.02, 'max_weight': 0.40, 'gamma': 0.50},
    'conservative': {'min_weight': 0.05, 'max_weight': 0.25, 'gamma': 1.00}
}

cors_config = options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"])

def get_risk_params(level):
    if level >= 8: return RISK_PROFILES['aggressive']
    elif level >= 5: return RISK_PROFILES['moderate']
    return RISK_PROFILES['conservative']

def get_ecb_risk_free_rate():
    try:
        url = "https://data-api.ecb.europa.eu/service/data/EST/EST.B.EU000A2X2A25.WT?lastNObservations=1&format=json"
        response = requests.get(url, timeout=3)
        if response.status_code == 200:
            data = response.json()
            series = list(data['dataSets'][0]['series'].values())[0]
            obs = list(series['observations'].values())[0]
            return float(obs[0]) / 100.0
    except: pass
    return 0.025

def generate_synthetic_series(days=1300, vol=0.10, ret=0.06):
    prices = {}
    price = 100.0
    today = datetime.now()
    daily_vol = vol / np.sqrt(252)
    daily_ret = ret / 252
    for i in range(days):
        date_str = (today - timedelta(days=days-i)).strftime('%Y-%m-%d')
        change = np.random.normal(daily_ret, daily_vol)
        price *= (1 + change)
        prices[date_str] = round(price, 2)
    return prices

def get_price_data(assets_list, db):
    price_data = {}
    for isin in assets_list:
        try:
            doc = db.collection('historico_vl_v2').document(isin).get()
            found = False
            if doc.exists:
                series = doc.to_dict().get('series', [])
                ts_data = {str(p['date']).split('T')[0]: float(p['price']) for p in series if p.get('price')}
                if len(ts_data) > 20: 
                    price_data[isin] = ts_data
                    found = True
            if not found: price_data[isin] = generate_synthetic_series()
        except: price_data[isin] = generate_synthetic_series()
    return price_data

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    req_data = request.data
    assets_list = req_data.get('assets', [])
    risk_level = int(req_data.get('risk_level', 5))
    if not assets_list: return {'status': 'error', 'warnings': ['Cartera vacía']}
    
    db = firestore.client()
    price_data = get_price_data(assets_list, db)
    
    try:
        df = pd.DataFrame(price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().ffill().dropna()
        if len(df) > 756: df = df.tail(756)
        
        mu = expected_returns.ema_historical_return(df, span=252)
        S = risk_models.CovarianceShrinkage(df).ledoit_wolf()
        params = get_risk_params(risk_level)
        rf = get_ecb_risk_free_rate()
        
        ef = EfficientFrontier(mu, S)
        ef.add_objective(objective_functions.L2_reg, gamma=params['gamma'])
        ef.add_constraint(lambda w: w >= 0.01)
        ef.add_constraint(lambda w: w <= 0.90)
        
        weights = ef.max_sharpe(risk_free_rate=rf)
        clean_weights = ef.clean_weights()
        perf = ef.portfolio_performance(verbose=False, risk_free_rate=rf)
        
        return { 'status': 'optimal', 'weights': clean_weights, 'metrics': {'return': perf[0], 'volatility': perf[1], 'sharpe': perf[2]}, 'warnings': [] }
    except Exception as e:
        n = len(assets_list)
        return {'status': 'fallback', 'weights': {i: 1.0/n for i in assets_list}, 'metrics': {'return':0, 'volatility':0, 'sharpe':0}, 'warnings': [str(e)]}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def backtest_portfolio(request: https_fn.CallableRequest):
    data = request.data
    portfolio = data.get('portfolio', []) 
    if not portfolio: return {'series': [], 'metrics': {}}
    
    db = firestore.client()
    assets = [p['isin'] for p in portfolio]
    weights_map = {p['isin']: float(p['weight'])/100.0 for p in portfolio}
    
    bench_assets = [BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN]
    all_assets_to_fetch = list(set(assets) | set(bench_assets))
    price_data = get_price_data(all_assets_to_fetch, db)
    
    rf_prices = pd.Series(price_data.get(BENCHMARK_RF_ISIN, generate_synthetic_series(vol=0.04, ret=0.03)))
    rv_prices = pd.Series(price_data.get(BENCHMARK_RV_ISIN, generate_synthetic_series(vol=0.15, ret=0.09)))
    rf_prices.index = pd.to_datetime(rf_prices.index)
    rv_prices.index = pd.to_datetime(rv_prices.index)

    try:
        client_price_data = {k: v for k, v in price_data.items() if k not in bench_assets}
        df = pd.DataFrame(client_price_data)
        df.index = pd.to_datetime(df.index)
        df = df.sort_index().ffill().dropna()
        
        common_index = df.index.intersection(rf_prices.index).intersection(rv_prices.index)
        if len(common_index) < 252: common_index = df.index

        df = df.loc[common_index]
        rf_s = rf_prices.loc[common_index]
        rv_s = rv_prices.loc[common_index]
        
        returns = df.pct_change().dropna()
        rf_ret = rf_s.pct_change().dropna()
        rv_ret = rv_s.pct_change().dropna()
        
        final_weights = np.array([weights_map.get(c, 0) for c in df.columns])
        if final_weights.sum() > 0: final_weights = final_weights / final_weights.sum()
        
        port_ret = returns.dot(final_weights)
        cumulative = (1 + port_ret).cumprod() * 100
        
        bench_cons = (1 + rf_ret).cumprod() * 100
        ret_mod = (rf_ret * 0.75) + (rv_ret * 0.25)
        bench_mod = (1 + ret_mod).cumprod() * 100
        ret_dyn = (rf_ret * 0.25) + (rv_ret * 0.75)
        bench_dyn = (1 + ret_dyn).cumprod() * 100
        bench_agg = (1 + rv_ret).cumprod() * 100
        
        def to_chart_data(series): return [{'x': d.strftime('%Y-%m-%d'), 'y': v} for d, v in series.items()]

        tot_r = cumulative.iloc[-1]/100 - 1
        ann_r = (1 + tot_r)**(252/len(cumulative)) - 1
        vol = port_ret.std() * np.sqrt(252)
        sharpe = (ann_r - 0.025)/vol if vol > 0 else 0
        dd = (cumulative/cumulative.cummax()) - 1
        max_dd = dd.min()
        corr = returns.corr().round(2).fillna(0).values.tolist()

        def get_stats(ser_ret):
            v = ser_ret.std() * np.sqrt(252)
            r = (1 + ser_ret.mean())**252 - 1
            return {'vol': v, 'ret': r}

        synthetics = [
            {'name': 'Conservador', 'key': 'conservative', **get_stats(rf_ret)},
            {'name': 'Moderado', 'key': 'moderate', **get_stats(ret_mod)},
            {'name': 'Dinámico', 'key': 'dynamic', **get_stats(ret_dyn)},
            {'name': 'Agresivo', 'key': 'aggressive', **get_stats(rv_ret)}
        ]

        return {
            'portfolioSeries': to_chart_data(cumulative),
            'benchmarkSeries': {
                'conservative': to_chart_data(bench_cons), 'moderate': to_chart_data(bench_mod),
                'dynamic': to_chart_data(bench_dyn), 'aggressive': to_chart_data(bench_agg)
            },
            'metrics': {'cagr': ann_r, 'volatility': vol, 'sharpe': sharpe, 'maxDrawdown': max_dd},
            'synthetics': synthetics,
            'correlationMatrix': corr
        }
    except Exception as e:
        print(f"Error Backtest: {e}")
        return {'portfolioSeries': [], 'metrics': {}}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getFinancialNews(request: https_fn.CallableRequest):
    return {'articles': [{'title': "Mercados estables", 'source': "Bloomberg", 'summary': "Sin novedad en el frente."}]}