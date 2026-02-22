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
from services.optimizer import run_optimization, generate_smart_portfolio, generate_efficient_frontier
from services.backtester import run_backtest

from services.admin import restore_historico_logic
from services.data_fetcher import DataFetcher

from services.daily_service import refresh_daily_logic


# ==============================================================================
# 1. CONFIGURACIÓN INICIAL
# ==============================================================================
initialize_app()


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
    from services.research import generate_weekly_strategy_report
    db = firestore.client()
    
    # Generar informe semanal consolidado
    result = generate_weekly_strategy_report(db)
    
    if result.get('success'):
        print("✅ Informe Semanal Consolidado generado correctamente.")
    else:
        print(f"❌ Error generando informe semanal: {result.get('error')}")

@https_fn.on_request(
    region="europe-west1",
    timeout_sec=540,
    memory=options.MemoryOption.GB_1,
    cors=cors_config
)
def force_weekly_research(req: https_fn.Request) -> https_fn.Response:
    """Endpoint manual para forzar la generación del reporte en pruebas"""
    print("🔥 Forzando Deep Research Semanal Manualmente")
    from services.research import generate_weekly_strategy_report
    db = firestore.client()
    
    try:
        result = generate_weekly_strategy_report(db)
        if result.get('success'):
            return https_fn.Response(json.dumps({"success": True, "message": "Nuevo informe generado con éxito."}), status=200, headers=get_cors_headers())
        else:
            return https_fn.Response(json.dumps({"success": False, "error": result.get('error')}), status=500, headers=get_cors_headers())
    except Exception as e:
        return https_fn.Response(json.dumps({"success": False, "error": str(e)}), status=500, headers=get_cors_headers())

# Funciones mensuales antiguas eliminadas temporalmente en favor de un único reporte semanal

# ==============================================================================
# 2. SISTEMA AUTOMÁTICO DE DATOS (EODHD -> FIRESTORE)
# ==============================================================================

# --- FUNCIÓN MAESTRA DIARIA (Descarga + Métricas) ---
# Reemplaza a las antiguas scheduleDailyNAVFetch y scheduleDailyMetricsUpdate
@scheduler_fn.on_schedule(
    region="europe-west1",
    schedule="0 6 * * 1-5",       # Lunes a Viernes a las 06:00 AM
    timezone="Europe/Madrid",
    timeout_sec=1200,             # 20 Minutos (Margen de seguridad)
    memory=options.MemoryOption.GB_1 # 1GB RAM (Vital para Pandas/Métricas)
)
def runMasterDailyRoutine(event: scheduler_fn.ScheduledEvent) -> None:
    print(f"🚀 [MASTER] Iniciando Rutina Diaria: {event.schedule_time}")
    
    # Importaciones diferidas para optimizar arranque
    from services.nav_fetcher import run_daily_fetch
    from services.analytics import update_daily_metrics
    from firebase_admin import firestore
    
    db = firestore.client()
    
    # --- PASO 1: DESCARGA DE DATOS ---
    print("⬇️ [PASO 1/2] Iniciando Descarga de NAVs...")
    try:
        fetch_result = run_daily_fetch()
        print(f"✅ Descarga completada: {fetch_result}")
    except Exception as e:
        print(f"❌ ERROR CRÍTICO en Descarga: {e}")
        print("⛔ Abortando cálculo de métricas para evitar datos corruptos.")
        return

    # --- PASO 2: CÁLCULO DE MÉTRICAS ---
    print("🧮 [PASO 2/3] Recalculando Métricas (Sharpe, Volatilidad, etc)...")
    try:
        # Ejecutar lógica de analítica
        update_daily_metrics(db) 
        print(f"✅ Métricas actualizadas correctamente.")
    except Exception as e:
        print(f"❌ ERROR en cálculo de Métricas: {e}")
        # No hacemos return aquí para que la función termine "bien" aunque falle este paso

    # --- PASO 3: RECONSTRUIR CACHÉ GLOBAL DE PRECIOS ---
    print("📦 [PASO 3/3] Reconstruyendo Caché Global en Cloud Storage...")
    try:
        from services.analytics import build_global_price_cache
        build_global_price_cache(db)
    except Exception as e:
        print(f"❌ ERROR al construir Caché Global: {e}")

    print("🏁 [MASTER] Rutina Diaria finalizada.")


# ==============================================================================


# ==============================================================================
# 4. GRÁFICOS DE MERCADO Y MACRO (Yahoo Finance + BCE)
# ==============================================================================

# ==============================================================================
# 4. TUS FUNCIONES CORE (Gestión de Cartera - Intactas)
# ==============================================================================


@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=540)
def generate_analysis_report(request: https_fn.CallableRequest):
    """Trigger manual para Deep Research Consolidado (Weekly Strategy Report)"""
    from services.research import generate_weekly_strategy_report
    db = firestore.client()
    
    return generate_weekly_strategy_report(db)


