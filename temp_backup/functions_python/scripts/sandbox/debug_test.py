import os
import sys

# Añadir el path para importar servicios
sys.path.append(os.path.join(os.getcwd(), "functions_python"))

from services.backtester import run_backtest
import firebase_admin
from firebase_admin import firestore


def debug_metrics():
    # 1. Inicializar Firebase Admin (Manual para emulador)
    if not firebase_admin._apps:
        # Para el emulador no necesitamos credenciales reales
        os.environ["FIRESTORE_EMULATOR_HOST"] = os.environ.get(
            "FIRESTORE_EMULATOR_HOST", "localhost:8080"
        )
        firebase_admin.initialize_app(
            options={
                "projectId": "bdb-fondos",
            }
        )

    db = firestore.client()

    # 2. Definir una cartera de prueba (ISINs comunes)
    test_portfolio = [
        {"isin": "ES0113906007", "weight": 60},  # Fonditel Mixto
        {"isin": "ES0159039036", "weight": 40},  # Magallanes Iberian
    ]

    print(f"🚀 Iniciando debug de backtest para: {[p['isin'] for p in test_portfolio]}")

    # 3. Ejecutar run_backtest
    try:
        result = run_backtest(test_portfolio, "3y", db)

        if "error" in result:
            print(f"❌ Error en backtest: {result['error']}")
        else:
            print("✅ Backtest completado con éxito.")
            metrics = result.get("metrics", {})
            print(f"📊 Métricas obtenidas: {metrics}")

            # Verificar si las series tienen datos
            port_series = result.get("portfolioSeries", [])
            print(f"📈 Puntos en la serie de cartera: {len(port_series)}")

            if len(port_series) > 0:
                print(f"📍 Primer punto: {port_series[0]}")
                print(f"📍 Último punto: {port_series[-1]}")
            else:
                print("⚠️ La serie de la cartera está VACÍA.")

    except Exception as e:
        print(f"💥 Excepción fatal: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    # Asegurarse de que el entorno apunte al emulador si es necesario
    os.environ["FIRESTORE_EMULATOR_HOST"] = os.environ.get(
        "FIRESTORE_EMULATOR_HOST", "localhost:8080"
    )
    debug_metrics()
