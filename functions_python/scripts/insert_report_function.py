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
            {
                'assetClass': 'Renta Variable Global (Mercados Desarrollados)',
                'allocationPercentage': 30,
                'focus': 'Calidad, empresas con ventajas competitivas y crecimiento de dividendos sostenible.'
            },
            {
                'assetClass': 'Renta Variable Mercados Emergentes',
                'allocationPercentage': 10,
                'focus': 'Selección estratégica en países con sólidas perspectivas de crecimiento demográfico y tecnológico.'
            },
            {
                'assetClass': 'Renta Fija (Bonos Grado de Inversión, Corto/Medio Plazo)',
                'allocationPercentage': 25,
                'focus': 'Preservación de capital, liquidez y generación de ingresos, con enfoque en duraciones más cortas.'
            },
            {
                'assetClass': 'Activos Alternativos (Inmobiliario vía REITs, Commodities Estratégicas)',
                'allocationPercentage': 10,
                'focus': 'Diversificación, cobertura contra la inflación y valor intrínseco. Oro y metales industriales.'
            },
            {
                'assetClass': 'Capital Privado / Venture Capital',
                'allocationPercentage': 5,
                'focus': 'Inversiones selectivas en fondos enfocados en tecnología disruptiva (IA, Biotech) y transición energética.'
            },
            {
                'assetClass': 'Valores Protegidos contra la Inflación (TIPS)',
                'allocationPercentage': 5,
                'focus': 'Cobertura proactiva contra la persistencia de la inflación.'
            },
            {
                'assetClass': 'Efectivo y Equivalentes',
                'allocationPercentage': 15,
                'focus': 'Flexibilidad táctica para aprovechar oportunidades en un mercado volátil y gestionar riesgos.'
            }
        ]
    }
    
    try:
        # Add to Firestore
        doc_ref = db.collection('analysis_results').add(monthly_report)
        return {
            'success': True,
            'message': 'Report inserted successfully',
            'doc_id': doc_ref[1].id,
            'type': monthly_report['type'],
            'date': monthly_report['date']
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
