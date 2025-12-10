from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore, storage
import pandas as pd
import numpy as np
import requests
import json
from datetime import datetime, timedelta
from pypfopt import EfficientFrontier, risk_models, expected_returns, objective_functions

# Inicializar Firebase Admin
initialize_app()

# ==========================================
# CONFIGURACIÓN Y CONSTANTES
# ==========================================
BENCHMARK_RF_ISIN = 'IE00B18GC888'
BENCHMARK_RV_ISIN = 'IE00B03HCZ61'
EODHD_API_KEY = "692fd3daddba57.47682479" # Tu API Key
BUCKET_NAME = "bdb-fondos.firebasestorage.app" # Tu Bucket de Storage
TRADING_DAYS = 252
RISK_FREE_RATE = 0.03

# Perfiles de Riesgo (Para el Optimizador Markowitz)
RISK_PROFILES = {
    'aggressive':   {'min_weight': 0.005, 'max_weight': 0.40, 'gamma': 0.10},
    'moderate':     {'min_weight': 0.005, 'max_weight': 0.30, 'gamma': 0.50},
    'conservative': {'min_weight': 0.005, 'max_weight': 0.20, 'gamma': 1.00}
}

cors_config = options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"])

# ==========================================
# UTILIDADES GENÉRICAS
# ==========================================

def get_risk_params(level):
    if level >= 8: return RISK_PROFILES['aggressive']
    elif level >= 5: return RISK_PROFILES['moderate']
    return RISK_PROFILES['conservative']

def get_ecb_risk_free_rate():
    try:
        url = "https://data-api.ecb.europa.eu/service/data/EST/EST.B.EU000A2X2A25.WT?lastNObservations=1&format=json"
        response = requests.get(url, timeout=2)
        if response.status_code == 200:
            data = response.json()
            series = list(data['dataSets'][0]['series'].values())[0]
            obs = list(series['observations'].values())[0]
            return float(obs[0]) / 100.0
    except: pass
    return 0.025

def generate_synthetic_series(days=2000, vol=0.10, ret=0.07, seed=None):
    if seed is not None: np.random.seed(seed)
    prices = {}
    price = 100.0
    today = datetime.now()
    dt = 1/252
    mu = ret * dt
    sigma = vol * np.sqrt(dt)
    for i in range(days):
        date_str = (today - timedelta(days=days-i)).strftime('%Y-%m-%d')
        shock = np.random.normal(0, 1)
        change = (mu - 0.5 * sigma**2) + sigma * shock
        price *= np.exp(change)
        prices[date_str] = round(price, 2)
    return prices

def get_price_data(assets_list, db):
    """Obtiene precios de Firestore para el optimizador (con fallback sintético)"""
    price_data = {}
    for isin in assets_list:
        try:
            doc = db.collection('historico_vl_v2').document(isin).get()
            found = False
            if doc.exists:
                series = doc.to_dict().get('series', [])
                ts_data = {str(p['date']).split('T')[0]: float(p['price']) for p in series if p.get('price')}
                if len(ts_data) > 50: 
                    price_data[isin] = ts_data
                    found = True
            if not found: 
                price_data[isin] = generate_synthetic_series(vol=0.12, ret=0.06) 
        except: 
            price_data[isin] = generate_synthetic_series(vol=0.12, ret=0.06)
    return price_data

# ==========================================
# NUEVAS UTILIDADES PARA SCREENING DIARIO
# ==========================================

def fetch_eodhd_history(isin):
    """Descarga histórico directo de EODHD para el screening"""
    # IMPORTANTE: Mapear ISIN a Ticker EODHD si es necesario (.MC, .US, etc.)
    # Por defecto probamos ISIN directo.
    url = f"https://eodhd.com/api/eod/{isin}?api_token={EODHD_API_KEY}&fmt=json&from={datetime.now().year - 3}-01-01"
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) > 0:
                return pd.DataFrame(data)
        return pd.DataFrame()
    except:
        return pd.DataFrame()

