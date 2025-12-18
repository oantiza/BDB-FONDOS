from firebase_admin import firestore, initialize_app, credentials
import datetime

# Initialize Firebase (Assuming local credential file or default behavior)
try:
    initialize_app()
except ValueError:
    pass # Already initialized

db = firestore.client()

def create_report(report_type):
    data = {
        'type': report_type,
        'date': datetime.datetime.now().strftime("%Y-%m-%d"),
        'createdAt': datetime.datetime.now(),
        'executive_summary': 'Para julio de 2025, el entorno de inversión se caracteriza por una mezcla de cautela persistente y oportunidades emergentes. La inflación, aunque con signos de moderación en algunas economías desarrolladas, sigue siendo un factor clave, dictando las acciones futuras de los bancos centrales. Las tensiones geopolíticas continúan añadiendo volatilidad, mientras que la rápida evolución tecnológica, especialmente en Inteligencia Artificial, presenta un potencial de crecimiento significativo. Nuestra estrategia se orienta hacia la resiliencia del portafolio, priorizando la calidad, el crecimiento secular y una asignación táctica para capitalizar disrupciones tecnológicas y protegerse contra la incertidumbre macroeconómica.',
        'marketSentiment': "Neutral a Cautelosamente Optimista",
        'thesis': {'title': 'Volatilidad Táctica'} if report_type == 'WEEKLY_MACRO' else None,
        'keyDrivers': [
            {'title': 'Inflación', 'impact': 'Trayectoria de la inflación global y las decisiones de política monetaria.'},
            {'title': 'Tecnología', 'impact': 'Impacto de la Inteligencia Artificial en la productividad empresarial.'},
            {'title': 'Política', 'impact': 'Resultados de las elecciones clave a nivel global.'},
            {'title': 'Ganancias', 'impact': 'Desempeño de las ganancias corporativas y resiliencia.'},
            {'title': 'Geopolítica', 'impact': 'Evolución de las tensiones geopolíticas.'}
        ],
        'model_portfolio': [
            {'asset_class': 'Renta Variable Global', 'region': 'DM', 'view': 'Sobreponderar', 'weight': 30, 'conviction': 4, 'rationale': 'Calidad, empresas con ventajas competitivas y crecimiento de dividendos sostenible.'},
            {'asset_class': 'Renta Variable Emergente', 'region': 'EM', 'view': 'Neutral', 'weight': 10, 'conviction': 3, 'rationale': 'Selección estratégica en países con sólidas perspectivas de crecimiento.'},
            {'asset_class': 'Renta Fija', 'region': 'Global', 'view': 'Neutral', 'weight': 25, 'conviction': 4, 'rationale': 'Preservación de capital, liquidez y generación de ingresos.'},
            {'asset_class': 'Activos Alternativos', 'region': 'Global', 'view': 'Sobreponderar', 'weight': 10, 'conviction': 4, 'rationale': 'Diversificación, cobertura contra la inflación y valor intrínseco.'},
            {'asset_class': 'Capital Privado', 'region': 'Global', 'view': 'Neutral', 'weight': 5, 'conviction': 3, 'rationale': 'Inversiones selectivas en fondos enfocados en tecnología disruptiva.'},
            {'asset_class': 'TIPS', 'region': 'Global', 'view': 'Sobreponderar', 'weight': 5, 'conviction': 4, 'rationale': 'Cobertura proactiva contra la persistencia de la inflación.'},
            {'asset_class': 'Efectivo', 'region': 'Global', 'view': 'Infraponderar', 'weight': 15, 'conviction': 2, 'rationale': 'Flexibilidad táctica para aprovechar oportunidades.'}
        ] if report_type == 'MONTHLY_PORTFOLIO' else []
    }
    
    db.collection('analysis_results').add(data)
    print(f"✅ Created {report_type} report.")


if __name__ == "__main__":
    print("Inyectando informes de prueba...")
    create_report('MONTHLY_PORTFOLIO')
    create_report('WEEKLY_MACRO')
    print("Done.")
