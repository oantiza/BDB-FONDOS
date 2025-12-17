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
        'executive_summary': f"Este es un informe generado automáticamente para probar la visualización de {report_type}. El mercado muestra señales mixtas con volatilidad moderada.",
        'marketSentiment': "NEUTRAL",
        'thesis': {'title': 'Volatilidad Táctica'} if report_type == 'WEEKLY_MACRO' else None,
        'keyDrivers': [
            {'title': 'Inflación', 'impact': 'Persistente en servicios, afectando decisiones de tipos.'},
            {'title': 'Crecimiento', 'impact': 'Desaceleración suave en EEUU, debilidad en Europa.'},
            {'title': 'Geopolítica', 'impact': 'Tensiones en Oriente Medio añaden prima de riesgo.'}
        ],
        'model_portfolio': [
             {'asset_class': 'Renta Variable', 'region': 'EEUU', 'view': 'Neutral', 'weight': 45, 'conviction': 3, 'rationale': 'Valoraciones exigentes pero fundamentales sólidos.'},
             {'asset_class': 'Renta Fija', 'region': 'Global', 'view': 'Sobreponderar', 'weight': 30, 'conviction': 4, 'rationale': 'Yields atractivos en tramos cortos.'},
             {'asset_class': 'Activos Reales', 'region': 'Global', 'view': 'Infraponderar', 'weight': 10, 'conviction': 2, 'rationale': 'Sensibilidad a tipos altos.'}
        ] if report_type == 'MONTHLY_PORTFOLIO' else []
    }
    
    db.collection('analysis_results').add(data)
    print(f"✅ Created {report_type} report.")


if __name__ == "__main__":
    print("Inyectando informes de prueba...")
    create_report('MONTHLY_PORTFOLIO')
    create_report('WEEKLY_MACRO')
    print("Done.")
