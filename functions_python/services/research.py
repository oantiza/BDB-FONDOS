
import datetime
import json
import logging
import google.generativeai as genai
import yfinance as yf
from .config import GEMINI_API_KEY, BUCKET_NAME
from firebase_admin import storage
from .pdf_generator import generate_pdf_from_data
import uuid

SYSTEM_PROMPT_STRATEGY = """
Rol: Actúa como un Director de Estrategia de Inversiones Senior y experto en Diseño de Interfaz de Usuario (UI) para banca privada de alto nivel.
Tu especialidad es comunicar datos financieros complejos de forma visual, minimalista y sofisticada.

Contexto: Soy un asesor de carteras y voy a presentar una propuesta de inversión a un cliente Ultra High Net Worth (UHNW).

Tarea: Diseña y estructura una "Matriz de Asignación de Activos Estratégica".

INSTRUCCIONES DE ESTRUCTURA (JSON STRICT):
Debes generar un JSON con la siguiente estructura exacta:

{
  "equity": {
    "geo": [{"name": "EE.UU.", "weight": "X%", "view": "SOBREPONDERAR"}, ...],
    "sectors": [{"name": "Tecnología", "view": "POSITIVO"}, ...]
  },
  "fixed_income": {
    "subsectors": [{"name": "Bonos Gobierno", "view": "NEUTRAL"}, ...],
    "geo": [{"name": "Tesoro USA", "view": "SOBREPONDERAR"}, ...]
  },
  "real_assets": {
    "currencies": [{"name": "USD/EUR", "view": "NEUTRAL"}],
    "commodities": [{"name": "Oro", "view": "POSITIVO"}]
  },
  "house_view_summary": "Resumen ejecutivo de la visión de la casa (2-3 líneas)."
}

Requisitos de Estilo:
- Terminología financiera profesional "Tier-1".
- VISIÓN DE LA CASA: Usa SOLO estos valores para 'view': "POSITIVO", "NEUTRAL", "NEGATIVO", "SOBREPONDERAR", "INFRAPONDERAR".
"""

# Mapeo de Activos para el Contexto
ASSETS = {
    'S&P 500': '^GSPC',
    'Nasdaq 100': '^NDX',
    'Euro Stoxx 50': '^STOXX50E',
    'MSCI Emerging': 'EEM',
    'US 10Y Treasury': '^TNX',
    'US 2Y Treasury': '^IRX',
    'Gold': 'GC=F',
    'Crude Oil (WTI)': 'CL=F',
    'EUR/USD': 'EURUSD=X',
    'USD/JPY': 'JPY=X',
    'Bitcoin': 'BTC-USD'
}

def get_market_context():
    """Descarga precios recientes y calcula variaciones para el contexto de la IA."""
    context_str = "DATOS DE MERCADO (ÚLTIMA SEMANA):\n"
    print("📡 Fetching market context for Strategy Report...")
    for name, ticker in ASSETS.items():
        try:
            # Descargar 5 días de datos
            df = yf.download(ticker, period="5d", progress=False)
            # Minimal check to avoid complex DataFrame errors
            if hasattr(df, 'empty') and not df.empty:
                 # Take last value blindly
                 last_close = df.iloc[-1]
                 # Handle Series vs DataFrame vs Scalar
                 if hasattr(last_close, 'item'): val = last_close.item()
                 elif hasattr(last_close, 'iloc'): val = last_close.iloc[0] # Multicolumn
                 else: val = last_close
                 
                 context_str += f"- {name}: {float(val):.2f}\n"
            else:
                 context_str += f"- {name}: Datos no disponibles\n"
        except Exception as e:
            print(f"⚠️ Error fetching {name}: {e}")
            context_str += f"- {name}: Error fetching data\n"
    return context_str

