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
    from services.research import generate_advanced_report, generate_strategy_report
    db = firestore.client()
    
    # 1. Generar informe mensual avanzado
    result = generate_advanced_report(db, 'MONTHLY')
    
    if result.get('success'):
        print("✅ Informe Mensual generado correctamente.")
    else:
        print(f"❌ Error generando informe mensual: {result.get('error')}")

    # 2. Generar Matriz de Estrategia (Asignación de Activos)
    print("⏰ Ejecutando Generación de Estrategia (Asignación de Activos)...")
    result_strategy = generate_strategy_report(db)
    
    if result_strategy.get('success'):
        print("✅ Informe de Estrategia generado correctamente.")
    else:
        print(f"❌ Error generando informe de estrategia: {result_strategy.get('error')}")


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



@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, cors=cors_config)
def backtest_portfolio(request: https_fn.CallableRequest):
    from services.backtester import run_backtest
    db = firestore.client()
    data = request.data
    portfolio = data.get('portfolio', [])
    period = data.get('period', '3y')
    if not portfolio: return {'error': 'Cartera vacía'}
    return run_backtest(portfolio, period, db)





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


# ==============================================================================
# 5. GLOBAL MACRO INTELLIGENCE (FRED API)
# ==============================================================================

FRED_MAPPING = {
    "USA": { 
        "GDP": "GDP", 
        "CPI": "CPIAUCSL", 
        "UNEMPLOYMENT": "UNRATE", 
        "INTEREST_RATE": "FEDFUNDS",
        "GDP_PER_CAPITA": "A939RX0Q048SBEA", 
        "GDP_PPP": "PPPGDPUSA", 
        "TRADE_BALANCE": "BOPGSTB", 
        "GOVT_DEBT": "GFDEGDQ188S" 
    },
    "Euro Area": { 
        "GDP": "CLVMEURSCAB1GQEA19", 
        "CPI": "CP0000EZ19M086NEST", 
        "UNEMPLOYMENT": "LRHUTTTTEZM156S", 
        "INTEREST_RATE": "IRSTCI01EZM156N",
        "GDP_PER_CAPITA": "CLVMEURSCAB1GQEA19", # Proxy or missing specific per capita in high freq
        "GDP_PPP": "PPPGDPEUA", # World Bank Annual usually
        "TRADE_BALANCE": "BOPGSTEZM", # Balance of payments
        "GOVT_DEBT": "GFDGDPE19" # Debt to GDP
    },
    "China": { 
        "GDP": "CHNGDPNQDSMEI", 
        "CPI": "CHNCPIALLMINMEI", 
        "UNEMPLOYMENT": "LMUNRRTTCNM156S", 
        "INTEREST_RATE": "INTDSRCNM193N",
        "GDP_PER_CAPITA": "MKTGDPCNKA646NWDB", # World Bank Annual
        "GDP_PPP": "PPPGDPCNA",
        "TRADE_BALANCE": "XTEXVA01CNM667S", # Exports vs Imports check needed
        "GOVT_DEBT": "GGXWDG_NGDP_CHN" # IMF data via FRED often available
    },
    "Germany": { 
        "GDP": "CLVMNACSCAB1GQDE", 
        "CPI": "DEUCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTDEM156S", 
        "INTEREST_RATE": "IRSTCI01DEM156N",
        "GDP_PER_CAPITA": "DEUGDPPCAP",
        "GDP_PPP": "PPPGDPDEA",
        "TRADE_BALANCE": "BOPGSTDEM",
        "GOVT_DEBT": "BPGDDT01DEA188N"
    },
    "Japan": { 
        "GDP": "JPNRGDPEXP", 
        "CPI": "JPNCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTJPM156S", 
        "INTEREST_RATE": "IRSTCI01JPM156N",
        "GDP_PER_CAPITA": "JPNGDPPCAP",
        "GDP_PPP": "PPPGDPJPA",
        "TRADE_BALANCE": "BOPGSTJPM",
        "GOVT_DEBT": "GGXWDG_NGDP_JPN"
    },
    "UK": { 
        "GDP": "UKNGDP", 
        "CPI": "GBRCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTGBM156S", 
        "INTEREST_RATE": "IRSTCI01GBM156N",
        "GDP_PER_CAPITA": "UKGDPPCAP",
        "GDP_PPP": "PPPGDPGBA",
        "TRADE_BALANCE": "BOPGSTGBM",
        "GOVT_DEBT": "BPGDDT01GBA188N"
    },
    "France": { 
        "GDP": "CLVMNACSCAB1GQFR", 
        "CPI": "FRACPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTFRM156S", 
        "INTEREST_RATE": "IRSTCI01FRM156N",
        "GDP_PER_CAPITA": "FRAGDPPCAP",
        "GDP_PPP": "PPPGDPFRA",
        "TRADE_BALANCE": "BOPGSTFRM",
        "GOVT_DEBT": "BPGDDT01FRA188N"
    },
    "Italy": { 
        "GDP": "CLVMNACSCAB1GQIT", 
        "CPI": "ITACPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTITM156S", 
        "INTEREST_RATE": "IRSTCI01ITM156N",
        "GDP_PER_CAPITA": "ITAGDPPCAP",
        "GDP_PPP": "PPPGDPITA",
        "TRADE_BALANCE": "BOPGSTITM",
        "GOVT_DEBT": "BPGDDT01ITA188N"
    },
    "Spain": { 
        "GDP": "CLVMNACSCAB1GQES", 
        "CPI": "ESPCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTESM156S", 
        "INTEREST_RATE": "IRSTCI01ESM156N",
        "GDP_PER_CAPITA": "ESPGDPPCAP",
        "GDP_PPP": "PPPGDPESA",
        "TRADE_BALANCE": "BOPGSTESM",
        "GOVT_DEBT": "BPGDDT01ESA188N"
    },
    "Brazil": { 
        "GDP": "BRAGDPNQDSMEI", 
        "CPI": "BRACPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTBRA156S", 
        "INTEREST_RATE": "INTDSRBRM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDBRA", # World Bank
        "GDP_PPP": "PPPGDPBRA",
        "TRADE_BALANCE": "BOPGSTBRM",
        "GOVT_DEBT": "GGXWDG_NGDP_BRA"
    },
    "India": { 
        "GDP": "INDGDPNQDSMEI", 
        "CPI": "INDCPIALLMINMEI", 
        "UNEMPLOYMENT": "SLUEM1524ZSIND", 
        "INTEREST_RATE": "INTDSRINM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDIND", 
        "GDP_PPP": "PPPGDPINA",
        "TRADE_BALANCE": "BOPGSTINM", # Check availability
        "GOVT_DEBT": "GGXWDG_NGDP_IND"
    },
    "Canada": { 
        "GDP": "CANGDPNQDSMEI", 
        "CPI": "CANCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTCAM156S", 
        "INTEREST_RATE": "IRSTCI01CAM156N",
        "GDP_PER_CAPITA": "CANSGDPPCAP",
        "GDP_PPP": "PPPGDPCAA",
        "TRADE_BALANCE": "BOPGSTCAM",
        "GOVT_DEBT": "GGXWDG_NGDP_CAN"
    },
    "South Korea": { 
        "GDP": "KORGDPNQDSMEI", 
        "CPI": "KORCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTKRM156S", 
        "INTEREST_RATE": "INTDSRKRM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDKOR",
        "GDP_PPP": "PPPGDPKRA",
        "TRADE_BALANCE": "BOPGSTKRM",
        "GOVT_DEBT": "GGXWDG_NGDP_KOR"
    },
    "Australia": { 
        "GDP": "AUSGDPNQDSMEI", 
        "CPI": "AUSCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTAUM156S", 
        "INTEREST_RATE": "IRSTCI01AUM156N",
        "GDP_PER_CAPITA": "AUSGDPPCAP",
        "GDP_PPP": "PPPGDPAUA",
        "TRADE_BALANCE": "BOPGSTAUM",
        "GOVT_DEBT": "GGXWDG_NGDP_AUS"
    },
    "Mexico": { 
        "GDP": "MEXGDPNQDSMEI", 
        "CPI": "MEXCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTMXM156S", 
        "INTEREST_RATE": "INTDSRMXM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDMEX",
        "GDP_PPP": "PPPGDPMXA",
        "TRADE_BALANCE": "BOPGSTMXM",
        "GOVT_DEBT": "GGXWDG_NGDP_MEX"
    },
    "Indonesia": { 
        "GDP": "IDNGDPNQDSMEI", 
        "CPI": "IDNCPIALLMINMEI", 
        "UNEMPLOYMENT": "SLUEM1524ZSIDN", 
        "INTEREST_RATE": "INTDSRIDM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDIDN",
        "GDP_PPP": "PPPGDPIDA",
        "TRADE_BALANCE": "BOPGSTIDM",
        "GOVT_DEBT": "GGXWDG_NGDP_IDN"
    },
    "Turkey": { 
        "GDP": "TURGDPNQDSMEI", 
        "CPI": "TURCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTTUM156S", 
        "INTEREST_RATE": "INTDSRTUM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDTUR",
        "GDP_PPP": "PPPGDPTUA",
        "TRADE_BALANCE": "BOPGSTTUM",
        "GOVT_DEBT": "GGXWDG_NGDP_TUR"
    },
    "Saudi Arabia": { 
        "GDP": "SAUGDPNQDSMEI", 
        "CPI": "SAUCPIALLMINMEI", 
        "UNEMPLOYMENT": "SLUEM1524ZSSAU", 
        "INTEREST_RATE": "INTDSRSAM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDSAU",
        "GDP_PPP": "PPPGDPSAA",
        "TRADE_BALANCE": "BOPGSTSAM",
        "GOVT_DEBT": "GGXWDG_NGDP_SAU"
    },
    "South Africa": { 
        "GDP": "ZAFGDPNQDSMEI", 
        "CPI": "ZAFCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTZAM156S", 
        "INTEREST_RATE": "INTDSRZAM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDZAF",
        "GDP_PPP": "PPPGDPZAA",
        "TRADE_BALANCE": "BOPGSTZAM",
        "GOVT_DEBT": "GGXWDG_NGDP_ZAF"
    },
    "Russia": { 
        "GDP": "RUSGDPNQDSMEI", 
        "CPI": "RUSCPIALLMINMEI", 
        "UNEMPLOYMENT": "LRHUTTTTRUM156S", 
        "INTEREST_RATE": "INTDSRRUM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDRUS",
        "GDP_PPP": "PPPGDPRUA",
        "TRADE_BALANCE": "BOPGSTRUM",
        "GOVT_DEBT": "GGXWDG_NGDP_RUS"
    },
    "Argentina": { 
        "GDP": "ARGGDPNQDSMEI", 
        "CPI": "ARGCPIALLMINMEI", 
        "UNEMPLOYMENT": "SLUEM1524ZSARG", 
        "INTEREST_RATE": "INTDSRARM193N",
        "GDP_PER_CAPITA": "NYGDPPCAPKDARG",
        "GDP_PPP": "PPPGDPARA",
        "TRADE_BALANCE": "BOPGSTARM",
        "GOVT_DEBT": "GGXWDG_NGDP_ARG"
    }
}

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, cors=cors_config)
def fetch_macro_data(request: https_fn.CallableRequest):
    """
    Obtiene datos macroeconómicos de FRED para países e indicadores seleccionados.
    Incluye caché en Firestore por 24h.
    """
    # 1. SETUP & IMPORTS SEGURIZADOS
    try:
        from fredapi import Fred
        import pandas as pd
        from datetime import datetime
        
        # 'firestore' se importa a nivel global en este archivo (from firebase_admin import firestore)
        # Inicializamos el cliente.
        db = firestore.client()
    except ImportError as e:
        return {"error": f"Import Error (Missing Library): {str(e)}"}
    except Exception as e:
        return {"error": f"Initialization Error: {str(e)}"}

    # 2. LÓGICA PRINCIPAL
    try:
        # Intento de obtener API Key de diversas fuentes de entorno
        api_key = os.environ.get('FRED_API_KEY') or os.environ.get('fred.key')
        
        # DEBUG: Imprimir claves de entorno disponibles
        # print(f"DEBUG keys: {[k for k in os.environ.keys() if 'KEY' in k or 'fred' in k.lower()]}")

        if not api_key:
             return {"error": "FRED API Key not configured in environment (checked FRED_API_KEY and fred.key)"}

        fred = Fred(api_key=api_key)
        
        # Obtener datos del request
        req_data = request.data if request.data else {}
        countries = req_data.get('countries', [])
        indicators = req_data.get('indicators', [])
        start_date_str = req_data.get('start_date') # YYYY-MM-DD
        
        results = {
            "chart_series": {},
            "table_data": []
        }
        
        now = datetime.now()
        
        # Lógica de fecha de inicio
        if start_date_str:
            try:
                datetime.strptime(start_date_str, '%Y-%m-%d')
                observation_start = start_date_str
            except:
                observation_start = f"{now.year - 10}-01-01"
        else:
            observation_start = f"{now.year - 10}-01-01"
        
        for country in countries:
            if country not in FRED_MAPPING:
                continue
                
            country_table_row = {"country": country}
            
            for indicator in indicators:
                if indicator not in FRED_MAPPING[country]:
                    continue
                
                series_id = FRED_MAPPING[country][indicator]
                cache_key = f"{country}_{indicator}".replace(" ", "_").upper()
                
                # 1. Verificar Caché en Firestore
                data_series = None
                try:
                    cache_ref = db.collection('macro_cache').document(cache_key)
                    cache_doc = cache_ref.get()
                    if cache_doc and cache_doc.exists:
                        cache_data = cache_doc.to_dict()
                        last_updated = cache_data.get('last_updated')
                        # Validar caducidad (24h)
                        if last_updated:
                            # Asegurar que es datatime
                            try:
                                ts = last_updated.timestamp()
                                now_ts = now.timestamp()
                                if (now_ts - ts) < 86400:
                                    data_series = pd.Series(cache_data['data'], index=pd.to_datetime(cache_data['index']))
                            except:
                                pass # Error timestamp, se descarga de nuevo
                except Exception as e:
                    print(f"Firestore Cache Error (Ignored): {e}")
                    # Continuamos sin caché

                # 2. Si no hay caché o es viejo, descargar de FRED
                if data_series is None:
                    try:
                        print(f"Fetching from FRED: {series_id}")
                        data_series = fred.get_series(series_id, observation_start=observation_start)
                        # Guardar en caché (Async best effort, no await en python sync)
                        try:
                            cache_ref.set({
                                'data': data_series.tolist(),
                                'index': [i.strftime('%Y-%m-%d') for i in data_series.index],
                                'last_updated': firestore.SERVER_TIMESTAMP
                            })
                        except:
                            pass
                    except Exception as e:
                        print(f"❌ Error descargando FRED {series_id}: {e}")
                        # Intentar seguir con otros
                        continue

                # 3. Procesamiento
                if data_series is not None and not data_series.empty:
                    # Chart
                    results["chart_series"][f"{country} - {indicator}"] = [
                        {"x": d.strftime('%Y-%m-%d'), "y": round(float(v), 2)} 
                        for d, v in data_series.items() if pd.notna(v)
                    ]
                    
                    # Table
                    try:
                        resampled = data_series.resample('YE').last()
                    except:
                        try:
                            resampled = data_series.resample('A').last()
                        except:
                            resampled = pd.Series()

                    for date_idx, val in resampled.items():
                        year_val = date_idx.year
                        val_num = round(float(val), 2) if pd.notna(val) else None
                        
                        if 2021 <= year_val < now.year:
                            country_table_row[f"{indicator}_{year_val}"] = val_num
                        elif year_val == now.year:
                            country_table_row[f"{indicator}_YTD"] = val_num

            results["table_data"].append(country_table_row)

        return results
        
    except Exception as e:
        import traceback
        # Retornamos el error como JSON 200 para verlo en el frontend en lugar de un 500 opaco
        return {"error": f"Unhandled Runtime Error: {str(e)}"}
