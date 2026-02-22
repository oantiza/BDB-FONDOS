import os
import sys

# Asegurar que el script puede importar desde functions_python
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from firebase_admin import credentials, initialize_app, firestore
from services.research import generate_weekly_strategy_report

print("Iniciando inyección manual del Informe Macro...")

# Inicializar Firebase con las credenciales por defecto de la terminal de GCP
try:
    initialize_app()
    db = firestore.client()
    print("Conexión a Firestore establecida.")
except Exception as e:
    print(f"Error conectando a Firebase: {e}")
    sys.exit(1)

# Forzar la generación saltándose el Cron
try:
    print("El cerebro de Gemini está analizando internet... (Este proceso tardará unos 30-40 segundos)")
    resultado = generate_weekly_strategy_report(db)
    
    if resultado.get('success'):
        print("✅ ¡Éxito! El Nuevo Informe con los 8 KPIs ha sido generado y guardado en tu base de datos.")
        print("Ve a la aplicación de React y recarga la página para visualizarlo.")
    else:
        print(f"❌ Fallo al generar: {resultado.get('error')}")
except Exception as e:
    print(f"Error inesperado durante la ejecución: {e}")
