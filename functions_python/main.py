import json
import os
import datetime
from datetime import timedelta
import logging

# --- LIBRERÍAS DE FIREBASE Y CLOUD ---
from firebase_functions import https_fn, options, scheduler_fn
from firebase_admin import initialize_app, firestore, storage
# --- LIBRERÍAS DE DATOS Y FINANZAS ---


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


@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="every day 00:00",
    timezone="Europe/Madrid",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1
)
def scheduleDailyMetricsUpdate(event: scheduler_fn.ScheduledEvent) -> None:
    print(f"⏰ Ejecutando Cálculo Diario de Métricas: {event.schedule_time}")
    from services.analytics import update_daily_metrics
    db = firestore.client()
    
    result = update_daily_metrics(db)
    
    if result.get('success'):
        print("✅ Métricas actualizadas correctamente.")
    else:
        print(f"❌ Error actualizando métricas.")


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
    req_data = request.data
    db = firestore.client()
    
    if req_data.get('warmup') is True: return {'status': 'warmed_up'}
    
    try:
        # Move imports INSIDE try to catch ImportError/ModuleNotFoundError
        from services.optimizer import run_optimization
        # from services.strategies import STRATEGY_CONSTRAINTS  <-- MISSING MODULE
        STRATEGY_CONSTRAINTS = {} 
        
        assets_list = req_data.get('assets', [])
        risk_level = req_data.get('risk_level', 5)
        locked_assets = req_data.get('locked_assets', []) or []
        if not assets_list: return {'status': 'error', 'warnings': ['Cartera vacía']}
        
        # --- NEW: CHALLENGER LOGIC (Add +1 Fund Capability) ---
        # Fetch Top 5 Funds by Sharpe to potentially replace/add to current portfolio
        # ONLY IF NOT DISABLED (Rebalance Mode)
        if not req_data.get('disable_challengers'):
            try:
                # --- SMART CHALLENGER LOGIC (V4.1) ---
                # Fetch Top 20 by Sharpe (broad net)
                docs = db.collection('funds_v3')\
                    .order_by('std_perf.sharpe', direction=firestore.Query.DESCENDING)\
                    .limit(20)\
                    .stream()
                
                challengers = []
                for d in docs:
                    # Early exit if we have enough
                    if len(challengers) >= 2: break
                    
                    data = d.to_dict() or {}
                    isin = d.id
                    
                    # 1. Skip if already in portfolio
                    if isin in assets_list: continue

                    # 2. Quality Filter (Crucial to avoid trash)
                    dq = data.get('data_quality', {})
                    # If history_ok is explicitly False, skip. (Default to True if missing to be permissive, but check history points)
                    if dq.get('history_ok') is False: continue
                    
                    # 3. Liquidity/Safety Filter (Optional but recommended)
                    # Skip if missing std_perf or very low history points fallback
                    if not data.get('std_perf'): continue
                    
                    challengers.append(isin)
                
                # Add valid challengers to the universe
                if challengers:
                    print(f"🚀 Injecting Challengers (Valid Quality): {challengers}")
                    assets_list.extend(challengers)
                else:
                    print("ℹ️ No valid challengers found in Top 20.")

            except Exception as e_chal:
                print(f"⚠️ Error fetching challengers: {e_chal}")
        else:
            print("ℹ️ Challenger Logic DISABLED (Weight-Only Optimization)")

        # Batch-read metadata (evita N+1)
        asset_metadata = {}
        try:
            refs = [db.collection('funds_v3').document(isin) for isin in assets_list]
            docs = db.get_all(refs)
            for d in docs:
                if d.exists:
                    data = d.to_dict() or {}
                    asset_metadata[d.id] = {
                        'regions': data.get('regions', {}) or {},
                        'metrics': data.get('metrics', {}) or {},
                        'asset_class': data.get('asset_class') or data.get('std_type')
                    }
        except Exception as e_meta:
            print(f"⚠️ Error batch metadata: {e_meta}")

        if req_data.get('auto_expand_universe'):
            STRATEGY_CONSTRAINTS['auto_expand_universe'] = True

        # --- NEW: UNCONSTRAINED REBALANCE ---
        if req_data.get('ignore_constraints'):
            # Override any strategy constraints
            STRATEGY_CONSTRAINTS = {} 
            # Signal optimizer to skip profile logic (buckets)
            STRATEGY_CONSTRAINTS['disable_profile_rules'] = True
            # Extract objective from payload (default to risk-based if not provided, but frontend now sends it)
            STRATEGY_CONSTRAINTS['objective'] = req_data.get('objective')
            
            # --- STRICT REBALANCE LIMITS (User Requested) ---
            STRATEGY_CONSTRAINTS['min_weight'] = 0.03   # 3% Min per Asset
            STRATEGY_CONSTRAINTS['max_weight'] = 0.25   # 25% Max per Asset

        result = run_optimization(
            assets_list,
            risk_level,
            db,
            constraints=STRATEGY_CONSTRAINTS,
            asset_metadata=asset_metadata,
            locked_assets=locked_assets
        )
        # Sello de versión para depuración/consistencia
        result['api_version'] = result.get('api_version', 'optimize_quant_v4')
        return result
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