def calculate_screening_metrics(df):
    """Calcula Volatilidad, Drawdown y Sharpe sobre DataFrame de precios"""
    if df.empty or 'adjusted_close' not in df.columns: return None
    
    # Limpieza
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date').set_index('date')
    prices = df['adjusted_close'].astype(float)
    
    # 1. Retornos
    returns = prices.pct_change().dropna()
    if len(returns) < 50: return None

    # 2. Volatilidad (1 Año - 252 días)
    recent_returns = returns.tail(TRADING_DAYS)
    vol_1y = recent_returns.std() * np.sqrt(TRADING_DAYS)

    # 3. Max Drawdown (3 Años)
    cumulative = (1 + returns).cumprod()
    running_max = cumulative.cummax()
    drawdown = (cumulative - running_max) / running_max
    max_dd = drawdown.min()

    # 4. Sharpe Ratio (Recalculado)
    days = (prices.index[-1] - prices.index[0]).days
    if days < 365: days = 365
    total_ret = (prices.iloc[-1] / prices.iloc[0]) - 1
    cagr = (1 + total_ret) ** (365 / days) - 1
    vol_3y = returns.std() * np.sqrt(TRADING_DAYS)
    sharpe = (cagr - RISK_FREE_RATE) / vol_3y if vol_3y > 0 else 0

    return {
        "volatility_1y": round(vol_1y, 4),
        "max_drawdown": round(max_dd, 4),
        "sharpe": round(sharpe, 2)
    }

def calculate_fund_score(metrics, alpha_ms):
    """
    Algoritmo de Scoring 0-100
    *** SIN COSTES *** (Gestionado manualmente por el usuario)
    """
    if not metrics: return 0
    score = 50 # Base neutral
    
    # 1. Sharpe (Eficiencia): +20 puntos por cada unidad de Sharpe
    score += (metrics['sharpe'] * 20)
    
    # 2. Alpha (Talento): +5 puntos por cada 1% de Alpha
    score += (alpha_ms * 5)
    
    # 3. Drawdown (Seguridad): Penaliza fuerte. Resta puntos directamente.
    # Ej: un drawdown de -0.20 (-20%) resta 20 puntos.
    score += (metrics['max_drawdown'] * 100)
    
    # Limites 0-100
    return max(0, min(100, int(score)))

# ==========================================
# FUNCIONES CLOUD (ENDPOINTS)
# ==========================================

# 1. GENERADOR DIARIO DE JSON (SCREENING) - NUEVO
@https_fn.on_request(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540)
def generate_daily_json(request):
    """
    Función programada (Cron) para generar el archivo funds_data.json en Storage.
    """
    print("--- INICIANDO PROCESO NOCTURNO DE SCREENING (SIN COSTES) ---")
    
    db = firestore.client()
    funds_ref = db.collection('funds_v2')
    docs = funds_ref.stream()
    
    final_data = []
    
    for doc in docs:
        fund_data = doc.to_dict()
        isin = doc.id
        
        # 1. Obtener Datos Estáticos de BD
        name = fund_data.get('name', 'Unknown')
        manual_type = fund_data.get('manual_type', 'Other')
        
        # Alpha de Morningstar
        alpha = fund_data.get('perf', {}).get('alpha', 0)
        if alpha is None: alpha = 0
        
        # Costes (Solo para display, NO para scoring)
        costs = fund_data.get('costs', {})
        ter = costs.get('ter', costs.get('management_fee', 0))

        # 2. Descargar Precios y Calcular Métricas Vivas
        df = fetch_eodhd_history(isin)
        
        # Fallback si EODHD falla
        metrics = None
        if not df.empty:
            metrics = calculate_screening_metrics(df)
        
        if not metrics:
            # Métricas por defecto si no hay datos (Penalizado suavemente)
            metrics = {"volatility_1y": 0.15, "max_drawdown": -0.20, "sharpe": 0.5}
        
        # 3. Calcular Score (SIN TER)
        score = calculate_fund_score(metrics, alpha)
        
        # 4. Construir Objeto
        fund_obj = {
            "id": isin,
            "isin": isin,
            "name": name,
            "manual_type": manual_type,
            "score": score,
            "metrics": metrics, # Dato vivo para el Frontend
            "quality_stats": {
                "alpha": alpha,
                "ter": ter # Se guarda solo para mostrar en la tabla, no afecta al ranking
            }
        }
        final_data.append(fund_obj)

    # 5. Guardar en Google Cloud Storage
    try:
        bucket = storage.bucket(BUCKET_NAME)
        blob = bucket.blob("funds_data.json")
        
        json_str = json.dumps(final_data, ensure_ascii=False)
        blob.upload_from_string(json_str, content_type='application/json')
        
        print(f"JSON Generado con éxito. {len(final_data)} fondos procesados.")
        return https_fn.Response(f"OK: JSON actualizado con {len(final_data)} fondos.", status=200)
        
    except Exception as e:
        print(f"Error crítico guardando en Storage: {e}")
        return https_fn.Response(f"Error: {str(e)}", status=500)


