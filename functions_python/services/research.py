import google.generativeai as genai
from firebase_admin import firestore
import json
import datetime
from .config import GEMINI_API_KEY

SYSTEM_PROMPT_WEEKLY = """
Actúa como un estratega senior de BlackRock. Genera un "Informe Táctico Semanal".
IMPORTANTE: Responde SOLO con JSON válido.

Estructura requerida:
{
  "executive_summary": "Análisis denso y profesional (aprox 150 palabras) sobre tipos, inflación y sentimiento.",
  "marketSentiment": "Bullish / Neutral / Bearish",
  "keyDrivers": [
    {"title": "Driver Principal", "impact": "Impacto detallado en mercados."}
  ],
  "thesis": { 
     "title": "La Oportunidad de la Semana",
     "content": "Detalle de una oportunidad táctica específica."
  }
}
"""

SYSTEM_PROMPT_MONTHLY = """
Actúa como CIO Global. Genera la "Estrategia de Asignación de Activos".
IMPORTANTE: Responde SOLO con JSON válido.
Incluye obligatoriamente estas clases de activos: Renta Variable (EEUU, Europa, Emergentes), Renta Fija (Gobierno), y Crédito (Investment Grade y High Yield).

Estructura requerida:
{
  "executive_summary": "Análisis macroeconómico profundo (mínimo 150 palabras).",
  "marketSentiment": "Cautiously Optimistic / Neutral / Defensive",
  "model_portfolio": [
    { "asset_class": "Renta Variable", "region": "EE.UU.", "weight": 25, "view": "Sobreponderar", "conviction": 4, "rationale": "Fundamentales sólidos..." },
    { "asset_class": "Renta Variable", "region": "Europa", "weight": 15, "view": "Infraponderar", "conviction": 2, "rationale": "Riesgo de estancamiento..." },
    { "asset_class": "Renta Variable", "region": "Emergentes", "weight": 10, "view": "Neutral", "conviction": 3, "rationale": "Valoraciones atractivas pero riesgo FX..." },
    { "asset_class": "Renta Fija", "region": "Bonos Gobierno (10Y)", "weight": 25, "view": "Sobreponderar", "conviction": 5, "rationale": "Protección ante recesión..." },
    { "asset_class": "Crédito", "region": "Investment Grade", "weight": 15, "view": "Neutral", "conviction": 3, "rationale": "Balance riesgo/retorno equilibrado..." },
    { "asset_class": "Crédito", "region": "High Yield", "weight": 5, "view": "Infraponderar", "conviction": 2, "rationale": "Spreads demasiado ajustados para el riesgo de impago actual." },
    { "asset_class": "Alternativos", "region": "Oro/Commodities", "weight": 5, "view": "Sobreponderar", "conviction": 4, "rationale": "Cobertura geopolítica." }
  ],
  "keyDrivers": [
     {"title": "Inflación y Tipos", "impact": "Análisis de la FED/BCE."},
     {"title": "Geopolítica", "impact": "Impacto en energía."}
  ]
}
"""

def generate_research_report(report_type, db):
    try:
        if not GEMINI_API_KEY:
             return {'success': False, 'error': "GEMINI_API_KEY not configured"}

        genai.configure(api_key=GEMINI_API_KEY)
        
        # Select Prompt
        system_instruction = SYSTEM_PROMPT_MONTHLY if report_type == 'MONTHLY_PORTFOLIO' else SYSTEM_PROMPT_WEEKLY
        
        # Model Configuration
        model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=system_instruction) # Fallback to 1.5 if 2.5 not avail in library yet
        
        print(f"Generating {report_type} report with Gemini...")
        
        today_str = datetime.datetime.now().strftime("%Y-%m-%d")
        
        response = model.generate_content(
            f"Fecha del informe: {today_str}. Escribe con tono profesional financiero. JSON puro."
        )
        
        text_response = response.text
        
        # Clean JSON markdown if present
        start = text_response.find('{')
        end = text_response.rfind('}')
        if start == -1 or end == -1:
             raise Exception("Invalid JSON response from AI")
        
        json_str = text_response[start:end+1]
        data = json.loads(json_str)
        
        # Add Metadata
        data['type'] = report_type
        data['date'] = today_str
        data['createdAt'] = datetime.datetime.now()
        
        # Save to Firestore
        db.collection('analysis_results').add(data)
        
        return {'success': True, 'mode': report_type}

    except Exception as e:
        print(f"Error generating report: {e}")
        return {'success': False, 'error': str(e)}
