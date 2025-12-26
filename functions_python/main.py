import json
import os
import datetime
from datetime import timedelta
import logging

# --- LIBRERÍAS DE FIREBASE Y CLOUD ---
from firebase_functions import https_fn, options, scheduler_fn
from firebase_admin import initialize_app, firestore, storage
# import vertexai
# from vertexai.generative_models import GenerativeModel, Part

# --- LIBRERÍAS DE DATOS Y FINANZAS ---
# --- LIBRERÍAS DE DATOS Y FINANZAS (Movidas a local scope)
# import yfinance as yf
# import pandas_datareader.data as web
# import pandas as pd

# --- TUS SERVICIOS LOCALES ---
from services.config import BUCKET_NAME 

# ==============================================================================
# 1. CONFIGURACIÓN INICIAL
# ==============================================================================
initialize_app()

# Configuración Vertex AI (Gemini)
PROJECT_ID = "bdb-fondos"
LOCATION = "us-central1"
# vertexai.init(project=PROJECT_ID, location=LOCATION)

# Configuración CORS
cors_config = options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"])

def get_cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600'
    }


# ==============================================================================
# 3. NUEVA FUNCIÓN AUTOMÁTICA (SCHEDULER): DEEP RESEARCH SEMANAL
# ==============================================================================

@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="every monday 09:00",
    timezone="Europe/Madrid",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1
)
def scheduleWeeklyResearch(event: scheduler_fn.ScheduledEvent) -> None:
    print(f"⏰ Ejecutando Deep Research Semanal Automático: {event.schedule_time}")
    from services.research import generate_advanced_report
    db = firestore.client()
    
    # Generar informe semanal avanzado
    result = generate_advanced_report(db, 'WEEKLY')
    
    if result.get('success'):
        print("✅ Informe Semanal generado correctamente.")
    else:
        print(f"❌ Error generando informe semanal: {result.get('error')}")


@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="0 9 1 * *",  # 1st of every month at 9:00 AM
    timezone="Europe/Madrid",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1
)
def scheduleMonthlyResearch(event: scheduler_fn.ScheduledEvent) -> None:
    print(f"⏰ Ejecutando Deep Research MENSUAL Automático: {event.schedule_time}")
    from services.research import generate_advanced_report
    db = firestore.client()
    
    # Generar informe mensual avanzado
    result = generate_advanced_report(db, 'MONTHLY')
    
    if result.get('success'):
        print("✅ Informe Mensual generado correctamente.")
    else:
        print(f"❌ Error generando informe mensual: {result.get('error')}")


# ==============================================================================
# 4. GRÁFICOS DE MERCADO (Yahoo Finance + BCE)
# ==============================================================================
@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getMarketIndex(request: https_fn.CallableRequest):
    try:
        import yfinance as yf
        symbol_map = {
            'GSPC.INDX': '^GSPC', 'IXIC.INDX': '^IXIC',
            'GDAXI.INDX': '^GDAXI', 'IBEX.INDX': '^IBEX'
        }
        req_symbol = request.data.get('symbol', 'GSPC.INDX')
        req_range = request.data.get('range', '1y')
        ticker = symbol_map.get(req_symbol, '^GSPC')
        
        yf_period = '1y'
        if req_range == '1m': yf_period = '1mo'
        elif req_range == '5y': yf_period = '5y'
        elif req_range == 'ytd': yf_period = 'ytd'
        
        data = yf.download(ticker, period=yf_period, interval='1d', progress=False)
        
        if data.empty: return {'series': [], 'symbol': req_symbol}

        series = []
        for index, row in data.iterrows():
            val = row['Close']
            if hasattr(val, 'item'): val = val.item()
            series.append({'x': index.strftime('%Y-%m-%d'), 'y': round(float(val), 2)})

        return {'series': series, 'symbol': req_symbol}
    except Exception as e:
        return {'series': [], 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getYieldCurve(request: https_fn.CallableRequest):
    region = request.data.get('region', 'US')
    curve_data = []
    
    try:
        import yfinance as yf
        import pandas_datareader.data as web
        import pandas as pd
        import datetime
        from datetime import datetime as dt
        if region == 'US':
            tickers = {'3M': '^IRX', '5Y': '^FVX', '10Y': '^TNX', '30Y': '^TYX'}
            data = yf.download(list(tickers.values()), period="5d", progress=False)['Close']
            last = data.iloc[-1]
            for mat, tick in tickers.items():
                try:
                    val = last[tick]
                    if hasattr(val, 'item'): val = val.item()
                    if pd.notna(val): curve_data.append({'maturity': mat, 'yield': round(float(val), 2)})
                except: continue

        elif region == 'EU':
            ecb_tickers = {
                '3M': 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_3M',
                '1Y': 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_1Y',
                '2Y': 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y',
                '5Y': 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_5Y',
                '10Y': 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y',
                '30Y': 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_30Y'
            }
            start_date = datetime.now() - timedelta(days=5)
            try:
                df = web.DataReader(list(ecb_tickers.values()), 'ecb', start=start_date)
                latest = df.iloc[-1]
                for label, code in ecb_tickers.items():
                    val = latest[code]
                    if pd.notna(val):
                        curve_data.append({'maturity': label, 'yield': round(float(val), 2)})
            except Exception as e_ecb:
                print(f"⚠️ Error ECB API, usando fallback: {e_ecb}")
                try:
                    bund = yf.Ticker('^GDB').history(period='1d')
                    val = bund['Close'].iloc[-1]
                    curve_data.append({'maturity': '10Y (Proxy)', 'yield': round(float(val), 2)})
                except: pass
             
        order = ['3M', '1Y', '2Y', '5Y', '10Y', '30Y']
        curve_data.sort(key=lambda x: order.index(x['maturity']) if x['maturity'] in order else 99)
        return {'curve': curve_data, 'region': region}

    except Exception as e:
        return {'curve': [], 'error': str(e)}


# ==============================================================================
# 4. TUS FUNCIONES CORE (Gestión de Cartera - Intactas)
# ==============================================================================

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540)
def generate_analysis_report(request: https_fn.CallableRequest):
    """Trigger manual para Deep Research"""
    from services.research import generate_advanced_report
    db = firestore.client()
    
    # Leer el tipo de informe desde el request (body)
    req_data = request.data or {}
    report_type = req_data.get('type', 'WEEKLY')
    
    if report_type == 'STRATEGY':
        from services.research import generate_strategy_report
        return generate_strategy_report(db)

    return generate_advanced_report(db, report_type)