SYSTEM_PROMPT_ADVANCED = """
Eres Gemini 3 Pro, el analista macroeconómico y estratega jefe más avanzado del mundo.
Tu objetivo es realizar un "DEEP RESEARCH" (Investigación Profunda) para generar Informes de Estrategia de Inversión Global.

IMPORTANTE: TODO EL CONTENIDO GENERADO (Resúmenes, Racionales, Títulos, Análisis) DEBE ESTAR EN RIGUROSO ESPAÑOL.

INSTRUCCIONES ESTRUCTURALES (8 PUNTOS):
Debes analizar y completar EXHAUSTIVAMENTE los siguientes puntos, utilizando los datos de mercado y noticias proporcionados:

(1) INDICADORES MACRO:
    - Analizar PIB, IPC, Empleo, Ventas Minoristas, PMIs.
    - DESTACAR desviaciones frente al consenso de mercado.
    - Comparar principales economías (EE.UU., Eurozona, China).

(2) GEOPOLÍTICA Y TENSIÓN:
    - Investigar eventos recientes que generen volatilidad financiera.
    - Foco específico: Suministro de energía y rutas comerciales.

(3) CATALIZADORES (PRÓXIMA SEMANA/MES):
    - Bancos Centrales (Decisiones de tipos, actas).
    - Subastas de deuda soberana.
    - Resultados corporativos clave.

(4) RÉGIMEN MACRO GLOBAL:
    - Evaluar tendencias de crecimiento y liquidez.
    - Evaluar tendencias de crecimiento y liquidez.
    - DETERMINAR EL ENTORNO: ¿REFLACIÓN? ¿ESTANFLACIÓN? ¿RECESIÓN? ¿CRECIMIENTO ESTABLE?

(5) TENDENCIAS ESTRUCTURALES (Solo para informe MENSUAL, breve en Semanal):
    - Guerras comerciales, Transición energética, Desglobalización.
    - Impacto sectorial.

(6) VISIÓN DE MERCADO (EN LUGAR DE TABLA DETALLADA):
    - Proporciona un resumen narrativo de la asignación.
    - Genera un dato numérico para un gráfico de "Apetito de Riesgo" (0-100).

(7) RIESGOS DE COLA (TAIL RISKS):
    - Identificar eventos de baja probabilidad pero alto impacto para el periodo entrante.

(8) SÍNTESIS INSTITUCIONAL:
    - Tono profesional, directo, de banca de inversión de primer nivel (e.g. Goldman Sachs, JPM).
    - El resultado debe ser accionable.

OUTPUT JSON FORMAT (STRICT):
{
  "title": "Título de Impacto (ej: 'Navigating the Stagflation Trap')",
  "date": "YYYY-MM-DD",
  "regime": "REFLACIÓN" | "ESTANFLACIÓN" | "RECESIÓN" | "CRECIMIENTO ESTABLE",
  "market_sentiment": "ALCISTA" | "BAJISTA" | "NEUTRAL",
  "executive_summary": "Síntesis MUY DETALLADA (400-600 palabras) tipo 'Newsletter Premium'. Debe contar una historia de mercado completa.",
  "macro_analysis": {
    "indicators": "Análisis del punto 1...",
    "central_banks": "Análisis de bancos centrales..."
  },
  "geopolitics": {
    "summary": "Análisis del punto 2...",
    "impact": "Impacto en energía/rutas..."
  },
  "catalysts_next_week": [
    {"day": "LUN/NA", "event": "...", "importance": "HIGH"}
  ],
  "structural_trends": "Análisis del punto 5 (Más detallado si es Mensual)...",
  "asset_allocation_summary": "Resumen narrativo breve de la asignación (sin tabla detallada).",
  "chart_data": {
    "label": "Tendencia de Mercado/Riesgo",
    "value": 75,
    "max": 100,
    "unit": "Índice de Apetito por el Riesgo"
  },
  "tail_risks": [
    {"risk": "...", "probability": "Low", "impact": "High"}
  ]
}
"""

