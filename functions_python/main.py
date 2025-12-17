from firebase_functions import https_fn, options
from firebase_admin import initialize_app, firestore, storage
from services.config import BUCKET_NAME

# Inicialización básica
initialize_app()

# Configuración CORS Permisiva
cors_config = options.CorsOptions(cors_origins="*", cors_methods=["GET", "POST", "OPTIONS"])

# ==========================================
# ENDPOINTS
# ==========================================

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getMarketIndex(request: https_fn.CallableRequest):
    from services.market import get_market_index
    symbol = request.data.get('symbol', 'GSPC.INDX')
    range_val = request.data.get('range', '1y')
    return get_market_index(symbol, range_val)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getYieldCurve(request: https_fn.CallableRequest):
    from services.market import get_yield_curve
    region = request.data.get('region', 'US')
    return get_yield_curve(region)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1)
def generate_analysis_report(request: https_fn.CallableRequest):
    from services.research import generate_research_report
    
    req_data = request.data
    report_type = req_data.get('type', 'MONTHLY_PORTFOLIO')
    
    db = firestore.client()
    return generate_research_report(report_type, db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=120, cors=cors_config)
def optimize_portfolio_quant(request: https_fn.CallableRequest):
    from services.optimizer import run_optimization
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
        from services.strategies import STRATEGY_CONSTRAINTS
        
        return run_optimization(assets_list, risk_level, db, constraints=STRATEGY_CONSTRAINTS, asset_metadata=asset_metadata)

    except Exception as e:
        print(f"❌ Error CRÍTICO Optimización Endpoint: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=str(e))

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
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

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_2, timeout_sec=120, cors=cors_config)
def backtest_portfolio(request: https_fn.CallableRequest):
    from services.backtester import run_backtest
    data = request.data
    portfolio = data.get('portfolio', [])
    period = data.get('period', '3y')
    
    if not portfolio: return {'error': 'Cartera vacía'}
    
    db = firestore.client()
    return run_backtest(portfolio, period, db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def getFinancialNews(request: https_fn.CallableRequest):
    from services.market import get_financial_news
    query = request.data.get('query', 'general')
    mode = request.data.get('mode', 'general')
    return get_financial_news(query, mode)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=300, cors=cors_config)
def clean_duplicates(request: https_fn.CallableRequest):
    from services.admin import clean_duplicates_logic
    db = firestore.client()
    return clean_duplicates_logic(db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540, cors=cors_config)
def restore_historico(request: https_fn.CallableRequest):
    from services.admin import restore_historico_logic
    db = firestore.client()
    return restore_historico_logic(db)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=540, cors=cors_config)
def analyze_isin_health(request: https_fn.CallableRequest):
    from services.admin import analyze_isin_health_logic
    db = firestore.client()
    bucket = storage.bucket(BUCKET_NAME)
    return analyze_isin_health_logic(db, bucket)

@https_fn.on_call(region="europe-west1", memory=options.MemoryOption.GB_1, timeout_sec=60, cors=cors_config)
def insertMonthlyReport(request: https_fn.CallableRequest):
    """
    Inserts the MONTHLY_PORTFOLIO report to Firestore
    One-time migration from boutique-financiera-app
    """
    import datetime
    db = firestore.client()
    
    monthly_report = {
        'type': 'MONTHLY_PORTFOLIO',
        'date': '2025-12-07',
        'createdAt': datetime.datetime(2025, 12, 7, 23, 29, 1, 991000),
        'executive_summary': 'Para julio de 2025, el entorno de inversión se caracteriza por una mezcla de cautela persistente y oportunidades emergentes. La inflación, aunque con signos de moderación en algunas economías desarrolladas, sigue siendo un factor clave, dictando las acciones futuras de los bancos centrales. Las tensiones geopolíticas continúan añadiendo volatilidad, mientras que la rápida evolución tecnológica, especialmente en Inteligencia Artificial, presenta un potencial de crecimiento significativo. Nuestra estrategia se orienta hacia la resiliencia del portafolio, priorizando la calidad, el crecimiento secular y una asignación táctica para capitalizar disrupciones tecnológicas y protegerse contra la incertidumbre macroeconómica.',
        'keyDrivers': [
            'Trayectoria de la inflación global y las decisiones de política monetaria de los principales bancos centrales (Fed, BCE, BoJ).',
            'Impacto de la Inteligencia Artificial en la productividad empresarial y la valoración de los sectores tecnológicos y no tecnológicos.',
            'Resultados de las elecciones clave a nivel global y sus implicaciones para la política fiscal, el comercio y la regulación.',
            'Desempeño de las ganancias corporativas, con un enfoque en la resiliencia y las revisiones de pronósticos para el segundo semestre de 2025.',
            'Evolución de las tensiones geopolíticas y su efecto en los precios de la energía y las cadenas de suministro.',
            'Salud del mercado laboral y el consumo privado en las economías desarrolladas y emergentes.',
            'Avances y regulaciones en materia de sostenibilidad y transición energética.'
        ],
        'marketSentiment': 'Neutral a Cautelosamente Optimista. La resiliencia económica observada en el primer semestre de 2025, impulsada por mercados laborales robustos y un consumo estable, contrarresta las preocupaciones sobre las futuras tasas de interés y la geopolítica. Sin embargo, la volatilidad impulsada por los informes de ganancias corporativas y los eventos macroeconómicos sugiere que los inversores mantienen una postura vigilante.',
        'model_portfolio': [
            {'assetClass': 'Renta Variable Global (Mercados Desarrollados)', 'allocationPercentage': 30, 'focus': 'Calidad, empresas con ventajas competitivas y crecimiento de dividendos sostenible.'},
            {'assetClass': 'Renta Variable Mercados Emergentes', 'allocationPercentage': 10, 'focus': 'Selección estratégica en países con sólidas perspectivas de crecimiento demográfico y tecnológico.'},
            {'assetClass': 'Renta Fija (Bonos Grado de Inversión, Corto/Medio Plazo)', 'allocationPercentage': 25, 'focus': 'Preservación de capital, liquidez y generación de ingresos, con enfoque en duraciones más cortas.'},
            {'assetClass': 'Activos Alternativos (Inmobiliario vía REITs, Commodities Estratégicas)', 'allocationPercentage': 10, 'focus': 'Diversificación, cobertura contra la inflación y valor intrínseco. Oro y metales industriales.'},
            {'assetClass': 'Capital Privado / Venture Capital', 'allocationPercentage': 5, 'focus': 'Inversiones selectivas en fondos enfocados en tecnología disruptiva (IA, Biotech) y transición energética.'},
            {'assetClass': 'Valores Protegidos contra la Inflación (TIPS)', 'allocationPercentage': 5, 'focus': 'Cobertura proactiva contra la persistencia de la inflación.'},
            {'assetClass': 'Efectivo y Equivalentes', 'allocationPercentage': 15, 'focus': 'Flexibilidad táctica para aprovechar oportunidades en un mercado volátil y gestionar riesgos.'}
        ]
    }
    
    try:
        doc_ref = db.collection('analysis_results').add(monthly_report)
        return {'success': True, 'message': 'Report inserted successfully', 'doc_id': doc_ref[1].id}
    except Exception as e:
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL, message=str(e))