# 2. OPTIMIZADOR QUANT (EXISTENTE)
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
        df = df.sort_index().fillna(method='ffill').fillna(method='bfill')
        
        if len(df) > 500: df = df.tail(500)
        
        mu = expected_returns.ema_historical_return(df, span=252)
        S = risk_models.CovarianceShrinkage(df).ledoit_wolf()
        
        params = get_risk_params(risk_level)
        rf = get_ecb_risk_free_rate()
        
        ef = EfficientFrontier(mu, S)
        ef.add_objective(objective_functions.L2_reg, gamma=params['gamma'])
        ef.add_constraint(lambda w: w >= params['min_weight'])
        ef.add_constraint(lambda w: w <= params['max_weight'])
        
        weights = ef.max_sharpe(risk_free_rate=rf)
        clean_weights = ef.clean_weights()
        perf = ef.portfolio_performance(verbose=False, risk_free_rate=rf)
        
        return { 
            'status': 'optimal', 
            'weights': clean_weights, 
            'metrics': {'return': perf[0], 'volatility': perf[1], 'sharpe': perf[2]}, 
            'warnings': [] 
        }
    except Exception as e:
        n = len(assets_list)
        return {
            'status': 'fallback', 
            'weights': {i: 1.0/n for i in assets_list}, 
            'metrics': {'return':0, 'volatility':0, 'sharpe':0}, 
            'warnings': [str(e)]
        }