def generate_advanced_report(db, report_type='WEEKLY'):
    try:
        if not GEMINI_API_KEY:
            return {'success': False, 'error': "GEMINI_API_KEY missing"}

        genai.configure(api_key=GEMINI_API_KEY)
        
        # 1. Gather Data
        print("📡 Gathering Advanced Market Data...")
        market_data_str = get_market_context()
        
        from .market import get_financial_news
        news_macro = get_financial_news("inflation", "general")
        news_geo = get_financial_news("geopolitics", "general")
        
        context_full = f"""
        FECHA ACTUAL: {datetime.datetime.now().strftime("%Y-%m-%d")}
        
        {market_data_str}
        
        NOTICIAS RECIENTES (MACRO):
        {json.dumps(news_macro.get('articles', [])[:5])}
        
        NOTICIAS RECIENTES (GEOPOLÍTICA):
        {json.dumps(news_geo.get('articles', [])[:5])}
        """

        # 2. Generate
        print(f"🧠 Invoking Gemini 3 Pro (via 2.0 Flash) for {report_type}...")
        
        # Ajuste dinámico del prompt según tipo
        prompt_used = SYSTEM_PROMPT_ADVANCED
        if report_type == 'MONTHLY':
            prompt_used = prompt_used.replace("CATALIZADORES (PRÓXIMA SEMANA/MES)", "CATALIZADORES (PRÓXIMO MES)")
            prompt_used = prompt_used.replace("catalysts_next_period", "catalysts_next_month")
            prompt_used = prompt_used.replace("breve en Semanal", "detallado en Mensual")

        # Usamos flash por velocidad y capacidad de contexto
        model = genai.GenerativeModel('gemini-2.0-flash-exp', system_instruction=prompt_used)
        
        response = model.generate_content(f"Genera el informe semanal basado en estos datos:\n{context_full}")
        
        # 3. Parse & Save
        text = response.text
        start, end = text.find('{'), text.rfind('}')
        if start == -1 or end == -1: raise Exception("Invalid JSON from Gemini")
        
        data = json.loads(text[start:end+1])
        
        # Enrich metadata
        data['type'] = report_type
        data['createdAt'] = datetime.datetime.now()
        tipo_es = "Mensual" if report_type == 'MONTHLY' else "Semanal"
        data['provider'] = f'Gemini 2.0 Flash (Deep Research {tipo_es})'
        data['status'] = 'generated'
        
        
        # 4. Generate & Upload PDF
        try:
            print("📄 Generating Private Banking PDF...")
            pdf_bytes = generate_pdf_from_data(data)
            
            # Upload to Firebase Storage
            bucket = storage.bucket(BUCKET_NAME)
            blob_name = f"reports/{report_type}_{datetime.datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}.pdf"
            blob = bucket.blob(blob_name)
            blob.upload_from_string(pdf_bytes, content_type='application/pdf')
            blob.make_public()
            
            data['pdfUrl'] = blob.public_url
            print(f"✅ PDF Uploaded: {data['pdfUrl']}")
        except Exception as e_pdf:
            print(f"⚠️ PDF Generation Failed: {e_pdf}")
            # Continue without PDF if fails
        
        # Save
        db.collection('reports').add(data)
        print("✅ Advanced Report Saved.")
        return {'success': True}

    except Exception as e:
        print(f"❌ Research Error: {e}")
        return {'success': False, 'error': str(e)}

def generate_strategy_report(db):
    try:
        if not GEMINI_API_KEY: return {'success': False, 'error': "No API Key"}
        
        genai.configure(api_key=GEMINI_API_KEY)
        market_data_str = get_market_context()
        
        print("🧠 Invoking Gemini 3 Pro (Strategy Mode)...")
        model = genai.GenerativeModel('gemini-2.0-flash-exp', system_instruction=SYSTEM_PROMPT_STRATEGY)
        response = model.generate_content(f"Genera la Matriz Estratégica con estos datos:\n{market_data_str}")
        
        text = response.text
        start, end = text.find('{'), text.rfind('}')
        if start == -1: raise Exception("Invalid JSON")
        
        data = json.loads(text[start:end+1])
        data['type'] = 'STRATEGY'
        data['createdAt'] = datetime.datetime.now()
        data['provider'] = 'Gemini 2.0 Flash (Strategic Allocation)'
        
        db.collection('reports').add(data)
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}


