from firebase_admin import firestore, initialize_app, credentials
import datetime

# Initialize Firebase (Assuming local credential file or default behavior)
try:
    initialize_app()
except ValueError:
    pass # Already initialized

db = firestore.client()

def create_report(report_type):
    # Estructura alineada con MacroReport.ts
    data = {
        'type': 'WEEKLY' if report_type == 'WEEKLY_MACRO' else 'MONTHLY',
        'date': datetime.datetime.now().strftime("%Y-%m-%d"),
        'createdAt': datetime.datetime.now(),
        'title': f"Informe {'Semanal' if report_type == 'WEEKLY_MACRO' else 'Mensual'} - Mercado Global",
        'provider': 'J.P. Morgan Asset Mgmt',
        'market_sentiment': "BULLISH",
        'executive_summary': 'Para julio de 2025, el entorno de inversión se caracteriza por una mezcla de cautela persistente y oportunidades emergentes. La inflación, aunque con signos de moderación en algunas economías desarrolladas, sigue siendo un factor clave, dictando las acciones futuras de los bancos centrales. Las tensiones geopolíticas continúan añadiendo volatilidad, mientras que la rápida evolución tecnológica, especialmente en Inteligencia Artificial, presenta un potencial de crecimiento significativo.',
        
        # DATOS SEMANALES
        'market_pulse': {
            'currencies': {'focus': 'EUR/USD', 'trend': 'BEARISH', 'note': 'El dólar se fortalece ante datos de empleo robustos.'},
            'commodities': {'focus': 'Brent Oil', 'trend': 'BULLISH', 'note': 'Tensiones en Oriente Medio impulsan el barril.'},
            'gold_metals': {'focus': 'Gold', 'trend': 'NEUTRAL', 'note': 'Consolidación tras máximos históricos.'}
        } if report_type == 'WEEKLY_MACRO' else None,
        
        'drivers_calendar': [
            {'day': 'MAR', 'event': 'IPC Estados Unidos', 'impact': 'ALTO'},
            {'day': 'MIE', 'event': 'Reunión FED', 'impact': 'ALTO'},
            {'day': 'JUE', 'event': 'PIB Eurozona', 'impact': 'MEDIO'}
        ] if report_type == 'WEEKLY_MACRO' else None,

        # DATOS MENSUALES
        'investment_thesis': 'Nuestra estrategia se orienta hacia la resiliencia del portafolio, priorizando la calidad, el crecimiento secular y una asignación táctica para capitalizar disrupciones tecnológicas y protegerse contra la incertidumbre macroeconómica. Recomendamos aumentar duración en Renta Fija y mantener exposición a Renta Variable de Calidad (Quality).',
        
        'model_portfolio': [
            {'asset_class': 'Renta Variable Global', 'region': 'DM', 'view': 'Sobreponderar', 'weight': 30, 'rationale': 'Calidad y crecimiento.'},
            {'asset_class': 'Renta Variable Emergente', 'region': 'EM', 'view': 'Neutral', 'weight': 10, 'rationale': 'Oportunidades selectivas.'},
            {'asset_class': 'Renta Fija', 'region': 'Global', 'view': 'Neutral', 'weight': 25, 'rationale': 'Preservación de capital.'},
            {'asset_class': 'Activos Alternativos', 'region': 'Global', 'view': 'Sobreponderar', 'weight': 10, 'rationale': 'Diversificación.'},
            {'asset_class': 'Capital Privado', 'region': 'Global', 'view': 'Neutral', 'weight': 5, 'rationale': 'Tecnología disruptiva.'},
            {'asset_class': 'TIPS', 'region': 'Global', 'view': 'Sobreponderar', 'weight': 5, 'rationale': 'Cobertura inflación.'},
            {'asset_class': 'Efectivo', 'region': 'Global', 'view': 'Infraponderar', 'weight': 15, 'rationale': 'Liquidez táctica.'}
        ] if report_type == 'MONTHLY_PORTFOLIO' else None
    }
    
    # IMPORTANTE: Escribir en la colección 'reports' que lee el frontend
    db.collection('reports').add(data)
    print(f"✅ Created {report_type} report in 'reports' collection.")


if __name__ == "__main__":
    print("Inyectando informes de prueba compatibles con MacroDashboard...")
    create_report('MONTHLY_PORTFOLIO')
    create_report('WEEKLY_MACRO')
    print("Done.")