@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540)
def restore_historico(request: https_fn.CallableRequest):
    from services.admin import restore_historico_logic
    db = firestore.client()
    return restore_historico_logic(db)



@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def insertMonthlyReport(request: https_fn.CallableRequest):
    db = firestore.client()
    doc_ref = db.collection('analysis_results').add(request.data)
    return {'success': True, 'doc_id': doc_ref[1].id}

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

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getEfficientFrontier(request: https_fn.CallableRequest):
    from services.optimizer import generate_efficient_frontier
    db = firestore.client()
    
    try:
        # Expected: { portfolio: [{isin: '...', weight: 20}, ...] }
        data = request.data or {}
        portfolio = data.get('portfolio', [])
        if not portfolio: 
            print("⚠️ [getEfficientFrontier] Cartera vacía recibida.")
            return {'error': 'Empty portfolio'}

        assets_list = [item['isin'] for item in portfolio]
        portfolio_weights = {item['isin']: (float(item.get('weight', 0)) / 100.0) for item in portfolio}
        
        print(f"🚀 [getEfficientFrontier] Calculando para {len(assets_list)} activos: {assets_list}")
        
        # 1. Generate Frontier & Portfolio Point
        result = generate_efficient_frontier(assets_list, db, portfolio_weights)
        
        if 'error' in result:
            print(f"❌ [getEfficientFrontier] Error en lógica interna: {result['error']}")
        
        return result
        
    except Exception as e:
        print(f"🔥 [getEfficientFrontier] Error crítico en endpoint: {e}")
        import traceback
        traceback.print_exc()
        return {'status': 'error', 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getRiskRate(request: https_fn.CallableRequest):
    from services.data_fetcher import DataFetcher
    db = firestore.client()
    fetcher = DataFetcher(db)
    return {'rate': fetcher.get_dynamic_risk_free_rate()}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540, cors=cors_config)
def audit_database(request: https_fn.CallableRequest):
    """
    Endpoint temporal para auditoría de Fase 3.
    Retorna JSON con status de funds_v3.
    """
    from services.audit_service import run_audit
    db = firestore.client()
    try:
        data = run_audit(db)
        return {'status': 'success', 'data': data}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def diagnose_history_endpoint(request: https_fn.CallableRequest):
    """
    Endpoint temporal para diagnostico de histórico.
    """
    from services.audit_service import diagnose_history_logic
    db = firestore.client()
    try:
        logs = diagnose_history_logic(db)
        return {'status': 'success', 'logs': logs}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540, cors=cors_config)
def fix_database_endpoint(request: https_fn.CallableRequest):
    """
    Endpoint temporal para Fix Fase 3.
    Params: { apply: bool }
    """
    from services.fix_service import run_db_fix
    db = firestore.client()
    try:
        apply_changes = request.data.get('apply', False)
        stats = run_db_fix(db, apply_changes=apply_changes)
        return {'status': 'success', 'stats': stats}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540, cors=cors_config)