@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=120, cors=cors_config)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    from services.optimizer import run_optimization
    db = firestore.client()
    from services.strategies import STRATEGY_CONSTRAINTS
    req_data = request.data
    if req_data.get('warmup') is True: return {'status': 'warmed_up'}
    try:
        assets_list = req_data.get('assets', [])
        risk_level = req_data.get('risk_level', 5)
        if not assets_list: return {'status': 'error', 'warnings': ['Cartera vacía']}
        # --- NEW: CHALLENGER LOGIC (Add +1 Fund Capability) ---
        # Fetch Top 5 Funds by Sharpe to potentially replace/add to current portfolio
        try:
            challengers = []
            docs = db.collection('funds_v2').order_by('perf.sharpe', direction=firestore.Query.DESCENDING).limit(5).stream()
            for d in docs:
                isin = d.id
                if isin not in assets_list:
                    challengers.append(isin)
            
            # Add top 2 challengers to the universe
            candidates = challengers[:2]
            if candidates:
                print(f"🚀 Injecting Challengers: {candidates}")
                assets_list.extend(candidates)
        except Exception as e_chal:
            print(f"⚠️ Error fetching challengers: {e_chal}")

        asset_metadata = {}
        for isin in assets_list:
             d = db.collection('funds_v2').document(isin).get()
             if d.exists: asset_metadata[isin] = {'regions': d.to_dict().get('regions', {})}
        return run_optimization(assets_list, risk_level, db, constraints=STRATEGY_CONSTRAINTS, asset_metadata=asset_metadata)
    except Exception as e:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=str(e))

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def generateSmartPortfolio(request: https_fn.CallableRequest):
    from services.optimizer import generate_smart_portfolio
    db = firestore.client()
    data = request.data
    return generate_smart_portfolio(
        category=data.get('category'),
        risk_level=data.get('risk_level', 5),
        num_funds=data.get('num_funds', 5),
        vip_funds_str=data.get('vip_funds', ''),
        optimize_now=data.get('optimize', True),
        db=db
    )

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, cors=cors_config)
def backtest_portfolio(request: https_fn.CallableRequest):
    from services.backtester import run_backtest
    db = firestore.client()
    data = request.data
    portfolio = data.get('portfolio', [])
    period = data.get('period', '3y')
    if not portfolio: return {'error': 'Cartera vacía'}
    return run_backtest(portfolio, period, db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getFinancialNews(request: https_fn.CallableRequest):
    from services.market import get_financial_news
    query = request.data.get('query', 'general')
    mode = request.data.get('mode', 'general')
    return get_financial_news(query, mode)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=300)
def clean_duplicates(request: https_fn.CallableRequest):
    from services.admin import clean_duplicates_logic
    db = firestore.client()
    return clean_duplicates_logic(db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540)
def restore_historico(request: https_fn.CallableRequest):
    from services.admin import restore_historico_logic
    db = firestore.client()
    return restore_historico_logic(db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540)
def analyze_isin_health(request: https_fn.CallableRequest):
    from services.admin import analyze_isin_health_logic
    db = firestore.client()
    bucket = storage.bucket(BUCKET_NAME)
    return analyze_isin_health_logic(db, bucket)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def insertMonthlyReport(request: https_fn.CallableRequest):
    db = firestore.client()
    doc_ref = db.collection('analysis_results').add(request.data)
    return {'success': True, 'doc_id': doc_ref[1].id}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getEfficientFrontier(request: https_fn.CallableRequest):
    from services.optimizer import generate_efficient_frontier
    db = firestore.client()
    
    # Expected: { assets: [{isin: '...', weight: 20}, ...] }
    data = request.data
    portfolio = data.get('portfolio', [])
    if not portfolio: return {'error': 'Empty portfolio'}

    assets_list = [item['isin'] for item in portfolio]
    portfolio_weights = {item['isin']: (item.get('weight', 0) / 100.0) for item in portfolio}
    
    # 1. Generate Frontier & Portfolio Point
    return generate_efficient_frontier(assets_list, db, portfolio_weights)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getRiskRate(request: https_fn.CallableRequest):
    from services.data import get_dynamic_risk_free_rate
    db = firestore.client()
    return {'rate': get_dynamic_risk_free_rate(db)}

