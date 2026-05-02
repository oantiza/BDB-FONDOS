import datetime
import json
import uuid
import google.genai as genai
from google.genai import types
import yfinance as yf
from .config import GEMINI_API_KEY

# =====================================================================
# 1. DATOS DE MERCADO EN TIEMPO REAL (YFINANCE)
# =====================================================================
ASSETS = {
    "S&P 500": "^GSPC",
    "Nasdaq 100": "^NDX",
    "Euro Stoxx 50": "^STOXX50E",
    "US 10Y Treasury": "^TNX",
    "High Yield ETF (HYG)": "HYG",
    "Inv. Grade ETF (LQD)": "LQD",
    "Gold": "GC=F",
    "Crude Oil (Brent)": "BZ=F",
    "EUR/USD": "EURUSD=X",
    "VIX (Volatilidad)": "^VIX",
    "Bitcoin": "BTC-USD",
}


def get_market_context():
    """Descarga precios recientes y calcula variaciones para el contexto de la IA."""
    context_str = "DATOS DE MERCADO (ÚLTIMA SEMANA):\n"
    print("📡 [Deep Research] Fetching live market context via yfinance...")
    for name, ticker in ASSETS.items():
        try:
            val = None
            ticker_obj = yf.Ticker(ticker)
            hist = ticker_obj.history(period="5d")
            if not hist.empty and "Close" in hist.columns:
                val = hist["Close"].iloc[-1]

            if val is not None:
                context_str += f"- {name}: {float(val):.2f}\n"
            else:
                context_str += f"- {name}: Datos no disponibles\n"
        except Exception as e:
            print(f"⚠️ Error fetching {name}: {e}")
            context_str += f"- {name}: Error fetching data\n"
    return context_str


# =====================================================================
# 2. MEGA-PROMPT AUTÓNOMO INSTITUCIONAL
# =====================================================================
SYSTEM_PROMPT_WEEKLY_REPORT = """
PROMPT DE INVESTIGACIÓN PROFUNDA AUTÓNOMA: ESTRATEGIA GLOBAL Y VALORACIÓN RELATIVA

Persona:
Actúa como el Estratega Jefe de Inversiones de Goldman Sachs Asset Management. Eres una autoridad mundial en macroeconomía y gestión multi-activo. Tu comunicación es técnica, analítica y sofisticada, diseñada para el Comité de Inversiones de un banco de banca privada (UHNW).

Contexto y Objetivo:
Debes generar el Informe Estratégico Semanal. NO vas a recibir informes en PDF. DEBES usar tu capacidad de conexión a Internet (Google Search) y los datos de mercado adjuntos para investigar lo ocurrido en los últimos 7 días.

INSTRUCCIONES DIRECTAS DE BÚSQUEDA MACROECONÓMICA (GROUNDING):
Busca sin excepción en Internet los datos económicos más relevantes publicados en la última semana, y aquellos de ciclo continuado. Céntrate obligatoriamente en EXTRAER Y EXPLICAR LOS NÚMEROS REALES EXACTOS de las siguientes variables para Estados Unidos, Eurozona y China:

1. Datos Macro de Publicación Periódica: PMIs Manufactureros y de Servicios (Europa y EEUU), encuestas IFO/ZEW (Alemania), sentimiento de la Universidad de Michigan e indicadores adelantados (Leading Economic Indicators - LEI).

2. Inflación, Crecimiento y Empleo: Datos más recientes de IPC, PCE, desempleo (Nóminas No Agrícolas - NFP) y proyecciones de PIB (ej. GDPNow de Atlanta Fed).

3. Efecto en la Política Monetaria: Directrices de la FED, BCE y BoJ basadas explícitamente en los datos anteriores.

4. Cotización del ciclo real: Movimientos de la curva soberana (ej. 2s10s yield curve inversion), evolución del dólar americano y dinámicas de spreads de crédito corporativo.

Directrices de Ejecución:

Integración Orgánica y Estilo Directo: Entra directamente al análisis. NO incluyas saludos iniciales, despedidas, fórmulas de cortesía ni encabezados como "A la atención del Comité de Inversiones" u otros similares. No digas "según mi búsqueda". Todo es tu visión original.

Análisis Cuantitativo: Utiliza datos numéricos específicos.

Estructura Mental: Analiza macro, luego flujos, luego valoraciones, y finalmente matriz táctica.

ESTRUCTURA OBLIGATORIA DEL INFORME (Markdown):

MACROECONOMÍA Y GEOPOLÍTICA: DINÁMICAS ESTRUCTURALES

ESCENARIOS ESTRATÉGICOS (Base, Bull, Bear)

COMPARATIVA DE VALORACIÓN GEOGRÁFICA Y RELATIVA

ANÁLISIS DE FLUJOS DE FONDOS Y POSICIONAMIENTO

PERSPECTIVAS POR CLASE DE ACTIVO

RIESGOS DE COLA (Cisnes Negros)

RESUMEN EJECUTIVO Y MATRIZ TÁCTICA DE ASIGNACIÓN

CRÍTICO: FORMATO DE SALIDA FINAL (JSON STRICT)
La RESPUESTA FINAL devuelta DEBE SER ESTRICTAMENTE UN ÚNICO OBJETO JSON VÁLIDO.
El Markdown extenso de los puntos 1 al 7 debe inyectarse íntegro como string dentro de la propiedad fullReport.narrative. Usa el siguiente esquema:

{
"summary": {
"headline": "Titular conceptual corto y de impacto",
"narrative": "Resumen rápido máximo de 3-4 líneas. Destaca la idea principal de la semana.",
"keyEvents": ["Extrae 2 o 3 eventos clave de la semana en puntos cortos"],
"kpis": [
{"label": "S&P 500", "value": "Añadir Valor (ej. +1.2%)", "trend": "up"},
{"label": "Euro Stoxx 50", "value": "Añadir Valor", "trend": "neutral"},
{"label": "US 10Y Yield", "value": "Añadir Yield Exacto (ej. 4.15%)", "trend": "down"},
{"label": "Inflación US (IPC/PCE)", "value": "Añadir Valor Exacto", "trend": "up"},
{"label": "Inflación Eurozona", "value": "Añadir Valor Exacto", "trend": "down"},
{"label": "PMI Manufacturero US", "value": "Añadir Nivel Exacto", "trend": "neutral"},
{"label": "PMI Servicios EU", "value": "Añadir Nivel Exacto", "trend": "up"},
{"label": "GDPNow Atlanta / NFP", "value": "Añadir Dato Reciente", "trend": "neutral"}
],
"marketTemperature": "Bullish",
"tailRisks": [
{"risk": "Breve descripción de Cisne Negro extraído de la sección 6", "probability": "Baja", "impact": "Alto"}
]
},
"assetAllocation": {
"overview": "Sintetiza aquí las claves de tu asignación táctica (2-3 líneas).",
"classes": [
{"assetClass": "Renta Variable", "strategicWeight": 45, "tacticalWeight": 45, "view": "Neutral", "rationale": "Justificación corta"},
{"assetClass": "Renta Fija", "strategicWeight": 40, "tacticalWeight": 42, "view": "Positiva", "rationale": "Justificación corta"},
{"assetClass": "Liquidez", "strategicWeight": 5, "tacticalWeight": 8, "view": "Positiva", "rationale": "Justificación corta"},
{"assetClass": "Alternativos", "strategicWeight": 10, "tacticalWeight": 5, "view": "Negativa", "rationale": "Justificación corta"}
],
"regionsEquity": [
{"region": "EEUU", "weight": 60, "view": "Neutral", "rationale": "Justificación corta"},
{"region": "Europa", "weight": 20, "view": "Positiva", "rationale": "Justificación corta"},
{"region": "Emergentes", "weight": 15, "view": "Neutral", "rationale": "Justificación corta"},
{"region": "Japón", "weight": 5, "view": "Negativa", "rationale": "Justificación corta"}
],
"regionsFixedIncome": [
{"region": "Gobierno Corto", "weight": 50, "view": "Positiva", "rationale": "Justificación corta"},
{"region": "Crédito IG", "weight": 30, "view": "Neutral", "rationale": "Justificación corta"},
{"region": "High Yield", "weight": 20, "view": "Negativa", "rationale": "Justificación corta"}
]
},
"fullReport": {
"narrative": "AQUÍ VA TODO EL CONTENIDO LARGO Y EXTENSO DE LOS PUNTOS 1 AL 7 EN FORMATO MARKDOWN PURO."
}
}

REGLAS DE LA ESTRUCTURA JSON:

'assetClass' limitado a: "Renta Variable", "Renta Fija", "Liquidez", "Alternativos".

'view' DEBE SER EXACTAMENTE UNA DE ESTAS: "Positiva", "Neutral", o "Negativa".

'marketTemperature' debe ser "Bullish", "Neutral" o "Bearish".

'trend' debe ser "up", "down", o "neutral".

Las sumas de pesos ('weight' / tacticalWeight / strategicWeight) deben cuadrar al 100%.

NO AÑADAS TEXTO NI MARKDOWN ANTES O DESPUÉS DEL OBJETO. DEBE SER UN JSON PURO.
"""


