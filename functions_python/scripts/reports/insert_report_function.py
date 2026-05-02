"""
BDB-FONDOS SCRIPT

STATUS: ACTIVE
CATEGORY: reports
PURPOSE: Utility para insertar reportes vía Cloud Functions/Firebase Admin.
SAFE_MODE: MUTATES_FIRESTORE
RUN: python -m scripts.reports.insert_report_function
"""
"""
Cloud Function to insert the user's report data to Firestore
This runs in the cloud with proper credentials
"""

from firebase_functions import https_fn
from firebase_admin import firestore
import datetime


@https_fn.on_call(region="europe-west1")
def insertMonthlyReport(request: https_fn.CallableRequest):
    """
    Inserts the MONTHLY_PORTFOLIO report from boutique-financiera-app to bdb-fondos
    """
    db = firestore.client()

    # Report data from user
    monthly_report = {
        "type": "MONTHLY_PORTFOLIO",
        "date": "2025-12-07",
        "createdAt": datetime.datetime(2025, 12, 7, 23, 29, 1, 991000),
        "executive_summary": "Para julio de 2025, el entorno de inversiÃ³n se caracteriza por una mezcla de cautela persistente y oportunidades emergentes. La inflaciÃ³n, aunque con signos de moderaciÃ³n en algunas economÃ­as desarrolladas, sigue siendo un factor clave, dictando las acciones futuras de los bancos centrales. Las tensiones geopolÃ­ticas continÃºan aÃ±adiendo volatilidad, mientras que la rÃ¡pida evoluciÃ³n tecnolÃ³gica, especialmente en Inteligencia Artificial, presenta un potencial de crecimiento significativo. Nuestra estrategia se orienta hacia la resiliencia del portafolio, priorizando la calidad, el crecimiento secular y una asignaciÃ³n tÃ¡ctica para capitalizar disrupciones tecnolÃ³gicas y protegerse contra la incertidumbre macroeconÃ³mica.",
        "keyDrivers": [
            "Trayectoria de la inflaciÃ³n global y las decisiones de polÃ­tica monetaria de los principales bancos centrales (Fed, BCE, BoJ).",
            "Impacto de la Inteligencia Artificial en la productividad empresarial y la valoraciÃ³n de los sectores tecnolÃ³gicos y no tecnolÃ³gicos.",
            "Resultados de las elecciones clave a nivel global y sus implicaciones para la polÃ­tica fiscal, el comercio y la regulaciÃ³n.",
            "DesempeÃ±o de las ganancias corporativas, con un enfoque en la resiliencia y las revisiones de pronÃ³sticos para el segundo semestre de 2025.",
            "EvoluciÃ³n de las tensiones geopolÃ­ticas y su efecto en los precios de la energÃ­a y las cadenas de suministro.",
            "Salud del mercado laboral y el consumo privado en las economÃ­as desarrolladas y emergentes.",
            "Avances y regulaciones en materia de sostenibilidad y transiciÃ³n energÃ©tica.",
        ],
        "marketSentiment": "Neutral a Cautelosamente Optimista. La resiliencia econÃ³mica observada en el primer semestre de 2025, impulsada por mercados laborales robustos y un consumo estable, contrarresta las preocupaciones sobre las futuras tasas de interÃ©s y la geopolÃ­tica. Sin embargo, la volatilidad impulsada por los informes de ganancias corporativas y los eventos macroeconÃ³micos sugiere que los inversores mantienen una postura vigilante.",
        "model_portfolio": [
            {
                "assetClass": "Renta Variable Global (Mercados Desarrollados)",
                "allocationPercentage": 30,
                "focus": "Calidad, empresas con ventajas competitivas y crecimiento de dividendos sostenible.",
            },
            {
                "assetClass": "Renta Variable Mercados Emergentes",
                "allocationPercentage": 10,
                "focus": "SelecciÃ³n estratÃ©gica en paÃ­ses con sÃ³lidas perspectivas de crecimiento demogrÃ¡fico y tecnolÃ³gico.",
            },
            {
                "assetClass": "Renta Fija (Bonos Grado de InversiÃ³n, Corto/Medio Plazo)",
                "allocationPercentage": 25,
                "focus": "PreservaciÃ³n de capital, liquidez y generaciÃ³n de ingresos, con enfoque en duraciones mÃ¡s cortas.",
            },
            {
                "assetClass": "Activos Alternativos (Inmobiliario vÃ­a REITs, Commodities EstratÃ©gicas)",
                "allocationPercentage": 10,
                "focus": "DiversificaciÃ³n, cobertura contra la inflaciÃ³n y valor intrÃ­nseco. Oro y metales industriales.",
            },
            {
                "assetClass": "Capital Privado / Venture Capital",
                "allocationPercentage": 5,
                "focus": "Inversiones selectivas en fondos enfocados en tecnologÃ­a disruptiva (IA, Biotech) y transiciÃ³n energÃ©tica.",
            },
            {
                "assetClass": "Valores Protegidos contra la InflaciÃ³n (TIPS)",
                "allocationPercentage": 5,
                "focus": "Cobertura proactiva contra la persistencia de la inflaciÃ³n.",
            },
            {
                "assetClass": "Efectivo y Equivalentes",
                "allocationPercentage": 15,
                "focus": "Flexibilidad tÃ¡ctica para aprovechar oportunidades en un mercado volÃ¡til y gestionar riesgos.",
            },
        ],
    }

    try:
        # Add to Firestore
        doc_ref = db.collection("analysis_results").add(monthly_report)
        return {
            "success": True,
            "message": "Report inserted successfully",
            "doc_id": doc_ref[1].id,
            "type": monthly_report["type"],
            "date": monthly_report["date"],
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