@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=120, cors=cors_config)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    req_data = request.data
    db = firestore.client()
    
    if req_data.get('warmup') is True: return {'status': 'warmed_up'}
    
    try:
        STRATEGY_CONSTRAINTS = {} 
        
        assets_list = req_data.get('assets', [])
        risk_level = req_data.get('risk_level', 5)
        locked_assets = req_data.get('locked_assets', []) or []
        if not assets_list: return {'status': 'error', 'warnings': ['Cartera vacía']}
        
        # --- NEW: CHALLENGER LOGIC (Add +1 Fund Capability) ---
        # Fetch Top 5 Funds by Sharpe to potentially replace/add to current portfolio
        # ONLY IF EXPLICITLY REQUESTED (Rebalance Mode with Challengers)
        # CHANGED: Default is False (No Ghost Assets)
        if req_data.get('enable_challengers') is True:
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
            print("ℹ️ Challenger Logic DISABLED by default (Weight-Only Optimization)")

        # Batch-read metadata (evita N+1)
        asset_metadata = {}
        try:
            refs = [db.collection('funds_v3').document(isin) for isin in assets_list]
            docs = db.get_all(refs)
            for d in docs:
                if d.exists:
                    data = d.to_dict() or {}
                    
                    # Robust Metadata Extraction (V3 Schema Compatible)
                    # 1. Regions: Priorities:
                    #    A) derived.portfolio_exposure.equity_regions_total (Cleanest, calculated by loader)
                    #    B) ms.regions.detail (Direct mapping)
                    #    C) ms.regions.macro (Fallback)
                    
                    derived_exposure = data.get('derived', {}).get('portfolio_exposure', {})
                    regions = derived_exposure.get('equity_regions_total', {})
                    
                    if not regions:
                        # Fallback to raw MS data if derived is missing
                        ms_regions = data.get('ms', {}).get('regions', {})
                        regions = ms_regions.get('detail', {})
                        if not regions:
                             regions = ms_regions.get('macro', {})
                    
                    # Legacy fallback (should ideally not be reached if V3 is clean)
                    if not regions: regions = data.get('regions', {})

                    # 2. Metrics: std_perf > metrics
                    metrics = data.get('std_perf', {}) 
                    if not metrics: metrics = data.get('metrics', {})

                    # 3. Asset Class: derived > root > std_type
                    asset_class = data.get('derived', {}).get('asset_class')
                    if not asset_class: asset_class = data.get('asset_class')
                    if not asset_class: asset_class = data.get('std_type')

                    asset_metadata[d.id] = {
                        'regions': regions or {},
                        'metrics': metrics or {},
                        'asset_class': asset_class,
                        'market_cap': data.get('std_mcap', 1e9) # Default for BL if missing
                    }
        except Exception as e_meta:
            print(f"⚠️ Error batch metadata: {e_meta}")

        # --- MERGE FRONTEND METADATA (V4.1 Fix) ---
        # If frontend sends specific labels (e.g. from CSV import or manual overrides), use them.
        frontend_meta = req_data.get('asset_metadata', {})
        if frontend_meta:
            print(f"📥 Merging {len(frontend_meta)} metadata items from Frontend")
            for isin, meta in frontend_meta.items():
                if isin not in asset_metadata:
                    asset_metadata[isin] = {}
                
                # Check for explicit label (mapped by Front: RV, RF, etc.)
                if 'label' in meta:
                    asset_metadata[isin]['label'] = meta['label']
                
                # Fallback: if we had nothing for asset_class, try to infer or use Front
                if not asset_metadata[isin].get('asset_class'):
                     asset_metadata[isin]['asset_class'] = meta.get('label') # Use label as asset_class proxy

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
    db = firestore.client()
    data = request.data
    portfolio = data.get('portfolio', [])
    period = data.get('period', '3y')
    if not portfolio: return {'error': 'Cartera vacía'}
    return run_backtest(portfolio, period, db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, cors=cors_config)
def backtest_portfolio_multi(request: https_fn.CallableRequest):
    """
    Optimized endpoint for Dashboard.
    Params: { portfolio: [...], periods: ['1y', '3y', '5y'] }
    """
    from services.backtester import run_multi_period_backtest
    db = firestore.client()
    data = request.data
    portfolio = data.get('portfolio', [])
    periods = data.get('periods', ['1y', '3y', '5y'])
    if not portfolio: return {'error': 'Cartera vacía'}
    return run_multi_period_backtest(portfolio, periods, db)





@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540)
def restore_historico(request: https_fn.CallableRequest):
    db = firestore.client()
    return restore_historico_logic(db)



@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def insertMonthlyReport(request: https_fn.CallableRequest):
    db = firestore.client()
    doc_ref = db.collection('analysis_results').add(request.data)
    return {'success': True, 'doc_id': doc_ref[1].id}



@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def getEfficientFrontier(request: https_fn.CallableRequest):
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
    db = firestore.client()
    fetcher = DataFetcher(db)
    return {'rate': fetcher.get_dynamic_risk_free_rate()}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def updateFundHistory(request: https_fn.CallableRequest):
    """
    Trigger manual update of fund history from EODHD.
    Params: { isin, mode='merge'|'overwrite', from_date='YYYY-MM-DD', to_date='YYYY-MM-DD' }
    """
    from services.nav_fetcher import update_single_fund_history
    db = firestore.client()
    
    # --- SECURITY CHECK ---
    if not request.auth:
        return {'success': False, 'error': 'Unauthorized'}
    
    user_email = request.auth.token.get('email', '')
    if user_email != 'oantiza@gmail.com':
        return {'success': False, 'error': f'Forbidden: User {user_email} is not authorized.'}
    
    data = request.data or {}
    
    isin = data.get('isin')
    if not isin: return {'success': False, 'error': 'Missing ISIN'}
    
    mode = data.get('mode', 'merge')
    from_date = data.get('from_date')
    to_date = data.get('to_date')
    
    return update_single_fund_history(db, isin, mode, from_date, to_date)


@https_fn.on_request(region="europe-west1", timeout_sec=540, memory=options.MemoryOption.GB_1)
def refresh_daily_metrics(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP Endpoint: Daily Refresh Job (Protected).
    Triggered by Cloud Scheduler.
    """
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