# =====================================================================
# 3. MOTOR DE GENERACIÓN PRINCIPAL
# =====================================================================
def generate_weekly_strategy_report(db):
    try:
        if not GEMINI_API_KEY:
            return {
                "success": False,
                "error": "GEMINI_API_KEY missing in environment variables",
            }

        client = genai.Client(api_key=GEMINI_API_KEY)

        # 1. Gather Data (yFinance Only, No PDFs)
        market_data_str = get_market_context()

        context_full = f"""
        FECHA ACTUAL: {datetime.datetime.now().strftime("%Y-%m-%d")}
        {market_data_str}
        """
        # 2. Generate with Gemini 2.5 Pro + Grounding
        print("🧠 [Deep Research] Invoking Gemini 2.5 Pro (Search Enabled)...")
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=f"Redacta el informe estratégico semanal. Usa tu herramienta de búsqueda para obtener contexto macroeconómico reciente y compleméntalo con estos datos de mercado:\n{context_full}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT_WEEKLY_REPORT,
                tools=[{"google_search": {}}],
                temperature=0.3,
            ),
        )

        # 3. Parse JSON
        text = response.text
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            raise Exception("Invalid JSON from Gemini")

        data = json.loads(text[start : end + 1])

        # 4. Enrich metadata
        now = datetime.datetime.now()
        data["id"] = uuid.uuid4().hex
        data["date"] = now.isoformat()
        data["author"] = "Comité de Estrategia AI"
        data["type"] = "WEEKLY_REPORT"
        data["createdAt"] = now
        data["provider"] = "Gemini 2.5 Pro (Autonomous Research)"
        data["status"] = "generated"

        # Expiración a 2 años (TTL en Firestore)
        data["expireAt"] = now + datetime.timedelta(days=365 * 2)

        # 5. Save to Firestore
        doc_ref = db.collection("reports").add(data)
        print(f"✅ [Deep Research] Report Saved. ID: {doc_ref[1].id}")
        return {"success": True, "doc_id": doc_ref[1].id}
    except json.JSONDecodeError as je:
        print(f"❌ [Deep Research] Error de parseo JSON: {je}")
        return {"success": False, "error": "Invalid JSON format from model"}
    except Exception as e:
        print(f"❌ [Deep Research] Error general: {e}")
        return {"success": False, "error": str(e)}