# 3. BACKTEST (EXISTENTE)
@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def backtest_portfolio(request: https_fn.CallableRequest):
    data = request.data
    portfolio = data.get('portfolio', []) 
    if not portfolio: return {'portfolioSeries': [], 'metrics': {}}
    
    db = firestore.client()
    assets = [p['isin'] for p in portfolio]
    weights_map = {p['isin']: float(p['weight'])/100.0 for p in portfolio}
    
    # Benchmarks
    bench_assets = [BENCHMARK_RF_ISIN, BENCHMARK_RV_ISIN]
    all_assets_to_fetch = list(set(assets) | set(bench_assets))
    price_data = get_price_data(all_assets_to_fetch, db)
    
    # Sintéticos para benchmarks si faltan
    if BENCHMARK_RF_ISIN not in price_data or len(price_data[BENCHMARK_RF_ISIN]) < 50:
        price_data[BENCHMARK_RF_ISIN] = generate_synthetic_series(days=3650, vol=0.02, ret=0.035, seed=10)
    if BENCHMARK_RV_ISIN not in price_data or len(price_data[BENCHMARK_RV_ISIN]) < 50:
        price_data[BENCHMARK_RV_ISIN] = generate_synthetic_series(days=3650, vol=0.14, ret=0.095, seed=20)

    try:
        df_all = pd.DataFrame(price_data)
        df_all.index = pd.to_datetime(df_all.index)
        df_all = df_all.sort_index().fillna(method='ffill').fillna(method='bfill')
        
        client_cols = [c for c in df_all.columns if c in assets]
        if not client_cols: raise Exception("Sin datos de activos válidos")
        
        df_port = df_all[client_cols]
        rf_s = df_all[BENCHMARK_RF_ISIN]
        rv_s = df_all[BENCHMARK_RV_ISIN]
        
        returns = df_port.pct_change().dropna()
        rf_ret = rf_s.pct_change().dropna()
        rv_ret = rv_s.pct_change().dropna()
        
        common = returns.index.intersection(rf_ret.index).intersection(rv_ret.index)
        if len(common) < 50: common = returns.index 
        
        returns = returns.loc[common]
        rf_ret = rf_ret.loc[common]
        rv_ret = rv_ret.loc[common]
        
        final_weights = np.array([weights_map.get(c, 0) for c in df_port.columns])
        if final_weights.sum() > 0: final_weights = final_weights / final_weights.sum()
        
        port_ret = returns.dot(final_weights)
        cumulative = (1 + port_ret).cumprod() * 100
        
        start_date = cumulative.index[0]
        end_date = cumulative.index[-1]
        days_diff = (end_date - start_date).days
        years = days_diff / 365.25
        final_val = cumulative.iloc[-1]
        
        cagr = (final_val / 100) ** (1/years) - 1 if years > 0 else 0
        vol = port_ret.std() * np.sqrt(252)
        sharpe = (cagr - 0.025) / vol if vol > 0 else 0
        
        downside_returns = port_ret[port_ret < 0]
        downside_dev = downside_returns.std() * np.sqrt(252)
        sortino = (cagr - 0.025) / downside_dev if downside_dev > 0 else 0

        running_max = cumulative.cummax()
        drawdown = (cumulative - running_max) / running_max
        max_dd = drawdown.min()
        
        corr = returns.corr().round(2).fillna(0).values.tolist()

        def create_bench(w_rf, w_rv):
            b_ret = (rf_ret * w_rf) + (rv_ret * w_rv)
            return (1 + b_ret).cumprod() * 100

        bench_cons = create_bench(1.0, 0.0)
        bench_mod = create_bench(0.60, 0.40)
        bench_dyn = create_bench(0.20, 0.80)
        bench_agg = create_bench(0.0, 1.0)
        
        def to_chart_data(series): 
            return [{'x': d.strftime('%Y-%m-%d'), 'y': round(v, 2)} for d, v in series.items()]

        def get_stats(ser_ret):
            if len(ser_ret) < 2: return {'vol':0, 'ret':0}
            v = ser_ret.std() * np.sqrt(252)
            tot = (1 + ser_ret).cumprod().iloc[-1]
            y = len(ser_ret) / 252
            r = tot**(1/y) - 1 if y > 0 else 0
            return {'vol': v, 'ret': r}

        synthetics = [
            {'name': 'Conservador', 'key': 'conservative', **get_stats(rf_ret)},
            {'name': 'Moderado', 'key': 'moderate', **get_stats(rf_ret*0.6 + rv_ret*0.4)},
            {'name': 'Dinámico', 'key': 'dynamic', **get_stats(rf_ret*0.2 + rv_ret*0.8)},
            {'name': 'Agresivo', 'key': 'aggressive', **get_stats(rv_ret)}
        ]

        return {
            'portfolioSeries': to_chart_data(cumulative),
            'benchmarkSeries': {
                'conservative': to_chart_data(bench_cons), 
                'moderate': to_chart_data(bench_mod),
                'dynamic': to_chart_data(bench_dyn), 
                'aggressive': to_chart_data(bench_agg)
            },
            'metrics': {
                'cagr': round(cagr, 4), 
                'volatility': round(vol, 4), 
                'sharpe': round(sharpe, 2), 
                'sortino': round(sortino, 2),
                'maxDrawdown': round(max_dd, 4)
            },
            'synthetics': synthetics,
            'correlationMatrix': corr
        }
    except Exception as e:
        print(f"Error Backtest: {e}")
        return {'portfolioSeries': [], 'metrics': {}, 'error': str(e)}

# 4. NOTICIAS (EXISTENTE)
@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getFinancialNews(request: https_fn.CallableRequest):
    req_data = request.data
    mode = req_data.get('mode', 'general')
    query = req_data.get('query', 'balance sheet')
    
    base_url = "https://eodhd.com/api/news"
    params = {'api_token': EODHD_API_KEY, 'limit': 15, 'offset': 0}
    
    if mode == 'ticker': params['s'] = query 
    else: params['t'] = query
        
    try:
        response = requests.get(base_url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        articles = []
        news_list = data if isinstance(data, list) else data.get('data', [])
        
        for item in news_list:
            if not item.get('title'): continue
            articles.append({
                'title': item.get('title'),
                'summary': item.get('content', 'Sin descripción.')[:200] + '...',
                'date': item.get('date', ''),
                'source': 'EODHD',
                'link': item.get('link', '#')
            })
        return {'articles': articles}
    except Exception as e:
        return {'articles': [], 'error': str(e)}