def backfill_std_perf_endpoint(request: https_fn.CallableRequest):
    """
    Endpoint Fase 4: Backfill Std Perf Metrics.
    Calcula Sharpe, Volatility, Return con historia real.
    """
    from services.calc_service import backfill_std_perf_logic
    db = firestore.client()
    try:
        stats = backfill_std_perf_logic(db)
        return {'status': 'success', 'data': stats}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540, cors=cors_config)
def update_metadata_endpoint(request: https_fn.CallableRequest):
    """
    Endpoint Fase 5: Actualizar Metadatos (Years Span).
    """
    from services.audit_service import update_years_span_logic
    db = firestore.client()
    try:
        data = request.data or {}
        apply_changes = data.get('apply', False)
        result = update_years_span_logic(db, apply=apply_changes)
        return {'status': 'success', 'result': result}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

@https_fn.on_request(region="europe-west1", timeout_sec=540, memory=options.MemoryOption.GB_1)
def refresh_daily_metrics(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP Endpoint: Daily Refresh Job (Protected).
    Triggered by Cloud Scheduler.
    """
    from services.daily_service import refresh_daily_logic
    import datetime
    import os
    import json
    
    # Security Check
    token = req.headers.get('X-Refresh-Token')
    expected_token = os.environ.get('REFRESH_TOKEN')
    
    if not expected_token or token != expected_token:
        # Fallback for empty env (dev mode only if needed, but stricter is better)
        # If no env var set, ALL requests fail. Good.
        return https_fn.Response(f"Unauthorized", status=403)
        
    start_time = datetime.datetime.utcnow().timestamp()
    db = firestore.client()
    
    try:
        result = refresh_daily_logic(db, start_time)
        return https_fn.Response(json.dumps(result, default=str), status=200, mimetype='application/json')
    except Exception as e:
        return https_fn.Response(f"Error: {str(e)}", status=500)


@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def verify_db_format(request: https_fn.CallableRequest):
    """
    Endpoint temporal para verificar formato de historicos.
    """
    from services.data_verification import verify_history_format_logic
    db = firestore.client()
    try:
        report = verify_history_format_logic(db)
        return {'status': 'success', 'report': report}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}


@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def inspect_doc_endpoint(request: https_fn.CallableRequest):
    from services.inspector import inspect_document_logic
    db = firestore.client()
    isin = request.data.get('isin')
    return inspect_document_logic(db, isin)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=600, cors=cors_config)
def migrate_historico_endpoint(request: https_fn.CallableRequest):
    """
    Endpoint para migrar 'series' -> 'history' (canonical).
    params: { 'dry_run': bool } (default True)
    """
    from services.fix_service import migrate_historico_vl_v2_to_history
    db = firestore.client()
    dry_run = request.data.get('dry_run', True)
    return migrate_historico_vl_v2_to_history(db, dry_run=dry_run)


# ==============================================================================
# 5. DEBUG ENDPOINTS
# ==============================================================================

@https_fn.on_request(region="europe-west1", timeout_sec=60, memory=options.MemoryOption.GB_1)
def test_frontier_debug(req: https_fn.Request) -> https_fn.Response:
    """
    Endpoint temporal de DEBUG para frontera eficiente.
    Uso: /test_frontier_debug
    """
    from services.optimizer import generate_efficient_frontier
    import json
    db = firestore.client()
    
    # ISINs de prueba (World + S&P 500)
    assets = ['IE00B03HCZ61', 'IE00B4L5Y983'] 
    
    try:
        req_json = req.get_json(silent=True)
        if req_json and 'assets' in req_json:
            assets = req_json['assets']
    except: pass

    print(f"🔬 DEBUG START: Testing Frontier for {assets}")
    try:
        res = generate_efficient_frontier(assets, db)
        return https_fn.Response(json.dumps(res, default=str), status=200, mimetype='application/json')
    except Exception as e:
        import traceback
        return https_fn.Response(f"CRITICAL ERROR: {str(e)}\n{traceback.format_exc()}", status=500)


